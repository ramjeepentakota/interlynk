/* InterLynk Login + Call + Settings + Tweaks + Incoming Call.
   Fully backend-wired; no mock participants or simulated calls.
   Voice CHANNELS (ambient, Discord-style) have been removed — only 1-on-1
   and group voice/video calls are supported here. */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Ic, type IconName } from './icons';
import { Avatar, Input, Tip } from './ui';
import { useApp, type Accent, type Theme } from './context';
import { useLiveKit, attachCameraTrack, type LiveKitParticipant } from '@/hooks/useLiveKit';
import { useWebRTC } from '@/hooks/useWebRTC';
import { Track } from 'livekit-client';
import { colorFor, type User } from './data';
import * as api from './api';
import { useAuthStore } from '@/store/useAppStore';
import { publishCallSignal } from './realtime';

/* ── LoginScreen ─────────────────────────────────────────── */
export function LoginScreen() {
  const { login, authError, theme, setTheme } = useApp();
  const [username, setUsername] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: { preventDefault: () => void }) => {
    e && e.preventDefault();
    if (!username.trim() || !pass) return;
    setLoading(true);
    try {
      await login(username, pass);
    } catch {
      /* authError surfaced via context */
    } finally {
      setLoading(false);
    }
  };

  const features: { icon: IconName; color: string; title: string; desc: string }[] = [
    { icon: 'Msg', color: '#8b5cf6', title: 'Rich Messaging', desc: 'Threads, reactions, @mentions' },
    { icon: 'Video', color: '#10b981', title: 'HD Video & Voice', desc: 'Group calls with screen share' },
    { icon: 'Zap', color: '#f43f5e', title: 'Realtime Sync', desc: 'Live channels powered by WebSocket' },
  ];

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--bg-base)', display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.25) 0%, transparent 65%)', top: '-15%', left: '-15%' }} />
          <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,.12) 0%, transparent 65%)', bottom: '-10%', right: '-10%' }} />
          <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,.09) 0%, transparent 65%)', bottom: '30%', left: '10%' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 420, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,var(--primary) 0%,#a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(139,92,246,.4)' }}>
              <span style={{ color: '#fff', fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 20 }}>IL</span>
            </div>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 24, color: 'var(--t1)', letterSpacing: '-.5px' }}>InterLynk</span>
          </div>

          <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 36, color: 'var(--t1)', lineHeight: 1.15, marginBottom: 16, letterSpacing: '-.5px' }}>
            Your team,<br />
            <span style={{ background: 'linear-gradient(135deg,var(--primary),#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>in sync.</span>
          </h2>
          <p style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 40 }}>Chat, voice &amp; video calls, and code collaboration — all in one place.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {features.map(({ icon, color, title, desc }) => {
              const IconCmp = Ic[icon];
              return (
                <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'var(--r-lg)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}22`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconCmp s={16} c={color} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>{title}</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>{desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ width: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--bd)', position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{ position: 'absolute', top: 20, right: 20, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', padding: '6px 11px', cursor: 'pointer', color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          {theme === 'dark' ? <Ic.Sun s={13} /> : <Ic.Moon s={13} />} {theme === 'dark' ? 'Light' : 'Dark'}
        </button>

        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 24, color: 'var(--t1)', marginBottom: 4 }}>
              Welcome back
            </h3>
            <p style={{ fontSize: 14, color: 'var(--t3)' }}>
              Sign in to your workspace
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input label="Email or Username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="you@company.com" icon={<Ic.Mail s={15} />} autoFocus />
              <Input
                label="Password"
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••••"
                icon={<Ic.Lock s={15} />}
                rightIcon={<span onClick={() => setShowPass(!showPass)} style={{ cursor: 'pointer', display: 'flex' }}>{showPass ? <Ic.EyeOff s={15} /> : <Ic.Eye s={15} />}</span>}
              />

              {authError && (
                <div style={{ fontSize: 13, color: 'var(--err)', background: 'var(--err-dim)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 'var(--r)', padding: '8px 12px' }}>
                  {authError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: 'var(--t2)' }}>
                  <input type="checkbox" style={{ accentColor: 'var(--primary)' }} /> Remember me
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', height: 44, borderRadius: 'var(--r)', background: 'linear-gradient(135deg,var(--primary) 0%,var(--primary-h) 100%)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, boxShadow: '0 4px 20px rgba(139,92,246,.35)', transition: 'opacity .15s', opacity: loading ? 0.75 : 1, fontFamily: "'DM Sans',sans-serif" }}
              >
                {loading ? (
                  <><Ic.Loader s={17} className="il-spin" /> Signing in…</>
                ) : (
                  <>Sign In<Ic.ArrR s={16} /></>
                )}
              </button>
            </div>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--t3)', marginTop: 20 }}>
            By continuing you agree to the <span style={{ color: 'var(--t-link)', cursor: 'pointer' }}>Terms of Service</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Call Panel (LiveKit SFU) ────────────────────────────── */

/** A single participant's video tile (camera or screen share). */
function VideoTile({ p, big }: { p: LiveKitParticipant; big?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const source = p.screenSharing ? Track.Source.ScreenShare : Track.Source.Camera;
  const pub = p.participant.getTrackPublication(source);
  const trackSid = pub?.trackSid;
  const hasVideo = Boolean(pub?.videoTrack && !pub.isMuted);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasVideo) return;
    const detach = attachCameraTrack(p.participant, el, source);
    return detach;
    // re-attach when the underlying track (sid) or visibility changes
  }, [p.participant, source, trackSid, hasVideo]);

  const avatarUser: Partial<User> = { name: p.name, color: colorFor(p.identity) };

  return (
    <div style={{ position: 'relative', background: '#0d0e18', borderRadius: 'var(--r-xl)', overflow: 'hidden', border: `2px solid ${p.isSpeaking ? 'var(--ok)' : 'rgba(255,255,255,.07)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minHeight: big ? 0 : 140 }}>
      {hasVideo ? (
        <video ref={ref} autoPlay playsInline muted={p.isLocal} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: p.isLocal && !p.screenSharing ? 'scaleX(-1)' : 'none' }} />
      ) : (
        <Avatar user={avatarUser} size={big ? 96 : 56} />
      )}
      <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', borderRadius: 6, padding: '3px 8px', fontSize: 12, color: '#fff', fontWeight: 600 }}>
        {!p.micEnabled && <Ic.MicOff s={12} c="#f87171" />}
        {p.name}{p.isLocal ? ' (you)' : ''}
      </div>
    </div>
  );
}

/** A circular avatar used in the call lobby (mic-muted ring + name pill). */
function VoiceAvatar({ name, identity, speaking, muted, isLocal }: { name: string; identity: string; speaking: boolean; muted: boolean; isLocal?: boolean }) {
  const avatarUser: Partial<User> = { name, color: colorFor(identity) };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 120 }}>
      <div style={{ position: 'relative', borderRadius: '50%', padding: 4, background: speaking ? 'var(--ok)' : 'transparent', transition: 'background .15s' }}>
        <Avatar user={avatarUser} size={72} />
        <div style={{ position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: '50%', background: muted ? '#ef4444' : 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #09090e' }}>
          {muted ? <Ic.MicOff s={12} c="#fff" /> : <Ic.Mic s={12} c="#fff" />}
        </div>
      </div>
      <span style={{ fontSize: 13, color: '#fff', fontWeight: 600, textAlign: 'center', maxWidth: 116, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}{isLocal ? ' (you)' : ''}
      </span>
    </div>
  );
}

export function CallPanel() {
  const { callSession, endCurrentCall, currentUser } = useApp();
  const [token, setToken] = useState<api.LiveKitToken | null>(null);
  const [duration, setDuration] = useState(0);
  const callType = callSession?.callType ?? 'voice';
  const title = callSession?.title ?? 'Call';
  const roomId = callSession?.roomId ?? null;
  const targetUserId = callSession?.targetUserId ?? null;
  const isInitiator = callSession?.isInitiator ?? false;
  // The callee enters CallPanel only after they accepted, so from their POV
  // the call is already "accepted". The initiator starts in a waiting state
  // and flips to accepted when the callee's accept signal arrives.
  const [calleeAccepted, setCalleeAccepted] = useState(!isInitiator);

  // Listen for remote call signaling state changes (accepted / rejected / ended).
  useEffect(() => {
    const handler = (e: Event) => {
      const signal = (e as CustomEvent).detail;
      if (!signal) return;
      if (signal.type === 'call-ended' || signal.type === 'call-rejected') {
        endCurrentCall();
      } else if (signal.type === 'call-accepted') {
        setCalleeAccepted(true);
      }
    };
    window.addEventListener('webrtc-signal', handler);
    return () => window.removeEventListener('webrtc-signal', handler);
  }, [endCurrentCall]);

  useEffect(() => {
    if (roomId == null) return;
    let cancelled = false;
    api.fetchLiveKitToken(roomId, true).then((t) => { if (!cancelled) setToken(t); }).catch(() => { if (!cancelled) setToken({ configured: false }); });
    return () => { cancelled = true; };
  }, [roomId]);

  const lk = useLiveKit({
    url: token?.url,
    token: token?.token,
    withVideo: callType === 'video',
    enabled: Boolean(token?.configured && token?.token),
  });

  // WebRTC fallback — used when LiveKit is not configured.
  // Read the shared client off `window` at each render so a connection that
  // came up after the panel mounted is still picked up by the hook.
  const stompClientRef = (window as { __stompClient?: import('@stomp/stompjs').Client | null }).__stompClient ?? null;
  const webrtc = useWebRTC({
    roomId,
    targetUserId,
    callType,
    stompClient: stompClientRef,
    isInitiator,
  });

  // Start WebRTC offer when LiveKit is not configured AND we are the initiator
  // AND the callee has actually accepted (otherwise the offer would race the
  // callee's CallPanel mount and the webrtc-signal listener would not catch it).
  const tokenResolved = token !== null;
  const lkConfigured = Boolean(token?.configured);
  useEffect(() => {
    if (!tokenResolved || lkConfigured) return;
    if (!isInitiator) return;
    if (roomId == null) return;
    if (webrtc.callState !== 'idle') return;
    // For 1-on-1 direct calls, wait for the callee's explicit accept.
    // For group/voice-channel calls (no specific target user), proceed.
    if (targetUserId != null && !calleeAccepted) return;
    webrtc.startCall();
  }, [tokenResolved, lkConfigured, isInitiator, webrtc.callState, roomId, targetUserId, calleeAccepted, webrtc]);

  // Pre-flight microphone / camera capture the moment the call panel opens in
  // WebRTC mode. This is what triggers the browser permission prompt — without
  // it the user only ever gets prompted after the signaling handshake
  // completes (which never happens if the other side never joins). Requesting
  // up-front also shows the user their own preview immediately, so the call
  // never looks "dead". Safe to call repeatedly: the hook reuses the stream.
  useEffect(() => {
    if (!tokenResolved || lkConfigured) return;
    if (roomId == null) return;
    if (webrtc.localStream) return;
    if (webrtc.callState === 'ended' || webrtc.callState === 'error') return;
    webrtc.preflightLocalMedia();
  }, [tokenResolved, lkConfigured, roomId, webrtc.localStream, webrtc.callState, webrtc]);

  // Bind WebRTC media elements. The dependency lists include the visibility
  // flags (camera/screen on, remote video off) so the effect re-runs and binds
  // srcObject the moment a <video> element (un)mounts — not only when the stream
  // object changes — which is what previously left a freshly-shown tile blank.
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  // Dedicated, always-mounted sink for remote AUDIO. Voice calls render no
  // <video>, so without this element the remote audio track was never attached
  // and the call was silent. The remote <video> is muted (below) so audio only
  // ever plays through here — no echo/double audio on video calls.
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (localVideoRef.current && webrtc.localStream) localVideoRef.current.srcObject = webrtc.localStream;
  }, [webrtc.localStream, webrtc.isVideoOn, webrtc.isScreenSharing]);
  useEffect(() => {
    if (remoteVideoRef.current && webrtc.remoteStream) remoteVideoRef.current.srcObject = webrtc.remoteStream;
  }, [webrtc.remoteStream, webrtc.remoteVideoOff, webrtc.remoteScreenSharing]);
  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el || !webrtc.remoteStream) return;
    el.srcObject = webrtc.remoteStream;
    el.muted = false;
    el.volume = 1;
    // Autoplay is allowed here because entering a call is a user gesture, but
    // some browsers (especially Chromium on a fresh tab) still reject the
    // first play() — retry on the next tick so a transient rejection doesn't
    // leave the call silent. Also re-run whenever the stream's track list
    // changes so a late-arriving remote audio track is bound immediately.
    const tryPlay = () => el.play?.().catch(() => undefined);
    tryPlay();
    const t1 = window.setTimeout(tryPlay, 100);
    const t2 = window.setTimeout(tryPlay, 500);
    const stream = webrtc.remoteStream;
    const onAddTrack = () => {
      el.srcObject = stream;
      tryPlay();
    };
    stream.addEventListener?.('addtrack', onAddTrack);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      stream.removeEventListener?.('addtrack', onAddTrack);
    };
  }, [webrtc.remoteStream]);

  useEffect(() => {
    const t = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const hangUp = async () => {
    // Notify the other party. For 1-on-1 we already know targetUserId; for
    // group calls (no specific target) we just tear down locally — other
    // participants get a participant_left broadcast on the room topic from
    // the leaveCall API.
    const authUser = useAuthStore.getState().user;
    if (callSession && authUser && callSession.targetUserId) {
      publishCallSignal({
        type: 'call-ended',
        roomId: callSession.roomId,
        senderUserId: Number(authUser.id),
        targetUserId: callSession.targetUserId,
        callType: callSession.callType,
      });
    }
    lk.disconnect();
    webrtc.endCall();
    await endCurrentCall();
  };

  // Determine which media system to use
  const configured = Boolean(token?.configured);
  // Use WebRTC when LiveKit is not configured; use LiveKit when configured
  const useWebRTCMode = tokenResolved && !configured;

  // Unified media controls
  const isMicOn = configured ? lk.micEnabled : !webrtc.isMuted;
  const isCamOn = configured ? lk.cameraEnabled : webrtc.isVideoOn;
  const isScreenOn = configured ? lk.screenSharing : webrtc.isScreenSharing;
  const toggleMic = configured ? lk.toggleMic : webrtc.toggleMute;
  const toggleCam = configured ? lk.toggleCamera : webrtc.toggleVideo;
  const toggleScreen = configured ? lk.toggleScreenShare : webrtc.shareScreen;
  const stopScreen = webrtc.stopScreenShare;

  const connecting = configured ? (lk.state !== 'connected' && lk.state !== 'error') : (webrtc.callState === 'connecting');
  const isConnected = configured ? lk.state === 'connected' : webrtc.callState === 'connected';

  // Show a friendly status that reflects the dial-state for the caller and
  // the connection state for everyone else.
  const isCallerWaiting = useWebRTCMode && isInitiator && targetUserId != null && !calleeAccepted;
  const stateLabel = configured
    ? (lk.state === 'connected' ? 'connected' : lk.state === 'error' ? 'media error' : 'connecting…')
    : webrtc.callState === 'error'
      ? 'error'
      : webrtc.callState === 'connected'
        ? 'connected'
        : isCallerWaiting
          ? 'ringing…'
          : webrtc.callState === 'connecting'
            ? 'connecting…'
            : 'ready';

  // Roster: LiveKit participants when connected. Voice-channel backend roster
  // was removed along with the voice-channel feature.
  const lkParticipants = lk.participants;

  const showLkVideoGrid = callType === 'video' && configured && lkParticipants.length > 0;
  // Use the video grid for video calls, and also whenever a screen is being
  // shared in either direction — so screen share is visible during voice calls.
  const showWebRTCVideoGrid =
    useWebRTCMode &&
    (callType === 'video' || webrtc.isScreenSharing || webrtc.remoteScreenSharing) &&
    Boolean(webrtc.localStream || webrtc.remoteStream);
  // Whether the remote peer currently has visible video (camera on, or sharing).
  const remoteHasVideo =
    Boolean(webrtc.remoteStream) && (webrtc.remoteScreenSharing || (callType === 'video' && !webrtc.remoteVideoOff));

  const ctrlBtn = (label: string, icon: IconName, active: boolean, color: string, onClick: () => void) => {
    const IconCmp = Ic[icon];
    return (
      <Tip label={label} pos="top">
        <button
          onClick={onClick}
          style={{ width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer', background: active ? `${color}25` : 'rgba(255,255,255,.1)', color: active ? color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', backdropFilter: 'blur(8px)' }}
        >
          <IconCmp s={20} />
        </button>
      </Tip>
    );
  };

  return (
    <div style={{ position: 'relative', background: '#09090e', display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden' }}>
      {/* Hidden sink for remote audio in WebRTC mode — always mounted so voice
          calls (which render no <video>) still play the other party's voice. */}
      {useWebRTCMode && <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(255,255,255,.04)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? 'var(--ok)' : connecting ? 'var(--warn)' : '#6b7280', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#fff', fontWeight: 600 }}>{fmt(duration)}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: callType === 'video' ? 'rgba(139,92,246,.2)' : 'rgba(34,197,94,.2)', color: callType === 'video' ? '#a78bfa' : '#4ade80', border: `1px solid ${callType === 'video' ? 'rgba(139,92,246,.3)' : 'rgba(34,197,94,.3)'}` }}>
            {callType === 'video' ? '📹 ' : '🎙 '}{title}
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>{stateLabel}</span>
        </div>
      </div>

      {webrtc.errorMessage && useWebRTCMode && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          borderBottom: '1px solid rgba(239,68,68,0.3)',
          color: '#fca5a5',
          padding: '10px 20px',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          <Ic.PhoneOff s={14} c="#fca5a5" />
          <span style={{ flex: 1 }}>{webrtc.errorMessage}</span>
          <button
            onClick={hangUp}
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Close
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 20 }}>
        {showLkVideoGrid ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${lkParticipants.length === 1 ? 1 : lkParticipants.length <= 4 ? 2 : 3}, 1fr)`, gap: 12, height: '100%', minHeight: 0 }}>
            {lkParticipants.map((p) => (
              <VideoTile key={p.identity} p={p} big={lkParticipants.length <= 2} />
            ))}
          </div>
        ) : showWebRTCVideoGrid ? (
          <div style={{ display: 'grid', gridTemplateColumns: webrtc.remoteStream ? '1fr 1fr' : '1fr', gap: 12, height: '100%', minHeight: 0 }}>
            <div style={{ position: 'relative', background: '#1c2128', borderRadius: 'var(--r-xl)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
              {(isCamOn || isScreenOn) && webrtc.localStream ? (
                <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: isScreenOn ? 'none' : 'scaleX(-1)' }} />
              ) : (
                <VoiceAvatar name={currentUser?.name || 'You'} identity={currentUser?.username || 'you'} speaking={false} muted={!isMicOn} isLocal />
              )}
              <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,.6)', borderRadius: 6, padding: '3px 8px', fontSize: 12, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                {!isMicOn && <Ic.MicOff s={12} c="#f87171" />}You{isScreenOn ? ' · sharing' : ''}
              </div>
            </div>
            {webrtc.remoteStream && (
              <div style={{ position: 'relative', background: '#1c2128', borderRadius: 'var(--r-xl)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                {/* The <video> stays mounted (so its srcObject binding survives) and
                    is hidden behind the avatar when the peer has no visible video.
                    It is muted — remote audio plays via the dedicated <audio>. */}
                <video ref={remoteVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: remoteHasVideo ? 'block' : 'none' }} />
                {!remoteHasVideo && (
                  <VoiceAvatar name={title} identity="remote" speaking={false} muted={webrtc.remoteMuted} />
                )}
                <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,.6)', borderRadius: 6, padding: '3px 8px', fontSize: 12, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {webrtc.remoteMuted && <Ic.MicOff s={12} c="#f87171" />}{title}{webrtc.remoteScreenSharing ? ' · sharing' : ''}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center', alignContent: 'center' }}>
              {configured && lkParticipants.length > 0 ? (
                lkParticipants.map((p) => (
                  <VoiceAvatar key={p.identity} name={p.name} identity={p.identity} speaking={p.isSpeaking} muted={!p.micEnabled} isLocal={p.isLocal} />
                ))
              ) : useWebRTCMode && webrtc.remoteStream ? (
                <>
                  <VoiceAvatar name={currentUser?.name || 'You'} identity={currentUser?.username || 'you'} speaking={false} muted={!isMicOn} isLocal />
                  <VoiceAvatar name={title} identity="remote" speaking={false} muted={webrtc.remoteMuted} />
                </>
              ) : (
                <VoiceAvatar
                  name={currentUser?.name || 'You'}
                  identity={currentUser?.username || 'you'}
                  speaking={false}
                  muted={!isMicOn}
                  isLocal
                />
              )}
            </div>
            {!webrtc.remoteStream && !isConnected && (
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 13 }}>Waiting for others to join…</div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '16px 20px', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
        {ctrlBtn(isMicOn ? 'Mute' : 'Unmute', 'MicOff', !isMicOn, '#ef4444', toggleMic)}
        {callType === 'video' && ctrlBtn(isCamOn ? 'Turn off camera' : 'Turn on camera', 'VideoOff', !isCamOn, '#ef4444', toggleCam)}
        {ctrlBtn(
          isScreenOn ? 'Stop sharing' : 'Share screen',
          'Monitor',
          isScreenOn,
          '#8b5cf6',
          isScreenOn && useWebRTCMode ? stopScreen : toggleScreen
        )}
        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,.12)', margin: '0 4px' }} />
        <Tip label="Leave" pos="top">
          <button
            onClick={hangUp}
            style={{ width: 52, height: 48, borderRadius: 24, border: 'none', cursor: 'pointer', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(239,68,68,.45)' }}
          >
            <Ic.PhoneOff s={20} />
          </button>
        </Tip>
      </div>
    </div>
  );
}

