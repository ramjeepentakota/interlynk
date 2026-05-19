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

// ICE server config — uses Google's public STUN server.
// For production, add TURN server credentials here.
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
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
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  startCall: () => Promise<void>;
  acceptCall: (offer: RTCSessionDescriptionInit) => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  shareScreen: () => Promise<void>;
  stopScreenShare: () => void;
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
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === 'video');
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const sendSignal = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      if (!stompClient?.connected || !roomId || !targetUserId || !user) return;
      stompClient.publish({
        destination: '/app/call/signal',
        body: JSON.stringify({
          type,
          roomId: Number(roomId),
          senderUserId: Number(user.id),
          targetUserId: Number(targetUserId),
          callType,
          ...payload,
        }),
      });
    },
    [stompClient, roomId, targetUserId, user, callType]
  );

  const createPeer = useCallback(() => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal('ice-candidate', { candidate: JSON.stringify(e.candidate) });
      }
    };

    peer.ontrack = (e) => {
      const [stream] = e.streams;
      setRemoteStream(stream);
    };

    peer.onconnectionstatechange = () => {
      switch (peer.connectionState) {
        case 'connected':
          setCallState('connected');
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          setCallState('ended');
          break;
        default:
          break;
      }
    };

    peerRef.current = peer;
    return peer;
  }, [sendSignal]);

  const getLocalMedia = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: callType === 'video' ? { width: 1280, height: 720 } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      setCallState('error');
      throw err;
    }
  }, [callType]);

  const addTracksFromStream = (peer: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
  };

  // ─── Caller flow ─────────────────────────────────────────────────────────────

  const startCall = useCallback(async () => {
    setCallState('connecting');
    try {
      const stream = await getLocalMedia();
      const peer = createPeer();
      addTracksFromStream(peer, stream);

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      sendSignal('offer', { sdp: JSON.stringify(offer) });
    } catch (err) {
      console.error('startCall error:', err);
      setCallState('error');
    }
  }, [createPeer, getLocalMedia, sendSignal]);

  // ─── Callee flow ─────────────────────────────────────────────────────────────

  const acceptCall = useCallback(
    async (offer: RTCSessionDescriptionInit) => {
      setCallState('connecting');
      try {
        const stream = await getLocalMedia();
        const peer = createPeer();
        addTracksFromStream(peer, stream);

        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        sendSignal('answer', { sdp: JSON.stringify(answer) });
      } catch (err) {
        console.error('acceptCall error:', err);
        setCallState('error');
      }
    },
    [createPeer, getLocalMedia, sendSignal]
  );

  // ─── Handle incoming WebRTC signals via custom DOM event ────────────────────

  useEffect(() => {
    const handler = async (e: Event) => {
      const signal = (e as CustomEvent).detail;
      const peer = peerRef.current;
      if (!peer) return;

      try {
        if (signal.type === 'offer') {
          const offer = JSON.parse(signal.sdp) as RTCSessionDescriptionInit;
          await acceptCall(offer);
        } else if (signal.type === 'answer') {
          const answer = JSON.parse(signal.sdp) as RTCSessionDescriptionInit;
          await peer.setRemoteDescription(new RTCSessionDescription(answer));
        } else if (signal.type === 'ice-candidate') {
          const candidate = JSON.parse(signal.candidate) as RTCIceCandidateInit;
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Error handling WebRTC signal:', err);
      }
    };

    window.addEventListener('webrtc-signal', handler);
    return () => window.removeEventListener('webrtc-signal', handler);
  }, [acceptCall]);

  // ─── Call Controls ───────────────────────────────────────────────────────────

  const endCall = useCallback(() => {
    // Stop all local tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());

    // Close peer connection
    peerRef.current?.close();
    peerRef.current = null;

    setLocalStream(null);
    setRemoteStream(null);
    setCallState('ended');
    setIsScreenSharing(false);

    // Notify the other peer via signaling
    sendSignal('call-ended', {});
  }, [sendSignal]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((prev) => !prev);
  }, []);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsVideoOn((prev) => !prev);
  }, []);

  const shareScreen = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;

      const peer = peerRef.current;
      if (peer && localStreamRef.current) {
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peer.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }

      setIsScreenSharing(true);

      // Auto-stop when user clicks "Stop sharing" in browser UI
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error('Screen share error:', err);
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    // Restore camera track
    const peer = peerRef.current;
    if (peer && localStreamRef.current) {
      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      const sender = peer.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && cameraTrack) {
        sender.replaceTrack(cameraTrack);
      }
    }

    setIsScreenSharing(false);
  }, []);

  // ─── Cleanup on unmount ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.close();
    };
  }, []);

  return {
    localStream,
    remoteStream,
    callState,
    isMuted,
    isVideoOn,
    isScreenSharing,
    startCall,
    acceptCall,
    endCall,
    toggleMute,
    toggleVideo,
    shareScreen,
    stopScreenShare,
  };
}
