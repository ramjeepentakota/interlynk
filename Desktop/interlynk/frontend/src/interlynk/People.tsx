/* InterLynk people & direct-messaging UI:
   - ProfileCard  : Teams/WhatsApp-style profile with Message / Audio / Video
   - UserSearchBox: reusable type-ahead user finder (backed by /users/search)
   - NewMessageModal : pick a person to start a DM
   - DmConversation : 1:1 chat surface shown in the main area */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Ic } from './icons';
import { Avatar, Tip, useHover } from './ui';
import { useApp } from './context';
import { STATUS_COLORS, type User } from './data';
import { Composer } from './ChatFeatures';

/* ── Reusable user search type-ahead ─────────────────────── */
export function UserSearchBox({
  placeholder = 'Search people…',
  onPick,
  autoFocus,
}: {
  placeholder?: string;
  onPick: (user: User) => void;
  autoFocus?: boolean;
}) {
  const { searchUsers } = useApp();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => {
      searchUsers(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, searchUsers]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 10, color: 'var(--t3)', display: 'flex' }}>
          <Ic.Search s={15} />
        </div>
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', padding: '9px 12px 9px 32px', fontSize: 13.5, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
        />
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading && <div style={{ padding: '8px 6px', fontSize: 12.5, color: 'var(--t3)' }}>Searching…</div>}
        {!loading && q.trim() && results.length === 0 && (
          <div style={{ padding: '8px 6px', fontSize: 12.5, color: 'var(--t3)' }}>No people found.</div>
        )}
        {results.map((u) => (
          <UserRow key={u.id} user={u} onClick={() => onPick(u)} />
        ))}
      </div>
    </div>
  );
}

function UserRow({ user, onClick, trailing }: { user: User; onClick: () => void; trailing?: ReactNode }) {
  const [h, hp] = useHover();
  return (
    <div
      {...hp}
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 'var(--r)', cursor: 'pointer', background: h ? 'var(--bg-hover)' : 'transparent' }}
    >
      <Avatar user={user} size={32} showStatus />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>@{user.username || user.id}</div>
      </div>
      {trailing}
    </div>
  );
}

