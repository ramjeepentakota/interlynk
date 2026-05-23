/**
 * useWebRTC - Custom hook for WebRTC peer-to-peer voice and video calls.
 *
 * Responsibilities:
 * - Capture local audio/video from getUserMedia
 * - Create and manage RTCPeerConnection
 * - Send/receive SDP offer/answer and ICE candidates via STOMP WebSocket
 * - Expose local/remote streams and connection state to UI
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { Client } from '@stomp/stompjs';
import { useAuthStore } from '@/store/useAppStore';

// ICE server config. Public STUN lets peers discover their public address, which
// is enough on the same LAN or behind cooperative NATs. Crossing most real
// networks/firewalls (symmetric NAT, corporate proxies) REQUIRES a TURN relay —
// without one the connection ends in "failed" ("Peer connection failed").
//
// Configure a TURN server via env (see frontend/.env.example):
//   VITE_TURN_URLS=turn:turn.example.com:3478,turns:turn.example.com:5349
//   VITE_TURN_USERNAME=<username>
//   VITE_TURN_CREDENTIAL=<password>
// Multiple comma-separated URLs are supported; turns:(TLS) is recommended so the
// relay survives strict firewalls that only allow 443/TLS egress.
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const turnUrls = (env.VITE_TURN_URLS ?? env.VITE_TURN_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (turnUrls.length > 0) {
    servers.push({
      urls: turnUrls,
      username: env.VITE_TURN_USERNAME ?? '',
      credential: env.VITE_TURN_CREDENTIAL ?? '',
    });
  } else {
    console.warn(
      '[WebRTC] No TURN server configured (VITE_TURN_URLS). Calls will only ' +
        'connect between peers on cooperative networks; cross-firewall calls ' +
        'will fail. Configure TURN for production.'
    );
  }
  return servers;
}

const ICE_CONFIG: RTCConfiguration = {
  iceServers: buildIceServers(),
  iceCandidatePoolSize: 10,
};

export type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

interface UseWebRTCOptions {
  roomId: string | number | null;
  targetUserId: string | number | null;
  callType: 'voice' | 'video';
  /** Reference to the global STOMP client (reuse existing connection) */
  stompClient: Client | null;
  isInitiator: boolean; // true = caller (makes offer), false = callee (answers)
}

/** Audio-flow stats sampled from getStats every second. Exposed to the UI so
 *  the user can see whether RTP is actually flowing in each direction —
 *  invaluable for diagnosing one-way audio without DevTools. */
export interface AudioFlow {
  inKbps: number;
  outKbps: number;
  inboundStuck: boolean;  // peer is connected and sending out but receiving nothing
  outboundStuck: boolean; // peer is connected but no outbound audio at all
  /** Local mic audioLevel (0-1) from `media-source` stat. Confirms the mic
   *  is actually capturing audible audio, not just streaming silence frames
   *  (Opus DTX-encoded silence still produces ~5-20 kbps of RTP bytes that
   *  fool a bytes-only diagnostic into thinking audio is fine). */
  localLevel: number;
  /** Remote received audioLevel (0-1) from `inbound-rtp` stat. Confirms the
   *  decoded remote audio has content. If kbps is non-zero but this stays at
   *  0, the peer is sending silence (their mic). If this is non-zero but the
   *  user hears nothing, the bug is in playback (element/output device). */
  remoteLevel: number;
}

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callState: CallState;
  errorMessage: string | null;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  /** Remote peer's self-reported media state, learned via 'media-state' signals
   *  (WebRTC has no built-in way to know the other side muted/turned off video). */
  remoteMuted: boolean;
  remoteVideoOff: boolean;
  remoteScreenSharing: boolean;
  /** Live audio-flow stats — see AudioFlow. */
  audioFlow: AudioFlow;
  /** Request mic/cam permission and capture local media without starting signaling.
   *  Safe to call multiple times — returns the existing stream on subsequent calls. */
  preflightLocalMedia: () => Promise<MediaStream | null>;
  startCall: () => Promise<void>;
  acceptCall: (offer: RTCSessionDescriptionInit) => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  shareScreen: () => Promise<void>;
  stopScreenShare: () => void;
}

/** Resolve the most current STOMP client, falling back to the global one if the
 *  prop was null at mount but became available afterwards. */
function resolveStompClient(prop: Client | null): Client | null {
  if (prop?.connected) return prop;
  const global = (window as { __stompClient?: Client | null }).__stompClient;
  return global?.connected ? global : prop;
}

