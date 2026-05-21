/* InterLynk Admin — Module 2 Views (Teams · Channels · Messaging Policies).
   Backend-wired; no mock data. Shares theme + primitives with the rest of the app. */
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Ic } from '../icons';
import { Avatar, Badge, Btn } from '../ui';
import * as adm from './api';
import type { AdminTeam, AdminChannel, MessagingPolicy, TeamMemberRow } from './api';

const card: CSSProperties = {
  background: 'var(--bg-elv)',
  border: '1px solid var(--bd)',
  borderRadius: 'var(--r-lg)',
  padding: 16,
};
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
function vbadge(v: string): 'primary' | 'success' | 'muted' | 'warning' {
  return v === 'PUBLIC' ? 'success' : v === 'ORG_WIDE' ? 'primary' : v === 'PRIVATE' ? 'muted' : 'warning';
}

/* ── Teams view ──────────────────────────────────────────── */
export function TeamsView() {
  const [q, setQ] = useState('');
  const [archived, setArchived] = useState<string>('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<adm.PagedTeams | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminTeam | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adm
      .listTeams({ q, archived: archived === '' ? undefined : archived === 'true', page, size: 25 })
      .then(setData)
      .catch(() => setBanner('Failed to load teams.'))
      .finally(() => setLoading(false));
  }, [q, archived, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 24, height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif", flex: 1 }}>Teams &amp; Channels</h2>
        <Btn size="sm" variant="primary" onClick={() => setShowCreate(true)}><Ic.Plus s={13} /> New team</Btn>
      </div>

      {banner && (
        <div style={{ ...card, padding: 10, fontSize: 12.5, color: 'var(--t2)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{banner}</span><span style={{ cursor: 'pointer', color: 'var(--t3)' }} onClick={() => setBanner(null)}>✕</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input style={{ ...input, flex: 1, minWidth: 220, padding: '9px 12px', fontSize: 13.5 }}
          placeholder="Search teams…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select style={{ ...select, padding: '9px 12px' }} value={archived} onChange={(e) => { setArchived(e.target.value); setPage(0); }}>
          <option value="">All states</option>
          <option value="false">Active</option>
          <option value="true">Archived</option>
        </select>
      </div>

      <div style={{ ...card, padding: 0, flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elv)' }}>
            <tr>
              <th style={headCell}>Team</th>
              <th style={headCell}>Visibility</th>
              <th style={headCell}>Members</th>
              <th style={headCell}>Channels</th>
              <th style={headCell}>Policy</th>
              <th style={headCell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ ...cell, color: 'var(--t3)', textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
            {!loading && data?.content.length === 0 && <tr><td colSpan={6} style={{ ...cell, color: 'var(--t3)', textAlign: 'center', padding: 30 }}>No teams yet.</td></tr>}
            {!loading && data?.content.map((t) => (
              <tr key={t.id} onClick={() => setSelected(t)} style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td style={cell}>
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>
                    {t.description || '—'}
                  </div>
                </td>
                <td style={cell}><Badge variant={vbadge(t.visibility)}>{t.visibility}</Badge></td>
                <td style={{ ...cell, color: 'var(--t2)' }}>{t.memberCount} <span style={{ color: 'var(--t3)' }}>({t.ownerCount} owner{t.ownerCount === 1 ? '' : 's'})</span></td>
                <td style={{ ...cell, color: 'var(--t2)' }}>{t.channelCount}</td>
                <td style={{ ...cell, color: 'var(--t2)' }}>{t.messagingPolicyName || <span style={{ color: 'var(--t3)' }}>Default</span>}</td>
                <td style={cell}>{t.archived
                  ? <Badge variant="muted">ARCHIVED</Badge>
                  : <Badge variant="success">ACTIVE</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Btn size="sm" variant="outline" disabled={data.first} onClick={() => setPage((p) => Math.max(0, p - 1))}><Ic.ChevL s={13} /> Prev</Btn>
          <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>Page {data.page + 1} of {data.totalPages} · {data.totalElements} teams</span>
          <Btn size="sm" variant="outline" disabled={data.last} onClick={() => setPage((p) => p + 1)}>Next <Ic.ChevR s={13} /></Btn>
        </div>
      )}

      {selected && <TeamDrawer team={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}

function CreateTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', visibility: 'PRIVATE', templateName: 'default' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    if (!form.name.trim()) return;
    setBusy(true); setErr(null);
    try { await adm.createTeam(form); onCreated(); onClose(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Failed to create team'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '92vw', background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', padding: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>Create team</div>
        {err && <div style={{ color: 'var(--err)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Name</label>
        <input style={{ ...input, marginBottom: 10 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Description</label>
        <input style={{ ...input, marginBottom: 10 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Visibility</label>
        <select style={{ ...select, marginBottom: 10 }} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
          <option value="PRIVATE">Private — invite only</option>
          <option value="PUBLIC">Public — discoverable</option>
          <option value="ORG_WIDE">Org-wide — auto-joined</option>
        </select>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Template</label>
        <select style={{ ...select, marginBottom: 14 }} value={form.templateName} onChange={(e) => setForm({ ...form, templateName: e.target.value })}>
          <option value="default">Default · single #general</option>
          <option value="engineering">Engineering · general, incidents, deploys</option>
          <option value="sales">Sales · general, wins, pipeline</option>
          <option value="leadership">Leadership · general, announcements</option>
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" variant="primary" disabled={busy || !form.name.trim()} onClick={create}>{busy ? 'Creating…' : 'Create team'}</Btn>
        </div>
      </div>
    </div>
  );
}

function TeamDrawer({ team, onClose, onChanged }: { team: AdminTeam; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<'overview' | 'members'>('overview');
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [policies, setPolicies] = useState<MessagingPolicy[]>([]);
  const [form, setForm] = useState({
    name: team.name, description: team.description || '',
    visibility: team.visibility, messagingPolicyId: team.messagingPolicyId,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [newMember, setNewMember] = useState({ username: '', role: 'MEMBER' });

  useEffect(() => {
    adm.listPolicies().then(setPolicies).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'members') {
      adm.getTeamMembers(team.id).then(setMembers).catch(() => setMembers([]));
    }
  }, [tab, team.id]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg(ok); onChanged(); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Operation failed'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,.5)' }} onClick={onClose}>
      <div className="il-slide-l" onClick={(e) => e.stopPropagation()} style={{ width: 500, maxWidth: '94vw', height: '100vh', background: 'var(--bg-base)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>{team.name}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>{team.memberCount} member{team.memberCount === 1 ? '' : 's'} · {team.channelCount} channel{team.channelCount === 1 ? '' : 's'}</div>
          </div>
          <Badge variant={vbadge(team.visibility)}>{team.visibility}</Badge>
          {team.archived && <Badge variant="muted">ARCHIVED</Badge>}
          <Btn size="icon-sm" variant="ghost" onClick={onClose}><Ic.X s={15} /></Btn>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--bd)' }}>
          <Btn size="sm" variant={tab === 'overview' ? 'active' : 'ghost'} onClick={() => setTab('overview')}>Overview</Btn>
          <Btn size="sm" variant={tab === 'members' ? 'active' : 'ghost'} onClick={() => setTab('members')}>Members ({team.memberCount})</Btn>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {msg && <div style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 10 }}>{msg}</div>}

          {tab === 'overview' && (
            <>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Name</label>
              <input style={{ ...input, marginBottom: 10 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Description</label>
              <input style={{ ...input, marginBottom: 10 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Visibility</label>
              <select style={{ ...select, marginBottom: 10 }} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as AdminTeam['visibility'] })}>
                <option value="PRIVATE">Private</option>
                <option value="PUBLIC">Public</option>
                <option value="ORG_WIDE">Org-wide</option>
              </select>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Messaging policy</label>
              <select style={{ ...select, marginBottom: 14 }} value={form.messagingPolicyId ?? ''} onChange={(e) => setForm({ ...form, messagingPolicyId: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">— Use default —</option>
                {policies.map((p) => <option key={p.id} value={p.id}>{p.name}{p.defaultPolicy ? ' (default)' : ''}</option>)}
              </select>

              <Btn size="sm" variant="primary" disabled={busy} onClick={() => act(() => adm.updateTeam(team.id, {
                name: form.name, description: form.description, visibility: form.visibility,
                messagingPolicyId: form.messagingPolicyId == null ? -1 : form.messagingPolicyId,
              }), 'Team updated')}>Save changes</Btn>

              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--bd)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {team.archived
                  ? <Btn size="sm" variant="success" disabled={busy} onClick={() => act(() => adm.restoreTeam(team.id), 'Team restored')}>Restore</Btn>
                  : <Btn size="sm" variant="outline" disabled={busy} onClick={() => act(() => adm.archiveTeam(team.id), 'Team archived')}>Archive</Btn>}
                <Btn size="sm" variant="danger" disabled={busy}
                  onClick={() => { if (confirm(`Permanently delete ${team.name}? Members, channels and messages will be removed.`))
                    act(async () => { await adm.deleteTeam(team.id); onClose(); }, 'Deleted'); }}>Delete permanently</Btn>
              </div>
            </>
          )}

          {tab === 'members' && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input style={{ ...input, flex: 1 }} placeholder="username" value={newMember.username} onChange={(e) => setNewMember({ ...newMember, username: e.target.value })} />
                <select style={select} value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}>
                  <option value="OWNER">Owner</option>
                  <option value="LEAD">Lead</option>
                  <option value="MEMBER">Member</option>
                  <option value="GUEST">Guest</option>
                </select>
                <Btn size="sm" variant="primary" disabled={busy || !newMember.username.trim()}
                  onClick={() => act(async () => {
                    await adm.addTeamMember(team.id, newMember.username.trim(), newMember.role);
                    setNewMember({ username: '', role: 'MEMBER' });
                    const rows = await adm.getTeamMembers(team.id);
                    setMembers(rows);
                  }, 'Member added')}>Add</Btn>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr><th style={headCell}>User</th><th style={headCell}>Role</th><th style={headCell}></th></tr></thead>
                <tbody>
                  {members.length === 0 && <tr><td colSpan={3} style={{ ...cell, color: 'var(--t3)' }}>No members.</td></tr>}
                  {members.map((m) => (
                    <tr key={m.userId}>
                      <td style={cell}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar user={{ id: String(m.userId), name: m.displayName, color: '#8b5cf6' }} size={26} />
                          <div><div style={{ fontWeight: 600 }}>{m.displayName}</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>@{m.username}</div></div>
                        </div>
                      </td>
                      <td style={cell}>
                        <select style={select} value={m.roleInTeam}
                          onChange={(e) => act(async () => {
                            await adm.changeTeamRole(team.id, m.userId, e.target.value);
                            setMembers(await adm.getTeamMembers(team.id));
                          }, 'Role updated')}>
                          <option value="OWNER">Owner</option><option value="LEAD">Lead</option>
                          <option value="MEMBER">Member</option><option value="GUEST">Guest</option>
                        </select>
                      </td>
                      <td style={cell}>
                        <Btn size="sm" variant="ghost" onClick={() => act(async () => {
                          await adm.removeTeamMember(team.id, m.userId);
                          setMembers(await adm.getTeamMembers(team.id));
                        }, 'Removed')}><Ic.Trash s={13} c="var(--err)" /></Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Channels view ───────────────────────────────────────── */
export function ChannelsView() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [archived, setArchived] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<adm.PagedChannels | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminChannel | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adm
      .listAdminChannels({ q, type: type || undefined, archived: archived === '' ? undefined : archived === 'true', page })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [q, type, archived, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 24, height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif", flex: 1 }}>Channels</h2>
        <Btn size="sm" variant="primary" onClick={() => setShowCreate(true)}><Ic.Plus s={13} /> New channel</Btn>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input style={{ ...input, flex: 1, minWidth: 220, padding: '9px 12px', fontSize: 13.5 }}
          placeholder="Search channels…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select style={{ ...select, padding: '9px 12px' }} value={type} onChange={(e) => { setType(e.target.value); setPage(0); }}>
          <option value="">All types</option><option value="TEXT">Text</option><option value="VOICE">Voice</option>
          <option value="PUBLIC">Public</option><option value="PRIVATE">Private</option>
        </select>
        <select style={{ ...select, padding: '9px 12px' }} value={archived} onChange={(e) => { setArchived(e.target.value); setPage(0); }}>
          <option value="">All states</option>
          <option value="false">Active</option>
          <option value="true">Archived</option>
        </select>
      </div>

      <div style={{ ...card, padding: 0, flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elv)' }}>
            <tr>
              <th style={headCell}>Channel</th><th style={headCell}>Team</th>
              <th style={headCell}>Type</th><th style={headCell}>Visibility</th>
              <th style={headCell}>Members</th><th style={headCell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ ...cell, color: 'var(--t3)', textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
            {!loading && data?.content.length === 0 && <tr><td colSpan={6} style={{ ...cell, color: 'var(--t3)', textAlign: 'center', padding: 30 }}>No channels match.</td></tr>}
            {!loading && data?.content.map((c) => (
              <tr key={c.id} onClick={() => setEditing(c)} style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td style={cell}>
                  <div style={{ fontWeight: 600 }}>#{c.name}{c.locked && <Badge variant="muted" style={{ marginLeft: 6 }}>READ-ONLY</Badge>}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>{c.description || '—'}</div>
                </td>
                <td style={{ ...cell, color: 'var(--t2)' }}>{c.teamName || <span style={{ color: 'var(--t3)' }}>—</span>}</td>
                <td style={cell}><Badge variant={c.type === 'VOICE' ? 'success' : 'dimmed'}>{c.type}</Badge></td>
                <td style={cell}><Badge variant={c.visibility === 'PRIVATE' ? 'warning' : c.visibility === 'SHARED' ? 'primary' : 'muted'}>{c.visibility}</Badge></td>
                <td style={{ ...cell, color: 'var(--t2)' }}>{c.memberCount}</td>
                <td style={cell}>
                  {c.archived ? <Badge variant="muted">ARCHIVED</Badge>
                    : c.active ? <Badge variant="success">ACTIVE</Badge>
                    : <Badge variant="warning">INACTIVE</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Btn size="sm" variant="outline" disabled={data.first} onClick={() => setPage((p) => Math.max(0, p - 1))}><Ic.ChevL s={13} /> Prev</Btn>
          <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>Page {data.page + 1} of {data.totalPages} · {data.totalElements} channels</span>
          <Btn size="sm" variant="outline" disabled={data.last} onClick={() => setPage((p) => p + 1)}>Next <Ic.ChevR s={13} /></Btn>
        </div>
      )}

      {showCreate && <CreateChannelModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {editing && <ChannelEditDrawer channel={editing} onClose={() => setEditing(null)} onChanged={load} />}
    </div>
  );
}

function CreateChannelModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', description: '', type: 'TEXT', visibility: 'STANDARD',
    teamId: '' as string | number, category: '', maxParticipants: 25,
  });
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    adm.listTeams({ size: 200 }).then((p) => setTeams(p.content)).catch(() => setTeams([]));
  }, []);

  const create = async () => {
    if (!form.name.trim()) return;
    setBusy(true); setErr(null);
    try {
      await adm.createAdminChannel({
        name: form.name.trim(), description: form.description, type: form.type,
        visibility: form.visibility, teamId: form.teamId ? Number(form.teamId) : undefined,
        category: form.category || undefined, maxParticipants: form.maxParticipants,
      });
      onCreated(); onClose();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Failed to create channel'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '92vw', background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', padding: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>Create channel</div>
        {err && <div style={{ color: 'var(--err)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Name</label>
        <input style={{ ...input, marginBottom: 10 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.replace(/\s+/g, '-') })} autoFocus />
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Description</label>
        <input style={{ ...input, marginBottom: 10 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Type</label>
            <select style={{ ...select, marginBottom: 10 }} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="TEXT">Text</option><option value="VOICE">Voice</option>
              <option value="PUBLIC">Public</option><option value="PRIVATE">Private</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Visibility</label>
            <select style={{ ...select, marginBottom: 10 }} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              <option value="STANDARD">Standard</option><option value="PRIVATE">Private</option><option value="SHARED">Shared</option>
            </select>
          </div>
        </div>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Team</label>
        <select style={{ ...select, marginBottom: 14 }} value={String(form.teamId)} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
          <option value="">— No team —</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" variant="primary" disabled={busy || !form.name.trim()} onClick={create}>{busy ? 'Creating…' : 'Create channel'}</Btn>
        </div>
      </div>
    </div>
  );
}

/* Grant/revoke who can access (and therefore join) a channel. */
function ChannelMembersSection({ channelId }: { channelId: number }) {
  const [members, setMembers] = useState<adm.AdminChannelMember[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<adm.AdminUser[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adm.getAdminChannelDetail(channelId).then((d) => setMembers(d.members || [])).catch(() => setMembers([]));
  }, [channelId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!q.trim()) { setResults([]); return; }
      adm.searchUsers({ q, size: 8 }).then((p) => setResults(p.content)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const memberIds = new Set(members.map((m) => m.id));
  const add = async (userId: number) => { setBusy(true); try { await adm.addAdminChannelMember(channelId, userId); setQ(''); setResults([]); load(); } finally { setBusy(false); } };
  const remove = async (userId: number) => { setBusy(true); try { await adm.removeAdminChannelMember(channelId, userId); load(); } finally { setBusy(false); } };

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Members &amp; access</div>
      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>People listed here can open this channel and join its voice room.</div>

      <input style={{ ...input, marginBottom: 8 }} placeholder="Search people to add…" value={q} onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <div style={{ ...card, padding: 4, marginBottom: 10, maxHeight: 180, overflowY: 'auto' }}>
          {results.map((u) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px' }}>
              <Avatar user={{ id: String(u.id), name: u.displayName, color: '#8b5cf6' }} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--t1)' }}>{u.displayName}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>@{u.username}</div>
              </div>
              {memberIds.has(u.id)
                ? <Badge variant="muted">Added</Badge>
                : <Btn size="sm" variant="primary" disabled={busy} onClick={() => add(u.id)}><Ic.Plus s={12} /> Add</Btn>}
            </div>
          ))}
        </div>
      )}

      <div style={{ ...card, padding: 4 }}>
        {members.length === 0 && <div style={{ padding: 10, fontSize: 12.5, color: 'var(--t3)' }}>No members yet — only admins can access this channel.</div>}
        {members.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px' }}>
            <Avatar user={{ id: String(m.id), name: m.displayName, color: '#8b5cf6' }} size={26} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--t1)' }}>{m.displayName}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>@{m.username}</div>
            </div>
            <Btn size="icon-sm" variant="ghost" disabled={busy} onClick={() => remove(m.id)}><Ic.Trash s={13} c="var(--err)" /></Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelEditDrawer({ channel, onClose, onChanged }: { channel: AdminChannel; onClose: () => void; onChanged: () => void }) {
  const [form, setForm] = useState({
    name: channel.name, description: channel.description || '', visibility: channel.visibility,
    locked: channel.locked, active: channel.active, category: channel.category || '',
    maxParticipants: channel.maxParticipants ?? 25,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg(ok); onChanged(); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,.5)' }} onClick={onClose}>
      <div className="il-slide-l" onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '92vw', height: '100vh', background: 'var(--bg-base)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>#{channel.name}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>{channel.teamName || 'No team'} · {channel.type}</div>
          </div>
          <Btn size="icon-sm" variant="ghost" onClick={onClose}><Ic.X s={15} /></Btn>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {msg && <div style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 10 }}>{msg}</div>}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Name</label>
          <input style={{ ...input, marginBottom: 10 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Description</label>
          <input style={{ ...input, marginBottom: 10 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Visibility</label>
          <select style={{ ...select, marginBottom: 10 }} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as AdminChannel['visibility'] })}>
            <option value="STANDARD">Standard</option><option value="PRIVATE">Private</option><option value="SHARED">Shared</option>
          </select>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Category</label>
              <input style={{ ...input, marginBottom: 10 }} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div style={{ width: 120 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Max</label>
              <input type="number" style={{ ...input, marginBottom: 10 }} value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: Number(e.target.value) })} />
            </div>
          </div>
          <label style={{ fontSize: 13, color: 'var(--t1)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <input type="checkbox" checked={form.locked} onChange={(e) => setForm({ ...form, locked: e.target.checked })} /> Read-only (announcements)
          </label>
          <label style={{ fontSize: 13, color: 'var(--t1)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
          </label>
          <Btn size="sm" variant="primary" disabled={busy} onClick={() => act(() => adm.updateAdminChannel(channel.id, form), 'Channel saved')}>Save</Btn>

          <ChannelMembersSection channelId={channel.id} />

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--bd)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {channel.archived
              ? <Btn size="sm" variant="success" disabled={busy} onClick={() => act(() => adm.restoreChannel(channel.id), 'Channel restored')}>Restore</Btn>
              : <Btn size="sm" variant="outline" disabled={busy} onClick={() => act(() => adm.archiveChannel(channel.id), 'Channel archived')}>Archive</Btn>}
            <Btn size="sm" variant="danger" disabled={busy}
              onClick={() => { if (confirm(`Delete #${channel.name}?`))
                act(async () => { await adm.deleteAdminChannel(channel.id); onClose(); }, 'Deleted'); }}>Delete</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Policies view ───────────────────────────────────────── */
export function PoliciesView() {
  const [list, setList] = useState<MessagingPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MessagingPolicy | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adm.listPolicies().then(setList).catch(() => setList([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 24, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif", flex: 1 }}>Messaging Policies</h2>
        <Btn size="sm" variant="primary" onClick={() => setCreating(true)}><Ic.Plus s={13} /> New policy</Btn>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--t3)', marginTop: -8 }}>
        Policies control message editing, deletion, attachments, retention, and external chat. The default policy applies to any team without an explicit assignment.
      </div>

      {loading && <div style={{ color: 'var(--t3)' }}>Loading…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
        {list.map((p) => (
          <div key={p.id} style={{ ...card, cursor: 'pointer' }} onClick={() => setEditing(p)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ic.Shield s={16} c="var(--primary)" />
              <div style={{ fontWeight: 700, color: 'var(--t1)', flex: 1 }}>{p.name}</div>
              {p.defaultPolicy && <Badge variant="primary">DEFAULT</Badge>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>{p.description || '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <span>Edit: {p.allowUserEdit ? 'on' : 'off'}</span>
              <span>Delete: {p.allowUserDelete ? 'on' : 'off'}</span>
              <span>External: {p.allowExternalChat ? 'on' : 'off'}</span>
              <span>Receipts: {p.readReceiptsEnabled ? 'on' : 'off'}</span>
              <span>Retention: {p.retentionDays ? p.retentionDays + 'd' : '∞'}</span>
              <span>Files: {p.allowFileAttachments ? `${p.maxAttachmentMb}MB` : 'off'}</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--t3)' }}>Used by {p.teamsUsingThisPolicy} team{p.teamsUsingThisPolicy === 1 ? '' : 's'} · updated {fmtDate(p.updatedAt)}</div>
          </div>
        ))}
      </div>

      {creating && <PolicyEditor onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {editing && <PolicyEditor policy={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function PolicyEditor({ policy, onClose, onSaved }: { policy?: MessagingPolicy; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!policy;
  const [form, setForm] = useState<Partial<MessagingPolicy> & { name: string }>(
    policy ?? {
      name: '', description: '', defaultPolicy: false,
      allowOwnerDelete: true, allowUserDelete: true, allowUserEdit: true,
      allowGifs: true, allowStickers: true, allowMemes: true,
      readReceiptsEnabled: true, allowExternalChat: false,
      allowFileAttachments: true, allowUrlPreviews: true,
      maxAttachmentMb: 25, retentionDays: 0, chatSupervision: false,
    }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!form.name.trim()) return;
    setBusy(true); setErr(null);
    try {
      if (isEdit) await adm.updatePolicy(policy!.id, form);
      else await adm.createPolicy(form);
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!policy) return;
    if (!confirm(`Delete policy "${policy.name}"?`)) return;
    try { await adm.deletePolicy(policy.id); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Delete failed'); }
  };

  const toggle = (key: keyof MessagingPolicy, label: string, hint?: string) => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
      <input type="checkbox" checked={Boolean((form as any)[key])} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} style={{ marginTop: 3 }} />
      <div>
        <div style={{ fontSize: 13, color: 'var(--t1)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>{hint}</div>}
      </div>
    </label>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,.5)' }} onClick={onClose}>
      <div className="il-slide-l" onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '94vw', height: '100vh', background: 'var(--bg-base)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Ic.Shield s={18} c="var(--primary)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{isEdit ? 'Edit policy' : 'New policy'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>Applied per-team. The default policy is used when none is assigned.</div>
          </div>
          <Btn size="icon-sm" variant="ghost" onClick={onClose}><Ic.X s={15} /></Btn>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {err && <div style={{ color: 'var(--err)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Name</label>
          <input style={{ ...input, marginBottom: 10 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Description</label>
          <input style={{ ...input, marginBottom: 10 }} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          {toggle('defaultPolicy', 'Default policy', 'Used by every team that does not have an explicit assignment.')}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', margin: '14px 0 4px' }}>Message editing &amp; deletion</div>
          {toggle('allowUserEdit', 'Users can edit their own messages')}
          {toggle('allowUserDelete', 'Users can delete their own messages')}
          {toggle('allowOwnerDelete', 'Channel owners can delete any message')}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', margin: '14px 0 4px' }}>Rich content</div>
          {toggle('allowGifs', 'GIFs in chat')}
          {toggle('allowStickers', 'Stickers')}
          {toggle('allowMemes', 'Memes')}
          {toggle('allowUrlPreviews', 'URL link previews')}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', margin: '14px 0 4px' }}>Communication</div>
          {toggle('readReceiptsEnabled', 'Read receipts', 'Show who has read each message.')}
          {toggle('allowExternalChat', 'External chat', 'Allow guests/federated users to participate.')}
          {toggle('chatSupervision', 'Chat supervision', 'Channel owners can read all messages for moderation.')}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', margin: '14px 0 4px' }}>Attachments &amp; retention</div>
          {toggle('allowFileAttachments', 'File attachments')}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Max attachment (MB)</label>
              <input style={input} type="number" value={form.maxAttachmentMb ?? 25} onChange={(e) => setForm({ ...form, maxAttachmentMb: Number(e.target.value) })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Retention (days · 0 = forever)</label>
              <input style={input} type="number" value={form.retentionDays ?? 0} onChange={(e) => setForm({ ...form, retentionDays: Number(e.target.value) })} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
            <div>
              {isEdit && !policy?.defaultPolicy && (
                <Btn size="sm" variant="danger" onClick={remove}>Delete</Btn>
              )}
            </div>
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
