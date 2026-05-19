/* InterLynk Login + Call + Settings + Tweaks + Incoming Call — ported from il-screens.jsx */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Ic, type IconName } from './icons';
import { Avatar, Input, Tip } from './ui';
import { useApp, type Accent, type Theme } from './context';
import { USERS, type User } from './data';

/* ── LoginScreen ─────────────────────────────────────────── */
export function LoginScreen() {
  const { setScreen, theme, setTheme } = useApp();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e?: { preventDefault: () => void }) => {
    e && e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setScreen('app'); }, 900);
  };

  const features: { icon: IconName; color: string; title: string; desc: string }[] = [
    { icon: 'Msg', color: '#8b5cf6', title: 'Rich Messaging', desc: 'Threads, reactions, @mentions' },
    { icon: 'Video', color: '#10b981', title: 'HD Video & Voice', desc: 'Group calls with screen share' },
    { icon: 'Zap', color: '#f43f5e', title: 'AI Assistant', desc: 'Built-in AI for your workflow' },
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
          <p style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 40 }}>Chat, calls, voice channels and code collaboration — all in one place.</p>

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
              {tab === 'login' ? 'Welcome back' : 'Join InterLynk'}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--t3)' }}>
              {tab === 'login' ? 'Sign in to your workspace' : 'Create your account'}
            </p>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: 'var(--r)', padding: 3, marginBottom: 24, border: '1px solid var(--bd)' }}>
            {([['login', 'Sign In'], ['register', 'Register']] as ['login' | 'register', string][]).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setTab(v)}
                style={{ flex: 1, padding: '7px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: tab === v ? 'var(--bg-active)' : 'transparent', color: tab === v ? 'var(--t1)' : 'var(--t3)', transition: 'all .15s' }}
              >
                {l}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input label="Email or Username" type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" icon={<Ic.Mail s={15} />} autoFocus />
              <Input
                label="Password"
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••••"
                icon={<Ic.Lock s={15} />}
                rightIcon={<span onClick={() => setShowPass(!showPass)} style={{ cursor: 'pointer', display: 'flex' }}>{showPass ? <Ic.EyeOff s={15} /> : <Ic.Eye s={15} />}</span>}
              />
              {tab === 'register' && <Input label="Display Name" type="text" placeholder="Your full name" icon={<Ic.User s={15} />} />}

              {tab === 'login' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: 'var(--t2)' }}>
                    <input type="checkbox" style={{ accentColor: 'var(--primary)' }} /> Remember me
                  </label>
                  <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-link)', fontSize: 13, fontWeight: 500 }}>Forgot password?</button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', height: 44, borderRadius: 'var(--r)', background: 'linear-gradient(135deg,var(--primary) 0%,var(--primary-h) 100%)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, boxShadow: '0 4px 20px rgba(139,92,246,.35)', transition: 'opacity .15s', opacity: loading ? 0.75 : 1, fontFamily: "'DM Sans',sans-serif" }}
              >
                {loading ? (
                  <><Ic.Loader s={17} className="il-spin" /> Signing in…</>
                ) : (
                  <>{tab === 'login' ? 'Sign In' : 'Create Account'}<Ic.ArrR s={16} /></>
                )}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
                <span style={{ fontSize: 12, color: 'var(--t3)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
              </div>

              <button
                type="button"
                onClick={() => setScreen('app')}
                style={{ width: '100%', height: 40, borderRadius: 'var(--r)', background: 'transparent', border: '1.5px dashed var(--bd2)', color: 'var(--t2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all .15s', fontFamily: "'DM Sans',sans-serif" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bd2)'; e.currentTarget.style.color = 'var(--t2)'; }}
              >
                <Ic.Globe s={14} /> Preview without signing in
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

/* ── Call Panel ──────────────────────────────────────────── */
interface Participant {
  user: User;
  isMuted: boolean;
  isVideo: boolean;
  isSpeaking: boolean;
}

const CALL_PARTICIPANTS: Participant[] = [
  { user: USERS.me, isMuted: false, isVideo: true, isSpeaking: false },
  { user: USERS.alice, isMuted: false, isVideo: true, isSpeaking: true },
  { user: USERS.bob, isMuted: true, isVideo: false, isSpeaking: false },
  { user: USERS.carol, isMuted: false, isVideo: true, isSpeaking: false },
];

function VideoTile({ user, isMuted, isVideo, isSpeaking, isLarge }: Partial<Participant> & { isLarge?: boolean }) {
  if (!user) return null;
  const sz = isLarge ? 72 : 44;
  const col = user.color || '#8b5cf6';
  return (
    <div
      className={isSpeaking ? 'il-speak-ring' : ''}
      style={{ position: 'relative', background: '#0d0e18', borderRadius: 'var(--r-xl)', overflow: 'hidden', border: `2px solid ${isSpeaking ? 'var(--ok)' : 'rgba(255,255,255,.07)'}`, transition: 'border-color .3s', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
    >
      {isVideo ? (
        <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${col}30 0%, #0d0e18 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', opacity: 0.4 }}>
            <div style={{ fontSize: 12, color: '#fff', fontFamily: "'Outfit',sans-serif" }}>Camera preview</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>({user.name})</div>
          </div>
          <Avatar user={user} size={sz} style={{ position: 'absolute', opacity: 0.2 }} />
        </div>
      ) : (
        <Avatar user={user} size={sz} />
      )}

      <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', borderRadius: 6, padding: '3px 8px' }}>
        {isSpeaking && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', flexShrink: 0 }} />}
        <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{user.id === 'me' ? 'You' : user.name}</span>
        {isMuted && <Ic.MicOff s={11} c="#ef4444" />}
      </div>
    </div>
  );
}

export function CallPanel() {
  const { setInCall, callType } = useApp();
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(callType === 'video');
  const [sharing, setSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParts, setShowParts] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatMsgs, setChatMsgs] = useState<{ id: string; author: string; text: string; time: string }[]>([
    { id: 's0', author: 'System', text: 'Call started. Use the chat to send quick notes.', time: 'Now' },
  ]);
  const [duration, setDuration] = useState(0);
  const [layout, setLayout] = useState<'grid' | 'spotlight'>('grid');
  const [speakerIdx, setSpeakerIdx] = useState(1);

  useEffect(() => {
    const t = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  const ctrlBtn = (label: string, icon: IconName, active: boolean, color: string, onClick: () => void) => {
    const IconCmp = Ic[icon];
    return (
      <Tip label={label} pos="top">
        <button
          onClick={onClick}
          style={{ width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer', background: active ? `${color}25` : 'rgba(255,255,255,.1)', color: active ? color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', backdropFilter: 'blur(8px)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = active ? `${color}35` : 'rgba(255,255,255,.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = active ? `${color}25` : 'rgba(255,255,255,.1)')}
        >
          <IconCmp s={20} />
        </button>
      </Tip>
    );
  };

  const mainStyle: CSSProperties = {
    position: fullscreen ? 'fixed' : 'relative',
    inset: fullscreen ? 0 : 'auto',
    zIndex: fullscreen ? 9999 : 1,
    background: '#09090e',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
    overflow: 'hidden',
  };

  return (
    <div style={mainStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(255,255,255,.04)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--err)', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#fff', fontWeight: 600 }}>{fmt(duration)}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: callType === 'video' ? 'rgba(139,92,246,.2)' : 'rgba(34,197,94,.2)', color: callType === 'video' ? '#a78bfa' : '#4ade80', border: `1px solid ${callType === 'video' ? 'rgba(139,92,246,.3)' : 'rgba(34,197,94,.3)'}` }}>
            {callType === 'video' ? '📹 Video Call' : '🎙 Voice Call'} · {CALL_PARTICIPANTS.length} participants
          </span>
          {sharing && <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'rgba(139,92,246,.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,.3)' }}>🖥 Sharing screen</span>}
          {handRaised && <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'rgba(245,158,11,.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,.3)' }}>✋ Hand raised</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tip label="Layout">
            <button onClick={() => setLayout(layout === 'grid' ? 'spotlight' : 'grid')} style={{ background: 'rgba(255,255,255,.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.7)', padding: '5px 10px', borderRadius: 6, fontSize: 12 }}>
              {layout === 'grid' ? '⊞ Grid' : '◈ Spotlight'}
            </button>
          </Tip>
          <Tip label="Participants">
            <button onClick={() => { setShowParts(!showParts); setShowChat(false); }} style={{ background: showParts ? 'rgba(139,92,246,.2)' : 'rgba(255,255,255,.08)', border: 'none', cursor: 'pointer', color: showParts ? '#a78bfa' : 'rgba(255,255,255,.7)', padding: '5px 10px', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'DM Sans',sans-serif" }}>
              <Ic.Users s={13} />{CALL_PARTICIPANTS.length}
            </button>
          </Tip>
          <Tip label="In-call Chat">
            <button onClick={() => { setShowChat(!showChat); setShowParts(false); }} style={{ background: showChat ? 'rgba(139,92,246,.2)' : 'rgba(255,255,255,.08)', border: 'none', cursor: 'pointer', color: showChat ? '#a78bfa' : 'rgba(255,255,255,.7)', padding: '5px 10px', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Ic.Msg s={13} />{chatMsgs.length > 1 ? chatMsgs.length - 1 : ''}
            </button>
          </Tip>
          <button onClick={() => setFullscreen(!fullscreen)} style={{ background: 'rgba(255,255,255,.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.7)', padding: 6, borderRadius: 6, display: 'flex' }}>
            {fullscreen ? <Ic.Min2 s={15} /> : <Ic.Max2 s={15} />}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          {layout === 'spotlight' ? (
            <>
              <div style={{ flex: 1, minHeight: 0 }}>
                <VideoTile {...CALL_PARTICIPANTS[speakerIdx]} isSpeaking isLarge />
              </div>
              <div style={{ display: 'flex', gap: 10, height: 120, flexShrink: 0 }}>
                {CALL_PARTICIPANTS.filter((_, i) => i !== speakerIdx).map((p) => (
                  <div
                    key={p.user.id}
                    onClick={() => setSpeakerIdx(CALL_PARTICIPANTS.indexOf(p))}
                    style={{ flex: 1, cursor: 'pointer', borderRadius: 'var(--r-lg)', overflow: 'hidden', transition: 'opacity .15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '.8')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    <VideoTile {...p} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gridTemplateRows: 'repeat(2,1fr)', gap: 10, minHeight: 0 }}>
              {CALL_PARTICIPANTS.map((p) => (
                <VideoTile key={p.user.id} {...p} />
              ))}
            </div>
          )}
        </div>

        {(showParts || showChat) && (
          <div className="il-slide-l" style={{ width: 280, background: 'rgba(13,14,24,.95)', backdropFilter: 'blur(16px)', borderLeft: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{showParts ? `Participants (${CALL_PARTICIPANTS.length})` : 'In-call Chat'}</span>
              <button onClick={() => { setShowParts(false); setShowChat(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', padding: 4, borderRadius: 4, display: 'flex' }}>
                <Ic.X s={14} />
              </button>
            </div>
            {showParts && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                {CALL_PARTICIPANTS.map(({ user, isMuted, isVideo, isSpeaking }) => (
                  <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 'var(--r)' }}>
                    <div style={{ position: 'relative' }}>
                      <Avatar user={user} size={32} />
                      {isSpeaking && <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: '2px solid var(--ok)', animation: 'speakPulse 1.4s infinite' }} />}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, color: '#fff', fontWeight: 500 }}>{user.id === 'me' ? 'You' : user.name}</span>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {isMuted && <Ic.MicOff s={13} c="#ef4444" />}
                      {!isVideo && <Ic.VideoOff s={13} c="#ef4444" />}
                      {!isMuted && !isSpeaking && <Ic.Mic s={13} c="rgba(255,255,255,.3)" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showChat && (
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chatMsgs.map((m) => (
                    <div key={m.id}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.8)' }}>{m.author}</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{m.time}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', lineHeight: 1.4 }}>{m.text}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', gap: 6 }}>
                  <input
                    value={chatMsg}
                    onChange={(e) => setChatMsg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && chatMsg.trim()) { setChatMsgs((p) => [...p, { id: String(Date.now()), author: 'You', text: chatMsg.trim(), time: 'Now' }]); setChatMsg(''); } }}
                    placeholder="Message…"
                    style={{ flex: 1, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 'var(--r)', padding: '7px 10px', fontSize: 13, color: '#fff', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,.12)')}
                  />
                  <button
                    onClick={() => { if (chatMsg.trim()) { setChatMsgs((p) => [...p, { id: String(Date.now()), author: 'You', text: chatMsg.trim(), time: 'Now' }]); setChatMsg(''); } }}
                    style={{ width: 34, height: 34, background: chatMsg.trim() ? 'var(--primary)' : 'rgba(255,255,255,.1)', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                  >
                    <Ic.Send s={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '16px 20px', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
        {ctrlBtn(muted ? 'Unmute' : 'Mute', 'MicOff', muted, '#ef4444', () => setMuted(!muted))}
        {ctrlBtn(videoOn ? 'Turn off camera' : 'Turn on camera', 'VideoOff', !videoOn, '#ef4444', () => setVideoOn(!videoOn))}
        {ctrlBtn(sharing ? 'Stop sharing' : 'Share screen', 'Monitor', sharing, '#8b5cf6', () => setSharing(!sharing))}
        {ctrlBtn(handRaised ? 'Lower hand' : 'Raise hand', 'Hand', handRaised, '#f59e0b', () => setHandRaised(!handRaised))}
        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,.12)', margin: '0 4px' }} />
        {ctrlBtn('Chat', 'Msg', showChat, '#8b5cf6', () => { setShowChat(!showChat); setShowParts(false); })}
        {ctrlBtn('Participants', 'Users', showParts, '#8b5cf6', () => { setShowParts(!showParts); setShowChat(false); })}
        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,.12)', margin: '0 4px' }} />
        <Tip label="End call" pos="top">
          <button
            onClick={() => setInCall(false)}
            style={{ width: 52, height: 48, borderRadius: 24, border: 'none', cursor: 'pointer', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', boxShadow: '0 4px 20px rgba(239,68,68,.45)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#dc2626')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#ef4444')}
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
  const { setIncomingCall, setInCall, setCallType } = useApp();
  const caller = USERS.alice;
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
            <div style={{ fontSize: 13, color: 'var(--t3)' }}>Incoming video call…</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setIncomingCall(false)}
            style={{ flex: 1, height: 40, borderRadius: 'var(--r)', background: 'var(--err-dim)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--err)', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--err-dim)')}
          >
            <Ic.PhoneOff s={16} /> Decline
          </button>
          <button
            onClick={() => { setIncomingCall(false); setCallType('video'); setInCall(true); }}
            style={{ flex: 1, height: 40, borderRadius: 'var(--r)', background: 'var(--ok-dim)', border: '1px solid rgba(34,197,94,.3)', color: 'var(--ok)', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(34,197,94,.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ok-dim)')}
          >
            <Ic.Video s={16} /> Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Settings Modal ──────────────────────────────────────── */
export function SettingsModal() {
  const { setShowSettings, theme, setTheme, setScreen } = useApp();
  const me = USERS.me;
  const [activeTab, setActiveTab] = useState('profile');
  const tabs: [string, IconName, string][] = [
    ['profile', 'User', 'Profile'],
    ['appearance', 'Sun', 'Appearance'],
    ['notifications', 'Bell', 'Notifications'],
    ['audio', 'Vol', 'Audio & Video'],
    ['privacy', 'Shield', 'Privacy'],
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
                onMouseEnter={(e) => { if (activeTab !== id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { if (activeTab !== id) e.currentTarget.style.background = 'transparent'; }}
              >
                <IconCmp s={15} /> {label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => { setShowSettings(false); setScreen('login'); }}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 'var(--r)', border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--err)', fontSize: 13, fontWeight: 500, textAlign: 'left' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--err-dim)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t1)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t3)')}
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
                <button style={{ marginLeft: 'auto', background: 'var(--primary-dim)', border: '1px solid var(--primary)', borderRadius: 'var(--r)', padding: '7px 14px', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Change Avatar</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[['Display Name', me.name], ['Username', '@' + me.username], ['Email', 'jordan@acme.corp']].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</label>
                    <input
                      defaultValue={v}
                      style={{ padding: '9px 12px', background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
                      onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                      onBlur={(e) => (e.target.style.borderColor = 'var(--bd)')}
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
          {activeTab !== 'profile' && activeTab !== 'appearance' && (
            <div style={{ color: 'var(--t3)', fontSize: 14, textAlign: 'center', paddingTop: 40 }}>This settings section is coming soon.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Tweaks Panel ────────────────────────────────────────── */
const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: 'violet', label: 'Violet', color: '#8b5cf6' },
  { id: 'rose', label: 'Rose', color: '#f43f5e' },
  { id: 'emerald', label: 'Emerald', color: '#10b981' },
  { id: 'amber', label: 'Amber', color: '#f59e0b' },
  { id: 'coral', label: 'Coral', color: '#f97316' },
];

export function TweaksPanel() {
  const { theme, setTheme, accent, setAccent, setShowTweaks, setIncomingCall } = useApp();
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
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t1)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t3)')}
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

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Simulate</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={() => setIncomingCall(true)}
              style={{ padding: '8px 12px', borderRadius: 'var(--r)', border: '1px solid var(--bd)', background: 'var(--bg-hover)', color: 'var(--t1)', cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7, textAlign: 'left' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--ok)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--bd)')}
            >
              <Ic.Phone s={13} c="var(--ok)" /> Incoming call notification
            </button>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', paddingTop: 4, borderTop: '1px solid var(--bd)' }}>Drag to move · Changes apply live</div>
      </div>
    </div>
  );
}
