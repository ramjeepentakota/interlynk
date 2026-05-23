/* InterLynk Login + Call + Settings + Tweaks + Incoming Call.
   Fully backend-wired; no mock participants or simulated calls.
   Voice CHANNELS (ambient, Discord-style) have been removed — only 1-on-1
   and group voice/video calls are supported here. */
import { useCallback, useEffect, useRef, useState } from 'react';
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

/** Resize an image File to a square JPEG data URL (centre-cropped). Used for
 *  avatars so we can persist the picture in the backend's avatarUrl field
 *  without a separate file-storage endpoint. */
async function resizeImageToDataUrl(file: File, size: number, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', quality);
}

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
    { icon: 'Msg', color: '#c9a85c', title: 'Rich Messaging', desc: 'Threads, reactions, @mentions' },
    { icon: 'Video', color: '#2f8f6b', title: 'HD Video & Voice', desc: 'Group calls with screen share' },
    { icon: 'Zap', color: '#b5546a', title: 'Realtime Sync', desc: 'Live channels powered by WebSocket' },
  ];

  return (
    <div className="il-login" style={{ width: '100vw', height: '100vh', background: 'var(--bg-base)', display: 'flex', overflow: 'hidden' }}>
      <div className="il-login-left" style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.25) 0%, transparent 65%)', top: '-15%', left: '-15%' }} />
          <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,.12) 0%, transparent 65%)', bottom: '-10%', right: '-10%' }} />
          <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,.09) 0%, transparent 65%)', bottom: '30%', left: '10%' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 420, width: '100%' }}>
          <img
            src="/narada-logo.png"
            alt="Narada — Connect · Communicate · Inspire"
            style={{ width: '100%', maxWidth: 460, height: 'auto', display: 'block', marginBottom: 28 }}
          />

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

      <div className="il-login-right" style={{ width: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--bd)', position: 'relative', flexShrink: 0 }}>
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

/** Pin/unpin button overlay used on top of a LiveKit VideoTile. */
function TileOverlay({ isPinned, onPinToggle, compact }: { isPinned: boolean; onPinToggle: () => void; compact?: boolean }) {
  return (
    <Tip label={isPinned ? 'Unpin' : 'Pin to spotlight'} pos="left">
      <button
        onClick={(e) => { e.stopPropagation(); onPinToggle(); }}
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 6,
          width: compact ? 26 : 30, height: compact ? 26 : 30, borderRadius: '50%',
          border: 'none', cursor: 'pointer',
          background: isPinned ? 'rgba(139,92,246,.85)' : 'rgba(0,0,0,.55)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)', transition: 'background .15s',
        }}
      >
        <Ic.Pin s={compact ? 13 : 15} />
      </button>
    </Tip>
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
  // WebRTC-only build: initialise token synchronously so the first render
  // already has tokenResolved=true. Eliminates the one-render-cycle gap
  // between mount and preflight/startCall firing.
  const [token, setToken] = useState<api.LiveKitToken | null>({ configured: false });
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
  // True when the browser's autoplay policy refused to start the remote audio
  // element. We surface a one-click "enable sound" prompt and also auto-unlock
  // on the next user gesture — this is what was leaving one side silent.
  const [audioBlocked, setAudioBlocked] = useState(false);
  // User-pinned spotlight tile (overrides auto-selection). 'local' / 'remote'
  // for the WebRTC path, or a LiveKit participant identity for the SFU path.
  // null = auto: screen-share takes precedence, then remote camera, then local.
  const [pinnedTile, setPinnedTile] = useState<string | null>(null);

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
    // PRODUCTION: WebRTC-only build. We deliberately do NOT fetch a LiveKit
    // token here — that HTTP roundtrip used to gate `preflightLocalMedia()`
    // AND the caller's `startCall()` trigger, adding 50–500 ms (and a full
    // network failure surface) to every call connect. Setting the token
    // synchronously to {configured:false} makes `tokenResolved` true on the
    // first render so the WebRTC path runs immediately. The `useLiveKit`
    // hook stays inert because `enabled` evaluates to false without a token.
    // If/when LiveKit gets re-enabled, restore the fetch behind a flag.
    setToken({ configured: false });
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
    if (lkConfigured) return;
    if (!isInitiator) return;
    if (roomId == null) return;
    if (webrtc.callState !== 'idle') return;
    // For 1-on-1 direct calls, wait for the callee's explicit accept.
    // For group/voice-channel calls (no specific target user), proceed.
    if (targetUserId != null && !calleeAccepted) return;
    webrtc.startCall();
  }, [lkConfigured, isInitiator, webrtc.callState, roomId, targetUserId, calleeAccepted, webrtc]);

  // Callee side: publish 'call-accepted' the moment the CallPanel mounts.
  // This runs AFTER useWebRTC's internal effect (effects fire in declaration
  // order within a commit), so the webrtc-signal listener is guaranteed to
  // be registered before we tell the caller to send the offer — race-free.
  // Replaces the old 50ms setTimeout in InterLynkApp.acceptIncomingCall
  // which was both slow and unreliable on slower machines / heavier renders.
  const calleeAcceptedSentRef = useRef(false);
  useEffect(() => {
    if (isInitiator) return;
    if (roomId == null || targetUserId == null) return;
    if (calleeAcceptedSentRef.current) return;
    const me = useAuthStore.getState().user;
    if (!me) return;
    calleeAcceptedSentRef.current = true;
    publishCallSignal({
      type: 'call-accepted',
      roomId: Number(roomId),
      senderUserId: Number(me.id),
      targetUserId: Number(targetUserId),
      callType,
    });
  }, [isInitiator, roomId, targetUserId, callType]);

  // Pre-flight microphone / camera capture the moment the call panel opens.
  // No longer gated on the LiveKit token fetch (it now resolves synchronously)
  // — the permission prompt fires as fast as React can commit.
  useEffect(() => {
    if (lkConfigured) return;
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
    const stream = webrtc.remoteStream;
    if (!el || !stream) return;
    // ─── REMOTE-AUDIO PLAYBACK — PRODUCTION INVARIANTS ─────────────────────
    // This effect is the single source of truth for remote audio playback.
    // If you change it, DO NOT regress the following invariants — each is
    // tied to a specific production bug that previously caused one-way
    // audio across every test device (mobile, multi-browser):
    //
    //  1. The <audio> element must be UNCONDITIONALLY mounted (see the
    //     element below). Gating it on tokenResolved/useWebRTCMode reopens
    //     the race where ontrack fires before the element exists and
    //     remoteAudioRef stays null forever.
    //
    //  2. Bind ONLY the audio track in a fresh single-track MediaStream —
    //     NOT the merged remote stream that also carries video. Chromium
    //     can silently stall audio when the same combined stream is bound
    //     to both <video> and <audio>.
    //
    //  3. The element must NOT use `display:none`. Some Chromium versions
    //     throttle/pause display:none media as "background audio". Use
    //     off-screen positioning + opacity:0 instead.
    //
    //  4. play() rejections must NOT be silently swallowed. We retry with
    //     backoff, then install a global user-gesture unlock + a visible
    //     "Click to enable call audio" button as last resort.
    //
    //  5. Defensive auto-resume: if the element pauses unexpectedly (some
    //     OS-level interruptions can pause it without a fresh gesture),
    //     we re-call play() automatically.
    // ───────────────────────────────────────────────────────────────────────
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    const audioOnly = new MediaStream([audioTracks[0]]);
    el.srcObject = audioOnly;
    el.muted = false;
    el.volume = 1;

    let cancelled = false;
    let removeGestureUnlock: (() => void) | null = null;

    const attemptPlay = async (): Promise<boolean> => {
      try {
        await el.play();
        return true;
      } catch {
        return false;
      }
    };

    // If autoplay is refused, unlock on the very next user interaction. The
    // user is already in the call UI (mute/hang-up buttons, the window), so a
    // single click/keypress anywhere reliably resumes playback. This is the
    // deterministic fallback that fixes the intermittent one-way audio: a
    // swallowed play() rejection used to leave that peer permanently muted.
    const installGestureUnlock = () => {
      if (removeGestureUnlock) return;
      const events: (keyof WindowEventMap)[] = ['click', 'keydown', 'touchstart', 'pointerdown'];
      const onGesture = () => {
        void attemptPlay().then((ok) => {
          if (ok && !cancelled) {
            setAudioBlocked(false);
            removeGestureUnlock?.();
          }
        });
      };
      events.forEach((ev) => window.addEventListener(ev, onGesture, { passive: true }));
      removeGestureUnlock = () => {
        events.forEach((ev) => window.removeEventListener(ev, onGesture));
        removeGestureUnlock = null;
      };
    };

    const run = async () => {
      // Immediate attempt, then a few backoff retries for transient rejections
      // (Chromium occasionally rejects the first play() even with a gesture).
      for (const delay of [0, 100, 300, 800, 1500]) {
        if (cancelled) return;
        if (delay) await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return;
        if (await attemptPlay()) {
          if (!cancelled) setAudioBlocked(false);
          return;
        }
      }
      if (!cancelled) {
        setAudioBlocked(true);
        installGestureUnlock();
      }
    };
    void run();

    // Re-bind and replay if the remote track set changes (late-arriving audio).
    const onAddTrack = () => {
      const latest = stream.getAudioTracks()[0];
      if (latest) el.srcObject = new MediaStream([latest]);
      void run();
    };
    stream.addEventListener?.('addtrack', onAddTrack);

    // Defensive: if the element gets paused without us asking (some OS-level
    // interruptions — incoming phone call, focus change, audio-device
    // switching — can pause an HTMLMediaElement), resume on the next tick.
    // Without this safety net a one-time pause silently leaves the call
    // muted on that peer until they end and re-establish.
    const onPause = () => {
      if (cancelled) return;
      window.setTimeout(() => { if (!cancelled && el.paused) void attemptPlay(); }, 50);
    };
    el.addEventListener('pause', onPause);

    return () => {
      cancelled = true;
      stream.removeEventListener?.('addtrack', onAddTrack);
      el.removeEventListener('pause', onPause);
      removeGestureUnlock?.();
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
    <div className="il-callpanel" style={{ position: 'relative', background: '#09090e', display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden' }}>
      {/* Hidden sink for remote audio. MUST be unconditionally rendered: the
          previous `useWebRTCMode && ...` gate created a race where the
          callee's `ontrack` fired BEFORE the LiveKit-token fetch resolved
          (which is what flipped useWebRTCMode true). At that point
          remoteAudioRef.current was null, the bind effect early-returned,
          and when the audio element later mounted, no further effect run
          ever bound srcObject — leaving the callee with healthy RTP flowing
          (↑↓ kbps non-zero) but zero audible sound. Always mounting fixes
          the race deterministically.
          We use off-screen positioning instead of `display: none` because
          Chromium has historically had bugs where display:none media
          elements get throttled/paused as "background audio". */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        aria-hidden
        tabIndex={-1}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', left: -9999, top: -9999 }}
      />
      {useWebRTCMode && audioBlocked && (
        <button
          onClick={() => {
            const el = remoteAudioRef.current;
            if (!el) return;
            el.muted = false;
            el.volume = 1;
            void el.play().then(() => setAudioBlocked(false)).catch(() => undefined);
          }}
          style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          🔊 Click to enable call audio
        </button>
      )}
      <div className="il-callpanel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(255,255,255,.04)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? 'var(--ok)' : connecting ? 'var(--warn)' : '#6b7280', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#fff', fontWeight: 600 }}>{fmt(duration)}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: callType === 'video' ? 'rgba(139,92,246,.2)' : 'rgba(34,197,94,.2)', color: callType === 'video' ? '#a78bfa' : '#4ade80', border: `1px solid ${callType === 'video' ? 'rgba(139,92,246,.3)' : 'rgba(34,197,94,.3)'}` }}>
            {callType === 'video' ? '📹 ' : '🎙 '}{title}
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>{stateLabel}</span>
          {useWebRTCMode && isConnected && (() => {
            // Heuristics that translate the codec-level audio levels into
            // a plain-English diagnosis the user can act on. audioLevel field
            // is 0..1; speech is usually > 0.02, silence < 0.005.
            const MIC_ACTIVE = webrtc.audioFlow.localLevel > 0.02;
            const REMOTE_ACTIVE = webrtc.audioFlow.remoteLevel > 0.02;
            const micPct = Math.min(100, Math.round(webrtc.audioFlow.localLevel * 100 * 3));   // ×3 so a normal voice fills the bar visibly
            const remotePct = Math.min(100, Math.round(webrtc.audioFlow.remoteLevel * 100 * 3));
            const problem = webrtc.audioFlow.inboundStuck
              ? 'No incoming RTP — Windows Firewall / NAT'
              : webrtc.audioFlow.outboundStuck
                ? 'No outgoing RTP — mic not capturing'
                : !MIC_ACTIVE && webrtc.audioFlow.outKbps > 1
                  ? 'Mic is sending silence! Wrong device or OS-muted'
                  : !REMOTE_ACTIVE && webrtc.audioFlow.inKbps > 1
                    ? "Peer's mic is sending silence (their device issue)"
                    : null;
            return (
              <span
                data-audio-diag
                title={problem ?? 'Live audio diagnostics. Bars: mic capture / received audio amplitude. kbps: RTP byte rate.'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
                  color: problem ? '#fca5a5' : 'rgba(255,255,255,.75)',
                  background: problem ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.06)',
                  border: `1px solid ${problem ? 'rgba(239,68,68,.4)' : 'rgba(255,255,255,.1)'}`,
                  padding: '3px 10px', borderRadius: 6, cursor: 'help',
                }}
              >
                <span title="Your microphone — should move when you speak" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Mic
                  <span style={{ position: 'relative', width: 36, height: 6, background: 'rgba(255,255,255,.1)', borderRadius: 3, overflow: 'hidden' }}>
                    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${micPct}%`, background: MIC_ACTIVE ? '#4ade80' : '#71717a', transition: 'width .15s' }} />
                  </span>
                </span>
                <span title="Audio received from peer — should move when THEY speak" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Recv
                  <span style={{ position: 'relative', width: 36, height: 6, background: 'rgba(255,255,255,.1)', borderRadius: 3, overflow: 'hidden' }}>
                    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${remotePct}%`, background: REMOTE_ACTIVE ? '#4ade80' : '#71717a', transition: 'width .15s' }} />
                  </span>
                </span>
                <span style={{ color: 'rgba(255,255,255,.5)' }}>↑{webrtc.audioFlow.outKbps.toFixed(0)} ↓{webrtc.audioFlow.inKbps.toFixed(0)}kbps</span>
                {problem && <span style={{ marginLeft: 4 }}>· {problem}</span>}
              </span>
            );
          })()}
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

      <div className="il-callpanel-stage" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: 20 }}>
        {showLkVideoGrid ? (() => {
          // ─── LiveKit spotlight layout ─────────────────────────────────
          // Auto-pick: any screen-sharer wins, otherwise the first remote
          // participant, otherwise the local participant. User pin overrides.
          const findById = (id: string | null) => id ? lkParticipants.find((q) => q.identity === id) ?? null : null;
          const userPinned = findById(pinnedTile);
          const screenSharer = lkParticipants.find((q) => q.screenSharing) ?? null;
          const remoteFirst = lkParticipants.find((q) => !q.isLocal) ?? null;
          const spotlight = userPinned ?? screenSharer ?? remoteFirst ?? lkParticipants[0];
          const thumbs = lkParticipants.filter((q) => q.identity !== spotlight.identity);
          return (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                <VideoTile p={spotlight} big />
                <TileOverlay
                  isPinned={pinnedTile === spotlight.identity}
                  onPinToggle={() => setPinnedTile((cur) => cur === spotlight.identity ? null : spotlight.identity)}
                />
              </div>
              {thumbs.length > 0 && (
                <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 5, maxHeight: 'calc(100% - 24px)', overflowY: 'auto' }}>
                  {thumbs.map((p) => (
                    <div key={p.identity} style={{ position: 'relative', width: 200, height: 120, borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.1)' }}>
                      <VideoTile p={p} />
                      <TileOverlay
                        compact
                        isPinned={pinnedTile === p.identity}
                        onPinToggle={() => setPinnedTile((cur) => cur === p.identity ? null : p.identity)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })() : showWebRTCVideoGrid ? (() => {
          // ─── WebRTC spotlight layout ──────────────────────────────────
          // The two <video> elements MUST stay mounted across spotlight
          // swaps (production invariant — see remote-audio comment above
          // and [[interlynk-webrtc-callee-order]]). So we always render
          // them in the same DOM order and just reposition their wrapper
          // via CSS based on which one is the spotlight.
          const hasRemote = Boolean(webrtc.remoteStream);
          const localIsScreen = isScreenOn;
          const remoteIsScreen = webrtc.remoteScreenSharing;
          // Auto-spotlight priority: any screen share wins (remote first),
          // then the remote camera, then local. User pin overrides.
          const autoSpotlight: 'local' | 'remote' =
            remoteIsScreen && hasRemote ? 'remote'
              : localIsScreen ? 'local'
                : hasRemote ? 'remote'
                  : 'local';
          const spotlightId: 'local' | 'remote' =
            (pinnedTile === 'local' || pinnedTile === 'remote')
              ? (pinnedTile === 'remote' && !hasRemote ? autoSpotlight : pinnedTile)
              : autoSpotlight;

          // Wrapper style: big = fills container, small = top-right thumbnail.
          // We stack thumbnails vertically when both tiles exist.
          const bigStyle: CSSProperties = { position: 'absolute', inset: 0, background: '#1c2128', borderRadius: 'var(--r-xl)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' };
          const thumbStyle = (idx: number): CSSProperties => ({
            position: 'absolute', top: 12 + idx * 148, right: 12, width: 220, height: 136,
            background: '#1c2128', borderRadius: 'var(--r)', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.1)', zIndex: 5,
          });

          // The local tile is the only one rendered if there is no remote yet.
          const localIsBig = spotlightId === 'local' || !hasRemote;
          const remoteIsBig = spotlightId === 'remote' && hasRemote;
          // Thumbnail index assignments (only the non-spotlight tile is a thumb).
          const localThumbIdx = !localIsBig ? 0 : -1;
          const remoteThumbIdx = !remoteIsBig && hasRemote ? 0 : -1;

          const PinBtn = ({ tileId, compact }: { tileId: 'local' | 'remote'; compact?: boolean }) => {
            const pinned = pinnedTile === tileId;
            return (
              <Tip label={pinned ? 'Unpin' : 'Pin to spotlight'} pos="left">
                <button
                  onClick={(e) => { e.stopPropagation(); setPinnedTile((cur) => cur === tileId ? null : tileId); }}
                  style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 6,
                    width: compact ? 26 : 30, height: compact ? 26 : 30, borderRadius: '50%',
                    border: 'none', cursor: 'pointer',
                    background: pinned ? 'rgba(139,92,246,.85)' : 'rgba(0,0,0,.55)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(8px)', transition: 'background .15s',
                  }}
                >
                  <Ic.Pin s={compact ? 13 : 15} />
                </button>
              </Tip>
            );
          };

          return (
            <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
              {/* LOCAL tile wrapper — always mounted, swaps between big/thumb via CSS. */}
              <div
                onClick={() => { if (!localIsBig) setPinnedTile('local'); }}
                style={localIsBig ? bigStyle : { ...thumbStyle(localThumbIdx), cursor: 'pointer' }}
              >
                {(isCamOn || isScreenOn) && webrtc.localStream ? (
                  <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: isScreenOn ? 'contain' : 'cover', background: '#000', transform: isScreenOn ? 'none' : 'scaleX(-1)' }} />
                ) : (
                  <VoiceAvatar name={currentUser?.name || 'You'} identity={currentUser?.username || 'you'} speaking={false} muted={!isMicOn} isLocal />
                )}
                <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,.65)', borderRadius: 6, padding: '3px 8px', fontSize: localIsBig ? 12 : 11, color: '#fff', display: 'flex', alignItems: 'center', gap: 6, maxWidth: 'calc(100% - 16px)' }}>
                  {!isMicOn && <Ic.MicOff s={12} c="#f87171" />}You{isScreenOn ? ' · sharing' : ''}
                </div>
                <PinBtn tileId="local" compact={!localIsBig} />
              </div>

              {/* REMOTE tile wrapper — always mounted (production invariant) so
                  the <video> srcObject binding survives spotlight swaps. */}
              {hasRemote && (
                <div
                  onClick={() => { if (!remoteIsBig) setPinnedTile('remote'); }}
                  style={remoteIsBig ? bigStyle : { ...thumbStyle(remoteThumbIdx), cursor: 'pointer' }}
                >
                  <video ref={remoteVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: webrtc.remoteScreenSharing ? 'contain' : 'cover', background: '#000', display: remoteHasVideo ? 'block' : 'none' }} />
                  {!remoteHasVideo && (
                    <VoiceAvatar name={title} identity="remote" speaking={false} muted={webrtc.remoteMuted} />
                  )}
                  <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,.65)', borderRadius: 6, padding: '3px 8px', fontSize: remoteIsBig ? 12 : 11, color: '#fff', display: 'flex', alignItems: 'center', gap: 6, maxWidth: 'calc(100% - 16px)' }}>
                    {webrtc.remoteMuted && <Ic.MicOff s={12} c="#f87171" />}{title}{webrtc.remoteScreenSharing ? ' · sharing' : ''}
                  </div>
                  <PinBtn tileId="remote" compact={!remoteIsBig} />
                </div>
              )}
            </div>
          );
        })() : (
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

      <div className="il-callpanel-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '16px 20px', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
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
            data-hangup
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
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  // Play ringtone while the incoming-call overlay is visible. Some browsers
  // require a prior user gesture before .play() resolves; we swallow the
  // rejection so an autoplay block never crashes the overlay.
  useEffect(() => {
    if (!incomingCall) return;
    const a = new Audio('/ringtone.mp3');
    a.loop = true;
    a.volume = 1;
    ringtoneRef.current = a;
    a.play().catch(() => undefined);
    return () => {
      try { a.pause(); a.currentTime = 0; } catch { /* noop */ }
      ringtoneRef.current = null;
    };
  }, [incomingCall?.roomId]);

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
    <div className="il-incoming-wrap" style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 24, pointerEvents: 'none' }}>
      <div className="il-scale-in il-incoming-card" style={{ background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-xl)', padding: 20, width: 320, boxShadow: '0 20px 60px rgba(0,0,0,.7)', pointerEvents: 'all' }}>
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

/* ── Toast host ──────────────────────────────────────────── */
/** Listens for `il-toast` window events and surfaces a small stacked
 *  notification card top-right. Used today by InterLynkApp to flash
 *  CALL_INVITE and other realtime notifications as they arrive. */
export function ToastHost() {
  const [toasts, setToasts] = useState<{ id: number; title: string; message: string; tone: 'info' | 'warn' }[]>([]);
  useEffect(() => {
    let nextId = 1;
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { title: string; message?: string; tone?: 'info' | 'warn' };
      const id = nextId++;
      setToasts((p) => [...p, { id, title: d.title, message: d.message || '', tone: d.tone || 'info' }]);
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
    };
    window.addEventListener('il-toast', handler);
    return () => window.removeEventListener('il-toast', handler);
  }, []);
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9600, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="il-scale-in"
          style={{
            background: 'var(--bg-elv)',
            border: `1px solid ${t.tone === 'warn' ? 'rgba(245,158,11,.5)' : 'var(--bd2)'}`,
            borderLeft: `4px solid ${t.tone === 'warn' ? 'var(--warn)' : 'var(--primary)'}`,
            borderRadius: 'var(--r-lg)',
            padding: '10px 14px',
            boxShadow: '0 12px 36px rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}
        >
          <span style={{ color: t.tone === 'warn' ? 'var(--warn)' : 'var(--primary)', display: 'flex', flexShrink: 0, marginTop: 1 }}>
            <Ic.Bell s={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>{t.title}</div>
            {t.message && <div style={{ fontSize: 12.5, color: 'var(--t2)', marginTop: 2 }}>{t.message}</div>}
          </div>
          <button
            onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 2, display: 'flex', borderRadius: 4 }}
          >
            <Ic.X s={13} />
          </button>
        </div>
      ))}
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
  const { setShowSettings, theme, setTheme, logout, currentUser, patchCurrentUser } = useApp();
  const me = currentUser || { name: 'You', username: '', role: 'MEMBER' as const };
  const email = useAuthStore.getState().user?.email || '';
  const [activeTab, setActiveTab] = useState('profile');
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdStatus, setPwdStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [pwdError, setPwdError] = useState('');

  // Profile picture upload state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [avatarError, setAvatarError] = useState('');

  const handleAvatarFile = async (file: File) => {
    // Be strict about supported formats — server only stores image/* and the
    // canvas resize below assumes a decodable image. PNG/JPG/JPEG/WEBP cover
    // the formats the user explicitly asked for.
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const looksLikeImage = file.type.startsWith('image/')
      || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
    if (!looksLikeImage) {
      setAvatarStatus('error');
      setAvatarError('Please choose an image file (JPG, JPEG, PNG, or WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarStatus('error');
      setAvatarError('Image is larger than 5 MB. Please pick a smaller picture.');
      return;
    }
    setAvatarStatus('saving');
    setAvatarError('');
    try {
      // Resize client-side to 256×256 JPEG so the persisted data: URL stays
      // small (~20-30 KB). The avatar_url column is now TEXT on the backend,
      // so anything in this size range is well within DB limits.
      const dataUrl = await resizeImageToDataUrl(file, 256, 0.85);
      const updated = await api.updateAvatar(dataUrl);
      patchCurrentUser({ avatar: updated.avatar || dataUrl });
      // Sync the auth-store cached profile too so other surfaces (rail, DMs)
      // see the new picture without a hard reload.
      const stored = useAuthStore.getState().user;
      if (stored) useAuthStore.getState().setUser({ ...stored, avatar: updated.avatar || dataUrl } as any);
      setAvatarStatus('ok');
      setTimeout(() => setAvatarStatus('idle'), 2500);
    } catch (e: any) {
      setAvatarStatus('error');
      // Show the actual server error when available — most often this is a
      // 413 Payload Too Large or a DB column-length error, both of which are
      // actionable for the user.
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message;
      setAvatarError(
        status === 413
          ? 'Image is too large for the server. Try a smaller picture.'
          : msg || 'Could not update profile picture. Please try again.'
      );
    }
  };

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
      <div className="il-scale-in il-modal-settings" style={{ background: 'var(--bg-elv)', border: '1px solid var(--bd)', borderRadius: 'var(--r-xl)', width: 680, maxHeight: '80vh', display: 'flex', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.7)' }} onClick={(e) => e.stopPropagation()}>
        <div data-settings-tabs style={{ width: 200, background: 'var(--bg-hover)', borderRight: '1px solid var(--bd)', padding: '16px 8px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '8px 12px', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Settings</div>
          </div>
          {tabs.map(([id, icon, label]) => {
            const IconCmp = Ic[icon];
            return (
              <button
                key={id}
                data-active={activeTab === id ? 'true' : 'false'}
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
        <div data-settings-body style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
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
                <div style={{ position: 'relative' }}>
                  <Avatar user={me} size={64} />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    title="Change profile picture"
                    style={{
                      position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: '50%',
                      background: 'var(--primary)', color: '#fff', border: '2px solid var(--bg-elv)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ic.Camera s={13} />
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    // Explicit extensions in addition to MIME types so the OS
                    // picker on every platform highlights .jpg/.jpeg/.png/.webp
                    // even when its MIME-type mapping is missing.
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); e.target.value = ''; }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>{me.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--t3)' }}>{me.role} · @{me.username}</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarStatus === 'saving'}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r)', border: '1px solid var(--bd2)', background: 'var(--bg-elv)', color: 'var(--t1)', fontSize: 12.5, fontWeight: 600, cursor: avatarStatus === 'saving' ? 'wait' : 'pointer', fontFamily: "'DM Sans',sans-serif" }}
                    >
                      <Ic.Upload s={13} /> {avatarStatus === 'saving' ? 'Uploading…' : 'Upload picture'}
                    </button>
                    {avatarStatus === 'ok' && (
                      <span style={{ fontSize: 12, color: 'var(--ok)' }}>Profile picture updated — everyone will see this.</span>
                    )}
                    {avatarStatus === 'error' && (
                      <span style={{ fontSize: 12, color: 'var(--err)' }}>{avatarError}</span>
                    )}
                  </div>
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
          {activeTab === 'audio' && <AudioVideoSettings />}
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
          {activeTab !== 'profile' && activeTab !== 'appearance' && activeTab !== 'security' && activeTab !== 'audio' && (
            <div style={{ color: 'var(--t3)', fontSize: 14, textAlign: 'center', paddingTop: 40 }}>This settings section is coming soon.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Audio & Video device check ──────────────────────────── */
/** Settings panel that lets the user verify their cam/mic/speaker and pick
 *  which physical device each call should use. Selections are stored in
 *  localStorage so getUserMedia in the call panel can opt-in to them later.
 *
 *  Bluetooth headsets typically appear as separate input + output devices —
 *  switching between system speakers and a paired headset is just a matter
 *  of picking the right entry in the dropdowns. */
function AudioVideoSettings() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permError, setPermError] = useState<string | null>(null);
  const [camId, setCamId] = useState<string>(() => localStorage.getItem('il-pref-cam') || '');
  const [micId, setMicId] = useState<string>(() => localStorage.getItem('il-pref-mic') || '');
  const [spkId, setSpkId] = useState<string>(() => localStorage.getItem('il-pref-spk') || '');
  const [camActive, setCamActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [camError, setCamError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [testingSpeaker, setTestingSpeaker] = useState(false);
  const [spkError, setSpkError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioRafRef = useRef<number | null>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list);
      setPermError(null);
    } catch (e: any) {
      setPermError(e?.message || 'Unable to list devices.');
    }
  }, []);

  // Initial enumerate — labels are blank until the user grants permission,
  // so we trigger a tiny getUserMedia to unlock them and then enumerate again.
  useEffect(() => {
    (async () => {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        probe.getTracks().forEach((t) => t.stop());
      } catch {
        setPermError('Permission to access camera / microphone was denied. Allow access in your browser to test devices.');
      }
      await refreshDevices();
    })();
    const onChange = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
    };
  }, [refreshDevices]);

  // Tear down on unmount so the OS tally light isn't left on.
  useEffect(() => () => {
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioRafRef.current != null) cancelAnimationFrame(audioRafRef.current);
    audioCtxRef.current?.close().catch(() => undefined);
    if (testAudioRef.current) { testAudioRef.current.pause(); testAudioRef.current.src = ''; }
  }, []);

  const cams = devices.filter((d) => d.kind === 'videoinput');
  const mics = devices.filter((d) => d.kind === 'audioinput');
  const spks = devices.filter((d) => d.kind === 'audiooutput');

  const startCameraTest = async () => {
    setCamError(null);
    try {
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: camId ? { deviceId: { exact: camId } } : true,
        audio: false,
      });
      camStreamRef.current = stream;
      // Flip camActive FIRST so the <video> element gets mounted; the effect
      // below then binds srcObject the moment the element exists. The previous
      // implementation tried to bind directly inside this handler, but
      // videoRef.current was null because the element was rendered behind
      // {camActive && <video />} — the bind silently no-op'd and the user
      // saw a black tile despite the stream being live.
      setCamActive(true);
    } catch (e: any) {
      setCamError(e?.message || 'Could not start the camera.');
      setCamActive(false);
    }
  };

  // Bind the active stream to the <video> as soon as both exist. Runs every
  // time camActive or the stream object changes, which is what fixes the
  // "Test camera" tile staying blank — see comment in startCameraTest.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (camActive && camStreamRef.current) {
      el.srcObject = camStreamRef.current;
      el.play().catch(() => undefined);
    } else {
      el.srcObject = null;
    }
  }, [camActive]);

  const stopCameraTest = () => {
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamActive(false);
  };

  const startMicTest = async () => {
    setMicError(null);
    try {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: micId ? { deviceId: { exact: micId } } : true,
        video: false,
      });
      micStreamRef.current = stream;
      const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        setMicLevel(peak);
        audioRafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setMicActive(true);
    } catch (e: any) {
      setMicError(e?.message || 'Could not access the microphone.');
      setMicActive(false);
    }
  };

  const stopMicTest = () => {
    if (audioRafRef.current != null) { cancelAnimationFrame(audioRafRef.current); audioRafRef.current = null; }
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setMicActive(false);
    setMicLevel(0);
  };

  const testSpeaker = async () => {
    setSpkError(null);
    setTestingSpeaker(true);
    try {
      const el = testAudioRef.current ?? (testAudioRef.current = new Audio('/ringtone.mp3'));
      el.loop = false;
      el.currentTime = 0;
      el.volume = 0.8;
      const anyEl = el as any;
      // setSinkId is Chromium-only; gracefully skip on browsers that lack it
      // (Firefox/Safari) and play through the system default instead.
      if (spkId && typeof anyEl.setSinkId === 'function') {
        try { await anyEl.setSinkId(spkId); } catch { /* fall through */ }
      }
      await el.play();
      el.onended = () => setTestingSpeaker(false);
      // Hard stop after 4s in case the asset is unexpectedly long.
      setTimeout(() => { try { el.pause(); el.currentTime = 0; } catch { /* noop */ } setTestingSpeaker(false); }, 4000);
    } catch (e: any) {
      setSpkError(e?.message || 'Could not play through the selected output.');
      setTestingSpeaker(false);
    }
  };

  const persistAndSet = (kind: 'cam' | 'mic' | 'spk', id: string) => {
    if (kind === 'cam') { setCamId(id); localStorage.setItem('il-pref-cam', id); if (camActive) startCameraTest(); }
    if (kind === 'mic') { setMicId(id); localStorage.setItem('il-pref-mic', id); if (micActive) startMicTest(); }
    if (kind === 'spk') { setSpkId(id); localStorage.setItem('il-pref-spk', id); }
  };

  const supportsSinkId = typeof (HTMLAudioElement.prototype as any).setSinkId === 'function';

  const fieldStyle: CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 'var(--r)', border: '1px solid var(--bd)', background: 'var(--bg-hover)', color: 'var(--t1)', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" };
  const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, display: 'block' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {permError && (
        <div style={{ fontSize: 13, color: 'var(--err)', background: 'var(--err-dim)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 'var(--r)', padding: '8px 12px' }}>
          {permError}
        </div>
      )}

      {/* Camera */}
      <div>
        <label style={labelStyle}>Camera</label>
        <select
          style={fieldStyle}
          value={camId}
          onChange={(e) => persistAndSet('cam', e.target.value)}
        >
          <option value="">System default</option>
          {cams.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 6)}`}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {!camActive ? (
            <button onClick={startCameraTest} style={primaryBtnStyle}><Ic.Camera s={14} /> Test camera</button>
          ) : (
            <button onClick={stopCameraTest} style={ghostBtnStyle}><Ic.X s={14} /> Stop test</button>
          )}
        </div>
        <div style={{ position: 'relative', marginTop: 10, width: '100%', aspectRatio: '16 / 9', background: '#000', borderRadius: 'var(--r-lg)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--bd)' }}>
          {/* The <video> element is ALWAYS mounted so the ref is bindable
              the instant a stream arrives. Showing the placeholder via CSS
              when camActive=false keeps the camera-test feature working
              (was broken because ref was null when srcObject got set). */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: camActive ? 'block' : 'none' }}
          />
          {!camActive && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.55)', fontSize: 12.5 }}>
              Click "Test camera" to preview
            </div>
          )}
        </div>
        {camError && <div style={{ fontSize: 12, color: 'var(--err)', marginTop: 6 }}>{camError}</div>}
      </div>

      {/* Microphone */}
      <div>
        <label style={labelStyle}>Microphone</label>
        <select
          style={fieldStyle}
          value={micId}
          onChange={(e) => persistAndSet('mic', e.target.value)}
        >
          <option value="">System default</option>
          {mics.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 6)}`}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {!micActive ? (
            <button onClick={startMicTest} style={primaryBtnStyle}><Ic.Mic s={14} /> Test microphone</button>
          ) : (
            <button onClick={stopMicTest} style={ghostBtnStyle}><Ic.X s={14} /> Stop test</button>
          )}
          {micActive && (
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>Speak now — bar should move:</span>
          )}
        </div>
        <div style={{ marginTop: 10, height: 14, borderRadius: 7, background: 'var(--bg-hover)', overflow: 'hidden', border: '1px solid var(--bd)' }}>
          <div style={{
            width: `${Math.min(100, Math.round(micLevel * 100 * 2))}%`,
            height: '100%',
            background: micLevel > 0.05 ? 'var(--ok)' : 'var(--bd2)',
            transition: 'width .08s linear',
          }} />
        </div>
        {micError && <div style={{ fontSize: 12, color: 'var(--err)', marginTop: 6 }}>{micError}</div>}
      </div>

      {/* Speaker / output */}
      <div>
        <label style={labelStyle}>Audio output {!supportsSinkId && <span style={{ color: 'var(--warn)', textTransform: 'none', fontWeight: 400 }}>· Output picking is unsupported in this browser — system default will be used.</span>}</label>
        <select
          style={fieldStyle}
          value={spkId}
          onChange={(e) => persistAndSet('spk', e.target.value)}
          disabled={!supportsSinkId}
        >
          <option value="">System default</option>
          {spks.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speakers ${d.deviceId.slice(0, 6)}`}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={testSpeaker} disabled={testingSpeaker} style={primaryBtnStyle}>
            <Ic.Headphones s={14} /> {testingSpeaker ? 'Playing…' : 'Play test tone'}
          </button>
          <button onClick={refreshDevices} style={ghostBtnStyle}><Ic.Refresh s={14} /> Refresh devices</button>
        </div>
        {spkError && <div style={{ fontSize: 12, color: 'var(--err)', marginTop: 6 }}>{spkError}</div>}
        <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 8, lineHeight: 1.5 }}>
          Connected a Bluetooth headset? It will show up here as a separate input + output device. Pick it from the dropdowns above to use it for calls.
        </div>
      </div>
    </div>
  );
}

const primaryBtnStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px',
  borderRadius: 'var(--r)', border: 'none', cursor: 'pointer',
  background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 12.5,
  fontFamily: "'DM Sans',sans-serif",
};
const ghostBtnStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px',
  borderRadius: 'var(--r)', border: '1px solid var(--bd2)', cursor: 'pointer',
  background: 'var(--bg-hover)', color: 'var(--t1)', fontWeight: 600, fontSize: 12.5,
  fontFamily: "'DM Sans',sans-serif",
};

/* ── Tweaks Panel (design tooling only) ──────────────────── */
const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: 'gold', label: 'Gold', color: '#c9a85c' },
  { id: 'rose', label: 'Rose', color: '#b5546a' },
  { id: 'emerald', label: 'Emerald', color: '#2f8f6b' },
  { id: 'amber', label: 'Amber', color: '#cc9a3e' },
  { id: 'coral', label: 'Coral', color: '#c2683f' },
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
      className="il-scale-in il-tweaks-panel"
      onMouseDown={onMouseDown}
      // Glass / transparent treatment requested by the user: the previous
      // build had a solid bg-elv background that read "bold" in both themes.
      // We now render a translucent surface with backdrop-blur so it sits
      // unobtrusively on top of either the dark or light app shell, matching
      // the original design intent.
      style={{
        position: 'fixed', ...panelPos, zIndex: 9999, width: 260,
        background: 'transparent',
        backdropFilter: 'blur(18px) saturate(140%)',
        WebkitBackdropFilter: 'blur(18px) saturate(140%)',
        border: '1px solid var(--bd)',
        borderRadius: 'var(--r-xl)',
        boxShadow: '0 16px 48px rgba(0,0,0,.35)',
        overflow: 'hidden',
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--bd)', background: 'transparent' }}>
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
