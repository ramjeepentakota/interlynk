/* InterLynk Admin — Module 3 Views (Meetings · Calling).
   Backend-wired; no mock data. */
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Ic } from '../icons';
import { Avatar, Badge, Btn } from '../ui';
import * as adm from './api';
import type { MeetingPolicy, PhoneNumber, CallQueue, AutoAttendant } from './api';

const card: CSSProperties = { background: 'var(--bg-elv)', border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', padding: 16 };
const headCell: CSSProperties = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'left' };
const cell: CSSProperties = { padding: '8px 10px', fontSize: 13, color: 'var(--t1)', borderTop: '1px solid var(--bd)' };
const input: CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', outline: 'none' };
const select: CSSProperties = { ...input, paddingRight: 22 };

function fmtDate(s?: string): string {
  if (!s) return '—';
  const iso = s.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

/* ── Meetings view ───────────────────────────────────────── */
export function MeetingsView() {
  const [list, setList] = useState<MeetingPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MeetingPolicy | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adm.listMeetingPolicies().then(setList).catch(() => setList([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 24, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif", flex: 1 }}>Meetings &amp; Webinars</h2>
        <Btn size="sm" variant="primary" onClick={() => setCreating(true)}><Ic.Plus s={13} /> New policy</Btn>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--t3)', marginTop: -8 }}>
        Recording, transcription, lobby, screen share, breakout rooms, AI recap, attendance reports, webinars, and live events. Assign policies per team in the Teams view.
      </div>

      {loading && <div style={{ color: 'var(--t3)' }}>Loading…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 12 }}>
        {list.map((p) => (
          <div key={p.id} style={{ ...card, cursor: 'pointer' }} onClick={() => setEditing(p)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ic.Video s={16} c="var(--primary)" />
              <div style={{ fontWeight: 700, color: 'var(--t1)', flex: 1 }}>{p.name}</div>
              {p.defaultPolicy && <Badge variant="primary">DEFAULT</Badge>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>{p.description || '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <span>Recording: {p.allowRecording ? 'on' : 'off'}</span>
              <span>Transcription: {p.allowTranscription ? 'on' : 'off'}</span>
              <span>AI recap: {p.allowAiRecap ? 'on' : 'off'}</span>
              <span>Lobby: {p.lobbyMode}</span>
              <span>Screen share: {p.allowScreenShare ? 'on' : 'off'}</span>
              <span>Breakouts: {p.allowBreakoutRooms ? 'on' : 'off'}</span>
              <span>Webinars: {p.allowWebinars ? 'on' : 'off'}</span>
              <span>Live events: {p.allowLiveEvents ? 'on' : 'off'}</span>
              <span>Max attendees: {p.maxAttendees}</span>
              <span>Attendance reports: {p.attendanceReports ? 'on' : 'off'}</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--t3)' }}>Updated {fmtDate(p.updatedAt)}</div>
          </div>
        ))}
      </div>

      {creating && <MeetingPolicyEditor onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {editing && <MeetingPolicyEditor policy={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function MeetingPolicyEditor({ policy, onClose, onSaved }: { policy?: MeetingPolicy; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!policy;
  const [form, setForm] = useState<Partial<MeetingPolicy> & { name: string }>(
    policy ?? {
      name: '', description: '', defaultPolicy: false,
      allowRecording: true, autoRecord: false, allowTranscription: true, allowAiRecap: true,
      lobbyMode: 'ORG_ONLY', allowAnonymousJoin: false,
      allowScreenShare: true, allowWhiteboard: true, allowBreakoutRooms: true,
      allowMeetingChat: true, allowReactions: true, allowPolls: true,
      attendanceReports: true, allowWebinars: true, allowLiveEvents: false, maxAttendees: 1000,
    }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!form.name.trim()) return;
    setBusy(true); setErr(null);
    try {
      if (isEdit) await adm.updateMeetingPolicy(policy!.id, form);
      else await adm.createMeetingPolicy(form);
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!policy) return;
    if (!confirm(`Delete "${policy.name}"?`)) return;
    try { await adm.deleteMeetingPolicy(policy.id); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Delete failed'); }
  };

  const toggle = (key: keyof MeetingPolicy, label: string, hint?: string) => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--bd)' }}>
      <input type="checkbox" checked={Boolean((form as any)[key])} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} style={{ marginTop: 3 }} />
      <div>
        <div style={{ fontSize: 13, color: 'var(--t1)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>{hint}</div>}
      </div>
    </label>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,.5)' }} onClick={onClose}>
      <div className="il-slide-l" onClick={(e) => e.stopPropagation()} style={{ width: 540, maxWidth: '94vw', height: '100vh', background: 'var(--bg-base)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Ic.Video s={18} c="var(--primary)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{isEdit ? 'Edit meeting policy' : 'New meeting policy'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>Governs recordings, lobby, sharing, and webinars.</div>
          </div>
          <Btn size="icon-sm" variant="ghost" onClick={onClose}><Ic.X s={15} /></Btn>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {err && <div style={{ color: 'var(--err)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Name</label>
          <input style={{ ...input, marginBottom: 10 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Description</label>
          <input style={{ ...input, marginBottom: 10 }} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          {toggle('defaultPolicy', 'Default policy')}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', margin: '14px 0 4px' }}>Recording &amp; transcription</div>
          {toggle('allowRecording', 'Allow recording')}
          {toggle('autoRecord', 'Auto-record', 'Start recording when the meeting begins.')}
          {toggle('allowTranscription', 'Live transcription')}
          {toggle('allowAiRecap', 'AI recap (summary + action items)')}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', margin: '14px 0 4px' }}>Lobby &amp; access</div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Lobby mode</label>
          <select style={{ ...select, marginBottom: 10 }} value={form.lobbyMode} onChange={(e) => setForm({ ...form, lobbyMode: e.target.value as MeetingPolicy['lobbyMode'] })}>
            <option value="EVERYONE">Everyone (no lobby)</option>
            <option value="ORG_ONLY">Organization only</option>
            <option value="INVITED_ONLY">Invited only</option>
          </select>
          {toggle('allowAnonymousJoin', 'Allow anonymous join links')}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', margin: '14px 0 4px' }}>In-meeting</div>
          {toggle('allowScreenShare', 'Screen sharing')}
          {toggle('allowWhiteboard', 'Whiteboard')}
          {toggle('allowBreakoutRooms', 'Breakout rooms')}
          {toggle('allowMeetingChat', 'Meeting chat')}
          {toggle('allowReactions', 'Reactions')}
          {toggle('allowPolls', 'Polls')}
          {toggle('attendanceReports', 'Attendance reports')}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', margin: '14px 0 4px' }}>Webinars &amp; live events</div>
          {toggle('allowWebinars', 'Allow webinars')}
          {toggle('allowLiveEvents', 'Allow live events (broadcast)')}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', marginTop: 8, display: 'block' }}>Max attendees</label>
          <input type="number" style={{ ...input, marginBottom: 16 }} value={form.maxAttendees ?? 1000} onChange={(e) => setForm({ ...form, maxAttendees: Number(e.target.value) })} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>{isEdit && !policy?.defaultPolicy && <Btn size="sm" variant="danger" onClick={remove}>Delete</Btn>}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn size="sm" variant="primary" disabled={busy || !form.name.trim()} onClick={save}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create policy'}</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Calling view (Numbers · Queues · Auto-Attendants) ───── */
export function CallingView() {
  const [tab, setTab] = useState<'numbers' | 'queues' | 'attendants'>('numbers');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 4px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>Calling &amp; Phone System</h2>
        <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>Phone numbers (PSTN / SIP / internal), call queues, and auto-attendants. Carrier connectors are configured per-number.</div>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '8px 24px', borderBottom: '1px solid var(--bd)' }}>
        <Btn size="sm" variant={tab === 'numbers' ? 'active' : 'ghost'} onClick={() => setTab('numbers')}>Phone numbers</Btn>
        <Btn size="sm" variant={tab === 'queues' ? 'active' : 'ghost'} onClick={() => setTab('queues')}>Call queues</Btn>
        <Btn size="sm" variant={tab === 'attendants' ? 'active' : 'ghost'} onClick={() => setTab('attendants')}>Auto-attendants</Btn>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'numbers' && <PhoneNumbersTab />}
        {tab === 'queues' && <QueuesTab />}
        {tab === 'attendants' && <AttendantsTab />}
      </div>
    </div>
  );
}

function PhoneNumbersTab() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<adm.PagedPhoneNumbers | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [assigning, setAssigning] = useState<PhoneNumber | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adm
      .listPhoneNumbers({ q, assignmentType: filter || undefined, page })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [q, filter, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18, height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input style={{ ...input, flex: 1, minWidth: 220, padding: '9px 12px', fontSize: 13.5 }}
          placeholder="Search by number or label…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select style={{ ...select, padding: '9px 12px' }} value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }}>
          <option value="">All assignments</option>
          <option value="USER">Assigned to user</option>
          <option value="CALL_QUEUE">Call queue</option>
          <option value="AUTO_ATTENDANT">Auto-attendant</option>
          <option value="EMERGENCY">Emergency</option>
          <option value="UNASSIGNED">Unassigned</option>
        </select>
        <Btn size="sm" variant="primary" onClick={() => setShowCreate(true)}><Ic.Plus s={13} /> Add number</Btn>
      </div>

      <div style={{ ...card, padding: 0, flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elv)' }}>
            <tr>
              <th style={headCell}>Number</th>
              <th style={headCell}>Assignment</th>
              <th style={headCell}>Assigned to</th>
              <th style={headCell}>Carrier</th>
              <th style={headCell}>Emergency address</th>
              <th style={headCell}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ ...cell, color: 'var(--t3)', textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
            {!loading && data?.content.length === 0 && <tr><td colSpan={6} style={{ ...cell, color: 'var(--t3)', textAlign: 'center', padding: 30 }}>No numbers yet. Add one above.</td></tr>}
            {!loading && data?.content.map((n) => (
              <tr key={n.id}>
                <td style={cell}>
                  <div style={{ fontWeight: 600 }}>{n.e164}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>{n.label || '—'}{n.callerIdName ? ` · CID: ${n.callerIdName}` : ''}</div>
                </td>
                <td style={cell}>
                  <Badge variant={n.assignmentType === 'UNASSIGNED' ? 'muted' : n.assignmentType === 'EMERGENCY' ? 'error' : 'dimmed'}>
                    {n.assignmentType.replace('_', ' ')}
                  </Badge>
                </td>
                <td style={{ ...cell, color: 'var(--t2)' }}>{n.assignedToLabel || <span style={{ color: 'var(--t3)' }}>—</span>}</td>
                <td style={cell}><Badge variant={n.carrier === 'INTERNAL' ? 'muted' : 'success'}>{n.carrier}</Badge></td>
                <td style={{ ...cell, color: 'var(--t3)', fontSize: 12 }}>{n.emergencyAddress || '—'}</td>
                <td style={cell}>
                  <Btn size="sm" variant="outline" onClick={() => setAssigning(n)}>Assign</Btn>{' '}
                  <Btn size="sm" variant="ghost" onClick={async () => {
                    if (confirm(`Delete ${n.e164}?`)) { await adm.deletePhoneNumber(n.id); load(); }
                  }}><Ic.Trash s={13} c="var(--err)" /></Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Btn size="sm" variant="outline" disabled={data.first} onClick={() => setPage((p) => Math.max(0, p - 1))}><Ic.ChevL s={13} /> Prev</Btn>
          <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>Page {data.page + 1} of {data.totalPages} · {data.totalElements} numbers</span>
          <Btn size="sm" variant="outline" disabled={data.last} onClick={() => setPage((p) => p + 1)}>Next <Ic.ChevR s={13} /></Btn>
        </div>
      )}

      {showCreate && <CreatePhoneModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {assigning && <AssignPhoneModal phone={assigning} onClose={() => setAssigning(null)} onAssigned={() => { setAssigning(null); load(); }} />}
    </div>
  );
}

function CreatePhoneModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ e164: '+1', label: '', callerIdName: '', carrier: 'INTERNAL', countryCode: '+1', emergencyAddress: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const create = async () => {
    setBusy(true); setErr(null);
    try { await adm.createPhoneNumber(form); onCreated(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Failed to add number'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '92vw', background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', padding: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>Add phone number</div>
        {err && <div style={{ color: 'var(--err)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>E.164 number</label>
        <input style={{ ...input, marginBottom: 10 }} value={form.e164} onChange={(e) => setForm({ ...form, e164: e.target.value })} placeholder="+14155550100" autoFocus />
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Label</label>
        <input style={{ ...input, marginBottom: 10 }} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Main line · SF HQ" />
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Caller ID name</label>
        <input style={{ ...input, marginBottom: 10 }} value={form.callerIdName} onChange={(e) => setForm({ ...form, callerIdName: e.target.value })} />
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Carrier</label>
        <select style={{ ...select, marginBottom: 10 }} value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })}>
          <option value="INTERNAL">Internal</option>
          <option value="PSTN">PSTN (carrier)</option>
          <option value="SIP">SIP trunk</option>
        </select>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Emergency address (E911)</label>
        <input style={{ ...input, marginBottom: 14 }} value={form.emergencyAddress} onChange={(e) => setForm({ ...form, emergencyAddress: e.target.value })} placeholder="Street, city, region" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" variant="primary" disabled={busy} onClick={create}>{busy ? 'Adding…' : 'Add number'}</Btn>
        </div>
      </div>
    </div>
  );
}

function AssignPhoneModal({ phone, onClose, onAssigned }: { phone: PhoneNumber; onClose: () => void; onAssigned: () => void }) {
  const [type, setType] = useState(phone.assignmentType);
  const [targetId, setTargetId] = useState<string>(phone.assignedToId ? String(phone.assignedToId) : '');
  const [queues, setQueues] = useState<CallQueue[]>([]);
  const [attendants, setAttendants] = useState<AutoAttendant[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    adm.listCallQueues().then(setQueues).catch(() => setQueues([]));
    adm.listAutoAttendants().then(setAttendants).catch(() => setAttendants([]));
  }, []);
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await adm.assignPhoneNumber(phone.id, {
        assignmentType: type,
        assignedToId: type === 'UNASSIGNED' || type === 'EMERGENCY' ? undefined : (targetId ? Number(targetId) : undefined),
      });
      onAssigned();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Assignment failed'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '92vw', background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', padding: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 4, fontFamily: "'Outfit',sans-serif" }}>Assign {phone.e164}</div>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>{phone.label}</div>
        {err && <div style={{ color: 'var(--err)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Assignment</label>
        <select style={{ ...select, marginBottom: 10 }} value={type} onChange={(e) => { setType(e.target.value as PhoneNumber['assignmentType']); setTargetId(''); }}>
          <option value="UNASSIGNED">Unassigned</option>
          <option value="USER">User (DID)</option>
          <option value="CALL_QUEUE">Call queue</option>
          <option value="AUTO_ATTENDANT">Auto-attendant</option>
          <option value="EMERGENCY">Emergency hotline</option>
        </select>
        {type === 'USER' && (
          <>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>User ID</label>
            <input style={{ ...input, marginBottom: 14 }} value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="numeric user id (find in User Management)" />
          </>
        )}
        {type === 'CALL_QUEUE' && (
          <>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Queue</label>
            <select style={{ ...select, marginBottom: 14 }} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">— select —</option>
              {queues.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </>
        )}
        {type === 'AUTO_ATTENDANT' && (
          <>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Attendant</label>
            <select style={{ ...select, marginBottom: 14 }} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">— select —</option>
              {attendants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" variant="primary" disabled={busy} onClick={submit}>{busy ? 'Assigning…' : 'Save assignment'}</Btn>
        </div>
      </div>
    </div>
  );
}

function QueuesTab() {
  const [list, setList] = useState<CallQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CallQueue | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adm.listCallQueues().then(setList).catch(() => setList([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12.5, color: 'var(--t3)', flex: 1 }}>{list.length} queue{list.length === 1 ? '' : 's'}</span>
        <Btn size="sm" variant="primary" onClick={() => setCreating(true)}><Ic.Plus s={13} /> New queue</Btn>
      </div>
      {loading && <div style={{ color: 'var(--t3)' }}>Loading…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 12 }}>
        {list.map((q) => (
          <div key={q.id} style={{ ...card, cursor: 'pointer' }} onClick={() => setEditing(q)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ic.Phone s={16} c="var(--ok)" />
              <div style={{ fontWeight: 700, color: 'var(--t1)', flex: 1 }}>{q.name}</div>
              <Badge variant={q.active ? 'success' : 'muted'}>{q.active ? 'ACTIVE' : 'PAUSED'}</Badge>
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 8 }}>{q.description || '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <span>Routing: {q.routingMethod}</span>
              <span>Max wait: {q.maxWaitSeconds}s</span>
              <span>Capacity: {q.maxSize}</span>
              <span>Overflow: {q.overflowAction.replace('OVERFLOW_', '')}</span>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {q.agents.slice(0, 5).map((a) => (
                <Avatar key={a.userId} user={{ id: String(a.userId), name: a.displayName, color: '#8b5cf6' }} size={22} />
              ))}
              {q.agentCount > 5 && <span style={{ fontSize: 11, color: 'var(--t3)' }}>+{q.agentCount - 5}</span>}
              {q.agentCount === 0 && <span style={{ fontSize: 11.5, color: 'var(--t3)' }}>No agents</span>}
            </div>
          </div>
        ))}
      </div>
      {(creating || editing) && (
        <QueueEditor queue={editing || undefined} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />
      )}
    </div>
  );
}

function QueueEditor({ queue, onClose, onSaved }: { queue?: CallQueue; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!queue;
  const [form, setForm] = useState({
    name: queue?.name || '', description: queue?.description || '',
    routingMethod: queue?.routingMethod || 'ATTENDANT',
    greetingLanguage: queue?.greetingLanguage || 'en-US',
    maxWaitSeconds: queue?.maxWaitSeconds ?? 300,
    maxSize: queue?.maxSize ?? 50,
    overflowAction: queue?.overflowAction || 'OVERFLOW_VOICEMAIL',
    overflowTarget: queue?.overflowTarget || '',
    agentIdsCsv: (queue?.agents || []).map((a) => a.userId).join(','),
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const agentIds = form.agentIdsCsv.split(',').map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => !isNaN(n));
      const payload = { ...form, agentIds };
      if (isEdit) await adm.updateCallQueue(queue!.id, payload);
      else await adm.createCallQueue(payload);
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!queue) return;
    if (!confirm(`Delete queue "${queue.name}"?`)) return;
    try { await adm.deleteCallQueue(queue.id); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Delete failed'); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,.5)' }} onClick={onClose}>
      <div className="il-slide-l" onClick={(e) => e.stopPropagation()} style={{ width: 500, maxWidth: '94vw', height: '100vh', background: 'var(--bg-base)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Ic.Phone s={18} c="var(--ok)" />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', flex: 1 }}>{isEdit ? 'Edit queue' : 'New call queue'}</div>
          <Btn size="icon-sm" variant="ghost" onClick={onClose}><Ic.X s={15} /></Btn>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {err && <div style={{ color: 'var(--err)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Name</label>
          <input style={{ ...input, marginBottom: 10 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Description</label>
          <input style={{ ...input, marginBottom: 10 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Routing</label>
              <select style={select} value={form.routingMethod} onChange={(e) => setForm({ ...form, routingMethod: e.target.value as CallQueue['routingMethod'] })}>
                <option value="ATTENDANT">Attendant (broadcast)</option>
                <option value="SERIAL">Serial</option>
                <option value="ROUND_ROBIN">Round robin</option>
                <option value="LONGEST_IDLE">Longest idle</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Language</label>
              <input style={input} value={form.greetingLanguage} onChange={(e) => setForm({ ...form, greetingLanguage: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Max wait (sec)</label>
              <input type="number" style={input} value={form.maxWaitSeconds} onChange={(e) => setForm({ ...form, maxWaitSeconds: Number(e.target.value) })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Queue size</label>
              <input type="number" style={input} value={form.maxSize} onChange={(e) => setForm({ ...form, maxSize: Number(e.target.value) })} />
            </div>
          </div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', marginTop: 10, display: 'block' }}>Overflow</label>
          <select style={{ ...select, marginBottom: 10 }} value={form.overflowAction} onChange={(e) => setForm({ ...form, overflowAction: e.target.value as CallQueue['overflowAction'] })}>
            <option value="OVERFLOW_VOICEMAIL">To voicemail</option>
            <option value="OVERFLOW_DISCONNECT">Disconnect</option>
            <option value="OVERFLOW_REDIRECT">Redirect to target</option>
          </select>
          {form.overflowAction === 'OVERFLOW_REDIRECT' && (
            <>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Redirect target</label>
              <input style={{ ...input, marginBottom: 10 }} value={form.overflowTarget} onChange={(e) => setForm({ ...form, overflowTarget: e.target.value })} placeholder="+14155550101 or queue:Support" />
            </>
          )}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Agent user IDs (comma-separated)</label>
          <input style={{ ...input, marginBottom: 16 }} value={form.agentIdsCsv} onChange={(e) => setForm({ ...form, agentIdsCsv: e.target.value })} placeholder="e.g. 12, 45, 67" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>{isEdit && <Btn size="sm" variant="danger" onClick={remove}>Delete</Btn>}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn size="sm" variant="primary" disabled={busy || !form.name.trim()} onClick={save}>{busy ? 'Saving…' : isEdit ? 'Save' : 'Create queue'}</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttendantsTab() {
  const [list, setList] = useState<AutoAttendant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AutoAttendant | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adm.listAutoAttendants().then(setList).catch(() => setList([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12.5, color: 'var(--t3)', flex: 1 }}>{list.length} attendant{list.length === 1 ? '' : 's'}</span>
        <Btn size="sm" variant="primary" onClick={() => setCreating(true)}><Ic.Plus s={13} /> New attendant</Btn>
      </div>
      {loading && <div style={{ color: 'var(--t3)' }}>Loading…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 12 }}>
        {list.map((a) => (
          <div key={a.id} style={{ ...card, cursor: 'pointer' }} onClick={() => setEditing(a)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ic.Cmd s={16} c="var(--primary)" />
              <div style={{ fontWeight: 700, color: 'var(--t1)', flex: 1 }}>{a.name}</div>
              <Badge variant={a.active ? 'success' : 'muted'}>{a.active ? 'ACTIVE' : 'OFF'}</Badge>
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 8 }}>{a.description || '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--t2)' }}>Language: {a.language} · TZ: {a.timeZone}</div>
            {a.greetingText && <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 6, fontStyle: 'italic' }}>"{a.greetingText.slice(0, 80)}{a.greetingText.length > 80 ? '…' : ''}"</div>}
          </div>
        ))}
      </div>
      {(creating || editing) && <AttendantEditor attendant={editing || undefined} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />}
    </div>
  );
}

function AttendantEditor({ attendant, onClose, onSaved }: { attendant?: AutoAttendant; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!attendant;
  const [form, setForm] = useState({
    name: attendant?.name || '', description: attendant?.description || '',
    language: attendant?.language || 'en-US', timeZone: attendant?.timeZone || 'UTC',
    greetingText: attendant?.greetingText || '', menuJson: attendant?.menuJson || JSON.stringify([
      { key: '1', label: 'Sales', action: 'TRANSFER_QUEUE', target: 'sales' },
      { key: '2', label: 'Support', action: 'TRANSFER_QUEUE', target: 'support' },
      { key: '0', label: 'Operator', action: 'TRANSFER_USER', target: 'operator' },
    ], null, 2),
    businessHoursJson: attendant?.businessHoursJson || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      if (form.menuJson) { try { JSON.parse(form.menuJson); } catch { throw new Error('Menu JSON is not valid JSON'); } }
      if (isEdit) await adm.updateAutoAttendant(attendant!.id, form);
      else await adm.createAutoAttendant(form);
      onSaved();
    } catch (e: any) { setErr(e?.message || e?.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!attendant) return;
    if (!confirm(`Delete attendant "${attendant.name}"?`)) return;
    try { await adm.deleteAutoAttendant(attendant.id); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Delete failed'); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,.5)' }} onClick={onClose}>
      <div className="il-slide-l" onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '94vw', height: '100vh', background: 'var(--bg-base)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Ic.Cmd s={18} c="var(--primary)" />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', flex: 1 }}>{isEdit ? 'Edit attendant' : 'New attendant'}</div>
          <Btn size="icon-sm" variant="ghost" onClick={onClose}><Ic.X s={15} /></Btn>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {err && <div style={{ color: 'var(--err)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Name</label>
          <input style={{ ...input, marginBottom: 10 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Description</label>
          <input style={{ ...input, marginBottom: 10 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Language</label>
              <input style={input} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Time zone</label>
              <input style={input} value={form.timeZone} onChange={(e) => setForm({ ...form, timeZone: e.target.value })} />
            </div>
          </div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', marginTop: 10, display: 'block' }}>Greeting</label>
          <textarea style={{ ...input, marginBottom: 10, minHeight: 70, fontFamily: 'inherit' }} value={form.greetingText} onChange={(e) => setForm({ ...form, greetingText: e.target.value })} />
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Menu JSON</label>
          <textarea style={{ ...input, marginBottom: 16, minHeight: 160, fontFamily: 'ui-monospace, "SF Mono", monospace' }} value={form.menuJson} onChange={(e) => setForm({ ...form, menuJson: e.target.value })} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>{isEdit && <Btn size="sm" variant="danger" onClick={remove}>Delete</Btn>}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn size="sm" variant="primary" disabled={busy || !form.name.trim()} onClick={save}>{busy ? 'Saving…' : isEdit ? 'Save' : 'Create attendant'}</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
