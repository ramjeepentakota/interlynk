/* InterLynk Workspace Rail + Sidebar — backend-wired.
   Sections: People search, Direct Messages (inbox), Channels.
   (Voice channels were removed from the product.) */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Ic, type IconName } from './icons';
import { Avatar, Badge, Tip, useHover } from './ui';
import { useApp } from './context';
import { type Channel } from './data';
import * as api from './api';
import { InlinePeopleSearch } from './People';

function RailIcon({
  label,
  children,
  active,
  onClick,
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const [h, hp] = useHover();
  return (
    <Tip label={label} pos="right">
      <div
        {...hp}
        onClick={onClick}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '4px 0', cursor: 'pointer' }}
      >
        <div style={{ position: 'absolute', left: 0, width: 3, height: active ? 36 : h ? 20 : 0, background: 'var(--t1)', borderRadius: '0 3px 3px 0', transition: 'height .2s ease' }} />
        <div style={{ width: 44, height: 44, borderRadius: active ? 'var(--r-lg)' : '50%', background: active ? 'var(--primary)' : h ? 'var(--bg-active)' : 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .18s', overflow: 'hidden', position: 'relative' }}>
          {children}
        </div>
      </div>
    </Tip>
  );
}

export function WorkspaceRail() {
  const { currentUser, setShowAdmin, showAdmin } = useApp();
  const isAdmin = currentUser?.role === 'ADMIN';
  if (!isAdmin) return null;
  return (
    <div className="il-rail" style={{ width: 'var(--rail-w)', height: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, paddingBottom: 10, gap: 2, borderRight: '1px solid var(--bd)', flexShrink: 0 }}>
      <RailIcon label="Admin Center" active={showAdmin} onClick={() => setShowAdmin(true)}>
        <Ic.Shield s={18} c="#fff" />
      </RailIcon>
      <div style={{ flex: 1 }} />
      <div style={{ height: 6 }} />
    </div>
  );
}

function ChannelItem({ ch, active, onClick, onDelete, onInvite }: { ch: Channel; active: boolean; onClick: () => void; onDelete: () => void; onInvite: () => void }) {
  const [h, hp] = useHover();
  const [showMenu, setShowMenu] = useState(false);
  const unread = ch.unread || 0;
  return (
    <div {...hp} style={{ position: 'relative' }}>
      <div
        onClick={onClick}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 'var(--r)', cursor: 'pointer', background: active ? 'var(--bg-active)' : h ? 'var(--bg-hover)' : 'transparent', color: active ? 'var(--t1)' : unread > 0 ? 'var(--t1)' : 'var(--t3)', transition: 'all .12s', borderLeft: active ? '2px solid var(--primary)' : '2px solid transparent', marginLeft: -2, position: 'relative', userSelect: 'none' }}
      >
        <div style={{ color: active ? 'var(--primary)' : 'inherit', flexShrink: 0 }}>
          {ch.type === 'announcement' ? <Ic.Megaphone s={15} /> : ch.locked ? <Ic.Lock s={15} /> : <Ic.Hash s={15} />}
        </div>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: unread > 0 || active ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
        {unread > 0 && !active && <Badge>{unread > 99 ? '99+' : unread}</Badge>}
        {h && (
          <div
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            style={{ color: 'var(--t3)', display: 'flex', borderRadius: 4, padding: 2 }}
          >
            <Ic.MoreV s={13} />
          </div>
        )}
      </div>
      {showMenu && (
        <div className="il-scale-in" style={{ position: 'absolute', right: 4, top: '100%', zIndex: 200, background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', padding: 4, minWidth: 170, boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
          <div
            onClick={() => { setShowMenu(false); onInvite(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', color: 'var(--t1)', fontSize: 13 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Ic.UserPlus s={14} /> Invite People
          </div>
          <div
            onClick={() => { setShowMenu(false); onDelete(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', color: 'var(--err)', fontSize: 13 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Ic.Trash s={14} /> Delete Channel
          </div>
        </div>
      )}
    </div>
  );
}

function InviteChannelModal({ channelId, channelName, onClose, onInvite }: { channelId: string; channelName: string; onClose: () => void; onInvite: (channelId: string, username: string) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const { searchUsers } = useApp();
  const [results, setResults] = useState<{ id: string; name: string; username?: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const users = await searchUsers(q);
      setResults(users.map((u) => ({ id: u.id, name: u.name, username: u.username })));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (username: string) => {
    if (!username) return;
    setStatus('sending');
    setErrorMsg('');
    try {
      await onInvite(channelId, username);
      setStatus('success');
      setTimeout(onClose, 1500);
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e?.response?.data?.message || 'Failed to invite user');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8000, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div className="il-scale-in il-modal-card il-invite-modal" style={{ background: 'var(--bg-elv)', border: '1px solid var(--bd)', borderRadius: 'var(--r-xl)', padding: 24, width: 400, boxShadow: '0 24px 80px rgba(0,0,0,.7)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>Invite to #{channelName}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>Search for a teammate to invite</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 4, borderRadius: 4, display: 'flex' }}><Ic.X s={16} /></button>
        </div>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); doSearch(e.target.value); }}
          placeholder="Search by name or username…"
          autoFocus
          style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-hover)', border: '1px solid var(--bd2)', borderRadius: 'var(--r)', color: 'var(--t1)', fontSize: 13, outline: 'none', fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box' }}
        />
        {status === 'success' && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--ok-dim)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 'var(--r)', color: 'var(--ok)', fontSize: 13, fontWeight: 600 }}>
            Invitation sent! They'll see it in their notifications.
          </div>
        )}
        {status === 'error' && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--err-dim)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 'var(--r)', color: 'var(--err)', fontSize: 13 }}>{errorMsg}</div>
        )}
        {searching && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--t3)' }}>Searching…</div>}
        {results.length > 0 && status === 'idle' && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {results.map((u) => (
              <div
                key={u.id}
                onClick={() => handleInvite(u.username || u.name)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r)', cursor: 'pointer', background: 'var(--bg-hover)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-active)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              >
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{u.name.charAt(0).toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{u.name}</div>
                  {u.username && <div style={{ fontSize: 11, color: 'var(--t3)' }}>@{u.username}</div>}
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>Invite</div>
              </div>
            ))}
          </div>
        )}
        {status === 'sending' && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--t3)' }}>Sending invitation…</div>}
      </div>
    </div>
  );
}