/* ── Incoming Call Overlay ───────────────────────────────── */
export function IncomingCallOverlay() {
  const { incomingCall, setIncomingCall, acceptIncomingCall } = useApp();
  const { user } = useAuthStore();

  if (!incomingCall) return null;

  const caller = {
    name: incomingCall.callerDisplayName || incomingCall.callerUsername,
    avatar: incomingCall.callerAvatarUrl,
    color: 'var(--primary)',
  };

  const handleDecline = () => {
    // Send rejection signal to caller via WebSocket
    if (user) {
      publishCallSignal({
        type: 'call-rejected',
        roomId: incomingCall.roomId,
        senderUserId: Number(user.id),
        targetUserId: incomingCall.callerUserId,
        callType: incomingCall.callType,
      });
    }
    // Best-effort: leave the room on the server side so the caller's leave/end
    // logic stays consistent.
    api.leaveCall(incomingCall.roomId).catch(() => undefined);
    setIncomingCall(null);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 24, pointerEvents: 'none' }}>
      <div className="il-scale-in" style={{ background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-xl)', padding: 20, width: 320, boxShadow: '0 20px 60px rgba(0,0,0,.7)', pointerEvents: 'all' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ position: 'relative' }}>
            <Avatar user={caller} size={48} />
            <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '2px solid var(--ok)', animation: 'ripple 1.5s infinite' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>{caller.name}</div>
            <div style={{ fontSize: 13, color: 'var(--t3)' }}>Incoming {incomingCall.callType} call…</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleDecline}
            style={{ flex: 1, height: 40, borderRadius: 'var(--r)', background: 'var(--err-dim)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--err)', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif" }}
          >
            <Ic.PhoneOff s={16} /> Decline
          </button>
          <button
            onClick={() => acceptIncomingCall()}
            style={{ flex: 1, height: 40, borderRadius: 'var(--r)', background: 'var(--ok-dim)', border: '1px solid rgba(34,197,94,.3)', color: 'var(--ok)', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif" }}
          >
            {incomingCall.callType === 'video' ? <Ic.Video s={16} /> : <Ic.Phone s={16} />} Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Call End Status Banner ─────────────────────────────── */
export function CallEndBanner() {
  const { callEndReason } = useApp();
  if (!callEndReason) return null;
  const isDeclined = callEndReason === 'declined';
  return (
    <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9500, background: isDeclined ? 'rgba(239,68,68,.95)' : 'rgba(15,15,20,.95)', border: `1px solid ${isDeclined ? 'rgba(239,68,68,.5)' : 'rgba(255,255,255,.1)'}`, borderRadius: 'var(--r-xl)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 12px 40px rgba(0,0,0,.6)', backdropFilter: 'blur(12px)' }} className="il-scale-in">
      {isDeclined ? <Ic.PhoneOff s={18} c="#fff" /> : <Ic.PhoneOff s={18} c="rgba(255,255,255,.7)" />}
      <span style={{ color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>
        {isDeclined ? 'Call declined' : 'Call ended'}
      </span>
    </div>
  );
}

/* ── Settings Modal ──────────────────────────────────────── */
export function SettingsModal() {
  const { setShowSettings, theme, setTheme, logout, currentUser } = useApp();
  const me = currentUser || { name: 'You', username: '', role: 'MEMBER' as const };
  const email = useAuthStore.getState().user?.email || '';
  const [activeTab, setActiveTab] = useState('profile');
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdStatus, setPwdStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [pwdError, setPwdError] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdForm.current || !pwdForm.next) return;
    if (pwdForm.next !== pwdForm.confirm) { setPwdStatus('error'); setPwdError('New passwords do not match.'); return; }
    if (pwdForm.next.length < 6) { setPwdStatus('error'); setPwdError('Password must be at least 6 characters.'); return; }
    setPwdStatus('saving');
    setPwdError('');
    try {
      await api.changePassword(pwdForm.current, pwdForm.next);
      setPwdStatus('ok');
      setPwdForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setPwdStatus('idle'), 3000);
    } catch (e: any) {
      setPwdStatus('error');
      setPwdError(e?.response?.data?.message || 'Failed to change password. Check your current password.');
    }
  };

  const tabs: [string, IconName, string][] = [
    ['profile', 'User', 'Profile'],
    ['security', 'KeyRound', 'Security'],
    ['appearance', 'Sun', 'Appearance'],
    ['notifications', 'Bell', 'Notifications'],
    ['audio', 'Vol', 'Audio & Video'],
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowSettings(false)}>
      <div className="il-scale-in" style={{ background: 'var(--bg-elv)', border: '1px solid var(--bd)', borderRadius: 'var(--r-xl)', width: 680, maxHeight: '80vh', display: 'flex', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.7)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 200, background: 'var(--bg-hover)', borderRight: '1px solid var(--bd)', padding: '16px 8px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '8px 12px', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Settings</div>
          </div>
          {tabs.map(([id, icon, label]) => {
            const IconCmp = Ic[icon];
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 'var(--r)', border: 'none', cursor: 'pointer', background: activeTab === id ? 'var(--bg-active)' : 'transparent', color: activeTab === id ? 'var(--t1)' : 'var(--t2)', fontSize: 13, fontWeight: activeTab === id ? 600 : 400, textAlign: 'left', transition: 'all .12s', borderLeft: activeTab === id ? '2px solid var(--primary)' : '2px solid transparent', marginLeft: -2 }}
              >
                <IconCmp s={15} /> {label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => { setShowSettings(false); logout(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 'var(--r)', border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--err)', fontSize: 13, fontWeight: 500, textAlign: 'left' }}
          >
            <Ic.LogOut s={15} /> Log out
          </button>
        </div>
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>{tabs.find((t) => t[0] === activeTab)?.[2]}</h2>
            <button
              onClick={() => setShowSettings(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 6, borderRadius: 6, display: 'flex' }}
            >
              <Ic.X s={18} />
            </button>
          </div>
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: 'var(--bg-hover)', borderRadius: 'var(--r-lg)', border: '1px solid var(--bd)' }}>
                <Avatar user={me} size={56} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>{me.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--t3)' }}>{me.role} · @{me.username}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[['Display Name', me.name], ['Username', '@' + (me.username || '')], ['Email', email]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</label>
                    <input
                      defaultValue={v}
                      readOnly
                      style={{ padding: '9px 12px', background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', marginBottom: 10 }}>Theme</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {([['dark', 'Dark', '#09090e'], ['light', 'Light', '#f2f0fb']] as [Theme, string, string][]).map(([v, l, bg]) => (
                    <div
                      key={v}
                      onClick={() => setTheme(v)}
                      style={{ flex: 1, padding: 16, borderRadius: 'var(--r-lg)', border: `2px solid ${theme === v ? 'var(--primary)' : 'var(--bd)'}`, background: bg, cursor: 'pointer', transition: 'border-color .15s' }}
                    >
                      <div style={{ width: 32, height: 6, borderRadius: 3, background: theme === v ? 'var(--primary)' : 'rgba(128,128,128,.4)', marginBottom: 4 }} />
                      <div style={{ width: 48, height: 4, borderRadius: 2, background: 'rgba(128,128,128,.25)', marginBottom: 2 }} />
                      <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(128,128,128,.2)', marginBottom: 10 }} />
                      <div style={{ fontSize: 12, fontWeight: 600, color: v === 'dark' ? '#eee' : '#333', textAlign: 'center' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 400 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>Change Password</div>
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>Current Password</label>
                  <input
                    type="password"
                    value={pwdForm.current}
                    onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))}
                    placeholder="Enter current password"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--t1)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>New Password</label>
                  <input
                    type="password"
                    value={pwdForm.next}
                    onChange={e => setPwdForm(f => ({ ...f, next: e.target.value }))}
                    placeholder="Enter new password"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--t1)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>Confirm New Password</label>
                  <input
                    type="password"
                    value={pwdForm.confirm}
                    onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))}
                    placeholder="Confirm new password"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--t1)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                {pwdStatus === 'error' && (
                  <div style={{ color: '#f87171', fontSize: 13, background: 'rgba(248,113,113,0.1)', padding: '8px 12px', borderRadius: 6 }}>{pwdError}</div>
                )}
                {pwdStatus === 'ok' && (
                  <div style={{ color: '#4ade80', fontSize: 13, background: 'rgba(74,222,128,0.1)', padding: '8px 12px', borderRadius: 6 }}>Password changed successfully!</div>
                )}
                <button
                  type="submit"
                  disabled={pwdStatus === 'saving'}
                  style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: pwdStatus === 'saving' ? 'not-allowed' : 'pointer', opacity: pwdStatus === 'saving' ? 0.7 : 1, alignSelf: 'flex-start' }}
                >
                  {pwdStatus === 'saving' ? 'Saving…' : 'Update Password'}
                </button>
              </form>
            </div>
          )}
          {activeTab !== 'profile' && activeTab !== 'appearance' && activeTab !== 'security' && (
            <div style={{ color: 'var(--t3)', fontSize: 14, textAlign: 'center', paddingTop: 40 }}>This settings section is coming soon.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Tweaks Panel (design tooling only) ──────────────────── */
const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: 'violet', label: 'Violet', color: '#8b5cf6' },
  { id: 'rose', label: 'Rose', color: '#f43f5e' },
  { id: 'emerald', label: 'Emerald', color: '#10b981' },
  { id: 'amber', label: 'Amber', color: '#f59e0b' },
  { id: 'coral', label: 'Coral', color: '#f97316' },
];

