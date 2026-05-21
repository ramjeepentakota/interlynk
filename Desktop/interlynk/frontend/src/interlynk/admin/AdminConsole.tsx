/* InterLynk Admin Console — Module 1: Dashboard & Overview + User Management.
   Fully backend-wired. Renders as a full-screen surface over the app. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Ic, type IconName } from '../icons';
import { Avatar, Badge, Btn } from '../ui';
import { useApp } from '../context';
import * as adm from './api';
import type { AdminUser, DashboardSummary } from './api';
import { TeamsView, ChannelsView, PoliciesView } from './Module2Views';
import { MeetingsView, CallingView } from './Module3Views';
import { SecurityView } from './Module4Views';

type Tab = 'dashboard' | 'users' | 'teams' | 'channels' | 'policies' | 'meetings' | 'calling' | 'security';

const card: CSSProperties = {
  background: 'var(--bg-elv)',
  border: '1px solid var(--bd)',
  borderRadius: 'var(--r-lg)',
  padding: 16,
};

function fmtDate(s?: string): string {
  if (!s) return '—';
  const iso = s.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function statusVariant(s: string): 'success' | 'warning' | 'error' | 'muted' {
  return s === 'ACTIVE' ? 'success' : s === 'SUSPENDED' ? 'warning' : s === 'BLOCKED' ? 'error' : 'muted';
}

/* ── Dashboard ───────────────────────────────────────────── */
function Stat({ label, value, icon, tone }: { label: string; value: ReactNode; icon: IconName; tone?: string }) {
  const I = Ic[icon];
  return (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 'var(--r)', background: tone || 'var(--primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <I s={20} c={tone ? '#fff' : 'var(--primary)'} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif", lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function MiniBars({ data }: { data: adm.TimeBucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '8px 0' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--t3)' }}>{d.value}</div>
          <div title={`${d.label}: ${d.value}`} style={{ width: '100%', height: `${(d.value / max) * 80}px`, minHeight: 3, background: 'linear-gradient(180deg,var(--primary),var(--primary-dim))', borderRadius: 4 }} />
          <div style={{ fontSize: 10, color: 'var(--t3)', whiteSpace: 'nowrap' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function DashboardView() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adm
      .getDashboard()
      .then((d) => { setData(d); setErr(null); })
      .catch(() => setErr('Failed to load dashboard. Ensure you are signed in as an administrator.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  if (loading && !data) return <div style={{ padding: 40, color: 'var(--t3)' }}>Loading dashboard…</div>;
  if (err) return <div style={{ padding: 40, color: 'var(--err)' }}>{err}</div>;
  if (!data) return null;

  const sevTone: Record<string, string> = { INFO: 'var(--primary-dim)', WARNING: 'var(--warn)', CRITICAL: 'var(--err)' };
  const healthTone: Record<string, 'success' | 'warning' | 'error'> = { UP: 'success', DEGRADED: 'warning', DOWN: 'error' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>Organization Overview</h2>
        <Btn size="sm" variant="outline" onClick={load}><Ic.Loader s={13} /> Refresh</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 12 }}>
        <Stat label="Total users" value={data.totalUsers} icon="Users" />
        <Stat label="Active" value={data.activeUsers} icon="Check" tone="var(--ok)" />
        <Stat label="Online now" value={data.onlineNow} icon="Zap" tone="var(--primary)" />
        <Stat label="Suspended / Blocked" value={`${data.suspendedUsers} / ${data.blockedUsers}`} icon="Lock" tone="var(--warn)" />
        <Stat label="Guests" value={data.guestUsers} icon="User" />
        <Stat label="New (7d)" value={data.newUsersLast7Days} icon="Star" />
        <Stat label="Teams" value={data.totalTeams} icon="Shield" />
        <Stat label="Channels" value={data.totalChannels} icon="Hash" />
        <Stat label="Messages (24h)" value={data.messagesLast24h} icon="Msg" />
        <Stat label="Active calls" value={data.activeCalls} icon="Phone" tone="var(--ok)" />
        <Stat label="Logins (24h)" value={data.loginsLast24h} icon="LogOut" />
        <Stat label="Failed logins (24h)" value={data.failedLoginsLast24h} icon="Shield" tone={data.failedLoginsLast24h >= 5 ? 'var(--err)' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>Sign-ins · last 7 days</div>
          <MiniBars data={data.loginTrend7d} />
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 10 }}>Service health</div>
          {data.serviceHealth.map((h) => (
            <div key={h.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--t1)' }}>{h.name}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>{h.detail}{h.latencyMs ? ` · ${h.latencyMs}ms` : ''}</div>
              </div>
              <Badge variant={healthTone[h.status] || 'muted'}>{h.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 10 }}>Alerts & notifications</div>
          {data.alerts.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
              <div style={{ width: 6, borderRadius: 3, background: sevTone[a.severity], flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{a.message}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 10 }}>Recent activity</div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {data.recentActivity.length === 0 && <div style={{ fontSize: 12, color: 'var(--t3)' }}>No recent activity.</div>}
            {data.recentActivity.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
                <Badge variant="dimmed">{r.action}</Badge>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.details || r.entityType}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{r.username} · {fmtDate(r.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── User detail drawer ──────────────────────────────────── */
function UserDrawer({ user, onClose, onChanged }: { user: AdminUser; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<'profile' | 'logins' | 'activity'>('profile');
  const [form, setForm] = useState({
    displayName: user.displayName || '',
    jobTitle: user.jobTitle || '',
    department: user.department || '',
    phoneNumber: user.phoneNumber || '',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [logins, setLogins] = useState<adm.LoginHistoryEntry[]>([]);
  const [activity, setActivity] = useState<adm.ActivityEntry[]>([]);

  useEffect(() => {
    if (tab === 'logins') adm.getUserLoginHistory(user.id).then((p) => setLogins(p.content)).catch(() => setLogins([]));
    if (tab === 'activity') adm.getUserActivity(user.id).then((p) => setActivity(p.content)).catch(() => setActivity([]));
  }, [tab, user.id]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg(ok); onChanged(); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Operation failed'); }
    finally { setBusy(false); }
  };

  const inputStyle: CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', outline: 'none', marginBottom: 10 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,.5)' }} onClick={onClose}>
      <div className="il-slide-l" onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '92vw', height: '100vh', background: 'var(--bg-base)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderBottom: '1px solid var(--bd)' }}>
          <Avatar user={{ id: String(user.id), name: user.displayName, color: '#8b5cf6' }} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{user.displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>@{user.username} · {user.email}</div>
          </div>
          <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
          <Btn size="icon-sm" variant="ghost" onClick={onClose}><Ic.X s={15} /></Btn>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--bd)' }}>
          {(['profile', 'logins', 'activity'] as const).map((t) => (
            <Btn key={t} size="sm" variant={tab === t ? 'active' : 'ghost'} onClick={() => setTab(t)}>
              {t === 'profile' ? 'Profile' : t === 'logins' ? 'Login history' : 'Activity'}
            </Btn>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {msg && <div style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 10 }}>{msg}</div>}

          {tab === 'profile' && (
            <>
              {(['displayName', 'jobTitle', 'department', 'phoneNumber'] as const).map((k) => (
                <div key={k}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{k}</label>
                  <input style={inputStyle} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </div>
              ))}
              <Btn variant="primary" size="sm" disabled={busy} onClick={() => act(() => adm.updateUser(user.id, form), 'Profile saved')}>Save changes</Btn>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--bd)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {user.status === 'SUSPENDED'
                  ? <Btn size="sm" variant="success" disabled={busy} onClick={() => act(() => adm.unsuspendUser(user.id), 'User reactivated')}>Unsuspend</Btn>
                  : <Btn size="sm" variant="outline" disabled={busy} onClick={() => { const r = prompt('Reason for suspension?'); if (r) act(() => adm.suspendUser(user.id, r), 'User suspended'); }}>Suspend</Btn>}
                <Btn size="sm" variant="outline" disabled={busy} onClick={() => act(() => adm.blockUser(user.id, user.status !== 'BLOCKED'), user.status === 'BLOCKED' ? 'Unblocked' : 'Blocked')}>
                  {user.status === 'BLOCKED' ? 'Unblock sign-in' : 'Block sign-in'}
                </Btn>
                <Btn size="sm" variant="outline" disabled={busy} onClick={() => act(async () => {
                  const res = await adm.resetPassword(user.id);
                  if (res.temporaryPassword) alert('Temporary password: ' + res.temporaryPassword);
                }, 'Password reset')}>Reset password</Btn>
                <Btn size="sm" variant="danger" disabled={busy} onClick={() => { if (confirm(`Delete ${user.username}? This cannot be undone.`)) act(async () => { await adm.deleteUser(user.id); onClose(); }, 'Deleted'); }}>Delete</Btn>
              </div>
            </>
          )}

          {tab === 'logins' && (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: 'var(--t3)', textAlign: 'left' }}><th style={{ padding: 6 }}>When</th><th>Result</th><th>IP</th></tr></thead>
              <tbody>
                {logins.length === 0 && <tr><td colSpan={3} style={{ padding: 10, color: 'var(--t3)' }}>No login records.</td></tr>}
                {logins.map((l) => (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--bd)' }}>
                    <td style={{ padding: 6, color: 'var(--t2)' }}>{fmtDate(l.loginAt)}</td>
                    <td><Badge variant={l.success ? 'success' : 'error'}>{l.success ? 'OK' : 'FAIL'}</Badge></td>
                    <td style={{ color: 'var(--t3)' }}>{l.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'activity' && (
            <div>
              {activity.length === 0 && <div style={{ fontSize: 12, color: 'var(--t3)' }}>No recorded activity.</div>}
              {activity.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--bd)' }}>
                  <Badge variant="dimmed">{a.action}</Badge>
                  <div><div style={{ fontSize: 12.5, color: 'var(--t1)' }}>{a.details}</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>{fmtDate(a.timestamp)}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Users view ──────────────────────────────────────────── */
function UsersView() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<adm.PagedUsers | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adm
      .searchUsers({ q, status: status || undefined, page, size: 25 })
      .then(setData)
      .catch(() => setBanner('Failed to load users.'))
      .finally(() => setLoading(false));
  }, [q, status, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const doExport = async () => {
    const blob = await adm.exportUsersCsv();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'users-export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.csv,text/csv,text/plain';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      const text = await f.text();
      try {
        const res = await adm.importUsersCsv(text);
        setBanner(`Imported ${res.created} of ${res.total} (${res.skipped} skipped).` + (res.errors.length ? ' First error: ' + res.errors[0] : ''));
        load();
      } catch { setBanner('Import failed.'); }
    };
    inp.click();
  };

  const inviteGuest = async () => {
    const email = prompt('Guest email address?');
    if (!email) return;
    try {
      const res = await adm.inviteGuest({ email });
      alert(res.message + (res.temporaryPassword ? `\nTemporary password: ${res.temporaryPassword}` : ''));
      load();
    } catch (e: any) { setBanner(e?.response?.data?.message || 'Invite failed.'); }
  };

  const headCell: CSSProperties = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'left' };
  const cell: CSSProperties = { padding: '8px 10px', fontSize: 13, color: 'var(--t1)', borderTop: '1px solid var(--bd)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 24, overflow: 'hidden', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif", flex: 1 }}>User Management</h2>
        <Btn size="sm" variant="outline" onClick={inviteGuest}><Ic.Mail s={13} /> Invite guest</Btn>
        <Btn size="sm" variant="outline" onClick={doImport}><Ic.Clip s={13} /> Import CSV</Btn>
        <Btn size="sm" variant="outline" onClick={doExport}><Ic.ArrR s={13} /> Export CSV</Btn>
      </div>

      {banner && (
        <div style={{ ...card, padding: 10, fontSize: 12.5, color: 'var(--t2)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{banner}</span><span style={{ cursor: 'pointer', color: 'var(--t3)' }} onClick={() => setBanner(null)}>✕</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input placeholder="Search name, username or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
          style={{ flex: 1, minWidth: 220, padding: '9px 12px', fontSize: 13.5, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', outline: 'none' }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          style={{ padding: '9px 12px', fontSize: 13.5, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', outline: 'none' }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BLOCKED">Blocked</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div style={{ ...card, padding: 0, flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elv)' }}>
            <tr><th style={headCell}>User</th><th style={headCell}>Department</th><th style={headCell}>Role</th><th style={headCell}>Status</th><th style={headCell}>Last seen</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ ...cell, color: 'var(--t3)', textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
            {!loading && data?.content.length === 0 && <tr><td colSpan={5} style={{ ...cell, color: 'var(--t3)', textAlign: 'center', padding: 30 }}>No users found.</td></tr>}
            {!loading && data?.content.map((u) => (
              <tr key={u.id} onClick={() => setSelected(u)} style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td style={cell}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar user={{ id: String(u.id), name: u.displayName, color: '#8b5cf6' }} size={32} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.displayName}{u.guest && <Badge variant="muted" style={{ marginLeft: 6 }}>GUEST</Badge>}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>@{u.username} · {u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ ...cell, color: 'var(--t2)' }}>{u.department || '—'}</td>
                <td style={{ ...cell }}>{u.roles.map((r) => <Badge key={r} variant="dimmed" style={{ marginRight: 4 }}>{r}</Badge>)}</td>
                <td style={cell}><Badge variant={statusVariant(u.status)}>{u.status}</Badge></td>
                <td style={{ ...cell, color: 'var(--t3)', fontSize: 12 }}>{fmtDate(u.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Btn size="sm" variant="outline" disabled={data.first} onClick={() => setPage((p) => Math.max(0, p - 1))}><Ic.ChevL s={13} /> Prev</Btn>
          <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>Page {data.page + 1} of {data.totalPages} · {data.totalElements} users</span>
          <Btn size="sm" variant="outline" disabled={data.last} onClick={() => setPage((p) => p + 1)}>Next <Ic.ChevR s={13} /></Btn>
        </div>
      )}

      {selected && <UserDrawer user={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

/* ── Shell ───────────────────────────────────────────────── */
export function AdminConsole() {
  const { setShowAdmin } = useApp();
  const [tab, setTab] = useState<Tab>('dashboard');

  const navItem = (t: Tab, label: string, icon: IconName, enabled = true) => {
    const I = Ic[icon];
    const active = tab === t;
    return (
      <button key={t} disabled={!enabled} onClick={() => enabled && setTab(t)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--r)', border: 'none', cursor: enabled ? 'pointer' : 'not-allowed', width: '100%', textAlign: 'left', background: active ? 'var(--primary-dim)' : 'transparent', color: active ? 'var(--primary)' : enabled ? 'var(--t2)' : 'var(--t3)', fontSize: 13.5, fontWeight: active ? 600 : 500, fontFamily: "'DM Sans',sans-serif", opacity: enabled ? 1 : 0.5 }}>
        <I s={16} /> {label}
      </button>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg-main)', display: 'flex' }}>
      <div style={{ width: 240, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 16px' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ic.Shield s={17} c="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)', fontFamily: "'Outfit',sans-serif" }}>Admin Center</div>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>InterLynk</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {navItem('dashboard', 'Dashboard', 'Globe')}
          {navItem('users', 'User Management', 'Users')}
          {navItem('teams', 'Teams', 'Shield')}
          {navItem('channels', 'Channels', 'Hash')}
          {navItem('policies', 'Messaging Policies', 'Book')}
          {navItem('meetings', 'Meetings & Webinars', 'Video')}
          {navItem('calling', 'Calling & Phone', 'Phone')}
          {navItem('security', 'Security & Compliance', 'Lock')}
        </div>
        <div style={{ flex: 1 }} />
        <Btn variant="outline" size="sm" onClick={() => setShowAdmin(false)}><Ic.ChevL s={14} /> Back to app</Btn>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'dashboard' && <DashboardView />}
        {tab === 'users' && <UsersView />}
        {tab === 'teams' && <TeamsView />}
        {tab === 'channels' && <ChannelsView />}
        {tab === 'policies' && <PoliciesView />}
        {tab === 'meetings' && <MeetingsView />}
        {tab === 'calling' && <CallingView />}
        {tab === 'security' && <SecurityView />}
      </div>
    </div>
  );
}
