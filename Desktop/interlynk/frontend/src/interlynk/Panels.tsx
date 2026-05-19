/* InterLynk TopBar + ChatPanel + Thread + MainLayout — ported from il-panels.jsx
   (fixed the prototype's duplicated ChatPanel hook block / channel lookup) */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Ic, type IconName } from './icons';
import { Avatar, Tip, useHover } from './ui';
import { useApp } from './context';
import { USERS, DMS, type Message } from './data';
import { WorkspaceRail, Sidebar } from './Sidebar';

/* ── TopBar ─────────────────────────────────────────────── */
export function TopBar() {
  const { activeChannel, activeDm, sideOpen, setSideOpen, theme, setTheme, showNotif, setShowNotif, setInCall, setCallType, setShowSettings, channels } = useApp();
  const ch = (channels || []).find((c) => c.id === activeChannel);
  const dm = DMS.find((d) => d.id === activeDm);
  const title = ch ? ch.name : dm ? USERS[dm.userId]?.name || dm.name : 'InterLynk';
  const desc = ch ? ch.description : dm ? 'Direct Message' : '';
  const isAnnouncment = ch?.type === 'announcement';

  return (
    <div style={{ height: 'var(--topbar-h)', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', paddingLeft: 14, paddingRight: 14, gap: 8, flexShrink: 0, zIndex: 10 }}>
      <Tip label={sideOpen ? 'Hide sidebar' : 'Show sidebar'}>
        <button
          onClick={() => setSideOpen(!sideOpen)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 5, borderRadius: 6, display: 'flex', transition: 'color .14s' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t1)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t3)')}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </Tip>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {ch && <span style={{ color: 'var(--t3)' }}>{ch.type === 'announcement' ? <Ic.Megaphone s={16} /> : ch.locked ? <Ic.Lock s={16} /> : <Ic.Hash s={16} />}</span>}
        {dm && (
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: USERS[dm.userId]?.color || 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
            {(USERS[dm.userId]?.name || 'A')[0]}
          </div>
        )}
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>{title}</span>
        {desc && (
          <>
            <div style={{ width: 1, height: 16, background: 'var(--bd2)' }} />
            <span style={{ fontSize: 12.5, color: 'var(--t3)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</span>
          </>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <button
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t3)', fontSize: 12.5, cursor: 'pointer', transition: 'all .14s', minWidth: 180 }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--bd2)'; e.currentTarget.style.color = 'var(--t2)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.color = 'var(--t3)'; }}
      >
        <Ic.Search s={13} />
        <span>Search…</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, background: 'var(--bg-active)', padding: '1px 5px', borderRadius: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Ic.Cmd s={10} />K
        </span>
      </button>

      <div style={{ width: 1, height: 20, background: 'var(--bd)', margin: '0 2px' }} />
      {((!isAnnouncment && activeChannel) || activeDm) && (
        <>
          <Tip label={activeDm ? 'Voice Call' : 'Group Voice Call'}>
            <button
              onClick={() => { setCallType('voice'); setInCall(true); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 6, borderRadius: 6, display: 'flex', transition: 'color .14s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ok)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t3)')}
            >
              <Ic.Phone s={16} />
            </button>
          </Tip>
          <Tip label={activeDm ? 'Video Call' : 'Group Video Call'}>
            <button
              onClick={() => { setCallType('video'); setInCall(true); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 6, borderRadius: 6, display: 'flex', transition: 'color .14s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t3)')}
            >
              <Ic.Video s={16} />
            </button>
          </Tip>
          <div style={{ width: 1, height: 20, background: 'var(--bd)', margin: '0 2px' }} />
        </>
      )}

      <Tip label={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 6, borderRadius: 6, display: 'flex', transition: 'color .14s' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--warn)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t3)')}
        >
          {theme === 'dark' ? <Ic.Sun s={16} /> : <Ic.Moon s={16} />}
        </button>
      </Tip>

      <Tip label="Notifications">
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            onClick={() => setShowNotif(!showNotif)}
            style={{ background: showNotif ? 'var(--primary-dim)' : 'none', border: 'none', cursor: 'pointer', color: showNotif ? 'var(--primary)' : 'var(--t3)', padding: 6, borderRadius: 6, display: 'flex', transition: 'all .14s' }}
            onMouseEnter={(e) => { if (!showNotif) e.currentTarget.style.color = 'var(--t1)'; }}
            onMouseLeave={(e) => { if (!showNotif) e.currentTarget.style.color = 'var(--t3)'; }}
          >
            <Ic.Bell s={16} />
          </button>
          <div style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: '50%', background: 'var(--err)', border: '2px solid var(--bg-sidebar)' }} />
        </div>
      </Tip>

      <div
        onClick={() => setShowSettings(true)}
        style={{ cursor: 'pointer', borderRadius: '50%', transition: 'opacity .14s' }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '.8')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        <Avatar user={USERS.me} size={30} showStatus />
      </div>
    </div>
  );
}

/* ── Message Item ────────────────────────────────────────── */
const EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '🤔', '😮', '✅', '🙌'];