export function TweaksPanel() {
  const { theme, setTheme, accent, setAccent, setShowTweaks } = useApp();
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [startDrag, setStartDrag] = useState<{ ox: number; oy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => { setShowTweaks(false); window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); };
  const save = (k: string, v: string) => window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    setDragging(true);
    const r = panelRef.current!.getBoundingClientRect();
    setStartDrag({ ox: e.clientX - r.left, oy: e.clientY - r.top });
  };
  useEffect(() => {
    if (!dragging || !startDrag) return;
    const mm = (e: MouseEvent) => setPos({ x: e.clientX - startDrag.ox, y: e.clientY - startDrag.oy });
    const mu = () => setDragging(false);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
    };
  }, [dragging, startDrag]);

  const panelPos: CSSProperties =
    pos.x !== null ? { left: pos.x as number, top: pos.y as number, bottom: 'auto', right: 'auto' } : { bottom: 24, right: 24 };

  return (
    <div
      ref={panelRef}
      className="il-scale-in"
      onMouseDown={onMouseDown}
      style={{ position: 'fixed', ...panelPos, zIndex: 9999, width: 260, background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-xl)', boxShadow: '0 20px 60px rgba(0,0,0,.6)', overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--bg-hover)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Ic.Zap s={14} c="var(--primary)" />
          <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--t1)' }}>Tweaks</span>
        </div>
        <button
          data-no-drag
          onClick={close}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 4, borderRadius: 4, display: 'flex' }}
        >
          <Ic.X s={14} />
        </button>
      </div>

      <div data-no-drag style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16, cursor: 'default' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Theme</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['dark', 'Dark', <Ic.Moon s={13} />], ['light', 'Light', <Ic.Sun s={13} />]] as [Theme, string, ReactNode][]).map(([v, l, ico]) => (
              <button
                key={v}
                onClick={() => { setTheme(v); save('theme', v); }}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--r)', border: `1.5px solid ${theme === v ? 'var(--primary)' : 'var(--bd)'}`, background: theme === v ? 'var(--primary-dim)' : 'var(--bg-hover)', color: theme === v ? 'var(--primary)' : 'var(--t2)', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all .14s' }}
              >
                {ico}
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Accent Color</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {ACCENTS.map((a) => (
              <Tip key={a.id} label={a.label} pos="top">
                <button
                  onClick={() => { setAccent(a.id); save('accent', a.id); }}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: a.color, border: `3px solid ${accent === a.id ? 'var(--t1)' : 'transparent'}`, cursor: 'pointer', transition: 'all .15s', outline: 'none', transform: accent === a.id ? 'scale(1.15)' : 'scale(1)', boxShadow: accent === a.id ? `0 0 12px ${a.color}80` : 'none' }}
                />
              </Tip>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', paddingTop: 4, borderTop: '1px solid var(--bd)' }}>Drag to move · Changes apply live</div>
      </div>
    </div>
  );
}
