/* InterLynk Login + Call + Settings + Tweaks + Incoming Call.
   Fully backend-wired; no mock participants or simulated calls.
   Voice CHANNELS (ambient, Discord-style) have been removed — only 1-on-1
   and group voice/video calls are supported here. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Ic, type IconName } from './icons';
import { Avatar, Input, Tip } from './ui';
import { useApp, type Accent, type Theme } from './context';
import { useSfu, type SfuParticipant } from '@/hooks/useSfu';
import { useWebRTC } from '@/hooks/useWebRTC';
import { colorFor, type User } from './data';
import * as api from './api';
import { useAuthStore } from '@/store/useAppStore';
import { publishCallSignal } from './realtime';

/** Resize an image File to a square JPEG data URL (centre-cropped). Used for
 *  avatars so we can persist the picture in the backend's avatarUrl field
 *  without a separate file-storage endpoint. */
async function resizeImageToDataUrl(file: File, size: number, quality: number): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  // Try the fast ImageBitmap path; fall back to <img> for older Safari.
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
    bitmap.close();
  } catch {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image decode failed')); };
      img.src = url;
    });
  }
  return canvas.toDataURL('image/jpeg', quality);
}

/** Resize to a square JPEG Blob so the image can be uploaded as a binary
 *  file and stored as a short URL — avoids the backend @Size(max=500) limit
 *  on the avatarUrl profile field which rejects base64 data URLs. */
async function resizeImageToBlob(file: File, size: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
    bitmap.close();
  } catch {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image decode failed')); };
      img.src = url;
    });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null'))),
      'image/jpeg',
      quality,
    );
  });
}

