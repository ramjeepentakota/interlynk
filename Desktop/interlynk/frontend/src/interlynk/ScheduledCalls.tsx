/* InterLynk — Scheduled Calls.
   A self-contained modal that lists upcoming scheduled calls and lets the user
   schedule a new one. Opened by dispatching window event 'il-open-scheduled-calls'
   (the TopBar calendar button does this), so no extra context plumbing is needed.

   When a scheduled call goes live (backend flips it to ACTIVE and notifies
   everyone), the host sees a "Start" button here that rings the invitees through
   the normal call path. */
import { useCallback, useEffect, useState } from 'react';
import { Ic } from './icons';
import { Avatar, Badge, Btn } from './ui';
import { useApp } from './context';
import type { User } from './data';
import { scheduledCallApi, type ScheduledCall } from '@/api/client';

const OPEN_EVENT = 'il-open-scheduled-calls';

/** Programmatic open helper for other parts of the app. */
export function openScheduledCalls() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** datetime-local value for a Date, in the browser's local wall-clock time. */
function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Render a backend LocalDateTime ("YYYY-MM-DDTHH:mm:ss", no zone) as local wall time. */
function formatWhen(raw: string): string {
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return raw;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const STATUS_BADGE: Record<ScheduledCall['status'], { variant: 'muted' | 'success' | 'dimmed'; label: string }> = {
  PENDING: { variant: 'dimmed', label: 'Scheduled' },
  ACTIVE: { variant: 'success', label: 'Live now' },
  COMPLETED: { variant: 'muted', label: 'Ended' },
  CANCELLED: { variant: 'muted', label: 'Cancelled' },
};

/** Fire a one-shot toast via the ToastHost in Screens.tsx. */
function toast(title: string, message?: string, tone: 'info' | 'warn' = 'info') {
  window.dispatchEvent(new CustomEvent('il-toast', { detail: { title, message: message || '', tone } }));
}

export function ScheduledCallsModal() {
  const { currentUser, searchUsers, startScheduledCall, joinScheduledCall } = useApp();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [calls, setCalls] = useState<ScheduledCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Create-form state. callType is locked to 'voice' per product decision:
  // every scheduled call is audio-only, so the Type selector was removed.
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [duration, setDuration] = useState(30);
  const callType: 'voice' | 'video' = 'voice';
  const [invitees, setInvitees] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await scheduledCallApi.list();
      setCalls(res.data);
    } catch {
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Open via window event; load the list each time it opens.
  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setView('list');
      refresh();
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [refresh]);

  // Debounced people search for the invitee picker.
  useEffect(() => {
    if (view !== 'create' || query.trim().length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const found = await searchUsers(query.trim());
        const pickedIds = new Set(invitees.map((u) => u.id));
        setResults(
          found.filter((u) => u.id !== String(currentUser?.id) && !pickedIds.has(u.id)).slice(0, 6)
        );
      } catch {
        setResults([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [query, view, invitees, searchUsers, currentUser]);

  const resetForm = () => {
    setTitle('');
    setWhen(toLocalInputValue(new Date(Date.now() + 15 * 60 * 1000)));
    setDuration(30);
    setInvitees([]);
    setQuery('');
    setResults([]);
    setError(null);
  };

  const goCreate = () => {
    resetForm();
    setView('create');
  };

  const submit = async () => {
    setError(null);
    if (!title.trim()) return setError('Give the call a title.');
    if (!when) return setError('Pick a date and time.');
    if (invitees.length === 0) return setError('Invite at least one person.');
    if (new Date(when).getTime() <= Date.now() + 60_000) {
      return setError('Pick a time at least a minute from now.');
    }
    setSubmitting(true);
    try {
      const created = await scheduledCallApi.create({
        title: title.trim(),
        scheduledAt: `${when}:00`,
        durationMinutes: duration,
        callType,
        inviteeIds: invitees.map((u) => Number(u.id)),
      });
      await refresh();
      setView('list');
      // Immediate confirmation popup for the organiser — invitees receive
      // their own CALL_INVITE notification via the backend, but until this
      // change the creator got no feedback that the call was actually saved.
      const whenLabel = formatWhen(`${when}:00`);
      toast(
        'Meeting scheduled',
        `"${created?.data?.title || title.trim()}" is set for ${whenLabel} · ${invitees.length} invited.`
      );
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not schedule the call.');
    } finally {
      setSubmitting(false);
    }
  };

  // Instant meeting — bypass the schedule and start an audio call right now
  // using the invitee list as participants. 1:1 rings through the WebRTC
  // direct-call path; 2+ becomes a GROUP room everyone can join.
  const startInstant = async () => {
    setError(null);
    if (invitees.length === 0) {
      return setError('Add at least one person to start an instant meeting.');
    }
    setSubmitting(true);
    try {
      await startScheduledCall({
        callType,
        title: title.trim() || 'Instant meeting',
        invitees: invitees.map((u) => ({
          userId: Number(u.id),
          username: u.username || u.name,
          displayName: u.name,
          avatarUrl: u.avatar,
        })),
      });
      toast('Instant meeting started', `Ringing ${invitees.length} ${invitees.length === 1 ? 'person' : 'people'}…`);
      setOpen(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Could not start the instant meeting.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelCall = async (id: number) => {
    setBusyId(id);
    try {
      await scheduledCallApi.cancel(id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const startCall = async (call: ScheduledCall) => {
    setBusyId(call.id);
    try {
      await startScheduledCall({ callType: call.callType, title: call.title, invitees: call.invitees });
      setOpen(false);
    } finally {
      setBusyId(null);
    }
  };

  // Invitee-or-host join: when the backend has flipped the call to ACTIVE
  // and there's a callRoomId, join that existing room directly. Otherwise
  // (host wants to launch early) fall back to startScheduledCall.
  const joinCall = async (call: ScheduledCall) => {
    setBusyId(call.id);
    try {
      if (call.status === 'ACTIVE' && call.callRoomId != null) {
        await joinScheduledCall({
          roomId: call.callRoomId,
          callType: call.callType,
          title: call.title,
        });
      } else {
        await startScheduledCall({ callType: call.callType, title: call.title, invitees: call.invitees });
      }
      setOpen(false);
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  const isHost = (c: ScheduledCall) => String(c.createdByUserId) === String(currentUser?.id);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={() => setOpen(false)}
    >
      <div
        className="il-modal-card il-sched-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(560px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-card, #16162a)', border: '1px solid var(--bd)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,.6)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--bd)' }}>
          <span style={{ color: 'var(--primary)', display: 'flex' }}><Ic.Calendar s={18} /></span>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>
            {view === 'list' ? 'Scheduled calls' : 'Schedule a call'}
          </div>
          <div style={{ flex: 1 }} />
          {view === 'list' ? (
            <Btn variant="primary" size="sm" onClick={goCreate}>
              <Ic.Plus s={14} /> New
            </Btn>
          ) : (
            <Btn variant="ghost" size="sm" onClick={() => setView('list')}>
              <Ic.ChevL s={14} /> Back
            </Btn>
          )}
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', display: 'flex', padding: 4 }}>
            <Ic.X s={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 18, overflowY: 'auto' }}>
          {view === 'list' ? (
            <ListView
              calls={calls}
              loading={loading}
              busyId={busyId}
              isHost={isHost}
              onStart={startCall}
              onJoin={joinCall}
              onCancel={cancelCall}
              onNew={goCreate}
            />
          ) : (
            <CreateView
              title={title} setTitle={setTitle}
              when={when} setWhen={setWhen}
              duration={duration} setDuration={setDuration}
              invitees={invitees} setInvitees={setInvitees}
              query={query} setQuery={setQuery}
              results={results}
              error={error}
              submitting={submitting}
              onSubmit={submit}
              onStartInstant={startInstant}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── List view ──────────────────────────────────────────── */
/** Parse a backend LocalDateTime ("YYYY-MM-DDTHH:mm:ss") as a local Date. */
function parseScheduledAt(raw: string): Date | null {
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

/** A scheduled call is joinable any time it isn't COMPLETED or CANCELLED.
 *  Product decision (user-requested): the Join button must let attendees in
 *  even well before the scheduled start so an organiser can warm up the room.
 *  The previous "opens 5 min before" lockout was confusing users into thinking
 *  the meeting was broken. ACTIVE calls obviously remain joinable. */
function isJoinable(c: ScheduledCall): boolean {
  return c.status === 'PENDING' || c.status === 'ACTIVE';
}

function ListView({
  calls, loading, busyId, isHost, onStart, onJoin, onCancel, onNew,
}: {
  calls: ScheduledCall[];
  loading: boolean;
  busyId: number | null;
  isHost: (c: ScheduledCall) => boolean;
  onStart: (c: ScheduledCall) => void;
  onJoin: (c: ScheduledCall) => void;
  onCancel: (id: number) => void;
  onNew: () => void;
}) {
  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--t3)', padding: '32px 0', fontSize: 13 }}>Loading…</div>;
  }
  if (calls.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--t3)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, opacity: 0.6 }}><Ic.Calendar s={34} /></div>
        <div style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 4 }}>No upcoming calls</div>
        <div style={{ fontSize: 12.5, marginBottom: 16 }}>Schedule a call and everyone you invite gets notified.</div>
        <Btn variant="primary" size="sm" onClick={onNew}><Ic.Plus s={14} /> Schedule a call</Btn>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {calls.map((c) => {
        const badge = STATUS_BADGE[c.status];
        const host = isHost(c);
        return (
          <div key={c.id} style={{ border: '1px solid var(--bd)', borderRadius: 12, padding: '12px 14px', background: 'var(--bg-hover)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: c.callType === 'video' ? 'var(--primary)' : 'var(--ok)', display: 'flex' }}>
                {c.callType === 'video' ? <Ic.Video s={16} /> : <Ic.Phone s={16} />}
              </span>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, color: 'var(--t3)', fontSize: 12.5 }}>
              <Ic.Clock s={13} />
              <span>{formatWhen(c.scheduledAt)}</span>
              <span style={{ opacity: 0.5 }}>· {c.durationMinutes} min</span>
              {!host && <span style={{ opacity: 0.7 }}>· hosted by {c.createdByDisplayName || c.createdByUsername}</span>}
            </div>

            {c.invitees.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {c.invitees.slice(0, 5).map((u) => (
                  <div key={u.userId} title={u.displayName || u.username} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg-card,#1c1c34)', borderRadius: 20, padding: '2px 8px 2px 2px' }}>
                    <Avatar user={{ name: u.displayName || u.username, avatar: u.avatarUrl }} size={18} />
                    <span style={{ fontSize: 11.5, color: 'var(--t2)' }}>{u.displayName || u.username}</span>
                  </div>
                ))}
                {c.invitees.length > 5 && <span style={{ fontSize: 11.5, color: 'var(--t3)' }}>+{c.invitees.length - 5}</span>}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {c.status === 'PENDING' && host && (
                <Btn variant="danger" size="sm" disabled={busyId === c.id} onClick={() => onCancel(c.id)}>Cancel</Btn>
              )}
              {c.status === 'ACTIVE' && host && (
                <Btn variant="success" size="sm" disabled={busyId === c.id} onClick={() => onStart(c)}>
                  <Ic.Phone s={13} /> {busyId === c.id ? 'Starting…' : 'Start call'}
                </Btn>
              )}
              {/* Join is available to anyone (host or invitee) for any
                  PENDING or ACTIVE call — no time-gated lockout. */}
              {(c.status === 'PENDING' || c.status === 'ACTIVE') && (
                <Btn
                  variant="primary"
                  size="sm"
                  disabled={busyId === c.id}
                  onClick={() => onJoin(c)}
                >
                  <Ic.Phone s={13} /> {busyId === c.id ? 'Joining…' : 'Join'}
                </Btn>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Create view ────────────────────────────────────────── */
function CreateView({
  title, setTitle, when, setWhen, duration, setDuration,
  invitees, setInvitees, query, setQuery, results, error, submitting, onSubmit, onStartInstant,
}: {
  title: string; setTitle: (v: string) => void;
  when: string; setWhen: (v: string) => void;
  duration: number; setDuration: (v: number) => void;
  invitees: User[]; setInvitees: (v: User[]) => void;
  query: string; setQuery: (v: string) => void;
  results: User[];
  error: string | null;
  submitting: boolean;
  onSubmit: () => void;
  onStartInstant: () => void;
}) {
  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: 14, fontFamily: "'DM Sans',sans-serif",
    background: 'var(--bg-hover)', border: '1.5px solid var(--bd)', borderRadius: 'var(--r)',
    color: 'var(--t1)', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5, display: 'block',
  };
  const minWhen = toLocalInputValue(new Date(Date.now() + 60 * 1000));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Title</label>
        <input style={fieldStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sprint sync" autoFocus />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Date & time</label>
          <input style={fieldStyle} type="datetime-local" min={minWhen} value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div style={{ width: 120 }}>
          <label style={labelStyle}>Duration</label>
          <select style={{ ...fieldStyle, cursor: 'pointer' }} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </div>
      </div>

      {/* Type selector intentionally omitted — every scheduled call is an
          audio (voice) call. Show a static note so the choice is obvious. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--t3)' }}>
        <Ic.Phone s={13} c="var(--ok)" /> Audio call · everyone joins voice-only
      </div>

      <div>
        <label style={labelStyle}>Invite people</label>
        {invitees.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {invitees.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary-dim)', borderRadius: 20, padding: '3px 6px 3px 3px' }}>
                <Avatar user={u} size={18} />
                <span style={{ fontSize: 12, color: 'var(--primary)' }}>{u.name}</span>
                <button onClick={() => setInvitees(invitees.filter((x) => x.id !== u.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', padding: 0 }}>
                  <Ic.X s={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <input style={fieldStyle} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or username…" />
          {results.length > 0 && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 10, background: 'var(--bg-card,#1c1c34)', border: '1px solid var(--bd2)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,.5)' }}>
              {results.map((u) => (
                <div
                  key={u.id}
                  onClick={() => { setInvitees([...invitees, u]); setQuery(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Avatar user={u} size={24} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, color: 'var(--t1)' }}>{u.name}</span>
                    {u.username && <span style={{ fontSize: 11.5, color: 'var(--t3)' }}>@{u.username}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div style={{ fontSize: 12.5, color: 'var(--err)' }}>{error}</div>}

      {/* Action row — "Start instant meeting" runs the invitees through the
          normal direct-call (1:1) or group-call (2+) path immediately;
          "Schedule call" persists a PENDING ScheduledCall that fires
          notifications now and again when the time arrives. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        <Btn variant="success" size="md" disabled={submitting || invitees.length === 0} onClick={onStartInstant}>
          <Ic.Phone s={15} /> Start instant meeting
        </Btn>
        <Btn variant="primary" size="md" disabled={submitting} onClick={onSubmit}>
          <Ic.Calendar s={15} /> {submitting ? 'Scheduling…' : 'Schedule call'}
        </Btn>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: -6 }}>
        Instant meeting rings the people you've added right now · scheduling notifies them and rings everyone at the time you set.
      </div>
    </div>
  );
}

export default ScheduledCallsModal;
