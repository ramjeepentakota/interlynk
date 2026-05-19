/* InterLynk Workspace Rail + Sidebar — ported from il-sidebar.jsx
   (fixed the prototype's duplicate `function Sidebar()` declaration) */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Ic, type IconName } from './icons';
import { Avatar, Badge, Tip, useHover } from './ui';
import { useApp } from './context';
import { USERS, VOICE_CHANNELS, DMS, type Channel, type DM, type User, type VoiceChannel } from './data';

const WORKSPACES = [
  { id: 'acme', name: 'Acme Corp', initials: 'AC', color: '#8b5cf6' },
  { id: 'side', name: 'Side Project', initials: 'SP', color: '#f97316' },
  { id: 'oss', name: 'Open Source', initials: 'OS', color: '#10b981' },
];

function RailIcon({
  label,
  children,
  active,
  onClick,
  notif,
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  notif?: boolean;
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
          {notif && <div style={{ position: 'absolute', top: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: 'var(--err)', border: '2px solid var(--bg-base)' }} />}
        </div>
      </div>
    </Tip>
  );
}

export function WorkspaceRail() {
  const { activeView, setActiveView } = useApp();
  const [activeWs, setActiveWs] = useState('acme');

  return (
    <div style={{ width: 'var(--rail-w)', height: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, paddingBottom: 10, gap: 2, borderRight: '1px solid var(--bd)', flexShrink: 0 }}>
      {WORKSPACES.map((ws) => (
        <RailIcon key={ws.id} label={ws.name} active={activeWs === ws.id} onClick={() => setActiveWs(ws.id)}>
          {activeWs === ws.id ? (
            <span style={{ color: '#fff', fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 15 }}>{ws.initials}</span>
          ) : (
            <div style={{ width: 44, height: 44, background: ws.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 14 }}>{ws.initials}</span>
            </div>
          )}
        </RailIcon>
      ))}

      <Tip label="Add Workspace" pos="right">
        <div
          style={{ width: 44, height: 44, borderRadius: '50%', border: '2px dashed var(--bd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: '2px 0', color: 'var(--t3)', transition: 'all .15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bd2)'; e.currentTarget.style.color = 'var(--t3)'; }}
        >
          <Ic.Plus s={16} />
        </div>
      </Tip>

      <div style={{ flex: 1 }} />

      <RailIcon label="Direct Messages" active={activeView === 'dm'} onClick={() => setActiveView('dm')}>
        <Ic.Msg s={20} c={activeView === 'dm' ? '#fff' : 'var(--t2)'} />
      </RailIcon>
      <RailIcon label="Explore" active={false}>
        <Ic.Globe s={20} c="var(--t2)" />
      </RailIcon>

      <div style={{ height: 6 }} />
    </div>
  );
}

function ChannelItem({ ch, active, onClick }: { ch: Channel; active: boolean; onClick: () => void }) {
  const [h, hp] = useHover();
  const [showMenu, setShowMenu] = useState(false);
  const isActive = active;
  const unread = ch.unread || 0;
  return (
    <div {...hp} style={{ position: 'relative' }}>
      <div
        onClick={onClick}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 'var(--r)', cursor: 'pointer', background: isActive ? 'var(--bg-active)' : h ? 'var(--bg-hover)' : 'transparent', color: isActive ? 'var(--t1)' : unread > 0 ? 'var(--t1)' : 'var(--t3)', transition: 'all .12s', borderLeft: isActive ? '2px solid var(--primary)' : '2px solid transparent', marginLeft: -2, position: 'relative', userSelect: 'none' }}
      >
        <div style={{ color: isActive ? 'var(--primary)' : 'inherit', flexShrink: 0 }}>
          {ch.type === 'announcement' ? <Ic.Megaphone s={15} /> : ch.locked ? <Ic.Lock s={15} /> : <Ic.Hash s={15} />}
        </div>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: unread > 0 || isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
        {unread > 0 && !isActive && <Badge>{unread > 99 ? '99+' : unread}</Badge>}
        {h && !ch.locked && (
          <div
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            style={{ color: 'var(--t3)', display: 'flex', borderRadius: 4, padding: 2 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t1)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t3)')}
          >
            <Ic.MoreV s={13} />
          </div>
        )}
      </div>
      {showMenu && (
        <div className="il-scale-in" style={{ position: 'absolute', right: 4, top: '100%', zIndex: 200, background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', padding: 4, minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
          {([['Pencil', 'Edit Channel', false], ['Pin', 'Pin Message', false], ['Bell', 'Notifications', false], ['Trash', 'Delete Channel', true]] as [IconName, string, boolean][]).map(([icon, label, danger]) => {
            const IconCmp = Ic[icon];
            return (
              <div
                key={label}
                onClick={() => setShowMenu(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', color: danger ? 'var(--err)' : 'var(--t1)', fontSize: 13 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <IconCmp s={14} /> {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DmItem({
  dm,
  active,
  onClick,
  onVoiceCall,
  onVideoCall,
}: {
  dm: DM;
  active: boolean;
  onClick: () => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
}) {
  const [h, hp] = useHover();
  const user: Partial<User> = dm.isBot ? { name: dm.name, color: dm.color, initials: dm.initials } : USERS[dm.userId];
  const isActive = active;
  return (
    <div
      {...hp}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 'var(--r)', background: isActive ? 'var(--bg-active)' : h ? 'var(--bg-hover)' : 'transparent', borderLeft: isActive ? '2px solid var(--primary)' : '2px solid transparent', marginLeft: -2, transition: 'all .12s', userSelect: 'none', cursor: 'pointer' }}
    >
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar user={user} size={28} />
          {!dm.isBot && (
            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: ({ online: '#22c55e', away: '#f59e0b', busy: '#ef4444', offline: 'var(--t3)' } as Record<string, string>)[user?.status || 'offline'], border: '2px solid var(--bg-sidebar)' }} />
          )}
          {dm.isBot && (
            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', border: '2px solid var(--bg-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ic.Zap s={6} c="#fff" />
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: isActive || dm.unread > 0 ? 600 : 400, color: isActive ? 'var(--t1)' : dm.unread > 0 ? 'var(--t1)' : 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || dm.name}</span>
            {dm.unread > 0 && !h && <Badge>{dm.unread}</Badge>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dm.lastMsg}</div>
        </div>
      </div>
      {h && !dm.isBot && (
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          <Tip label="Voice Call" pos="top">
            <button
              onClick={(e) => { e.stopPropagation(); onVoiceCall?.(); }}
              style={{ width: 26, height: 26, border: 'none', background: 'var(--ok-dim)', color: 'var(--ok)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(34,197,94,.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ok-dim)')}
            >
              <Ic.Phone s={12} />
            </button>
          </Tip>
          <Tip label="Video Call" pos="top">
            <button
              onClick={(e) => { e.stopPropagation(); onVideoCall?.(); }}
              style={{ width: 26, height: 26, border: 'none', background: 'var(--primary-dim)', color: 'var(--primary)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--primary-dim)')}
            >
              <Ic.Video s={12} />
            </button>
          </Tip>
        </div>
      )}
    </div>
  );
}

function VoiceItem({ vc, active, onJoin }: { vc: VoiceChannel; active: boolean; onJoin: () => void }) {
  const [h, hp] = useHover();
  const participants = (vc.participants || []).map((id) => USERS[id]).filter(Boolean);
  return (
    <div>
      <div
        {...hp}
        onClick={onJoin}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 'var(--r)', cursor: 'pointer', background: active ? 'var(--ok-dim)' : h ? 'var(--bg-hover)' : 'transparent', color: active ? 'var(--ok)' : 'var(--t3)', transition: 'all .12s', userSelect: 'none' }}
      >
        <Ic.Vol s={14} c={active ? 'var(--ok)' : 'currentColor'} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: active ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vc.name}</span>
        {participants.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
            {participants.length}
          </span>
        )}
      </div>
      {participants.length > 0 && (
        <div style={{ marginLeft: 22, marginBottom: 2 }}>
          {participants.map((u) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', color: 'var(--t3)', fontSize: 12 }}>
              <Avatar user={u} size={18} />
              <span>{u.name}</span>
              <Ic.Mic s={11} c="var(--ok)" style={{ marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SideSection({
  title,
  onAdd,
  children,
  defaultOpen = true,
}: {
  title: string;
  onAdd?: () => void;
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
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t1)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t3)')}
        >
          <Ic.ChevD s={12} style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .18s' }} />
          {title}
        </button>
        {onAdd && (
          <button
            onClick={onAdd}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 2, borderRadius: 4, display: 'flex' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t1)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t3)')}
          >
            <Ic.Plus s={14} />
          </button>
        )}
      </div>
      {open && <div className="il-fade-up">{children}</div>}
    </div>
  );
}

function UserPanel() {
  const { setShowSettings } = useApp();
  const me = USERS.me;
  const [micMuted, setMicMuted] = useState(false);
  const [headMuted, setHeadMuted] = useState(false);
  return (
    <div style={{ padding: '8px 10px', borderTop: '1px solid var(--bd)', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setShowSettings(true)}>
        <Avatar user={me} size={34} />
        <div style={{ position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: '50%', background: 'var(--ok)', border: '2px solid var(--bg-base)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Outfit',sans-serif" }}>{me.name}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)' }}>#{me.username}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tip label={micMuted ? 'Unmute' : 'Mute'} pos="top">
          <button
            onClick={() => setMicMuted(!micMuted)}
            style={{ width: 28, height: 28, border: 'none', background: micMuted ? 'var(--err-dim)' : 'none', color: micMuted ? 'var(--err)' : 'var(--t3)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .14s' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = micMuted ? 'var(--err-dim)' : 'none')}
          >
            {micMuted ? <Ic.MicOff s={15} /> : <Ic.Mic s={15} />}
          </button>
        </Tip>
        <Tip label={headMuted ? 'Unmute Headset' : 'Mute Headset'} pos="top">
          <button
            onClick={() => setHeadMuted(!headMuted)}
            style={{ width: 28, height: 28, border: 'none', background: headMuted ? 'var(--err-dim)' : 'none', color: headMuted ? 'var(--err)' : 'var(--t3)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = headMuted ? 'var(--err-dim)' : 'none')}
          >
            {headMuted ? <Ic.MicOff s={15} /> : <Ic.Vol s={15} />}
          </button>
        </Tip>
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
    </div>
  );
}

export function Sidebar() {
  const { activeChannel, setActiveChannel, activeDm, setActiveDm, sideOpen, setInCall, setCallType, channels, setChannels } = useApp();
  const [activeVoice, setActiveVoice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    const ch: Channel = { id: newName.toLowerCase().replace(/\s+/g, '-'), name: newName.trim(), type: 'text', unread: 0, description: '' };
    setChannels((prev) => [...prev, ch]);
    setNewName('');
    setShowCreate(false);
    setActiveChannel(ch.id);
    setActiveDm(null);
  };

  if (!sideOpen) return null;
  return (
    <div className="il-slide-l" style={{ width: 'var(--side-w)', height: '100vh', background: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--bd)', flexShrink: 0 }}>
      <div style={{ height: 'var(--topbar-h)', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <button
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', flex: 1, padding: '6px 4px', borderRadius: 'var(--r)', transition: 'background .14s' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 13 }}>IL</span>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif", lineHeight: 1.2 }}>Acme Corp</div>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>7 members online</div>
          </div>
          <Ic.ChevD s={14} c="var(--t3)" style={{ marginLeft: 'auto' }} />
        </button>
      </div>

      <div style={{ padding: '10px 10px 6px' }}>
        <button
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t3)', fontSize: 13, cursor: 'pointer', transition: 'all .14s' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--bd2)'; e.currentTarget.style.color = 'var(--t2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.color = 'var(--t3)'; }}
        >
          <Ic.Search s={13} />
          <span style={{ flex: 1, textAlign: 'left' }}>Search…</span>
          <span style={{ fontSize: 11, background: 'var(--bg-active)', padding: '1px 5px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Ic.Cmd s={10} />K
          </span>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 0' }}>
        <SideSection title="Direct Messages" onAdd={() => {}}>
          {DMS.map((dm) => (
            <DmItem
              key={dm.id}
              dm={dm}
              active={activeDm === dm.id}
              onClick={() => { setActiveDm(dm.id); setActiveChannel(null); }}
              onVoiceCall={() => { setCallType('voice'); setInCall(true); }}
              onVideoCall={() => { setCallType('video'); setInCall(true); }}
            />
          ))}
        </SideSection>

        <SideSection title="Channels" onAdd={() => setShowCreate(true)}>
          {channels.map((ch) => (
            <ChannelItem key={ch.id} ch={ch} active={activeChannel === ch.id} onClick={() => { setActiveChannel(ch.id); setActiveDm(null); }} />
          ))}
          {channels.length === 0 && !showCreate && (
            <div style={{ padding: '8px 6px' }}>
              <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 7, lineHeight: 1.5 }}>No channels yet. Create one to get started.</p>
              <button
                onClick={() => setShowCreate(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 10px', borderRadius: 'var(--r)', border: '1.5px dashed var(--bd2)', background: 'transparent', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%', transition: 'all .14s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-dim)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Ic.Plus s={13} /> Create Channel
              </button>
            </div>
          )}
          {showCreate && (
            <div className="il-fade-up" style={{ padding: '8px 6px', background: 'var(--bg-hover)', borderRadius: 'var(--r-lg)', margin: '4px 0', border: '1px solid var(--bd)' }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value.replace(/\s+/g, '-'))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowCreate(false); setNewName(''); } }}
                placeholder="channel-name"
                autoFocus
                style={{ width: '100%', background: 'var(--bg-active)', border: '1px solid var(--bd2)', borderRadius: 'var(--r)', padding: '6px 9px', color: 'var(--t1)', fontSize: 13, outline: 'none', marginBottom: 6, fontFamily: "'DM Sans',sans-serif" }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--bd2)')}
              />
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={handleCreate} style={{ flex: 1, padding: '5px 8px', borderRadius: 'var(--r)', background: 'var(--primary)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Create</button>
                <button onClick={() => { setShowCreate(false); setNewName(''); }} style={{ padding: '5px 8px', borderRadius: 'var(--r)', background: 'transparent', border: '1px solid var(--bd2)', color: 'var(--t2)', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
              </div>
            </div>
          )}
        </SideSection>

        <SideSection title="Voice Channels" onAdd={() => {}} defaultOpen>
          {VOICE_CHANNELS.map((vc) => (
            <VoiceItem key={vc.id} vc={vc} active={activeVoice === vc.id} onJoin={() => setActiveVoice(activeVoice === vc.id ? null : vc.id)} />
          ))}
        </SideSection>
      </div>

      <UserPanel />
    </div>
  );
}