/* ── Inline people search (no modal — typeahead with dropdown) ── */
export function InlinePeopleSearch({ width = 220, placeholder = 'Search people…' }: { width?: number | string; placeholder?: string }) {
  const { searchUsers, openDm } = useApp();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (!query) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(() => {
      searchUsers(query).then(setResults).catch(() => setResults([])).finally(() => setLoading(false));
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, searchUsers]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const open = focused && q.trim().length > 0;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width }}>
      <div style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', display: 'flex', pointerEvents: 'none' }}>
        <Ic.Search s={14} />
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        style={{ width: '100%', height: 32, padding: '0 10px 0 30px', fontSize: 13, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
      />
      {open && (
        <div className="il-scale-in" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 280, maxWidth: 'calc(100vw - 24px)', maxHeight: 320, overflowY: 'auto', background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', boxShadow: '0 12px 40px rgba(0,0,0,.45)', padding: 6, zIndex: 200 }}>
          {loading && <div style={{ padding: '10px 8px', fontSize: 12.5, color: 'var(--t3)' }}>Searching…</div>}
          {!loading && results.length === 0 && (
            <div style={{ padding: '10px 8px', fontSize: 12.5, color: 'var(--t3)' }}>No people found.</div>
          )}
          {results.map((u) => (
            <UserRow key={u.id} user={u} onClick={() => { openDm(u); setQ(''); setFocused(false); }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── New-message modal (pick a person → open DM) ─────────── */
export function NewMessageModal({ onClose }: { onClose: () => void }) {
  const { openDm } = useApp();
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }} onClick={onClose}>
      <div className="il-scale-in il-modal-card il-newmsg-modal" onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '92vw', background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-xl)', padding: 16, boxShadow: '0 24px 80px rgba(0,0,0,.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>New message</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 4, borderRadius: 6, display: 'flex' }}>
            <Ic.X s={16} />
          </button>
        </div>
        <UserSearchBox
          autoFocus
          placeholder="Search by name or username…"
          onPick={(u) => { openDm(u); onClose(); }}
        />
      </div>
    </div>
  );
}

/* ── Profile card (Teams/WhatsApp style) ─────────────────── */
export function ProfileCard() {
  const { profileUser, closeProfile, openDm, startDirectCall, currentUser } = useApp();
  if (!profileUser) return null;
  const u = profileUser;
  const isSelf = currentUser?.id === u.id;
  const status = u.status || 'offline';

  const action = (label: string, icon: ReactNode, onClick: () => void, tone: string) => (
    <button
      onClick={onClick}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', borderRadius: 'var(--r-lg)', border: '1px solid var(--bd)', background: 'var(--bg-hover)', color: tone, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, fontWeight: 600, transition: 'all .14s' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-active)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 5200, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeProfile}>
      <div className="il-scale-in il-modal-card il-profile-card" onClick={(e) => e.stopPropagation()} style={{ width: 340, maxWidth: '92vw', background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.65)' }}>
        <div style={{ height: 84, background: 'linear-gradient(135deg,var(--primary) 0%,#a855f7 100%)', position: 'relative' }}>
          <button onClick={closeProfile} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,.3)', border: 'none', cursor: 'pointer', color: '#fff', padding: 5, borderRadius: 6, display: 'flex' }}>
            <Ic.X s={15} />
          </button>
        </div>
        <div style={{ padding: '0 20px 20px', marginTop: -36 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ borderRadius: '50%', border: '4px solid var(--bg-elv)' }}>
              <Avatar user={u} size={72} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>{u.name}</span>
            {u.role === 'ADMIN' && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'var(--primary-dim)', color: 'var(--primary)' }}>ADMIN</span>}
          </div>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 2 }}>@{u.username || u.id}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COLORS[status] }} />
            <span style={{ fontSize: 12.5, color: 'var(--t2)', textTransform: 'capitalize' }}>{status}</span>
          </div>

          {!isSelf && (
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              {action('Message', <Ic.Msg s={18} />, () => openDm(u), 'var(--primary)')}
              {action('Audio', <Ic.Phone s={18} />, () => startDirectCall(u, 'voice'), 'var(--ok)')}
              {action('Video', <Ic.Video s={18} />, () => startDirectCall(u, 'video'), 'var(--t-link)')}
            </div>
          )}
          {isSelf && (
            <div style={{ marginTop: 18, fontSize: 12.5, color: 'var(--t3)', textAlign: 'center' }}>This is you.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── DM conversation (main-area surface) ─────────────────── */
export function DmConversation() {
  const {
    activeDm, activeDmUser, dmMessages, dmLoading, sendDm, currentUser,
    startDirectCall, openProfile,
  } = useApp();
  const bottomRef = useRef<HTMLDivElement>(null);

  const list = (activeDm && dmMessages[activeDm]) || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [list.length, activeDm]);

  if (!activeDmUser) return null;
  const other = activeDmUser;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ height: 'var(--topbar-h)', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }} onClick={() => openProfile(other)}>
          <Avatar user={other} size={30} showStatus />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif", lineHeight: 1.2 }}>{other.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--t3)', textTransform: 'capitalize' }}>{other.status || 'offline'}</div>
          </div>
        </div>
        <Tip label="Audio call">
          <button onClick={() => startDirectCall(other, 'voice')} style={iconBtn('var(--ok)')}><Ic.Phone s={17} /></button>
        </Tip>
        <Tip label="Video call">
          <button onClick={() => startDirectCall(other, 'video')} style={iconBtn('var(--primary)')}><Ic.Video s={17} /></button>
        </Tip>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <Avatar user={other} size={56} style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>{other.name}</div>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>This is the beginning of your direct message history.</div>
        </div>

        {dmLoading && list.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ic.Loader s={14} className="il-spin" /> Loading…
          </div>
        )}

        {list.map((m, i) => {
          const mine = currentUser ? m.senderId === currentUser.id : false;
          const showDate = m.date !== list[i - 1]?.date;
          return (
            <div key={m.id}>
              {showDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px 4px' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
                  <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>{m.date}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', padding: '2px 16px' }}>
                <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 2 }}>
                  <div style={{ padding: '8px 12px', borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: mine ? 'var(--primary)' : 'var(--bg-hover)', color: mine ? '#fff' : 'var(--t1)', fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>
                    {m.content}
                  </div>
                  <span style={{ fontSize: 10.5, color: 'var(--t3)', padding: '0 4px' }}>{m.time}</span>
                </div>
              </div>
            </div>
          );
        })}

        {!dmLoading && list.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--t3)', fontSize: 14 }}>Say hello 👋</div>
        )}
        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* Input — shared Composer (emoji, GIF, dictation, multilingual). */}
      <Composer
        resetKey={activeDm}
        placeholder={`Message ${other.name}…`}
        onSend={(textVal) => sendDm(textVal)}
      />
    </div>
  );
}

function iconBtn(color: string): React.CSSProperties {
  return {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color,
    padding: 7,
    borderRadius: 8,
    display: 'flex',
    transition: 'background .14s',
  };
}
