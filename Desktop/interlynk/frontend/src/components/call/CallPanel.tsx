/**
 * CallPanel - Full WebRTC Voice & Video Call UI
 *
 * Features:
 * - Live local + remote video streams via useWebRTC hook
 * - Mute, Video toggle, Screen share, Raise hand, Leave call
 * - Participants panel with real-time mute/video status
 * - In-call chat panel
 * - Timer, fullscreen mode, active-speaker indicator
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Monitor, MessageSquare, Users, Maximize2, Minimize2, Hand,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Avatar, Tooltip, Badge } from '@/components/ui';
import { useCallStore, useAuthStore } from '@/store/useAppStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useAudioLevel } from '@/hooks/useAudioLevel';
import { callApi } from '@/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
}

// Use the global stompClient exposed from the hook module
// We read it via a helper so the WebRTC hook can send signals
declare global {
  interface Window {
    __stompClient?: import('@stomp/stompjs').Client | null;
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function CallPanel() {
  const {
    isMuted: storeMuted,
    isVideoEnabled: storeVideo,
    isScreenSharing: storeScreen,
    currentCall,
    setCurrentCall,
    isInCall,
    setInCall,
    remoteUser,
    setRemoteUser,
  } = useCallStore();
  const { user } = useAuthStore();

  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [showChat, setShowChat] = React.useState(false);
  const [showParticipants, setShowParticipants] = React.useState(false);
  const [callDuration, setCallDuration] = React.useState(0);
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = React.useState(false);
  const [handRaised, setHandRaised] = React.useState(false);

  const callRoomId = currentCall ? String(currentCall.id) : null;

  // Determine call type from currentCall
  const callType: 'voice' | 'video' =
    currentCall && (currentCall as any).callType === 'voice' ? 'voice' : 'video';

  // Determine if we are the initiator. Backend ships `hostId` as a number; coerce
  // both sides to strings so the comparison is type-agnostic. Falls back to the
  // username comparison if `hostId` is unavailable for any reason.
  const isInitiator = React.useMemo(() => {
    if (!currentCall || !user) return false;
    if (currentCall.hostId != null) {
      return String(currentCall.hostId) === String(user.id);
    }
    const createdBy = (currentCall as any).createdByUsername;
    return createdBy != null && createdBy === user.username;
  }, [currentCall, user]);

  // Find the target user for 1-on-1 signaling. The caller's `currentCall.participants`
  // is empty at the moment `call-accepted` arrives (the room snapshot is from before
  // either side joined), so fall back to the `remoteUser` the caller stashed when
  // dialing — that is always the dial target.
  const targetUserId = React.useMemo(() => {
    if (!currentCall || !user) return null;
    const otherMember = currentCall.participants?.find(p => String(p.userId) !== String(user.id));
    if (otherMember) return otherMember.userId;
    if (remoteUser?.id) return remoteUser.id;
    return null;
  }, [currentCall, user, remoteUser]);

  // ── WebRTC ──────────────────────────────────────────────────────────────────
  const {
    localStream,
    remoteStream,
    callState,
    isMuted,
    isVideoOn,
    isScreenSharing,
    startCall,
    endCall: webrtcEndCall,
    toggleMute,
    toggleVideo,
    shareScreen,
    stopScreenShare,
  } = useWebRTC({
    roomId: callRoomId,
    targetUserId: targetUserId,
    callType,
    stompClient: window.__stompClient ?? null,
    isInitiator: isInitiator,
  });

  // ── Active speaker detection ────────────────────────────────────────────────
  const { isSpeaking: localSpeaking } = useAudioLevel(localStream);
  const { isSpeaking: remoteSpeaking } = useAudioLevel(remoteStream);
  // Suppress local speaking ring while muted — the track is silent but a tiny
  // amount of noise can still exceed the threshold in some browsers.
  const localActiveSpeaker = localSpeaking && !isMuted;

  // ── WebRTC Signaling & Initialization ──────────────────────────────────────────
  React.useEffect(() => {
    const handler = (e: Event) => {
      const signal = (e as CustomEvent).detail;
      
      if (signal.type === 'call-accepted') {
        if (isInitiator && callState === 'idle') {
          console.log('Callee accepted. Starting WebRTC offer...');
          startCall();
        }
      } else if (signal.type === 'call-rejected') {
        console.log('Call was rejected by the other user.');
        handleLeaveCall();
      }
    };

    window.addEventListener('webrtc-signal', handler);
    return () => window.removeEventListener('webrtc-signal', handler);
  }, [isInitiator, callState, startCall]);

  // Handle the case where the callee joins late or we need to restart
  // This is a safety effect.
  React.useEffect(() => {
    if (isInitiator && isInCall && callRoomId && targetUserId && callState === 'idle') {
      // In group calls, we might want to start immediately.
      // But for 1-on-1, we wait for 'call-accepted' signal.
      if (currentCall?.type === 'GROUP') {
        startCall();
      }
    }
  }, [isInitiator, isInCall, callRoomId, targetUserId, callState, startCall, currentCall?.type]);


  // Bind local video stream
  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);
  // Dedicated <audio> sink for voice calls. VoiceOnlyGrid renders no media
  // element, so without this the remote audio track has no output and the
  // caller hears nothing — the source of the "one-way audio" symptom.
  const remoteAudioRef = React.useRef<HTMLAudioElement>(null);

  React.useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  React.useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // ── Timer ───────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isInCall) return;
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isInCall]);

  // ── Participants polling ─────────────────────────────────────────────────────
  const fetchParticipants = React.useCallback(async (roomId: string) => {
    setIsLoadingParticipants(true);
    try {
      const res = await callApi.getParticipants(roomId);
      if (Array.isArray(res.data)) {
        setParticipants(
          res.data.map((p: any) => ({
            id: String(p.id),
            userId: String(p.userId),
            username: p.username || '',
            displayName: p.displayName || p.username || 'Unknown',
            avatar: p.avatarUrl,
            isMuted: p.isMuted || false,
            isVideoEnabled: p.isVideoEnabled !== false,
            isScreenSharing: p.isScreenSharing || false,
          }))
        );
      }
    } catch (e) {
      console.error('Failed to fetch participants:', e);
    } finally {
      setIsLoadingParticipants(false);
    }
  }, []);

  React.useEffect(() => {
    if (!callRoomId || !isInCall) return;
    fetchParticipants(callRoomId);
    const interval = setInterval(() => fetchParticipants(callRoomId), 5000);
    return () => clearInterval(interval);
  }, [callRoomId, isInCall, fetchParticipants]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleLeaveCall = async () => {
    webrtcEndCall();
    if (callRoomId) {
      try {
        await callApi.leaveCall(callRoomId);
      } catch (e) {
        console.error('Failed to leave call:', e);
      }
    }
    setInCall(false);
    setCurrentCall(null);
    setRemoteUser(null);
    setCallDuration(0);
    setParticipants([]);
  };

  const handleToggleMute = async () => {
    toggleMute();
    if (callRoomId) {
      try {
        await callApi.updateState(callRoomId, { isMuted: !isMuted });
      } catch (e) { /* non-critical */ }
    }
  };

  const handleToggleVideo = async () => {
    toggleVideo();
    if (callRoomId) {
      try {
        await callApi.updateState(callRoomId, { isVideoEnabled: !isVideoOn });
      } catch (e) { /* non-critical */ }
    }
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      if (callRoomId) await callApi.updateState(callRoomId, { isScreenSharing: false });
    } else {
      await shareScreen();
      if (callRoomId) await callApi.updateState(callRoomId, { isScreenSharing: true });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  // Show "Dialing" screen when we are the caller and the other person hasn't joined yet
  const isDialing = isInitiator && remoteUser && !remoteStream && callState !== 'connected';

  if (isDialing) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-full bg-[#0d1117] ${
          isFullscreen ? 'fixed inset-0 z-50' : ''
        }`}
        style={{ background: 'radial-gradient(ellipse at center, #1a1a3e 0%, #0d1117 70%)' }}
      >
        {/* Ripple rings */}
        <div className="relative flex items-center justify-center mb-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border-2 border-indigo-400/30"
              style={{ width: 120 + i * 48, height: 120 + i * 48 }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5 }}
            />
          ))}

          {/* Avatar */}
          <div
            className="relative z-10 w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 0 0 4px rgba(255,255,255,0.1)',
            }}
          >
            {remoteUser.avatarUrl ? (
              <img src={remoteUser.avatarUrl} alt={remoteUser.displayName} className="w-full h-full rounded-full object-cover" />
            ) : (
              remoteUser.displayName.charAt(0).toUpperCase()
            )}
          </div>
        </div>

        {/* Name & status */}
        <h2 className="text-2xl font-bold text-white mb-1">{remoteUser.displayName}</h2>
        <p className="text-sm text-white/50 mb-1">@{remoteUser.username}</p>
        <p className="text-sm text-white/40 animate-pulse mb-10">
          {callType === 'video' ? '📹 Calling with video…' : '🎙 Calling…'}
        </p>

        {/* Hang up */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleLeaveCall}
          className="w-16 h-16 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-500 text-white"
          style={{ boxShadow: '0 4px 24px rgba(239,68,68,0.5)' }}
        >
          <PhoneOff className="w-6 h-6" />
        </motion.button>
        <p className="text-xs text-white/30 mt-3">Cancel</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col bg-[#0d1117] transition-all duration-300',
        isFullscreen ? 'fixed inset-0 z-50' : 'h-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#161b22]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-mono font-semibold text-white">
              {formatDuration(callDuration)}
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              background: callType === 'video' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)',
              color: callType === 'video' ? '#818cf8' : '#34d399',
              border: `1px solid ${callType === 'video' ? 'rgba(99,102,241,0.3)' : 'rgba(52,211,153,0.3)'}`,
            }}
          >
            {callType === 'video' ? '📹 Video' : '🎙 Voice'} Call
          </span>
          <Badge variant="info">{participants.length} in call</Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <Tooltip content="Participants">
            <Button
              variant={showParticipants ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); }}
            >
              <Users className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="In-call Chat">
            <Button
              variant={showChat ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => { setShowChat(!showChat); setShowParticipants(false); }}
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Grid */}
        <div className={cn('flex-1 p-4 transition-all duration-300', (showChat || showParticipants) && 'mr-[320px]')}>
          {callType === 'video' ? (
            <VideoGrid
              localStream={localStream}
              remoteStream={remoteStream}
              localVideoRef={localVideoRef}
              remoteVideoRef={remoteVideoRef}
              participants={participants}
              currentUser={user}
              isVideoOn={isVideoOn}
              localSpeaking={localActiveSpeaker}
              remoteSpeaking={remoteSpeaking}
            />
          ) : (
            <>
              <VoiceOnlyGrid
                participants={participants}
                currentUser={user}
                localSpeaking={localActiveSpeaker}
                remoteSpeaking={remoteSpeaking}
              />
              {/* Hidden audio sink — required for voice calls because the
                  VoiceOnlyGrid renders no <audio>/<video> element of its own.
                  Without this the remote MediaStream has nowhere to play. */}
              <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
            </>
          )}
        </div>

        {/* Side panels */}
        <AnimatePresence>
          {showParticipants && (
            <motion.div
              key="participants-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="absolute right-0 top-0 bottom-0 bg-[#161b22] border-l border-white/10 overflow-hidden"
            >
              <ParticipantsPanel
                participants={participants}
                currentUserId={user?.id || ''}
                localSpeaking={localActiveSpeaker}
                remoteSpeaking={remoteSpeaking}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showChat && (
            <motion.div
              key="chat-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="absolute right-0 top-0 bottom-0 bg-[#161b22] border-l border-white/10 overflow-hidden"
            >
              <CallChatPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-center gap-3 px-6 py-5 bg-[#161b22] border-t border-white/10">
        {/* Mute */}
        <Tooltip content={isMuted ? 'Unmute' : 'Mute'}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleToggleMute}
            id="call-toggle-mute-btn"
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200',
              isMuted
                ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                : 'bg-white/10 border border-white/10 text-white hover:bg-white/20'
            )}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </motion.button>
        </Tooltip>

        {/* Video (only relevant for video calls) */}
        {callType === 'video' && (
          <Tooltip content={isVideoOn ? 'Turn off camera' : 'Turn on camera'}>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleToggleVideo}
              id="call-toggle-video-btn"
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200',
                !isVideoOn
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                  : 'bg-white/10 border border-white/10 text-white hover:bg-white/20'
              )}
            >
              {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </motion.button>
          </Tooltip>
        )}

        {/* Screen Share */}
        <Tooltip content={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleScreenShare}
            id="call-toggle-screen-btn"
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200',
              isScreenSharing
                ? 'bg-indigo-500/30 border border-indigo-400/50 text-indigo-300'
                : 'bg-white/10 border border-white/10 text-white hover:bg-white/20'
            )}
          >
            <Monitor className="w-5 h-5" />
          </motion.button>
        </Tooltip>

        {/* Raise hand */}
        <Tooltip content={handRaised ? 'Lower hand' : 'Raise hand'}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setHandRaised(!handRaised)}
            id="call-raise-hand-btn"
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200',
              handRaised
                ? 'bg-amber-500/30 border border-amber-400/50 text-amber-300'
                : 'bg-white/10 border border-white/10 text-white hover:bg-white/20'
            )}
          >
            <Hand className="w-5 h-5" />
          </motion.button>
        </Tooltip>

        {/* Divider */}
        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* End Call */}
        <Tooltip content="Leave call">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleLeaveCall}
            id="call-leave-btn"
            className="w-14 h-12 rounded-full flex items-center justify-center transition-all duration-200 bg-red-600 hover:bg-red-500 text-white"
            style={{ boxShadow: '0 4px 20px rgba(239,68,68,0.4)' }}
          >
            <PhoneOff className="w-5 h-5" />
          </motion.button>
        </Tooltip>
      </div>
    </div>
  );
}

// ─── Video Grid ────────────────────────────────────────────────────────────────

// Small animated equalizer bars shown in the name tag when someone is speaking.
function EqualizerBars() {
  return (
    <span className="inline-flex items-end gap-[2px] h-3 ml-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-green-400"
          animate={{ height: ['4px', '10px', '4px'] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          style={{ display: 'inline-block' }}
        />
      ))}
    </span>
  );
}

function VideoGrid({
  localStream,
  remoteStream,
  localVideoRef,
  remoteVideoRef,
  participants,
  currentUser,
  isVideoOn,
  localSpeaking,
  remoteSpeaking,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  participants: Participant[];
  currentUser: any;
  isVideoOn: boolean;
  localSpeaking: boolean;
  remoteSpeaking: boolean;
}) {
  const hasRemote = !!remoteStream;

  return (
    <div className={cn('grid gap-3 h-full', hasRemote ? 'grid-cols-2' : 'grid-cols-1')}>
      {/* Local stream */}
      <motion.div
        animate={localSpeaking ? {
          boxShadow: ['0 0 0 0px rgba(74,222,128,0.0)', '0 0 0 3px rgba(74,222,128,0.7)', '0 0 0 3px rgba(74,222,128,0.7)'],
        } : {
          boxShadow: '0 0 0 0px rgba(74,222,128,0.0)',
        }}
        transition={{ duration: 0.2 }}
        className="relative rounded-2xl overflow-hidden bg-[#1c2128] border border-white/10 flex items-center justify-center min-h-[200px]"
        style={localSpeaking ? { borderColor: 'rgba(74,222,128,0.7)' } : undefined}
      >
        {isVideoOn && localStream ? (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white">
              {currentUser?.displayName?.charAt(0).toUpperCase() || 'Y'}
            </div>
            <p className="text-sm text-white/60">Camera off</p>
          </div>
        )}
        <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md text-xs font-medium text-white bg-black/50 backdrop-blur-sm flex items-center">
          You
          {localSpeaking && <EqualizerBars />}
        </div>
      </motion.div>

      {/* Remote stream */}
      {hasRemote && (
        <motion.div
          animate={remoteSpeaking ? {
            boxShadow: ['0 0 0 0px rgba(74,222,128,0.0)', '0 0 0 3px rgba(74,222,128,0.7)', '0 0 0 3px rgba(74,222,128,0.7)'],
          } : {
            boxShadow: '0 0 0 0px rgba(74,222,128,0.0)',
          }}
          transition={{ duration: 0.2 }}
          className="relative rounded-2xl overflow-hidden bg-[#1c2128] border border-white/10 flex items-center justify-center min-h-[200px]"
          style={remoteSpeaking ? { borderColor: 'rgba(74,222,128,0.7)' } : undefined}
        >
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {participants.length > 0 && (
            <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md text-xs font-medium text-white bg-black/50 backdrop-blur-sm flex items-center">
              {participants.find((p) => p.userId !== String(currentUser?.id))?.displayName || 'Remote'}
              {remoteSpeaking && <EqualizerBars />}
            </div>
          )}
        </motion.div>
      )}

      {/* Waiting state */}
      {!hasRemote && (
        <div className="col-span-full flex items-center justify-center">
          {participants.length <= 1 && (
            <div className="text-center text-white/40">
              <div className="w-8 h-8 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">Waiting for others to join…</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Voice-Only Grid ───────────────────────────────────────────────────────────

function VoiceOnlyGrid({
  participants,
  currentUser,
  localSpeaking,
  remoteSpeaking,
}: {
  participants: Participant[];
  currentUser: any;
  localSpeaking: boolean;
  remoteSpeaking: boolean;
}) {
  const allParticipants = participants.length > 0
    ? participants
    : [{ id: 'me', userId: String(currentUser?.id), username: currentUser?.username || '', displayName: currentUser?.displayName || 'You', isMuted: false, isVideoEnabled: false, isScreenSharing: false }];

  return (
    <div className="flex flex-wrap items-center justify-center gap-8 h-full content-center">
      {allParticipants.map((p) => {
        const isLocal = String(p.userId) === String(currentUser?.id);
        const speaking = isLocal ? localSpeaking : remoteSpeaking;

        return (
          <div key={p.id} className="flex flex-col items-center gap-3">
            <motion.div
              animate={speaking ? {
                boxShadow: [
                  '0 0 0 3px rgba(255,255,255,0.1)',
                  '0 0 0 6px rgba(74,222,128,0.55)',
                  '0 0 0 6px rgba(74,222,128,0.55)',
                ],
              } : {
                boxShadow: '0 0 0 3px rgba(255,255,255,0.1)',
              }}
              transition={{ duration: 0.2 }}
              className="relative w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              {p.displayName.charAt(0).toUpperCase()}
              {p.isMuted && (
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center border-2 border-[#0d1117]">
                  <MicOff className="w-3 h-3 text-white" />
                </div>
              )}
            </motion.div>

            <div className="flex items-center gap-1.5">
              <p className={cn(
                'text-sm font-medium transition-colors duration-150',
                speaking ? 'text-white' : 'text-white/80'
              )}>
                {p.displayName}
              </p>
              {speaking && <EqualizerBars />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Participants Panel ────────────────────────────────────────────────────────

function ParticipantsPanel({
  participants,
  currentUserId,
  localSpeaking,
  remoteSpeaking,
}: {
  participants: Participant[];
  currentUserId: string;
  localSpeaking: boolean;
  remoteSpeaking: boolean;
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/10">
        <h3 className="font-semibold text-white">Participants ({participants.length})</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {participants.length === 0 ? (
          <p className="p-4 text-center text-white/40 text-sm">No participants yet</p>
        ) : (
          participants.map((p) => {
            const isLocal = String(p.userId) === String(currentUserId);
            const speaking = isLocal ? localSpeaking : remoteSpeaking;

            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                {/* Avatar with green speaking dot */}
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                    {p.displayName.charAt(0).toUpperCase()}
                  </div>
                  {speaking && (
                    <motion.div
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-[#161b22]"
                      animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium truncate transition-colors duration-150',
                    speaking ? 'text-white' : 'text-white/80'
                  )}>
                    {p.displayName}
                    {isLocal && <span className="text-white/40 ml-1">(You)</span>}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {speaking && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                  {p.isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                  {!p.isVideoEnabled && <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                  {p.isScreenSharing && <Monitor className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── In-call Chat Panel ────────────────────────────────────────────────────────

function CallChatPanel() {
  const [messages, setMessages] = React.useState<{ id: string; author: string; text: string; time: string }[]>([
    { id: '1', author: 'System', text: 'Welcome to the call! You can chat here during the call.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [input, setInput] = React.useState('');
  const { user } = useAuthStore();
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), author: user?.displayName || 'You', text: input.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);
    setInput('');
  };

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/10">
        <h3 className="font-semibold text-white">Chat</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m) => (
          <div key={m.id}>
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-white/70">{m.author}</span>
              <span className="text-[10px] text-white/30">{m.time}</span>
            </div>
            <p className="text-sm text-white/60 mt-0.5">{m.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-white/10">
        <form onSubmit={send} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message…"
            className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500"
          />
          <Button type="submit" size="sm">Send</Button>
        </form>
      </div>
    </div>
  );
}

export default CallPanel;