function SideSection({
  title,
  onAdd,
  addLabel,
  children,
  defaultOpen = true,
}: {
  title: string;
  onAdd?: () => void;
  addLabel?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', marginBottom: 2 }}>
        <button
          onClick={() => setOpen(!open)}
          style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', padding: 2, borderRadius: 4 }}
        >
          <Ic.ChevD s={12} style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .18s' }} />
          {title}
        </button>
        {onAdd && (
          <Tip label={addLabel || 'Add'}>
            <button
              onClick={onAdd}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 2, borderRadius: 4, display: 'flex' }}
            >
              <Ic.Plus s={14} />
            </button>
          </Tip>
        )}
      </div>
      {open && <div className="il-fade-up">{children}</div>}
    </div>
  );
}

function UserPanel() {
  const { setShowSettings, currentUser } = useApp();
  const me = currentUser || { name: '?', username: '' };
  return (
    <div style={{ padding: '8px 10px', borderTop: '1px solid var(--bd)', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowSettings(true)}>
        <Avatar user={me} size={34} />
        <div style={{ position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: '50%', background: 'var(--ok)', border: '2px solid var(--bg-base)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Outfit',sans-serif" }}>{me.name}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)' }}>@{me.username}</div>
      </div>
      <Tip label="Settings" pos="top">
        <button
          onClick={() => setShowSettings(true)}
          style={{ width: 28, height: 28, border: 'none', background: 'none', color: 'var(--t3)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <Ic.Gear s={15} />
        </button>
      </Tip>
    </div>
  );
}

/* ── Direct message conversation row ─────────────────────── */
function DmItem({
  user,
  preview,
  unread,
  active,
  onClick,
}: {
  user: { id: string; name: string; username?: string; avatar?: string; color?: string; status?: any };
  preview: string;
  unread: number;
  active: boolean;
  onClick: () => void;
}) {
  const [h, hp] = useHover();
  return (
    <div
      {...hp}
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 'var(--r)', cursor: 'pointer', background: active ? 'var(--bg-active)' : h ? 'var(--bg-hover)' : 'transparent', borderLeft: active ? '2px solid var(--primary)' : '2px solid transparent', marginLeft: -2, userSelect: 'none' }}
    >
      <Avatar user={user} size={28} showStatus />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: unread > 0 || active ? 600 : 500, color: unread > 0 || active ? 'var(--t1)' : 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview || '@' + (user.username || '')}</div>
      </div>
      {unread > 0 && <Badge>{unread > 99 ? '99+' : unread}</Badge>}
    </div>
  );
}

export function Sidebar() {
  const {
    activeChannel, selectChannel, sideOpen, channels, createChannel,
    conversations, activeDm, openDm,
    inviteToChannel,
  } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showInvite, setShowInvite] = useState<string | null>(null); // channelId

  // Defensively filter out any legacy VOICE-type channels that may still be
  // sitting in the database — they should never render in the new UI.
  const textChannels = channels.filter((c) => c.type !== 'voice');

  const extractError = (e: any): string => {
    const msg: string = e?.response?.data?.message || e?.response?.data?.error || e?.message || '';
    if (e?.response?.status === 409 || msg.toLowerCase().includes('already exists')) {
      return 'A channel with this name already exists. Please choose a different name.';
    }
    return msg || 'Failed to create channel. Please try again.';
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setCreateError('');
    try {
      await createChannel(name);
      setNewName('');
      setShowCreate(false);
    } catch (e) {
      setCreateError(extractError(e));
    } finally {
      setCreating(false);
    }
  };

  if (!sideOpen) return null;
  return (
    <div className="il-slide-l il-sidebar" style={{ width: 'var(--side-w)', height: '100vh', background: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--bd)', flexShrink: 0 }}>
      <div style={{ height: 'var(--topbar-h)', padding: '4px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <img src="/narada-logo.png" alt="Narada" style={{ height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 0' }}>
        {/* Direct messages (inbox) */}
        <SideSection title="Direct Messages">
          <div style={{ padding: '2px 4px 6px' }}>
            <InlinePeopleSearch width="100%" placeholder="Search people…" />
          </div>
          {conversations.map((c) => (
            <DmItem
              key={c.userId}
              user={c.user}
              preview={c.lastMessage}
              unread={c.unread}
              active={activeDm === c.userId}
              onClick={() => openDm(c.user)}
            />
          ))}
          {conversations.length === 0 && (
            <div style={{ padding: '4px 6px 8px', fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>
              No conversations yet. Search above to find a teammate.
            </div>
          )}
        </SideSection>

        {/* Text channels */}
        <SideSection title="Channels" onAdd={() => setShowCreate(true)} addLabel="Create channel">
          {textChannels.map((ch) => (
            <ChannelItem
              key={ch.id}
              ch={ch}
              active={activeChannel === ch.id}
              onClick={() => selectChannel(ch.id)}
              onInvite={() => setShowInvite(ch.id)}
              onDelete={async () => {
                try {
                  await api.deleteChannel(ch.id);
                } catch (e) {
                  console.error('Delete failed', e);
                }
              }}
            />
          ))}
          {textChannels.length === 0 && !showCreate && (
            <div style={{ padding: '8px 6px', fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>
              No channels yet. Click <strong style={{ color: 'var(--t2)' }}>+</strong> above to create one.
            </div>
          )}
          {showCreate && (
            <div className="il-fade-up" style={{ padding: '8px 6px', background: 'var(--bg-hover)', borderRadius: 'var(--r-lg)', margin: '4px 0', border: '1px solid var(--bd)' }}>
              <input
                value={newName}
                onChange={(e) => { setNewName(e.target.value.replace(/\s+/g, '-')); setCreateError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowCreate(false); setNewName(''); setCreateError(''); } }}
                placeholder="channel-name"
                autoFocus
                style={{ width: '100%', background: 'var(--bg-active)', border: `1px solid ${createError ? '#f87171' : 'var(--bd2)'}`, borderRadius: 'var(--r)', padding: '6px 9px', color: 'var(--t1)', fontSize: 13, outline: 'none', marginBottom: createError ? 4 : 6, fontFamily: "'DM Sans',sans-serif" }}
              />
              {createError && (
                <div style={{ fontSize: 11, color: '#f87171', marginBottom: 6, lineHeight: 1.4 }}>{createError}</div>
              )}
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={handleCreate} disabled={creating} style={{ flex: 1, padding: '5px 8px', borderRadius: 'var(--r)', background: 'var(--primary)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>{creating ? 'Creating…' : 'Create'}</button>
                <button onClick={() => { setShowCreate(false); setNewName(''); setCreateError(''); }} style={{ padding: '5px 8px', borderRadius: 'var(--r)', background: 'transparent', border: '1px solid var(--bd2)', color: 'var(--t2)', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
              </div>
            </div>
          )}
        </SideSection>

      </div>

      <UserPanel />

      {showInvite && (() => {
        const inviteCh = channels.find((c) => c.id === showInvite);
        return (
          <InviteChannelModal
            channelId={showInvite}
            channelName={inviteCh?.name || showInvite}
            onClose={() => setShowInvite(null)}
            onInvite={inviteToChannel}
          />
        );
      })()}
    </div>
  );
}
