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

    // Voice calls capture no camera, so there is no video sender to swap a
    // screen-share track onto. Pre-negotiate a sendrecv video transceiver up
    // front: both peers run createPeer, so the m-line is agreed during the
    // initial offer/answer and screen share later becomes a zero-renegotiation
    // replaceTrack(). Video calls already get a video sender from the camera
    // track (set in addTracksFromStream), so skip the extra transceiver there.
    if (callTypeRef.current !== 'video') {
      try {
        const vt = peer.addTransceiver('video', { direction: 'sendrecv' });
        videoSenderRef.current = vt.sender;
      } catch (err) {
        console.warn('[WebRTC] Could not pre-add video transceiver', err);
      }
    }

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal('ice-candidate', { candidate: JSON.stringify(e.candidate) });
      }
    };

    peer.ontrack = (e) => {
      const [stream] = e.streams;
      if (stream) {
        setRemoteStream(stream);
      } else if (e.track) {
        // Some browsers may not pass streams; build one from the track.
        setRemoteStream((prev) => {
          const s = prev ?? new MediaStream();
          s.addTrack(e.track);
          return s;
        });
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
        // Try ICE restart
        try { peer.restartIce(); } catch { /* noop */ }
      }
    };

    peerRef.current = peer;
    remoteDescriptionSetRef.current = false;
    pendingIceRef.current = [];
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

      // No legacy offerToReceive* flags: the transceiver directions (audio
      // sendrecv from the mic track, video sendrecv from the camera track on
      // video calls or the pre-added transceiver on voice calls) already define
      // the SDP. Passing offerToReceiveVideo:false here would downgrade the
      // voice-call video transceiver to send-only and break two-way screen share.
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

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
        const stream = await getLocalMedia();
        const peer = createPeer();
        addTracksFromStream(peer, stream);

        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        remoteDescriptionSetRef.current = true;
        await flushPendingIce();

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

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
          // Callee path — create peer + accept the offer.
          await acceptCall(offer);
        } else if (signal.type === 'answer') {
          const peer = peerRef.current;
          if (!peer || !signal.sdp) return;
          const answer = JSON.parse(signal.sdp) as RTCSessionDescriptionInit;
          // Guard against duplicate answers in unexpected states.
          if (peer.signalingState === 'have-local-offer') {
            await peer.setRemoteDescription(new RTCSessionDescription(answer));
            remoteDescriptionSetRef.current = true;
            await flushPendingIce();
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

    // Restore the outgoing video sender: back to the camera on a video call, or
    // to nothing on a voice call (so we stop transmitting the screen). No
    // renegotiation — the sender/transceiver already exists.
    const sender = getVideoSender();
    if (sender) {
      sender.replaceTrack(cam ?? null).catch((err) => {
        console.warn('[WebRTC] Failed to restore video sender', err);
      });
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
  }, [sendMediaState]);

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

      // Send the screen over the always-present video sender (camera sender for
      // video calls, pre-negotiated transceiver for voice calls). replaceTrack
      // needs no renegotiation, so this works for BOTH call types.
      const sender = getVideoSender();
      if (sender) {
        try { await sender.replaceTrack(videoTrack); }
        catch (err) { console.warn('[WebRTC] Failed to send screen track', err); }
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
  }, [stopScreenShare, sendMediaState]);

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