/* ── LoginScreen ─────────────────────────────────────────── */
export function LoginScreen() {
  const { login, loginMfa, authError, theme, setTheme } = useApp();
  const [username, setUsername] = useState('');
  const [pass, setPass] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // MFA challenge state. When non-null the form switches to a code-entry view
  // and submits to /api/v1/auth/login/mfa instead of /api/v1/auth/login.
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const handleLogin = async (e?: { preventDefault: () => void }) => {
    e && e.preventDefault();
    if (!username.trim() || !pass) return;
    setLoading(true);
    try {
      const result = await login(username, pass, rememberMe);
      if (result?.mfaRequired) {
        setMfaChallenge(result.mfaChallenge);
        setMfaCode('');
      }
    } catch {
      /* authError surfaced via context */
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e?: { preventDefault: () => void }) => {
    e && e.preventDefault();
    if (!mfaChallenge || mfaCode.trim().length < 6) return;
    setLoading(true);
    try {
      await loginMfa(mfaChallenge, mfaCode.trim());
    } catch {
      /* authError surfaced via context */
    } finally {
      setLoading(false);
    }
  };

  const cancelMfa = () => {
    setMfaChallenge(null);
    setMfaCode('');
    setPass('');
  };

  return (
    <div className="il-login" style={{ width: '100vw', height: '100vh', background: 'var(--bg-base)', display: 'flex', overflow: 'hidden', color: 'var(--t1)' }}>

      {/* ── Left brand panel ──────────────────────────────── */}
      <div className="il-login-left" style={{ flex: '0 0 56%', position: 'relative', display: 'flex', flexDirection: 'column', padding: 56, overflow: 'hidden', background: 'linear-gradient(135deg, var(--bg-base) 0%, var(--bg-elv) 60%, var(--bg-sidebar) 100%)', borderRight: '1px solid var(--bd)' }}>
        <div style={{ position: 'absolute', width: 720, height: 720, right: -200, top: -120, background: "url('/narada-mandala.svg') no-repeat center/contain", opacity: 0.10, pointerEvents: 'none', filter: 'drop-shadow(0 0 12px var(--primary))' }} />
        <div style={{ position: 'absolute', width: 320, height: 320, left: -80, bottom: -60, background: "url('/narada-mandala.svg') no-repeat center/contain", opacity: 0.06, pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <img src="/narada-logo.png" alt="Narada" style={{ height: 42, width: 'auto' }} />
          <div>
            <div className="h-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--t1)', lineHeight: 1 }}>NARADA</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '0.32em', textTransform: 'uppercase', marginTop: 4 }}>Connect · Communicate · Inspire</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 560, position: 'relative' }}>
          <div className="narada-string" style={{ marginBottom: 24, color: 'var(--primary)' }}>
            <span style={{ fontSize: 11, letterSpacing: '0.32em', textTransform: 'uppercase', fontWeight: 700 }}>The Messenger</span>
            <div className="line" />
          </div>
          <h1 className="h-display" style={{ fontSize: 64, lineHeight: 1.02, fontWeight: 400, letterSpacing: '-0.03em', color: 'var(--t1)', marginBottom: 22 }}>
            Where teams<br />
            <em style={{ color: 'var(--primary)', fontStyle: 'italic', fontWeight: 500 }}>truly</em> meet.
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--t2)', maxWidth: 480, fontWeight: 300 }}>
            A secure, enterprise-grade workspace for messaging, meetings, and shipping code together — engineered to replace Teams without the noise.
          </p>

          <div style={{ marginTop: 48, display: 'flex', gap: 36, flexWrap: 'wrap' }}>
            {[['SOC-2', 'Type II'], ['ISO', '27001'], ['Encrypted', 'End-to-end'], ['On-prem', 'Available']].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10.5, color: 'var(--t3)', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>{k}</div>
                <div style={{ fontSize: 13.5, color: 'var(--t1)', fontFamily: 'var(--ff-mono)', marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', fontSize: 11, color: 'var(--t3)', position: 'relative' }}>
          <div style={{ fontFamily: 'var(--ff-mono)' }}>v4.2.0 · build {String(Date.now()).slice(-4)}</div>
          <div style={{ display: 'flex', gap: 20 }}>
            <span style={{ cursor: 'pointer' }}>Privacy</span>
            <span style={{ cursor: 'pointer' }}>Status</span>
            <span style={{ cursor: 'pointer' }}>Docs</span>
          </div>
        </div>
      </div>

      {/* ── Right form ────────────────────────────────────── */}
      <div className="il-login-right" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, background: 'var(--bg-base)', position: 'relative' }}>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: '1px solid var(--bd2)', borderRadius: 'var(--r)', padding: '6px 11px', cursor: 'pointer', color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Ic.Sun s={13} /> : <Ic.Moon s={13} />}
          {theme === 'dark' ? 'Dawn' : 'Dusk'}
        </button>

        <div style={{ width: '100%', maxWidth: 380 }}>
          {mfaChallenge ? (
            <>
              <div className="narada-string" style={{ marginBottom: 28, color: 'var(--primary)' }}>
                <div className="line" />
                <span style={{ fontSize: 10.5, letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 700 }}>Two-Factor</span>
                <div className="line" />
              </div>

              <h3 className="h-display" style={{ fontSize: 32, fontWeight: 500, color: 'var(--t1)', marginBottom: 6, letterSpacing: '-0.02em' }}>Verify it's you.</h3>
              <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 24, lineHeight: 1.55 }}>
                Open your authenticator app and enter the 6-digit code shown for Narada. You can also paste one of your backup codes.
              </p>

              <form onSubmit={handleMfaSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9A-Za-z-]/g, '').slice(0, 16))}
                    placeholder="123 456"
                    autoFocus
                    style={{
                      width: '100%', padding: '14px 16px',
                      background: 'var(--bg-elv)', border: '1px solid var(--bd2)',
                      borderRadius: 'var(--r)', color: 'var(--t1)',
                      fontFamily: 'var(--ff-mono)',
                      fontSize: 24, letterSpacing: 6, textAlign: 'center', outline: 'none',
                    }}
                  />

                  {authError && (
                    <div style={{ fontSize: 13, color: 'var(--err)', background: 'var(--err-dim)', border: '1px solid var(--err)', borderRadius: 'var(--r)', padding: '8px 12px' }}>
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || mfaCode.trim().length < 6}
                    style={{
                      width: '100%', height: 46,
                      borderRadius: 'var(--r)',
                      background: 'var(--primary)',
                      border: 'none',
                      color: '#11183d',
                      fontSize: 14, fontWeight: 600,
                      letterSpacing: '0.04em',
                      cursor: loading ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 8, marginTop: 6,
                      boxShadow: 'var(--sh-glow)',
                      opacity: (loading || mfaCode.trim().length < 6) ? 0.6 : 1,
                      transition: 'opacity .15s',
                      fontFamily: 'var(--ff-body)',
                    }}
                  >
                    {loading ? <><Ic.Loader s={17} className="il-spin" /> Verifying…</> : <>Verify &amp; sign in<Ic.ArrR s={16} /></>}
                  </button>

                  <button
                    type="button"
                    onClick={cancelMfa}
                    style={{ background: 'transparent', border: 'none', color: 'var(--t3)', fontSize: 13, cursor: 'pointer', padding: 6 }}
                  >
                    ← Use a different account
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="narada-string" style={{ marginBottom: 28, color: 'var(--primary)' }}>
                <div className="line" />
                <span style={{ fontSize: 10.5, letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 700 }}>Sign In</span>
                <div className="line" />
              </div>

              <h3 className="h-display" style={{ fontSize: 32, fontWeight: 500, color: 'var(--t1)', marginBottom: 6, letterSpacing: '-0.02em' }}>Welcome back.</h3>
              <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 28 }}>Sign in to your Narada workspace.</p>

              <form onSubmit={handleLogin}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Input
                    label="Email or Username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="you@company.com"
                    icon={<Ic.Mail s={15} />}
                    autoFocus
                  />
                  <Input
                    label="Password"
                    type={showPass ? 'text' : 'password'}
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="••••••••••"
                    icon={<Ic.Lock s={15} />}
                    rightIcon={
                      <span onClick={() => setShowPass(!showPass)} style={{ cursor: 'pointer', display: 'flex' }}>
                        {showPass ? <Ic.EyeOff s={15} /> : <Ic.Eye s={15} />}
                      </span>
                    }
                  />

                  {authError && (
                    <div style={{ fontSize: 13, color: 'var(--err)', background: 'var(--err-dim)', border: '1px solid var(--err)', borderRadius: 'var(--r)', padding: '8px 12px' }}>
                      {authError}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--t2)' }}>
                      <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                      Keep me signed in
                    </label>
                    <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>Forgot?</span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%', height: 46,
                      borderRadius: 'var(--r)',
                      background: 'var(--primary)',
                      border: 'none',
                      color: '#11183d',
                      fontSize: 14, fontWeight: 600,
                      letterSpacing: '0.04em',
                      cursor: loading ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 8, marginTop: 6,
                      boxShadow: 'var(--sh-glow)',
                      opacity: loading ? 0.75 : 1,
                      transition: 'opacity .15s',
                      fontFamily: 'var(--ff-body)',
                    }}
                  >
                    {loading ? (
                      <><Ic.Loader s={17} className="il-spin" /> Signing in…</>
                    ) : (
                      <>Enter Narada<Ic.ArrR s={16} /></>
                    )}
                  </button>
                </div>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 14px', color: 'var(--t3)' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
                <span style={{ fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase' }}>or continue with</span>
                <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {['SSO · SAML', 'Microsoft', 'Google'].map(p => (
                  <button key={p} type="button" style={{
                    flex: 1, height: 40,
                    background: 'transparent', border: '1px solid var(--bd2)',
                    borderRadius: 'var(--r)', color: 'var(--t2)',
                    fontSize: 12, fontFamily: 'inherit', fontWeight: 500,
                    cursor: 'pointer',
                  }}>{p}</button>
                ))}
              </div>

              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--t3)', marginTop: 26 }}>
                New to Narada? <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Request access</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Call Panel (LiveKit SFU) ────────────────────────────── */

/** A single participant's video tile (camera or screen share). */
function VideoTile({ p, big }: { p: SfuParticipant; big?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  // Prefer the screen-share stream when present, else the camera stream.
  const stream = p.screenSharing ? p.screenStream : p.cameraStream;
  const hasVideo = Boolean(stream);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    return () => { try { el.srcObject = null; } catch { /* noop */ } };
    // re-bind when the underlying stream identity changes
  }, [stream]);

  const avatarUser: Partial<User> = { name: p.name, color: colorFor(p.identity) };

  return (
    <div style={{
      position: 'relative',
      background: 'radial-gradient(circle at 30% 30%, var(--bg-elv), var(--bg-base) 70%)',
      borderRadius: big ? 18 : 14,
      overflow: 'hidden',
      border: `${p.isSpeaking ? 2 : 1}px solid ${p.isSpeaking ? 'var(--primary)' : 'var(--bd)'}`,
      boxShadow: p.isSpeaking ? '0 0 0 4px rgba(212,165,72,0.18)' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100%', height: '100%', minHeight: big ? 0 : 140,
      transition: 'box-shadow .15s var(--ease), border-color .15s var(--ease)',
    }}>
      {hasVideo ? (
        <video ref={ref} autoPlay playsInline muted={p.isLocal} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: p.isLocal && !p.screenSharing ? 'scaleX(-1)' : 'none' }} />
      ) : (
        <Avatar user={avatarUser} size={big ? 96 : 56} />
      )}
      <div style={{ position: 'absolute', bottom: big ? 14 : 6, left: big ? 14 : 6, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(6,8,26,0.6)', backdropFilter: 'blur(8px)', borderRadius: 999, padding: big ? '6px 10px' : '3px 8px', fontSize: big ? 12.5 : 11, color: 'var(--t1)', fontWeight: 500 }}>
        {p.isSpeaking && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)' }} />}
        {!p.micEnabled && <Ic.MicOff s={12} c="var(--err)" />}
        <span>{p.name}{p.isLocal ? <span style={{ color: 'var(--primary)' }}> · You</span> : ''}</span>
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
          background: isPinned ? 'rgba(212,165,72,.9)' : 'rgba(0,0,0,.55)',
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
  const { callSession, endCurrentCall, currentUser, searchUsers } = useApp();
  // Group calls use the self-hosted SFU when configured; 1:1 falls back to mesh
  // WebRTC. Start as {configured:false} so the first render already has
  // tokenResolved=true and the WebRTC preflight can fire without waiting.
  const [token, setToken] = useState<api.SfuToken | null>({ configured: false });
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
  // True once this call has been upgraded from a 1:1 mesh call into a group
  // (SFU) call — either because WE added a person, or we received a
  // 'call-upgrade' signal from the peer who did. Flips the panel onto the SFU
  // media path while leaving callSession.targetUserId intact.
  const [groupUpgrade, setGroupUpgrade] = useState(false);
  // "Add person" picker state.
  const [showAddPerson, setShowAddPerson] = useState(false);
  // Speaker/earpiece output routing. speakerOn=true uses the device's default
  // (loudspeaker on desktop); off routes to the earpiece/communications device.
  const [speakerOn, setSpeakerOn] = useState(true);

  // Listen for remote call signaling state changes (accepted / rejected / ended).
  useEffect(() => {
    const handler = (e: Event) => {
      const signal = (e as CustomEvent).detail;
      if (!signal) return;
      // Only react to signals for THIS call's room (multi-call safety).
      if (signal.roomId != null && roomId != null && Number(signal.roomId) !== Number(roomId)) return;
      if (signal.type === 'call-ended' || signal.type === 'call-rejected') {
        endCurrentCall();
      } else if (signal.type === 'call-accepted') {
        setCalleeAccepted(true);
      } else if (signal.type === 'call-upgrade') {
        // The peer added someone and is migrating this 1:1 to a group room.
        // Switch onto the SFU path so all parties share the same room.
        setGroupUpgrade(true);
      }
    };
    window.addEventListener('webrtc-signal', handler);
    return () => window.removeEventListener('webrtc-signal', handler);
  }, [endCurrentCall, roomId]);

  useEffect(() => {
    if (roomId == null) return;
    // 1:1 direct calls (a specific targetUserId) use the proven mesh WebRTC
    // path — no token needed, so we resolve synchronously and the WebRTC
    // preflight fires immediately. GROUP calls (no single target) — AND 1:1
    // calls that have been upgraded to a group — use the self-hosted SFU:
    // fetch a join token; if the SFU isn't configured the token comes back
    // {configured:false} and the panel shows a notice.
    if (targetUserId != null && !groupUpgrade) {
      setToken({ configured: false });
      return;
    }
    let cancelled = false;
    api.fetchSfuToken(roomId, true).then((t) => {
      if (!cancelled) setToken(t);
    });
    return () => { cancelled = true; };
  }, [roomId, targetUserId, groupUpgrade]);

  const lk = useSfu({
    url: token?.url,
    token: token?.token,
    identity: token?.identity,
    displayName: currentUser?.name,
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

  // When a 1:1 call is upgraded to a group, tear down the mesh peer connection
  // locally (silent — the peer migrates, it is NOT a hang-up) so the SFU path
  // becomes the single audio source. The SFU hook re-acquires mic/camera when
  // it connects; there is a brief (~1s) handoff gap. Runs once per upgrade.
  const meshTornDownRef = useRef(false);
  useEffect(() => {
    if (!groupUpgrade || meshTornDownRef.current) return;
    if (targetUserId == null) return; // pure group call: no mesh to tear down
    meshTornDownRef.current = true;
    webrtc.endCall(true);
  }, [groupUpgrade, targetUserId, webrtc]);

  // Start WebRTC offer when LiveKit is not configured AND we are the initiator
  // AND the callee has actually accepted (otherwise the offer would race the
  // callee's CallPanel mount and the webrtc-signal listener would not catch it).
  const tokenResolved = token !== null;
  const lkConfigured = Boolean(token?.configured);
  useEffect(() => {
    if (lkConfigured) return;
    // Mesh WebRTC is 1:1 only. Group calls (no specific target) go through the
    // SFU, never the mesh path.
    if (targetUserId == null) return;
    if (!isInitiator) return;
    if (roomId == null) return;
    if (webrtc.callState !== 'idle') return;
    // For 1-on-1 direct calls, wait for the callee's explicit accept.
    if (!calleeAccepted) return;
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
    // Only the mesh (1:1) path captures media here; the SFU hook captures its
    // own media once connected.
    if (targetUserId == null) return;
    if (roomId == null) return;
    if (webrtc.localStream) return;
    if (webrtc.callState === 'ended' || webrtc.callState === 'error') return;
    webrtc.preflightLocalMedia();
  }, [tokenResolved, lkConfigured, targetUserId, roomId, webrtc.localStream, webrtc.callState, webrtc]);

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

  // ── Add person to this call ────────────────────────────────────────────────
  // Rings the chosen user into THIS room as a group invite. If we're still a
  // 1:1 mesh call, we also tell the existing peer to migrate to the SFU group
  // room (call-upgrade signal) and flip ourselves onto the SFU path — so all
  // three end up in the same room. Already-group calls just ring the new person.
  const addPersonToCall = useCallback(async (user: User) => {
    if (roomId == null) return;
    const me = useAuthStore.getState().user;
    const isMeshOneToOne = targetUserId != null && !groupUpgrade;
    try {
      // Adding a person turns the call into a group call, which needs the SFU.
      // If we're still a 1:1, verify the SFU is actually available BEFORE we
      // migrate — otherwise we'd tear down a perfectly good 1:1 for nothing.
      if (isMeshOneToOne) {
        const probe = await api.fetchSfuToken(roomId, true);
        if (!probe.configured) {
          window.dispatchEvent(new CustomEvent('il-toast', {
            detail: { title: 'Group calls unavailable', message: 'The group-call server is not reachable right now.', tone: 'warn' },
          }));
          setShowAddPerson(false);
          return;
        }
      }
      await api.inviteToCall(Number(roomId), Number(user.id), callType);
      if (isMeshOneToOne) {
        if (me) {
          publishCallSignal({
            type: 'call-upgrade',
            roomId: Number(roomId),
            senderUserId: Number(me.id),
            targetUserId: Number(targetUserId),
            callType,
          });
        }
        setGroupUpgrade(true);
      }
      window.dispatchEvent(new CustomEvent('il-toast', {
        detail: { title: 'Adding to call', message: `Ringing ${user.name}…`, tone: 'info' },
      }));
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      window.dispatchEvent(new CustomEvent('il-toast', {
        detail: { title: 'Could not add to call', message: msg || 'Please try again.', tone: 'warn' },
      }));
    }
    setShowAddPerson(false);
  }, [roomId, targetUserId, groupUpgrade, callType]);

  // ── Speaker / earpiece audio-output routing ────────────────────────────────
  // setSinkId is the Audio Output Devices API. Unsupported on iOS Safari, so we
  // only surface the button when it exists. Applied to BOTH the mesh remote
  // <audio> element and (via the SFU hook) every SFU remote audio element.
  const speakerSupported = typeof window !== 'undefined'
    && typeof HTMLMediaElement !== 'undefined'
    && 'setSinkId' in HTMLMediaElement.prototype;
  const setSfuOutput = lk.setAudioOutput;
  const applyAudioOutput = useCallback(async (useSpeaker: boolean) => {
    if (!speakerSupported) return;
    let deviceId = '';
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outs = devices.filter((d) => d.kind === 'audiooutput');
      const byKw = (kw: string) => outs.find((d) => d.label.toLowerCase().includes(kw));
      if (useSpeaker) {
        // Prefer an explicit loudspeaker device (mobile); '' = the browser
        // default sink, which IS the loudspeaker on desktop.
        deviceId = byKw('speaker')?.deviceId || '';
      } else {
        // Earpiece / handset (mobile) or the OS "communications" device.
        deviceId = byKw('earpiece')?.deviceId
          || byKw('handset')?.deviceId
          || outs.find((d) => d.deviceId === 'communications')?.deviceId
          || '';
      }
    } catch { deviceId = ''; }
    const el = remoteAudioRef.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (el && typeof el.setSinkId === 'function') {
      try { await el.setSinkId(deviceId); } catch { /* unsupported sink */ }
    }
    try { await setSfuOutput(deviceId); } catch { /* noop */ }
  }, [speakerSupported, setSfuOutput]);

  // Apply only when the user actually toggles speaker/earpiece — NOT on mount.
  // The default (speakerOn=true) is the browser's default sink, so touching
  // setSinkId on first render would be a needless extra call against the proven
  // 1:1 remote-audio element. We guard the initial run with a ref.
  const speakerInitRef = useRef(true);
  useEffect(() => {
    if (speakerInitRef.current) { speakerInitRef.current = false; return; }
    void applyAudioOutput(speakerOn);
  }, [speakerOn, applyAudioOutput]);

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
          style={{
            width: 46, height: 46, borderRadius: '50%',
            border: `1px solid ${active ? color : 'var(--bd)'}`,
            cursor: 'pointer',
            background: active ? `${color}22` : 'rgba(17,24,61,0.65)',
            color: active ? color : 'var(--t1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s var(--ease)',
            backdropFilter: 'blur(12px)',
            boxShadow: active ? `0 0 0 3px ${color}1f` : 'none',
          }}
        >
          <IconCmp s={19} />
        </button>
      </Tip>
    );
  };

  return (
    <div className="il-callpanel" style={{ position: 'relative', background: 'radial-gradient(ellipse at 50% 120%, var(--bg-elv) 0%, var(--bg-main) 60%, var(--bg-base) 100%)', display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', overflow: 'hidden', color: 'var(--t1)' }}>
      <div className="narada-mandala-bg" style={{ width: 900, height: 900, left: -200, top: -200, position: 'absolute', opacity: 0.05, pointerEvents: 'none' }} />
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
          style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: 'var(--primary)', color: '#11183d', border: 'none', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--sh-glow)', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          🔊 Click to enable call audio
        </button>
      )}
      <div className="il-callpanel-header" style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', background: 'rgba(6,8,26,0.55)', backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? 'var(--ok)' : connecting ? 'var(--warn)' : 'var(--t3)', animation: 'pulse 2s infinite', boxShadow: isConnected ? '0 0 0 0 var(--ok)' : 'none' }} />
            <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 700 }}>{isConnected ? 'Live' : connecting ? 'Connecting' : 'Idle'}</span>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 13, color: 'var(--t1)', fontWeight: 500, marginLeft: 4 }}>{fmt(duration)}</span>
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--bd)' }} />
          <div>
            <div className="h-display" style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)' }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--ff-mono)' }}>{callType === 'video' ? 'Video' : 'Voice'} · {stateLabel}</div>
          </div>
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
                  fontSize: 11, fontFamily: 'var(--ff-mono)',
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
                    background: pinned ? 'rgba(212,165,72,.9)' : 'rgba(0,0,0,.55)',
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
            {(() => {
              // Group/SFU: show until at least one OTHER participant is present.
              // Mesh 1:1: show until the peer connects. Once others join, the
              // roster grows and this hint disappears.
              const aloneInGroup = configured && lkParticipants.length <= 1;
              const meshWaiting = useWebRTCMode && !webrtc.remoteStream && !isConnected;
              return aloneInGroup || meshWaiting;
            })() && (
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 13 }}>Waiting for others to join…</div>
            )}
          </div>
        )}
      </div>

      {/* Controls row. flexWrap + safe-area bottom padding keep every control
          (mute / camera / screen / speaker / add / leave) visible and tappable
          on phones — previously the row could overflow the viewport / sit under
          the home bar so the icons appeared cut off or missing. */}
      <div className="il-callpanel-controls" style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, padding: '18px 20px calc(20px + env(safe-area-inset-bottom, 0px))', background: 'linear-gradient(to top, rgba(6,8,26,0.95), transparent)', borderTop: '1px solid var(--bd)', flexShrink: 0 }}>
        {showAddPerson && (
          <AddPersonPanel
            searchUsers={searchUsers}
            excludeId={currentUser?.id}
            onPick={addPersonToCall}
            onClose={() => setShowAddPerson(false)}
          />
        )}
        {ctrlBtn(isMicOn ? 'Mute' : 'Unmute', 'MicOff', !isMicOn, '#d04354', toggleMic)}
        {callType === 'video' && ctrlBtn(isCamOn ? 'Turn off camera' : 'Turn on camera', 'VideoOff', !isCamOn, '#d04354', toggleCam)}
        {(() => {
          // Screen share is unavailable on most mobile browsers (iOS Safari,
          // Chrome on Android lack getDisplayMedia, or it errors NotSupported
          // when invoked). Without explicit feedback the user just sees the
          // button do nothing. Feature-detect once and either surface a clear
          // toast on tap, OR (when stopping a share that's already running)
          // let the stop path run normally.
          const canShareScreen =
            typeof navigator !== 'undefined'
            && !!navigator.mediaDevices
            && typeof navigator.mediaDevices.getDisplayMedia === 'function';
          const stopHandler = isScreenOn && useWebRTCMode ? stopScreen : toggleScreen;
          const onScreenClick = () => {
            if (!isScreenOn && !canShareScreen) {
              window.dispatchEvent(new CustomEvent('il-toast', { detail: {
                title: 'Screen sharing unsupported',
                message: 'This browser/device cannot share its screen. Try a desktop browser (Chrome, Edge, Firefox) on https://.',
                tone: 'warn',
              } }));
              return;
            }
            stopHandler();
          };
          return ctrlBtn(
            isScreenOn ? 'Stop sharing' : (canShareScreen ? 'Share screen' : 'Screen share (desktop only)'),
            'Monitor',
            isScreenOn,
            '#d4a548',
            onScreenClick,
          );
        })()}
        {speakerSupported && ctrlBtn(
          speakerOn ? 'Speaker (tap for earpiece)' : 'Earpiece (tap for speaker)',
          'Volume',
          speakerOn,
          '#3aa57a',
          () => setSpeakerOn((v) => !v)
        )}
        {ctrlBtn(
          showAddPerson ? 'Close' : 'Add person',
          'UserPlus',
          showAddPerson,
          '#d4a548',
          () => setShowAddPerson((v) => !v)
        )}
        <div style={{ width: 1, height: 28, background: 'var(--bd)', margin: '0 6px' }} />
        <Tip label="Leave call" pos="top">
          <button
            data-hangup
            onClick={hangUp}
            style={{ height: 44, padding: '0 22px', borderRadius: 999, border: 'none', cursor: 'pointer', background: 'var(--err)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'var(--ff-body)', fontWeight: 600, fontSize: 13, letterSpacing: '0.06em', boxShadow: '0 8px 24px rgba(208,67,84,0.45)' }}
          >
            <Ic.PhoneOff s={17} /> Leave
          </button>
        </Tip>
      </div>
    </div>
  );
}