function MsgItem({
  msg,
  isFirst,
  setMessages,
  channelId,
}: {
  msg: Message;
  isFirst: boolean;
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>;
  channelId: string;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const { setThreadMsg } = useApp();
  const user = msg.userId === 'me' ? USERS.me : USERS[msg.userId] || { name: msg.userId, color: '#8b5cf6', initials: '?' };
  const isMe = msg.userId === 'me';

  const addReaction = (emoji: string) => {
    setMessages((prev) => {
      const arr = [...(prev[channelId] || [])];
      const idx = arr.findIndex((m) => m.id === msg.id);
      if (idx === -1) return prev;
      const m = { ...arr[idx] };
      const reactions = [...(m.reactions || [])];
      const ri = reactions.findIndex((r) => r.emoji === emoji);
      if (ri > -1) {
        reactions[ri] = { ...reactions[ri], count: reactions[ri].reacted ? reactions[ri].count - 1 : reactions[ri].count + 1, reacted: !reactions[ri].reacted };
      } else {
        reactions.push({ emoji, count: 1, reacted: true });
      }
      arr[idx] = { ...m, reactions };
      return { ...prev, [channelId]: arr };
    });
    setShowPicker(false);
  };

  return (
    <div
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowPicker(false); }}
      style={{ display: 'flex', gap: 12, padding: `${isFirst ? '12px' : '2px'} 16px`, position: 'relative', borderRadius: 4, transition: 'background .12s', background: showActions ? 'var(--bg-hover)' : 'transparent' }}
    >
      {isFirst ? (
        <div style={{ flexShrink: 0, marginTop: 1 }}><Avatar user={user} size={36} /></div>
      ) : (
        <div style={{ width: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {showActions && <span style={{ fontSize: 10, color: 'var(--t3)' }}>{msg.time}</span>}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {isFirst && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
            <span
              style={{ fontWeight: 700, fontSize: 14.5, color: isMe ? 'var(--primary-l)' : 'var(--t1)', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              {user.name}
            </span>
            {USERS[msg.userId]?.role === 'ADMIN' && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'var(--primary-dim)', color: 'var(--primary)' }}>ADMIN</span>}
            {USERS[msg.userId]?.role === 'MOD' && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'var(--ok-dim)', color: 'var(--ok)' }}>MOD</span>}
            <span style={{ fontSize: 11.5, color: 'var(--t3)' }}>{msg.time}</span>
          </div>
        )}

        <div style={{ fontSize: 14.5, color: 'var(--t1)', lineHeight: 1.55, wordBreak: 'break-word', fontWeight: 400 }}>
          {msg.content.split(/(@\w+)/g).map((part, i) =>
            /^@\w+/.test(part) ? (
              <span key={i} style={{ background: 'var(--primary-dim)', color: 'var(--primary-l)', borderRadius: 4, padding: '0 3px', fontWeight: 600, cursor: 'pointer' }}>{part}</span>
            ) : (
              part
            )
          )}
          {msg.isEdited && <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 4 }}>(edited)</span>}
        </div>

        {msg.reactions && msg.reactions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
            {msg.reactions.filter((r) => r.count > 0).map((r) => (
              <button
                key={r.emoji}
                onClick={() => addReaction(r.emoji)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, border: `1.5px solid ${r.reacted ? 'var(--primary)' : 'var(--bd2)'}`, background: r.reacted ? 'var(--primary-dim)' : 'transparent', cursor: 'pointer', fontSize: 13, color: r.reacted ? 'var(--primary)' : 'var(--t2)', transition: 'all .12s', fontFamily: 'inherit' }}
              >
                <span>{r.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{r.count}</span>
              </button>
            ))}
            <button
              onClick={() => setShowPicker(!showPicker)}
              style={{ display: 'flex', alignItems: 'center', padding: '2px 7px', borderRadius: 20, border: '1.5px dashed var(--bd)', background: 'transparent', cursor: 'pointer', color: 'var(--t3)', fontSize: 13, transition: 'all .12s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--bd2)'; e.currentTarget.style.color = 'var(--t2)'; }}
            >
              <Ic.Smile s={13} />
            </button>
          </div>
        )}

        {(msg.replies || 0) > 0 && (
          <button
            onClick={() => setThreadMsg(msg)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-link)', fontSize: 12.5, fontWeight: 600, marginTop: 4, padding: '2px 0' }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          >
            <Ic.Thread s={13} />
            {msg.replies} {msg.replies === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>

      {showActions && (
        <div className="il-scale-in" style={{ position: 'absolute', top: -16, right: 12, display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r)', padding: '3px 5px', zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,.4)' }}>
          {EMOJIS.slice(0, 5).map((e) => (
            <button
              key={e}
              onClick={() => addReaction(e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 4, fontSize: 15, lineHeight: 1, transition: 'transform .1s' }}
              onMouseEnter={(e2) => (e2.currentTarget.style.transform = 'scale(1.3)')}
              onMouseLeave={(e2) => (e2.currentTarget.style.transform = 'scale(1)')}
            >
              {e}
            </button>
          ))}
          <div style={{ width: 1, height: 16, background: 'var(--bd)', margin: '0 2px' }} />
          {([['Reply', 'Reply', () => {}], ['Thread', 'Thread', () => setThreadMsg(msg)], ['MoreH', 'More', () => {}]] as [IconName, string, () => void][]).map(([ico, label, fn]) => {
            const IconCmp = Ic[ico];
            return (
              <Tip key={ico} label={label}>
                <button
                  onClick={fn}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', padding: 5, borderRadius: 4, display: 'flex', transition: 'color .12s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t2)')}
                >
                  <IconCmp s={14} />
                </button>
              </Tip>
            );
          })}
        </div>
      )}

      {showPicker && (
        <div className="il-scale-in" style={{ position: 'absolute', top: 0, right: 80, background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', padding: 8, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,.5)', display: 'flex', flexWrap: 'wrap', gap: 4, width: 200 }}>
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => addReaction(e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, fontSize: 18, lineHeight: 1, transition: 'transform .1s' }}
              onMouseEnter={(e2) => (e2.currentTarget.style.transform = 'scale(1.25)')}
              onMouseLeave={(e2) => (e2.currentTarget.style.transform = 'scale(1)')}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Message Input ───────────────────────────────────────── */
function MessageInput({ channelId }: { channelId: string }) {
  const [text, setText] = useState('');
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [code, setCode] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const { addMessage, channels } = useApp();
  const ch = (channels || []).find((c) => c.id === channelId);
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = (e?: { preventDefault: () => void }) => {
    e && e.preventDefault();
    if (!text.trim()) return;
    addMessage(channelId, text.trim());
    setText('');
    setBold(false);
    setItalic(false);
    setCode(false);
    setTimeout(() => ref.current?.focus(), 50);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const addEmoji = (em: string) => {
    setText((t) => t + em);
    setShowEmoji(false);
    ref.current?.focus();
  };

  const placeholder = ch?.locked ? 'This channel is read-only' : `Message #${ch?.name || channelId}…`;

  return (
    <div style={{ padding: '0 14px 14px', flexShrink: 0 }}>
      <div style={{ height: 18, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, paddingLeft: 4 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          <span className="il-typing-dot" />
          <span className="il-typing-dot" />
          <span className="il-typing-dot" />
        </div>
        <span style={{ fontSize: 12, color: 'var(--t3)' }}>Carol is typing…</span>
      </div>

      <div
        style={{ background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', overflow: 'hidden', transition: 'border-color .14s' }}
        onFocusCapture={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
        onBlurCapture={(e) => (e.currentTarget.style.borderColor = 'var(--bd)')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--bd)' }}>
          <button className={`il-fmt-btn${bold ? ' active' : ''}`} onClick={() => setBold(!bold)} style={{ fontWeight: 700 }}>B</button>
          <button className={`il-fmt-btn${italic ? ' active' : ''}`} onClick={() => setItalic(!italic)} style={{ fontStyle: 'italic' }}>I</button>
          <button className={`il-fmt-btn${code ? ' active' : ''}`} onClick={() => setCode(!code)} style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{'<>'}</button>
          <div style={{ width: 1, height: 14, background: 'var(--bd)', margin: '0 3px' }} />
          <button className="il-fmt-btn" title="Link"><Ic.At s={13} /></button>
          <button className="il-fmt-btn" title="Attach"><Ic.Clip s={13} /></button>
          <div style={{ flex: 1 }} />
          <button className="il-fmt-btn" style={{ fontSize: 11, color: 'var(--t3)' }} title="Shift+Enter for newline">Shift↵ = newline</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 10px' }}>
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'; }}
            onKeyDown={onKey}
            placeholder={placeholder}
            disabled={ch?.locked}
            rows={1}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: 14.5, fontFamily: "'DM Sans',sans-serif", fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal', resize: 'none', minHeight: 22, maxHeight: 150, overflowY: 'auto', lineHeight: 1.55 }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Tip label="Emoji">
                <button
                  onClick={() => setShowEmoji(!showEmoji)}
                  style={{ background: showEmoji ? 'var(--primary-dim)' : 'none', border: 'none', cursor: 'pointer', color: showEmoji ? 'var(--primary)' : 'var(--t3)', padding: 6, borderRadius: 6, display: 'flex', transition: 'all .14s' }}
                  onMouseEnter={(e) => { if (!showEmoji) e.currentTarget.style.color = 'var(--t2)'; }}
                >
                  <Ic.Smile s={18} />
                </button>
              </Tip>
              {showEmoji && (
                <div className="il-scale-in" style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, background: 'var(--bg-elv)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-xl)', padding: 10, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,.5)', display: 'flex', flexWrap: 'wrap', gap: 5, width: 220 }}>
                  {['😀', '😂', '🥰', '🤩', '😎', '🤔', '😮', '😢', '🎉', '🔥', '👍', '❤️', '✅', '🚀', '💯', '🙌', '⚡', '🎨', '💡', '🤯'].map((em) => (
                    <button
                      key={em}
                      onClick={() => addEmoji(em)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 3, borderRadius: 4, lineHeight: 1, transition: 'transform .1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.3)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => send()}
              disabled={!text.trim() || ch?.locked}
              style={{ width: 32, height: 32, borderRadius: 'var(--r)', border: 'none', cursor: text.trim() ? 'pointer' : 'default', background: text.trim() ? 'var(--primary)' : 'var(--bg-active)', color: text.trim() ? '#fff' : 'var(--t3)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', transform: text.trim() ? 'scale(1)' : 'scale(.9)' }}
            >
              <Ic.Send s={15} c="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ChatPanel ───────────────────────────────────────────── */
export function ChatPanel() {
  const { activeChannel, activeDm, messages, setMessages, channels } = useApp();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJumpDown, setShowJumpDown] = useState(false);

  const channelId = activeDm || activeChannel;
  const msgList = (channelId && messages[channelId]) || [];
  const ch = (channels || []).find((c) => c.id === activeChannel);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
  }, [channelId]);

  useEffect(() => {
    if (!showJumpDown) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgList.length, showJumpDown]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setShowJumpDown(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  };

  const grouped = useMemo(() => {
    const result: { msg: Message; isFirst: boolean; showDate: boolean }[] = [];
    let lastUser = '';
    let lastDate = '';
    msgList.forEach((msg, i) => {
      const isFirst = msg.userId !== lastUser || msg.date !== msgList[i - 1]?.date;
      const dateChanged = msg.date !== lastDate;
      result.push({ msg, isFirst, showDate: dateChanged });
      lastUser = msg.userId;
      lastDate = msg.date;
    });
    return result;
  }, [msgList]);

  if (!channelId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 32 }}>
        <div style={{ width: 64, height: 64, borderRadius: 'var(--r-xl)', background: 'var(--primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ic.Msg s={28} c="var(--primary)" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif", marginBottom: 6 }}>Welcome to InterLynk</div>
          <div style={{ fontSize: 14, color: 'var(--t3)', maxWidth: 340, lineHeight: 1.6 }}>Select a direct message to start chatting, or create a channel in the sidebar to collaborate with your team.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {activeChannel === 'general' && (
        <div style={{ padding: '6px 16px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--t2)', flexShrink: 0 }}>
          <Ic.Pin s={13} c="var(--primary)" />
          <span><span style={{ color: 'var(--primary)', fontWeight: 600 }}>Pinned:</span> @Alice pushed auth changes — PR is ready for review</span>
          <button
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t1)')}
          >
            View all pins
          </button>
        </div>
      )}

      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', padding: '8px 0', position: 'relative' }}>
        <div style={{ padding: '20px 16px 8px', borderBottom: '1px solid var(--bd)', marginBottom: 8 }}>
          <div style={{ width: 56, height: 56, borderRadius: 'var(--r-xl)', background: 'var(--primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            {ch?.type === 'announcement' ? <Ic.Megaphone s={26} c="var(--primary)" /> : <Ic.Hash s={26} c="var(--primary)" />}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif", marginBottom: 4 }}>Welcome to #{ch?.name || channelId}!</h2>
          <p style={{ fontSize: 14, color: 'var(--t2)', maxWidth: 480 }}>{ch?.description || 'This is the start of the channel.'}</p>
        </div>

        {grouped.map(({ msg, isFirst, showDate }) => (
          <div key={msg.id}>
            {showDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px 4px', margin: '4px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
                <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600, background: 'var(--bg-main)', padding: '2px 10px', borderRadius: 20, border: '1px solid var(--bd)' }}>{msg.date}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
              </div>
            )}
            <MsgItem msg={msg} isFirst={isFirst} setMessages={setMessages} channelId={channelId} />
          </div>
        ))}

        {msgList.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--t3)', fontSize: 14 }}>No messages yet. Say hello! 👋</div>
        )}
        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {showJumpDown && (
        <button
          className="il-fade-up"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          style={{ position: 'absolute', bottom: 90, right: 20, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, boxShadow: 'var(--primary-glow)', zIndex: 50 }}
        >
          <Ic.ChevD s={13} c="#fff" /> New messages
        </button>
      )}

      <MessageInput channelId={channelId} />
    </div>
  );
}

/* ── Thread Panel ────────────────────────────────────────── */
function ThreadPanel() {
  const { threadMsg, setThreadMsg } = useApp();
  const [reply, setReply] = useState('');
  if (!threadMsg) return null;
  const user = threadMsg.userId === 'me' ? USERS.me : USERS[threadMsg.userId] || { name: 'User', color: '#8b5cf6' };
  const sendReply = () => {
    if (reply.trim()) {
      setReply('');
      setThreadMsg({ ...threadMsg, replies: (threadMsg.replies || 0) + 1 });
    }
  };
  return (
    <div className="il-slide-l" style={{ width: 'var(--right-w)', background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>
      <div style={{ padding: '0 14px', height: 'var(--topbar-h)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--bd)' }}>
        <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Outfit',sans-serif" }}>Thread</span>
        <button
          onClick={() => setThreadMsg(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 5, borderRadius: 6, display: 'flex' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--t1)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--t3)')}
        >
          <Ic.X s={16} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--r-lg)', padding: 12, marginBottom: 12, border: '1px solid var(--bd)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <Avatar user={user} size={28} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--t1)' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>{threadMsg.time}</div>
            </div>
          </div>
          <div style={{ fontSize: 14, color: 'var(--t1)', lineHeight: 1.5 }}>{threadMsg.content}</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', margin: '8px 0' }}>{threadMsg.replies || 0} replies</div>
      </div>
      <div style={{ padding: 10, borderTop: '1px solid var(--bd)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
            placeholder="Reply in thread…"
            style={{ flex: 1, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', padding: '8px 10px', fontSize: 13, color: 'var(--t1)', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--bd)')}
          />
          <button
            onClick={sendReply}
            style={{ width: 32, height: 32, background: reply.trim() ? 'var(--primary)' : 'var(--bg-active)', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', color: reply.trim() ? '#fff' : 'var(--t3)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
          >
            <Ic.Send s={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Right Sidebar ─────────────────────────────────────────── */
export function RightSidebar() {
  const { threadMsg } = useApp();
  if (threadMsg) return <ThreadPanel />;
  return null;
}

export function MainLayout() {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <WorkspaceRail />
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-main)' }}>
        <TopBar />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          <ChatPanel />
          <RightSidebar />
        </div>
      </div>
    </div>
  );
}