export function useWebRTC({
  roomId,
  targetUserId,
  callType,
  stompClient,
  isInitiator,
}: UseWebRTCOptions): UseWebRTCReturn {
  const { user } = useAuthStore();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === 'video');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteVideoOff, setRemoteVideoOff] = useState(callType !== 'video');
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
  const [audioFlow, setAudioFlow] = useState<AudioFlow>({ inKbps: 0, outKbps: 0, inboundStuck: false, outboundStuck: false, localLevel: 0, remoteLevel: 0 });

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Live mirrors of our own media state so the signal sender never reads a stale
  // closure value when broadcasting 'media-state' to the peer.
  const isMutedRef = useRef(false);
  const isVideoOnRef = useRef(callType === 'video');
  const isScreenSharingRef = useRef(false);
  // The RTCRtpSender carrying outgoing video (camera for video calls, or a
  // pre-negotiated video transceiver for voice calls). Screen share swaps its
  // track via replaceTrack(), so no renegotiation is ever required.
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  // Camera track set aside while screen sharing, so we can restore it on stop.
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  // Lets the connection-state handler broadcast our media state on connect
  // without creating a dependency cycle with the (later-defined) sender.
  const sendMediaStateRef = useRef<(() => void) | null>(null);
  // Tracks an in-flight getUserMedia so re-renders during the permission prompt
  // never stack a second prompt on top of the first.
  const pendingMediaRef = useRef<Promise<MediaStream> | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const remoteDescriptionSetRef = useRef<boolean>(false);
  // Buffer ICE candidates that arrive before the remote description is set.
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  // Latest props mirrored into refs so the long-lived signal handler always
  // sees current values (effect re-runs would tear down the listener mid-call).
  const roomIdRef = useRef(roomId);
  const targetUserIdRef = useRef(targetUserId);
  const callTypeRef = useRef(callType);
  const stompClientRef = useRef(stompClient);
  const userRef = useRef(user);
  const isInitiatorRef = useRef(isInitiator);

  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { targetUserIdRef.current = targetUserId; }, [targetUserId]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);
  useEffect(() => { stompClientRef.current = stompClient; }, [stompClient]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { isInitiatorRef.current = isInitiator; }, [isInitiator]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const sendSignal = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      const client = resolveStompClient(stompClientRef.current);
      const u = userRef.current;
      const rid = roomIdRef.current;
      const tid = targetUserIdRef.current;
      const ctype = callTypeRef.current;
      if (!client?.connected || !rid || !tid || !u) {
        console.warn('[WebRTC] Cannot send signal — missing prerequisites', {
          hasClient: Boolean(client?.connected),
          rid,
          tid,
          hasUser: Boolean(u),
        });
        return;
      }
      client.publish({
        destination: '/app/call/signal',
        body: JSON.stringify({
          type,
          roomId: Number(rid),
          senderUserId: Number(u.id),
          targetUserId: Number(tid),
          callType: ctype,
          ...payload,
        }),
      });
    },
    []
  );

  // Broadcast our current mic/camera/screen state to the peer. WebRTC gives the
  // far side no signal when we mute or stop video (the track keeps flowing, just
  // silent/black), so we relay it explicitly. The JSON rides in the existing
  // `sdp` pass-through field, which the backend forwards verbatim — no backend
  // change needed.
  const sendMediaState = useCallback(() => {
    sendSignal('media-state', {
      sdp: JSON.stringify({
        muted: isMutedRef.current,
        videoOff: !isVideoOnRef.current,
        screenSharing: isScreenSharingRef.current,
      }),
    });
  }, [sendSignal]);
  useEffect(() => { sendMediaStateRef.current = sendMediaState; }, [sendMediaState]);

  const createPeer = useCallback(() => {
    // Close any existing peer first
    if (peerRef.current) {
      try { peerRef.current.close(); } catch { /* noop */ }
    }

    const peer = new RTCPeerConnection(ICE_CONFIG);
    videoSenderRef.current = null;

    // Intentionally NO pre-added video transceiver here. The previous
    // implementation pre-added a sendrecv video m-line on both sides so screen
    // share could later replaceTrack() without renegotiation. That forced an
    // m=video, m=audio order in the SDP which, on real cross-network setups,
    // could leave the audio transceiver in a half-paired state on the callee
    // — producing the one-way audio bug. Voice calls now negotiate m=audio
    // ONLY; screen share starts a normal renegotiation via addTrack +
    // negotiationneeded (caller) or a 'renegotiate' signal (callee).

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal('ice-candidate', { candidate: JSON.stringify(e.candidate) });
      }
    };

    peer.ontrack = (e) => {
      // Accumulate every incoming track onto a single MediaStream so the
      // <audio>/<video> consumers always see both kinds, even if the audio
      // and video tracks arrive in separate ontrack events (Firefox) or with
      // empty e.streams (some older browsers). Replacing remoteStream wholesale
      // on each event was the bug that hid the remote audio track when the
      // video track arrived later — leaving one direction silent.
      setRemoteStream((prev) => {
        const merged = prev ?? new MediaStream();
        // Track the streams the browser handed us so future tracks share the
        // same MediaStream identity where possible (helps consumers that key
        // off stream.id).
        const incoming = e.streams?.[0];
        if (incoming) {
          incoming.getTracks().forEach((t) => {
            if (!merged.getTracks().some((x) => x.id === t.id)) {
              try { merged.addTrack(t); } catch { /* duplicate */ }
            }
          });
        } else if (e.track) {
          if (!merged.getTracks().some((x) => x.id === e.track.id)) {
            try { merged.addTrack(e.track); } catch { /* duplicate */ }
          }
        }
        // Drop any tracks that have ended (e.g. peer stopped screen share).
        merged.getTracks().forEach((t) => {
          if (t.readyState === 'ended') {
            try { merged.removeTrack(t); } catch { /* noop */ }
          }
        });
        // Return a new MediaStream wrapper so React sees a referential change
        // and re-binds srcObject on consumers, while reusing the same tracks.
        return new MediaStream(merged.getTracks());
      });
      // When the remote track itself ends (peer turned camera off, hung up),
      // remove it from the merged stream so consumers stop trying to render it.
      const track = e.track;
      if (track) {
        track.onended = () => {
          setRemoteStream((prev) => {
            if (!prev) return prev;
            try { prev.removeTrack(track); } catch { /* noop */ }
            return new MediaStream(prev.getTracks());
          });
        };
      }
    };

    peer.onconnectionstatechange = () => {
      switch (peer.connectionState) {
        case 'connecting':
          setCallState('connecting');
          break;
        case 'connected':
          setCallState('connected');
          // Sync our initial mic/camera state to the peer the moment media can
          // flow, so their UI shows correct mute/camera badges from the start.
          sendMediaStateRef.current?.();
          break;
        case 'failed':
          setCallState('error');
          setErrorMessage('Peer connection failed. Check network/firewall.');
          break;
        case 'disconnected':
          // Transient — give it a moment before treating as ended.
          setTimeout(() => {
            if (peerRef.current?.connectionState === 'disconnected') {
              setCallState('ended');
            }
          }, 3000);
          break;
        case 'closed':
          setCallState('ended');
          break;
        default:
          break;
      }
    };

    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'failed') {
        // Trigger ICE restart. restartIce() alone only marks the *next* offer
        // as an ICE restart — it does NOT generate one. The caller side has to
        // actually compose a new offer; the callee just answers whatever it
        // gets. Without this follow-up, a transient ICE failure left the call
        // permanently in `failed` with no media flowing.
        try { peer.restartIce(); } catch { /* noop */ }
        if (isInitiatorRef.current) {
          void (async () => {
            try {
              const offer = await peer.createOffer({ iceRestart: true });
              await peer.setLocalDescription(offer);
              sendSignal('offer', { sdp: JSON.stringify(offer) });
            } catch (err) {
              console.warn('[WebRTC] ICE restart offer failed', err);
            }
          })();
        }
      }
    };

    // The caller responds to renegotiation triggers (e.g. dynamic addTrack).
    // The callee never composes offers in this 1-on-1 architecture — it only
    // answers — so we gate this on isInitiatorRef to avoid offer/offer races.
    peer.onnegotiationneeded = () => {
      if (!isInitiatorRef.current) return;
      // Skip the initial offer (startCall composes it explicitly); only react
      // to subsequent renegotiations once we have a stable connection.
      if (peer.signalingState !== 'stable') return;
      void (async () => {
        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          sendSignal('offer', { sdp: JSON.stringify(offer) });
        } catch (err) {
          console.warn('[WebRTC] renegotiation offer failed', err);
        }
      })();
    };

    peerRef.current = peer;
    remoteDescriptionSetRef.current = false;
    pendingIceRef.current = [];

    // Expose a debug dumper on window so the user can diagnose audio issues
    // from DevTools: `await __webrtcDebug()` prints senders, receivers,
    // transceivers, and outbound/inbound RTP stats for the active call.
    (window as unknown as { __webrtcDebug?: () => Promise<void> }).__webrtcDebug = async () => {
      const p = peerRef.current;
      if (!p) { console.log('[WebRTC debug] no active peer'); return; }
      console.group('[WebRTC debug] connection state');
      console.log('signalingState', p.signalingState);
      console.log('connectionState', p.connectionState);
      console.log('iceConnectionState', p.iceConnectionState);
      console.log('iceGatheringState', p.iceGatheringState);
      console.groupEnd();
      console.group('[WebRTC debug] transceivers');
      p.getTransceivers().forEach((t, i) => {
        console.log(`#${i} mid=${t.mid} dir=${t.direction} curDir=${t.currentDirection}`, {
          senderKind: t.sender.track?.kind,
          senderTrackId: t.sender.track?.id,
          senderTrackEnabled: t.sender.track?.enabled,
          senderTrackMuted: t.sender.track?.muted,
          receiverKind: t.receiver.track?.kind,
          receiverTrackId: t.receiver.track?.id,
          receiverTrackMuted: t.receiver.track?.muted,
        });
      });
      console.groupEnd();
      console.group('[WebRTC debug] local stream tracks');
      localStreamRef.current?.getTracks().forEach((t) => {
        console.log(`${t.kind} enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState} id=${t.id}`);
      });
      console.groupEnd();
      try {
        const stats = await p.getStats();
        console.group('[WebRTC debug] RTP stats');
        stats.forEach((report: { type?: string; kind?: string; bytesSent?: number; bytesReceived?: number; packetsSent?: number; packetsReceived?: number; ssrc?: number }) => {
          if (report.type === 'outbound-rtp' && report.kind === 'audio') {
            console.log('outbound audio bytesSent', report.bytesSent, 'packetsSent', report.packetsSent, 'ssrc', report.ssrc);
          }
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            console.log('inbound audio bytesReceived', report.bytesReceived, 'packetsReceived', report.packetsReceived, 'ssrc', report.ssrc);
          }
        });
        console.groupEnd();
      } catch (err) {
        console.warn('[WebRTC debug] getStats failed', err);
      }
    };

    return peer;
  }, [sendSignal]);

  /** Resolve a MediaDevices instance — directly when available, or by adapting
   *  the deprecated `navigator.getUserMedia` (callback style) for browsers that
   *  still expose it. Returns null in non-secure contexts where the API is
   *  intentionally hidden by the browser. */
  const getMediaDevicesShim = (): MediaDevices | null => {
    if (typeof navigator === 'undefined') return null;
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      return navigator.mediaDevices;
    }
    // Try the legacy prefixed getUserMedia and wrap in a Promise shim.
    type LegacyNav = Navigator & {
      getUserMedia?: (c: MediaStreamConstraints, s: (m: MediaStream) => void, e: (err: Error) => void) => void;
      webkitGetUserMedia?: (c: MediaStreamConstraints, s: (m: MediaStream) => void, e: (err: Error) => void) => void;
      mozGetUserMedia?: (c: MediaStreamConstraints, s: (m: MediaStream) => void, e: (err: Error) => void) => void;
      msGetUserMedia?: (c: MediaStreamConstraints, s: (m: MediaStream) => void, e: (err: Error) => void) => void;
    };
    const nav = navigator as LegacyNav;
    const legacy = nav.getUserMedia || nav.webkitGetUserMedia || nav.mozGetUserMedia || nav.msGetUserMedia;
    if (legacy) {
      const shim = {
        getUserMedia: (constraints: MediaStreamConstraints): Promise<MediaStream> =>
          new Promise<MediaStream>((resolve, reject) => legacy.call(nav, constraints, resolve, reject)),
      } as unknown as MediaDevices;
      return shim;
    }
    return null;
  };

  const getLocalMedia = useCallback(async () => {
    // If we already captured a local stream (e.g. via preflight), reuse it so
    // the user is not prompted for permissions twice.
    if (localStreamRef.current) {
      return localStreamRef.current;
    }
    // If a previous call is still awaiting the user's permission decision,
    // attach to that same promise instead of issuing a second getUserMedia.
    if (pendingMediaRef.current) {
      return pendingMediaRef.current;
    }
    // STEP 1 — verify the browser exposes the media APIs. They are hidden by
    // the browser in non-secure contexts (any origin other than https:// or
    // http://localhost / http://127.0.0.1). Detect that first so the user
    // gets actionable guidance instead of a cryptic TypeError.
    const md = getMediaDevicesShim();
    if (!md) {
      const isSecure = typeof window !== 'undefined' ? window.isSecureContext : false;
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
      let msg: string;
      if (!isSecure && !isLocalHost) {
        msg =
          `Camera and microphone access require a secure connection. You are ` +
          `viewing this app over an insecure origin (${origin}). ` +
          `Open it via http://localhost:<port> on this machine, or serve it over https://.`;
      } else {
        msg = 'This browser does not support camera/microphone access. Try a recent Chrome, Edge, Firefox, or Safari.';
      }
      setErrorMessage(msg);
      setCallState('error');
      throw new Error(msg);
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          callType === 'video'
            ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
            : false,
      };
      const pending = md.getUserMedia(constraints);
      pendingMediaRef.current = pending;
      let stream: MediaStream;
      try {
        stream = await pending;
      } finally {
        pendingMediaRef.current = null;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      const e = err as DOMException;
      let msg = 'Could not access microphone or camera.';
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        msg = 'Permission denied. Please allow camera/microphone access in your browser settings.';
      } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
        msg = callType === 'video'
          ? 'No camera or microphone found. Connect a device and try again.'
          : 'No microphone found. Connect a device and try again.';
      } else if (e?.name === 'NotReadableError' || e?.name === 'TrackStartError') {
        msg = 'Your camera or microphone is in use by another application.';
      } else if (e?.name === 'OverconstrainedError') {
        msg = 'Your devices do not support the requested settings.';
      } else if (e?.name === 'SecurityError') {
        msg = 'Browser security blocked media access. Make sure you are on https:// or http://localhost.';
      } else if (e?.name === 'TypeError') {
        // Some browsers surface the "no mediaDevices" case as TypeError.
        msg = 'Media access is not available. Open this app via https:// or http://localhost.';
      }
      setErrorMessage(msg);
      setCallState('error');
      throw err;
    }
  }, [callType]);

  /** Capture the local camera/mic up front so the browser permission prompt
   *  is shown the moment the user enters a call — independently of the
   *  signaling handshake. The captured stream is reused by startCall /
   *  acceptCall, so the user is never prompted twice. */
  const preflightLocalMedia = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      return await getLocalMedia();
    } catch {
      // getLocalMedia already populated errorMessage/callState.
      return null;
    }
  }, [getLocalMedia]);

  const addTracksFromStream = (peer: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((track) => {
      const sender = peer.addTrack(track, stream);
      // Remember the camera's sender so screen share can replaceTrack() onto it.
      if (track.kind === 'video') videoSenderRef.current = sender;
    });
  };

  const flushPendingIce = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer || !remoteDescriptionSetRef.current) return;
    const pending = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const cand of pending) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn('[WebRTC] Failed to add buffered ICE candidate', err);
      }
    }
  }, []);

  // ─── Caller flow ─────────────────────────────────────────────────────────────

  const startCall = useCallback(async () => {
    if (callState === 'connecting' || callState === 'connected') return;
    setErrorMessage(null);
    setCallState('connecting');
    try {
      const stream = await getLocalMedia();
      const peer = createPeer();
      addTracksFromStream(peer, stream);

      // Force every transceiver we just attached to sendrecv before the offer
      // is composed. The default is sendrecv already, but a previous renegotiation
      // (e.g. screen share lifecycle) can leave a sender stuck in sendonly —
      // which silently turns into one-way audio after the next handshake.
      peer.getTransceivers().forEach((t) => {
        try {
          if (t.currentDirection !== 'stopped' && t.direction !== 'sendrecv') {
            t.direction = 'sendrecv';
          }
        } catch { /* immutable */ }
      });

      // No legacy offerToReceive* flags: the transceiver directions (audio
      // sendrecv from the mic track, video sendrecv from the camera track on
      // video calls or the pre-added transceiver on voice calls) already define
      // the SDP. Passing offerToReceiveVideo:false here would downgrade the
      // voice-call video transceiver to send-only and break two-way screen share.
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      if (import.meta.env.DEV) {
        console.info('[WebRTC] caller offer transceivers',
          peer.getTransceivers().map((t) => ({
            mid: t.mid,
            kind: t.sender.track?.kind ?? t.receiver.track?.kind,
            direction: t.direction,
            hasSenderTrack: Boolean(t.sender.track),
          })));
      }

      sendSignal('offer', { sdp: JSON.stringify(offer) });
    } catch (err) {
      console.error('startCall error:', err);
      // errorMessage already set inside getLocalMedia where applicable.
      setCallState('error');
    }
  }, [callState, createPeer, getLocalMedia, sendSignal]);

  // ─── Callee flow ─────────────────────────────────────────────────────────────

  const acceptCall = useCallback(
    async (offer: RTCSessionDescriptionInit) => {
      if (callState === 'connecting' || callState === 'connected') {
        // Already negotiating — ignore duplicate offers.
        return;
      }
      setErrorMessage(null);
      setCallState('connecting');
      try {
        const peer = createPeer();

        // STEP 1: Set the remote description FIRST. This creates matching
        // transceivers on this side keyed to the offer's m-line mids. Doing
        // it before any addTrack guarantees `addTrack` below will reuse those
        // transceivers (matched by kind) rather than creating new unbound ones
        // — which was the source of the one-way audio bug on Chromium↔Firefox
        // over TURN.
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        remoteDescriptionSetRef.current = true;
        await flushPendingIce();

        // STEP 2: Acquire local media (mic / camera). On failure, getLocalMedia
        // already populated callState='error' and a friendly errorMessage.
        const stream = await getLocalMedia();

        // STEP 3: Attach every local track via the *simple* addTrack path.
        // Per WebRTC spec, addTrack reuses an existing transceiver of the same
        // kind whose sender has no track (which is exactly the case here: SRD
        // just created the audio transceiver, and createPeer pre-added a video
        // transceiver for voice calls). The browser also flips that
        // transceiver's direction to 'sendrecv' as part of addTrack — no
        // manual replaceTrack/find dance required.
        stream.getTracks().forEach((track) => {
          const sender = peer.addTrack(track, stream);
          if (track.kind === 'video') videoSenderRef.current = sender;
        });

        // STEP 4: Defensively force every (non-stopped) transceiver to
        // 'sendrecv' BEFORE createAnswer. Some browsers will otherwise leave
        // the answer's m=audio at recvonly if they think the sender's track
        // binding hasn't settled yet, which silently produces one-way audio.
        peer.getTransceivers().forEach((t) => {
          try {
            if (t.currentDirection !== 'stopped' && t.direction !== 'sendrecv') {
              t.direction = 'sendrecv';
            }
          } catch { /* immutable in some signaling states */ }
        });

        // STEP 5: Compose and send the answer.
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        if (import.meta.env.DEV) {
          console.info('[WebRTC] callee answer transceivers',
            peer.getTransceivers().map((t) => ({
              mid: t.mid,
              kind: t.receiver.track?.kind ?? t.sender.track?.kind,
              direction: t.direction,
              currentDirection: t.currentDirection,
              hasSenderTrack: Boolean(t.sender.track),
            })));
        }

        sendSignal('answer', { sdp: JSON.stringify(answer) });
      } catch (err) {
        console.error('acceptCall error:', err);
        setCallState('error');
      }
    },
    [callState, createPeer, getLocalMedia, sendSignal, flushPendingIce]
  );

  // ─── Handle incoming WebRTC signals via custom DOM event ────────────────────
  // The signal handler must work even when peerRef.current is null (the very
  // first 'offer' for the callee arrives before any peer exists — that offer
  // is what *causes* the peer to be created via acceptCall).

  useEffect(() => {
    const handler = async (e: Event) => {
      const signal = (e as CustomEvent).detail;
      if (!signal || typeof signal !== 'object') return;

      // Ignore signals that aren't for our room (multi-call safety).
      if (signal.roomId != null && roomIdRef.current != null) {
        if (Number(signal.roomId) !== Number(roomIdRef.current)) return;
      }

      try {
        if (signal.type === 'offer') {
          if (!signal.sdp) return;
          const offer = JSON.parse(signal.sdp) as RTCSessionDescriptionInit;
          const peer = peerRef.current;
          // If we already have a connected peer, this is a renegotiation offer
          // (e.g. the other side did an ICE restart or added a screen-share
          // transceiver). Apply it in-place instead of going through the
          // full acceptCall flow, which would tear down the active media.
          if (peer && peer.signalingState !== 'closed' && remoteDescriptionSetRef.current) {
            try {
              await peer.setRemoteDescription(new RTCSessionDescription(offer));
              // Force sendrecv on every active transceiver so a renegotiation
              // can never silently downgrade audio direction.
              peer.getTransceivers().forEach((t) => {
                try {
                  if (t.currentDirection !== 'stopped' && t.direction !== 'sendrecv') {
                    t.direction = 'sendrecv';
                  }
                } catch { /* immutable */ }
              });
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              sendSignal('answer', { sdp: JSON.stringify(answer) });
            } catch (err) {
              console.warn('[WebRTC] renegotiation accept failed', err);
            }
          } else {
            // Initial offer — callee path.
            await acceptCall(offer);
          }
        } else if (signal.type === 'answer') {
          const peer = peerRef.current;
          if (!peer || !signal.sdp) return;
          const answer = JSON.parse(signal.sdp) as RTCSessionDescriptionInit;
          // Guard against duplicate answers in unexpected states.
          if (peer.signalingState === 'have-local-offer') {
            await peer.setRemoteDescription(new RTCSessionDescription(answer));
            remoteDescriptionSetRef.current = true;
            await flushPendingIce();
            if (import.meta.env.DEV) {
              console.info('[WebRTC] caller post-answer transceivers',
                peer.getTransceivers().map((t) => ({
                  mid: t.mid,
                  kind: t.sender.track?.kind ?? t.receiver.track?.kind,
                  direction: t.direction,
                  currentDirection: t.currentDirection,
                })));
            }
          }
        } else if (signal.type === 'ice-candidate') {
          if (!signal.candidate) return;
          const candidate = JSON.parse(signal.candidate) as RTCIceCandidateInit;
          const peer = peerRef.current;
          if (peer && remoteDescriptionSetRef.current) {
            try {
              await peer.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.warn('[WebRTC] addIceCandidate failed', err);
            }
          } else {
            // Buffer ICE arriving before remote description is set.
            pendingIceRef.current.push(candidate);
          }
        } else if (signal.type === 'renegotiate') {
          // The non-initiator added a track (e.g. screen share) and asked us
          // to compose a new offer. Only the initiator answers this.
          const peer = peerRef.current;
          if (!peer || !isInitiatorRef.current) return;
          if (peer.signalingState !== 'stable') return;
          try {
            const newOffer = await peer.createOffer();
            await peer.setLocalDescription(newOffer);
            sendSignal('offer', { sdp: JSON.stringify(newOffer) });
          } catch (err) {
            console.warn('[WebRTC] renegotiate-on-request failed', err);
          }
        } else if (signal.type === 'media-state') {
          // Peer told us their mic/camera/screen state — reflect it in the UI.
          if (!signal.sdp) return;
          const st = JSON.parse(signal.sdp) as {
            muted?: boolean;
            videoOff?: boolean;
            screenSharing?: boolean;
          };
          setRemoteMuted(Boolean(st.muted));
          setRemoteVideoOff(Boolean(st.videoOff));
          setRemoteScreenSharing(Boolean(st.screenSharing));
        }
      } catch (err) {
        console.error('[WebRTC] Error handling signal', signal?.type, err);
      }
    };

    window.addEventListener('webrtc-signal', handler);
    return () => window.removeEventListener('webrtc-signal', handler);
  }, [acceptCall, flushPendingIce]);

  // ─── Call Controls ───────────────────────────────────────────────────────────

  const endCall = useCallback(() => {
    // Notify the other peer via signaling BEFORE we tear down (otherwise the
    // STOMP publish may race the cleanup and never go out).
    sendSignal('call-ended', {});

    // Stop all local tracks
    localStreamRef.current?.getTracks().forEach((t) => {
      try { t.stop(); } catch { /* noop */ }
    });
    screenStreamRef.current?.getTracks().forEach((t) => {
      try { t.stop(); } catch { /* noop */ }
    });
    localStreamRef.current = null;
    screenStreamRef.current = null;
    pendingMediaRef.current = null;
    cameraTrackRef.current = null;
    videoSenderRef.current = null;

    // Close peer connection
    if (peerRef.current) {
      try { peerRef.current.close(); } catch { /* noop */ }
    }
    peerRef.current = null;
    remoteDescriptionSetRef.current = false;
    pendingIceRef.current = [];

    setLocalStream(null);
    setRemoteStream(null);
    setCallState('ended');
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;
    setRemoteMuted(false);
    setRemoteVideoOff(callTypeRef.current !== 'video');
    setRemoteScreenSharing(false);
  }, [sendSignal]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getAudioTracks();
    if (tracks.length === 0) return;
    const newMuted = tracks[0].enabled; // currently enabled -> becoming muted
    tracks.forEach((t) => {
      t.enabled = !newMuted;
    });
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;
    sendMediaState(); // let the peer reflect our mute state
  }, [sendMediaState]);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getVideoTracks();
    if (tracks.length === 0) return;
    const becomingOff = tracks[0].enabled;
    tracks.forEach((t) => {
      t.enabled = !becomingOff;
    });
    setIsVideoOn(!becomingOff);
    isVideoOnRef.current = !becomingOff;
    sendMediaState(); // let the peer reflect our camera state
  }, [sendMediaState]);

  /** Resolve the outgoing video sender (camera sender for video calls, or the
   *  pre-negotiated transceiver sender for voice calls). */
  const getVideoSender = (): RTCRtpSender | null =>
    videoSenderRef.current
    ?? peerRef.current?.getSenders().find((s) => s.track?.kind === 'video')
    ?? null;

  const stopScreenShare = useCallback(() => {
    const screen = screenStreamRef.current;
    screen?.getTracks().forEach((t) => {
      try { t.stop(); } catch { /* noop */ }
    });
    screenStreamRef.current = null;

    const cam = cameraTrackRef.current; // null on voice calls (no camera)
    const peer = peerRef.current;
    const sender = getVideoSender();

    if (cam && sender) {
      // Video call — restore the camera onto the existing sender.
      sender.replaceTrack(cam).catch((err) => {
        console.warn('[WebRTC] Failed to restore video sender', err);
      });
    } else if (sender && peer) {
      // Voice call — fully remove the video track so the m=video stops
      // transmitting. replaceTrack(null) keeps the m-line; removeTrack drops
      // it and triggers a renegotiation that cleanly closes the section.
      try { peer.removeTrack(sender); } catch { /* noop */ }
      videoSenderRef.current = null;
      if (!isInitiatorRef.current) {
        sendSignal('renegotiate', {});
      }
    }

    // Update the local preview: drop the screen track, restore the camera.
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        try { localStreamRef.current!.removeTrack(t); } catch { /* noop */ }
      });
      if (cam) {
        try { localStreamRef.current.addTrack(cam); } catch { /* noop */ }
      }
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    }
    cameraTrackRef.current = null;

    setIsScreenSharing(false);
    isScreenSharingRef.current = false;
    sendMediaState(); // tell the peer we stopped sharing
  }, [sendMediaState, sendSignal]);

  const shareScreen = useCallback(async () => {
    // Mirror the same secure-context guard as getUserMedia: getDisplayMedia
    // is also hidden by the browser on non-secure origins, where calling it
    // would throw a confusing TypeError.
    if (typeof navigator === 'undefined'
        || !navigator.mediaDevices
        || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      const isSecure = typeof window !== 'undefined' ? window.isSecureContext : false;
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
      const msg = !isSecure && !isLocalHost
        ? 'Screen sharing requires a secure connection. Open the app via http://localhost or https://.'
        : 'This browser does not support screen sharing. Try a recent Chrome, Edge, Firefox, or Safari.';
      setErrorMessage(msg);
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = screenStream;

      const videoTrack = screenStream.getVideoTracks()[0];
      if (!videoTrack) return;

      const peer = peerRef.current;
      const sender = getVideoSender();
      if (sender) {
        // Video calls and any prior screen-share session already have a video
        // sender — swap the track without renegotiation.
        try { await sender.replaceTrack(videoTrack); }
        catch (err) { console.warn('[WebRTC] Failed to send screen track', err); }
      } else if (peer) {
        // Voice call — no video sender yet. Adding the track creates a new
        // video transceiver and fires negotiationneeded; the initiator already
        // listens for that and composes a renegotiation offer. If we are the
        // non-initiator, ask the caller to renegotiate so the new m=video
        // section actually gets exchanged.
        const newSender = peer.addTrack(videoTrack, screenStream);
        videoSenderRef.current = newSender;
        if (!isInitiatorRef.current) {
          sendSignal('renegotiate', {});
        }
      }

      // Reflect the screen in the local preview. Set the camera aside (kept live)
      // so stopScreenShare can restore it.
      if (localStreamRef.current) {
        const cam = localStreamRef.current.getVideoTracks()[0];
        if (cam) {
          cameraTrackRef.current = cam;
          try { localStreamRef.current.removeTrack(cam); } catch { /* noop */ }
        }
        try { localStreamRef.current.addTrack(videoTrack); } catch { /* noop */ }
        // Trigger a state refresh so consumers re-bind the <video> srcObject.
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      setIsScreenSharing(true);
      isScreenSharingRef.current = true;
      sendMediaState(); // tell the peer to show our screen

      // Auto-stop when the user clicks "Stop sharing" in the browser UI.
      videoTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      const e = err as DOMException;
      // User cancelled the picker — not an error.
      if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') {
        return;
      }
      console.error('Screen share error:', err);
      let msg = 'Could not start screen sharing.';
      if (e?.name === 'NotFoundError') msg = 'No screen or window was found to share.';
      else if (e?.name === 'NotReadableError') msg = 'The selected screen is unavailable.';
      else if (e?.name === 'SecurityError') msg = 'Browser blocked screen sharing. Use https:// or http://localhost.';
      setErrorMessage(msg);
    }
  }, [stopScreenShare, sendMediaState, sendSignal]);

  // ─── Audio-flow watchdog ───────────────────────────────────────────────────
  // Polls getStats() once per second while connected and:
  //   1. Exposes inbound/outbound audio kbps for a visible UI indicator.
  //   2. Detects "inbound stuck at 0 while outbound flows" — the signature of
  //      one-way audio caused by NAT/firewall asymmetry over STUN-only (no
  //      TURN). When detected, the initiator side composes an ICE-restart
  //      offer to nudge the connection onto a working candidate pair.
  // This is the deterministic recovery path for the "one user can't hear the
  // other" symptom that varies between attempts.
  useEffect(() => {
    if (callState !== 'connected') return;
    let cancelled = false;
    let prevIn = 0;
    let prevOut = 0;
    let prevTs = 0;
    let stuckInSamples = 0;     // consecutive seconds with inbound=0 while outbound>0
    let restartRequested = false;
    let prevRemoteEnergy = 0;
    let prevRemoteSamples = 0;
    const sample = async () => {
      const peer = peerRef.current;
      if (!peer || cancelled) return;
      try {
        const stats = await peer.getStats();
        let inboundBytes = 0;
        let outboundBytes = 0;
        let ts = 0;
        let localLevel = 0;
        let remoteAudioLevelDirect = -1; // -1 = not reported by browser
        let remoteEnergy = 0;
        let remoteSamples = 0;
        stats.forEach((r: { type?: string; kind?: string; bytesReceived?: number; bytesSent?: number; timestamp?: number; audioLevel?: number; totalAudioEnergy?: number; totalSamplesDuration?: number }) => {
          if (r.kind !== 'audio') return;
          if (r.type === 'inbound-rtp') {
            inboundBytes += r.bytesReceived ?? 0;
            if (typeof r.audioLevel === 'number') remoteAudioLevelDirect = Math.max(remoteAudioLevelDirect, r.audioLevel);
            if (typeof r.totalAudioEnergy === 'number') remoteEnergy = r.totalAudioEnergy;
            if (typeof r.totalSamplesDuration === 'number') remoteSamples = r.totalSamplesDuration;
            if (r.timestamp && r.timestamp > ts) ts = r.timestamp;
          } else if (r.type === 'outbound-rtp') {
            outboundBytes += r.bytesSent ?? 0;
            if (r.timestamp && r.timestamp > ts) ts = r.timestamp;
          } else if (r.type === 'media-source') {
            if (typeof r.audioLevel === 'number') localLevel = Math.max(localLevel, r.audioLevel);
          }
        });
        if (cancelled) return;
        const dtSec = prevTs ? Math.max(0.001, (ts - prevTs) / 1000) : 1;
        const inDelta = Math.max(0, inboundBytes - prevIn);
        const outDelta = Math.max(0, outboundBytes - prevOut);
        const inKbps = prevTs ? (inDelta * 8) / 1000 / dtSec : 0;
        const outKbps = prevTs ? (outDelta * 8) / 1000 / dtSec : 0;
        // Remote audio amplitude: prefer the direct audioLevel field; if the
        // browser doesn't report it, derive an RMS-like value from the energy
        // delta (totalAudioEnergy is integrated RMS²·duration; divide by the
        // samples-duration delta and sqrt to get RMS).
        let remoteLevel = 0;
        if (remoteAudioLevelDirect >= 0) {
          remoteLevel = remoteAudioLevelDirect;
        } else if (prevRemoteSamples > 0) {
          const energyDelta = Math.max(0, remoteEnergy - prevRemoteEnergy);
          const sampleDelta = Math.max(0.001, remoteSamples - prevRemoteSamples);
          remoteLevel = Math.min(1, Math.sqrt(energyDelta / sampleDelta));
        }
        prevRemoteEnergy = remoteEnergy;
        prevRemoteSamples = remoteSamples;
        prevIn = inboundBytes;
        prevOut = outboundBytes;
        prevTs = ts;

        // Track consecutive stuck-inbound seconds. We require some outbound
        // activity (>=2 kbps) before declaring inbound "stuck", to avoid false
        // positives when both peers are silent.
        if (prevTs && inKbps < 1 && outKbps >= 2) stuckInSamples += 1;
        else stuckInSamples = 0;

        const inboundStuck = stuckInSamples >= 5;
        const outboundStuck = prevTs > 0 && outKbps < 1 && !isMutedRef.current;
        setAudioFlow({ inKbps, outKbps, inboundStuck, outboundStuck, localLevel, remoteLevel });

        // After ~6s of stuck inbound, trigger ONE ICE restart from the
        // initiator side. ICE renegotiation often resolves asymmetric
        // candidate-pair selection without forcing a full reconnect.
        if (inboundStuck && !restartRequested && isInitiatorRef.current) {
          restartRequested = true;
          console.warn('[WebRTC] Inbound audio stuck — triggering ICE restart');
          try {
            peer.restartIce();
            const offer = await peer.createOffer({ iceRestart: true });
            await peer.setLocalDescription(offer);
            sendSignal('offer', { sdp: JSON.stringify(offer) });
          } catch (err) {
            console.warn('[WebRTC] ICE restart failed', err);
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[WebRTC] audio-flow getStats failed', err);
      }
    };
    const id = window.setInterval(sample, 1000);
    void sample();
    return () => { cancelled = true; window.clearInterval(id); };
  }, [callState, sendSignal]);

  // ─── Cleanup on unmount ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => {
        try { t.stop(); } catch { /* noop */ }
      });
      screenStreamRef.current?.getTracks().forEach((t) => {
        try { t.stop(); } catch { /* noop */ }
      });
      if (peerRef.current) {
        try { peerRef.current.close(); } catch { /* noop */ }
      }
    };
  }, []);

  return {
    localStream,
    remoteStream,
    callState,
    errorMessage,
    isMuted,
    isVideoOn,
    isScreenSharing,
    remoteMuted,
    remoteVideoOff,
    remoteScreenSharing,
    audioFlow,
    preflightLocalMedia,
    startCall,
    acceptCall,
    endCall,
    toggleMute,
    toggleVideo,
    shareScreen,
    stopScreenShare,
  };
}