/* ── Add-person picker (popover above the call controls) ─────────────────────
   Search for a teammate and ring them into the current call. Self-contained:
   manages its own debounced search so the CallPanel stays lean. */
function AddPersonPanel({
  searchUsers, excludeId, onPick, onClose,
}: {
  searchUsers: (q: string) => Promise<User[]>;
  excludeId?: string;
  onPick: (u: User) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 1) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const found = await searchUsers(query.trim());
        if (!cancelled) setResults(found.filter((u) => String(u.id) !== String(excludeId)).slice(0, 6));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, searchUsers, excludeId]);

  return (
    <>
      {/* Click-away backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, width: 'min(320px, 92vw)', background: '#16162a', border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,.6)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 13, fontWeight: 600 }}>
          <Ic.UserPlus s={15} /> Add to call
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.6)', display: 'flex', padding: 2 }}>
            <Ic.X s={15} />
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.4)', display: 'flex' }}><Ic.Search s={14} /></span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 30px', fontSize: 13, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#fff', outline: 'none' }}
          />
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {loading && <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 12, padding: '6px 4px' }}>Searching…</div>}
          {!loading && query.trim().length > 0 && results.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 12, padding: '6px 4px' }}>No matches.</div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => onPick(u)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#fff' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Avatar user={u} size={26} />
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
                {u.username && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>@{u.username}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
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

  const initials = (caller.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="il-incoming-wrap" style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, var(--bg-elv) 0%, var(--bg-main) 50%, var(--bg-base) 100%)',
      overflow: 'hidden',
      color: 'var(--t1)',
      pointerEvents: 'all',
    }}>
      {/* Rotating mandala — centered via top/left + negative margins so
          transform stays free for the rotation animation. */}
      <div
        className="narada-mandala-bg"
        style={{
          position: 'absolute',
          width: 900, height: 900,
          top: '50%', left: '50%',
          marginTop: -450, marginLeft: -450,
          opacity: 0.08,
          animation: 'rotateSlow 60s linear infinite',
          transformOrigin: 'center center',
        }}
      />

      {/* Concentric gold pulse rings centered on viewport. */}
      {[1, 2, 3].map((i) => {
        const size = 240 + i * 120;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              marginTop: -size / 2, marginLeft: -size / 2,
              width: size, height: size,
              borderRadius: '50%',
              border: '1px solid var(--primary)',
              opacity: 0.5 - i * 0.12,
              animation: `ringPulse ${2 + i * 0.4}s ${i * 0.3}s ease-out infinite`,
            }}
          />
        );
      })}

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 24, maxWidth: 480 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
          {incomingCall.callType === 'video' ? <Ic.Video s={12} /> : <Ic.Phone s={12} />}
          Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call
        </div>

        <div style={{ position: 'relative' }}>
          <div className="narada-ring-pulse" style={{
            width: 132, height: 132, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary-l), var(--primary-h))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#11183d',
            fontFamily: 'var(--ff-display)', fontWeight: 600, fontSize: 48,
            boxShadow: '0 0 0 4px var(--bg-base), 0 0 0 6px var(--primary), 0 24px 64px rgba(6,8,26,0.7)',
          }}>{initials}</div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="h-display" style={{ fontSize: 32, fontWeight: 500, color: 'var(--t1)', letterSpacing: '-0.01em' }}>{caller.name}</div>
          <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--ff-mono)', color: 'var(--primary)', letterSpacing: '0.06em' }}>ringing…</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleDecline}
              style={{
                width: 70, height: 70, borderRadius: '50%',
                background: 'var(--err)', color: '#fff',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 12px 32px rgba(208,67,84,0.45)',
                transition: 'transform .15s var(--ease)',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <Ic.PhoneOff s={22} c="#fff" />
            </button>
            <span style={{ fontSize: 11, color: 'var(--t2)', letterSpacing: '0.08em' }}>Decline</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => acceptIncomingCall()}
              style={{
                width: 70, height: 70, borderRadius: '50%',
                background: 'var(--ok)', color: '#fff',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 12px 32px rgba(58,165,122,0.45)',
                transition: 'transform .15s var(--ease)',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {incomingCall.callType === 'video' ? <Ic.Video s={22} c="#fff" /> : <Ic.Phone s={22} c="#fff" />}
            </button>
            <span style={{ fontSize: 11, color: 'var(--t2)', letterSpacing: '0.08em' }}>
              Accept {incomingCall.callType === 'video' ? '· Video' : '· Voice'}
            </span>
          </div>
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
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--ff-display)' }}>{t.title}</div>
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
      <span style={{ color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: 'var(--ff-body)' }}>
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
      // Resize to 256×256 JPEG Blob and upload as a binary file so we get
      // back a short fileUrl. Sending a base64 data URL directly to
      // PUT /api/v1/auth/profile fails with 400 because the backend has
      // @Size(max=500) on avatarUrl — data URLs are 50-100KB strings.
      const blob = await resizeImageToBlob(file, 256, 0.85);
      const attachment = await api.uploadAttachment('0', blob, `avatar-${Date.now()}.jpg`);
      const fileUrl = attachment.fileUrl;
      const updated = await api.updateAvatar(fileUrl);
      const avatarUrl = updated.avatar || fileUrl;
      patchCurrentUser({ avatar: avatarUrl });
      // Sync the auth-store cached profile so other surfaces see the new picture.
      const stored = useAuthStore.getState().user;
      if (stored) useAuthStore.getState().setUser({ ...stored, avatar: avatarUrl } as any);
      setAvatarStatus('ok');
      setTimeout(() => setAvatarStatus('idle'), 2500);
    } catch (e: any) {
      setAvatarStatus('error');
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
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--ff-display)' }}>{tabs.find((t) => t[0] === activeTab)?.[2]}</h2>
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
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--t1)', fontFamily: 'var(--ff-display)' }}>{me.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--t3)' }}>{me.role} · @{me.username}</div>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--t3)' }}>
                    Click the camera icon to change your profile picture.
                  </div>
                  {avatarStatus === 'saving' && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--t3)' }}>Uploading…</div>
                  )}
                  {avatarStatus === 'ok' && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ok)' }}>Profile picture updated.</div>
                  )}
                  {avatarStatus === 'error' && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--err)' }}>{avatarError}</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[['Display Name', me.name], ['Username', '@' + (me.username || '')], ['Email', email]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</label>
                    <input
                      defaultValue={v}
                      readOnly
                      style={{ padding: '9px 12px', background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', fontSize: 14, outline: 'none', fontFamily: 'var(--ff-body)' }}
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

  const fieldStyle: CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 'var(--r)', border: '1px solid var(--bd)', background: 'var(--bg-hover)', color: 'var(--t1)', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'var(--ff-body)' };
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
  fontFamily: 'var(--ff-body)',
};
const ghostBtnStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px',
  borderRadius: 'var(--r)', border: '1px solid var(--bd2)', cursor: 'pointer',
  background: 'var(--bg-hover)', color: 'var(--t1)', fontWeight: 600, fontSize: 12.5,
  fontFamily: 'var(--ff-body)',
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
          <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 13, color: 'var(--t1)' }}>Tweaks</span>
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
