/* InterLynk Admin — Module 4 Views (Security · RBAC · Audit · eDiscovery · Compliance).
   Backend-wired; no mock data. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Ic } from '../icons';
import { Badge, Btn } from '../ui';
import * as adm from './api';
import type {
  AdminRole, AdminUser, AuditEntry, Barrier, ConditionalAccess, Dlp,
  EDiscoveryResult, Label, PermissionCatalogEntry, Retention,
} from './api';

const card: CSSProperties = { background: 'var(--bg-elv)', border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', padding: 16 };
const input: CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 'var(--r)', color: 'var(--t1)', outline: 'none' };
const select: CSSProperties = { ...input, paddingRight: 22 };
const headCell: CSSProperties = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'left' };
const cell: CSSProperties = { padding: '8px 10px', fontSize: 13, color: 'var(--t1)', borderTop: '1px solid var(--bd)' };

function fmtDate(s?: string): string {
  if (!s) return '—';
  const iso = s.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

type SecTab = 'mfa' | 'roles' | 'ca' | 'dlp' | 'labels' | 'barriers' | 'retention' | 'audit' | 'ediscovery';

export function SecurityView() {
  const [tab, setTab] = useState<SecTab>('mfa');
  const tabs: { id: SecTab; label: string; icon: keyof typeof Ic }[] = [
    { id: 'mfa', label: 'MFA enforcement', icon: 'Shield' },
    { id: 'roles', label: 'Admin roles · RBAC', icon: 'User' },
    { id: 'ca', label: 'Conditional access', icon: 'Lock' },
    { id: 'dlp', label: 'DLP policies', icon: 'Eye' },
    { id: 'labels', label: 'Sensitivity labels', icon: 'Pin' },
    { id: 'barriers', label: 'Info barriers', icon: 'Shield' },
    { id: 'retention', label: 'Retention', icon: 'Book' },
    { id: 'audit', label: 'Audit log', icon: 'Eye' },
    { id: 'ediscovery', label: 'eDiscovery', icon: 'Search' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 4px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--ff-display)' }}>Security &amp; Compliance</h2>
        <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>MFA · custom admin roles · conditional access · DLP · sensitivity labels · information barriers · retention · audit · eDiscovery.</div>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '8px 24px', borderBottom: '1px solid var(--bd)', flexWrap: 'wrap' }}>
        {tabs.map((t) => {
          const I = Ic[t.icon];
          return (
            <Btn key={t.id} size="sm" variant={tab === t.id ? 'active' : 'ghost'} onClick={() => setTab(t.id)}>
              <I s={13} /> {t.label}
            </Btn>
          );
        })}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'mfa' && <MfaTab />}
        {tab === 'roles' && <RolesTab />}
        {tab === 'ca' && <CaTab />}
        {tab === 'dlp' && <DlpTab />}
        {tab === 'labels' && <LabelsTab />}
        {tab === 'barriers' && <BarriersTab />}
        {tab === 'retention' && <RetentionTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'ediscovery' && <EDiscoveryTab />}
      </div>
    </div>
  );
}

/* ── MFA ─────────────────────────────────────────────────── */
interface EnrollState {
  user: AdminUser;
  secret: string;
  otpauthUrl: string;
  codes: string[];
}

function MfaTab() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<adm.PagedUsers | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaById, setMfaById] = useState<Record<number, adm.MfaStatus>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [enrolling, setEnrolling] = useState<EnrollState | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adm.searchUsers({ q, page, size: 25 })
      .then(async (p) => {
        setData(p);
        const results = await Promise.all(
          p.content.map((u) => adm.getMfaStatus(u.id).then((s) => [u.id, s] as const).catch(() => null))
        );
        const map: Record<number, adm.MfaStatus> = {};
        for (const r of results) if (r) map[r[0]] = r[1];
        setMfaById(map);
      })
      .catch(() => { setData(null); setMfaById({}); })
      .finally(() => setLoading(false));
  }, [q, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const toggleRequired = async (u: AdminUser, value: boolean) => {
    setBusyId(u.id);
    try {
      const status = await adm.setMfa(u.id, { required: value });
      setMfaById((m) => ({ ...m, [u.id]: status }));
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const disable = async (u: AdminUser) => {
    if (!confirm(`Disable MFA for @${u.username}? Their authenticator will stop being accepted at sign-in.`)) return;
    setBusyId(u.id);
    try {
      const status = await adm.setMfa(u.id, { enabled: false });
      setMfaById((m) => ({ ...m, [u.id]: status }));
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Could not disable MFA');
    } finally {
      setBusyId(null);
    }
  };

  const startEnroll = async (u: AdminUser) => {
    setBusyId(u.id);
    try {
      const res = await adm.enrollMfa(u.id);
      setEnrolling({ user: u, secret: res.secret, otpauthUrl: res.otpauthUrl, codes: res.backupCodes });
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Enrollment failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input style={{ ...input, padding: '9px 12px', fontSize: 13.5 }} placeholder="Search users…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      <div style={{ fontSize: 12, color: 'var(--t3)' }}>
        Compatible with Authy, Google Authenticator, Microsoft Authenticator, 1Password, Duo, FreeOTP, Bitwarden and any other RFC 6238 TOTP app.
        Enrollment opens a QR code the user scans — they must enter their first 6-digit code to activate MFA.
      </div>
      <div style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={headCell}>User</th>
            <th style={headCell}>Status</th>
            <th style={headCell}>Required</th>
            <th style={headCell}>Enrolled</th>
            <th style={headCell}>Backup codes</th>
            <th style={headCell}></th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ ...cell, color: 'var(--t3)', textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
            {!loading && data?.content.map((u) => {
              const m = mfaById[u.id];
              const isEnrolled = !!m?.enabled;
              const isPending = !!m?.pendingConfirmation;
              return (
                <tr key={u.id}>
                  <td style={cell}>
                    <div style={{ fontWeight: 600 }}>{u.displayName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>@{u.username}</div>
                  </td>
                  <td style={cell}>
                    {isEnrolled
                      ? <Badge variant="success">ENABLED</Badge>
                      : isPending
                        ? <Badge variant="warning">PENDING</Badge>
                        : <Badge variant="muted">OFF</Badge>}
                  </td>
                  <td style={cell}>
                    <input type="checkbox"
                      checked={!!m?.required}
                      disabled={busyId === u.id}
                      onChange={(e) => toggleRequired(u, e.target.checked)} />
                  </td>
                  <td style={{ ...cell, color: 'var(--t3)', fontSize: 12 }}>
                    {m?.enrolledAt ? fmtDate(m.enrolledAt) : '—'}
                  </td>
                  <td style={{ ...cell, color: 'var(--t2)', fontSize: 12 }}>
                    {isEnrolled ? `${m?.backupCodesRemaining ?? 0} remaining` : '—'}
                  </td>
                  <td style={cell}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn size="sm" variant="outline" disabled={busyId === u.id} onClick={() => startEnroll(u)}>
                        {isEnrolled ? 'Re-enroll' : isPending ? 'Resume enrollment' : 'Enroll'}
                      </Btn>
                      {isEnrolled && (
                        <Btn size="sm" variant="ghost" disabled={busyId === u.id} onClick={() => disable(u)} title="Disable MFA">
                          <Ic.X s={13} c="var(--err)" />
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <Btn size="sm" variant="outline" disabled={data.first} onClick={() => setPage((p) => Math.max(0, p - 1))}><Ic.ChevL s={13} /> Prev</Btn>
          <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>Page {data.page + 1} of {data.totalPages}</span>
          <Btn size="sm" variant="outline" disabled={data.last} onClick={() => setPage((p) => p + 1)}>Next <Ic.ChevR s={13} /></Btn>
        </div>
      )}

      {enrolling && (
        <MfaEnrollModal
          state={enrolling}
          onClose={() => setEnrolling(null)}
          onConfirmed={async () => {
            const status = await adm.getMfaStatus(enrolling.user.id).catch(() => null);
            if (status) setMfaById((m) => ({ ...m, [enrolling.user.id]: status }));
            setEnrolling(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Two-step admin enrollment modal:
 *   1. Show QR code (loaded from /mfa/qr.png) + raw secret as a fallback.
 *      The admin asks the user to scan it into their authenticator app.
 *   2. The user reads the 6-digit code back and the admin types it in. Only
 *      then does the backend mark MFA active. Backup codes are revealed last.
 */
function MfaEnrollModal({
  state, onClose, onConfirmed,
}: { state: EnrollState; onClose: () => void; onConfirmed: () => void }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [step, setStep] = useState<'scan' | 'verify' | 'done'>('scan');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let current: string | null = null;
    adm.fetchMfaQrObjectUrl(state.user.id)
      .then((url) => { if (cancelled) URL.revokeObjectURL(url); else { current = url; setQrUrl(url); } })
      .catch(() => setErr('Could not render QR code.'));
    return () => { cancelled = true; if (current) URL.revokeObjectURL(current); };
  }, [state.user.id]);

  const verify = async () => {
    const trimmed = code.trim();
    if (trimmed.length < 6) return;
    setBusy(true); setErr(null);
    try {
      await adm.confirmMfa(state.user.id, trimmed);
      setStep('done');
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Invalid code. Try the next one your app shows.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '94vw', background: 'var(--bg-base)', border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 6, fontFamily: 'var(--ff-display)' }}>
          MFA enrollment · @{state.user.username}
        </div>

        {step === 'scan' && (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--t3)', marginBottom: 14 }}>
              Ask the user to open their authenticator (Authy, Google Authenticator, Microsoft Authenticator, 1Password, Duo, FreeOTP, Bitwarden…) and scan this QR code.
              They can also tap "Add manually" and paste the secret below.
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
              <div style={{ width: 200, height: 200, background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {qrUrl
                  ? <img src={qrUrl} alt="MFA QR code" style={{ width: 196, height: 196, display: 'block' }} />
                  : <span style={{ fontSize: 12, color: '#666' }}>Loading QR…</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Secret (manual entry)</label>
                <input style={{ ...input, marginBottom: 10, fontFamily: 'ui-monospace,monospace', wordBreak: 'break-all' }} value={state.secret} readOnly onFocus={(e) => e.currentTarget.select()} />
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>otpauth URL</label>
                <input style={{ ...input, fontFamily: 'ui-monospace,monospace', fontSize: 11 }} value={state.otpauthUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn size="sm" variant="primary" onClick={() => setStep('verify')}>I've scanned it — next</Btn>
            </div>
          </>
        )}

        {step === 'verify' && (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--t3)', marginBottom: 14 }}>
              Enter the 6-digit code currently displayed in the user's authenticator app to prove the secret was added correctly. MFA becomes active only after a successful verification.
            </div>
            {err && <div style={{ color: 'var(--err)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
            <input
              style={{ ...input, marginBottom: 14, fontFamily: 'ui-monospace,monospace', fontSize: 22, letterSpacing: 6, textAlign: 'center', padding: '12px 10px' }}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={(e) => { if (e.key === 'Enter') verify(); }}
              placeholder="123456"
              inputMode="numeric"
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Btn size="sm" variant="ghost" onClick={() => setStep('scan')}>← Back</Btn>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
                <Btn size="sm" variant="primary" disabled={busy || code.length < 6} onClick={verify}>
                  {busy ? 'Verifying…' : 'Verify & activate'}
                </Btn>
              </div>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div style={{ fontSize: 13.5, color: 'var(--ok)', marginBottom: 12 }}>
              ✓ MFA is now active. The user will be asked for a code on every sign-in.
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--t3)', marginBottom: 8 }}>
              Hand these one-time backup codes to the user in a secure channel. They will not be shown again. Each is consumed on use.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, marginBottom: 14, fontFamily: 'ui-monospace,monospace', fontSize: 13 }}>
              {state.codes.map((c) => <div key={c} style={{ padding: 8, background: 'var(--bg-hover)', border: '1px solid var(--bd)', borderRadius: 6, textAlign: 'center' }}>{c}</div>)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn size="sm" variant="outline" onClick={() => {
                navigator.clipboard?.writeText(state.codes.join('\n')).catch(() => {});
              }}>Copy codes</Btn>
              <Btn size="sm" variant="primary" onClick={onConfirmed}>Done</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Admin roles (RBAC) ──────────────────────────────────── */
function RolesTab() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([adm.listAdminRoles(), adm.listPermissionCatalog()])
      .then(([r, c]) => { setRoles(r); setCatalog(c); })
      .catch(() => { setRoles([]); setCatalog([]); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 12.5, color: 'var(--t3)', flex: 1 }}>System roles cannot be deleted. Custom roles select permissions from the catalog below.</div>
        <Btn size="sm" variant="primary" onClick={() => setCreating(true)}><Ic.Plus s={13} /> New role</Btn>
      </div>
      {loading && <div style={{ color: 'var(--t3)' }}>Loading…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
        {roles.map((r) => (
          <div key={r.id} style={{ ...card, cursor: 'pointer' }} onClick={() => setEditing(r)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ic.User s={16} c="var(--primary)" />
              <div style={{ fontWeight: 700, color: 'var(--t1)', flex: 1 }}>{r.name}</div>
              {r.systemRole && <Badge variant="muted">SYSTEM</Badge>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 8 }}>{r.description || '—'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--t2)' }}>{r.permissions.length} permission{r.permissions.length === 1 ? '' : 's'}</div>
          </div>
        ))}
      </div>
      {(creating || editing) && (
        <RoleEditor role={editing || undefined} catalog={catalog}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }} />
      )}
    </div>
  );
}

function RoleEditor({ role, catalog, onClose, onSaved }: { role?: AdminRole; catalog: PermissionCatalogEntry[]; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!role;
  const [name, setName] = useState(role?.name || '');
  const [desc, setDesc] = useState(role?.description || '');
  const [perms, setPerms] = useState<Set<string>>(new Set(role?.permissions || []));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const m: Record<string, PermissionCatalogEntry[]> = {};
    catalog.forEach((c) => { (m[c.category] = m[c.category] || []).push(c); });
    return m;
  }, [catalog]);
  const toggle = (k: string) => {
    const n = new Set(perms);
    n.has(k) ? n.delete(k) : n.add(k);
    setPerms(n);
  };
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try {
      if (isEdit) await adm.updateAdminRole(role!.id, { description: desc, permissions: [...perms] });
      else await adm.createAdminRole({ name, description: desc, permissions: [...perms] });
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!role || role.systemRole) return;
    if (!confirm(`Delete role "${role.name}"?`)) return;
    try { await adm.deleteAdminRole(role.id); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Delete failed'); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,.5)' }} onClick={onClose}>
      <div className="il-slide-l" onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '94vw', height: '100vh', background: 'var(--bg-base)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Ic.User s={18} c="var(--primary)" />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', flex: 1 }}>{isEdit ? `Edit role · ${role!.name}` : 'New custom admin role'}</div>
          <Btn size="icon-sm" variant="ghost" onClick={onClose}><Ic.X s={15} /></Btn>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {err && <div style={{ color: 'var(--err)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
          {!isEdit && (<>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Role name (uppercase, e.g. HELPDESK_ADMIN)</label>
            <input style={{ ...input, marginBottom: 10 }} value={name} onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z_]/g, ''))} />
          </>)}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase' }}>Description</label>
          <input style={{ ...input, marginBottom: 14 }} value={desc} onChange={(e) => setDesc(e.target.value)} />

          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>{cat}</div>
              {items.map((p) => (
                <label key={p.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--bd)' }}>
                  <input type="checkbox" checked={perms.has(p.key)} onChange={() => toggle(p.key)} style={{ marginTop: 3 }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontFamily: 'ui-monospace,monospace', color: 'var(--t1)' }}>{p.key}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>{p.description}</div>
                  </div>
                </label>
              ))}
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
            <div>{isEdit && !role!.systemRole && <Btn size="sm" variant="danger" onClick={remove}>Delete</Btn>}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn size="sm" variant="primary" disabled={busy || (!isEdit && !name.trim())} onClick={save}>{busy ? 'Saving…' : isEdit ? 'Save' : 'Create role'}</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Generic CRUD table for compliance entities ─────────── */
function PolicyList<T extends { id: number; name: string; description?: string }>({
  title, items, onNew, onEdit, fields, loading,
}: {
  title: string;
  items: T[];
  onNew: () => void;
  onEdit: (item: T) => void;
  fields: (item: T) => { label: string; value: string }[];
  loading: boolean;
}) {
  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, fontSize: 12.5, color: 'var(--t3)' }}>{items.length} {title}</div>
        <Btn size="sm" variant="primary" onClick={onNew}><Ic.Plus s={13} /> New</Btn>
      </div>
      {loading && <div style={{ color: 'var(--t3)' }}>Loading…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
        {items.map((it) => (
          <div key={it.id} style={{ ...card, cursor: 'pointer' }} onClick={() => onEdit(it)}>
            <div style={{ fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>{it.name}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 8 }}>{it.description || '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {fields(it).map((f) => <span key={f.label}>{f.label}: {f.value}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Conditional access ──────────────────────────────────── */
function CaTab() {
  const [list, setList] = useState<ConditionalAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ConditionalAccess | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => { setLoading(true); adm.listCa().then(setList).catch(() => setList([])).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <PolicyList title="conditional-access policies" items={list} loading={loading}
        onNew={() => setCreating(true)} onEdit={(it) => setEditing(it)}
        fields={(p) => [
          { label: 'State', value: p.state },
          { label: 'MFA', value: p.requireMfa ? 'required' : 'off' },
          { label: 'Block legacy', value: p.blockLegacyAuth ? 'on' : 'off' },
          { label: 'Session', value: p.sessionMinutes + 'm' },
        ]} />
      {(creating || editing) && <CaEditor policy={editing || undefined} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />}
    </>
  );
}
function CaEditor({ policy, onClose, onSaved }: { policy?: ConditionalAccess; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!policy;
  const [form, setForm] = useState<Partial<ConditionalAccess> & { name: string }>(
    policy ?? { name: '', description: '', state: 'REPORT_ONLY', trustedIpRanges: '', blockAction: false, requireMfa: true, blockLegacyAuth: true, sessionMinutes: 60 }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try { isEdit ? await adm.updateCa(policy!.id, form) : await adm.createCa(form); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };
  const remove = async () => { if (!policy) return; if (!confirm('Delete policy?')) return; await adm.deleteCa(policy.id); onSaved(); };
  return (
    <PolicyDrawer title={isEdit ? `Edit · ${policy!.name}` : 'New conditional-access policy'} onClose={onClose} onSave={save} onDelete={isEdit ? remove : undefined} busy={busy} err={err} canSave={!!form.name}>
      <Field label="Name"><input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Description"><input style={input} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label="State"><select style={select} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value as ConditionalAccess['state'] })}>
        <option value="REPORT_ONLY">Report only</option><option value="ENFORCED">Enforced</option><option value="DISABLED">Disabled</option>
      </select></Field>
      <Field label="Trusted IP ranges (CIDR, comma)"><input style={input} value={form.trustedIpRanges || ''} onChange={(e) => setForm({ ...form, trustedIpRanges: e.target.value })} placeholder="10.0.0.0/8, 192.168.1.0/24" /></Field>
      <Field label="Session minutes"><input type="number" style={input} value={form.sessionMinutes ?? 60} onChange={(e) => setForm({ ...form, sessionMinutes: Number(e.target.value) })} /></Field>
      <Toggle label="Require MFA" value={!!form.requireMfa} onChange={(v) => setForm({ ...form, requireMfa: v })} />
      <Toggle label="Block legacy auth" value={!!form.blockLegacyAuth} onChange={(v) => setForm({ ...form, blockLegacyAuth: v })} />
      <Toggle label="Block on match (vs allow)" value={!!form.blockAction} onChange={(v) => setForm({ ...form, blockAction: v })} />
    </PolicyDrawer>
  );
}

/* ── DLP ─────────────────────────────────────────────────── */
function DlpTab() {
  const [list, setList] = useState<Dlp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Dlp | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => { setLoading(true); adm.listDlp().then(setList).catch(() => setList([])).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <PolicyList title="DLP policies" items={list} loading={loading}
        onNew={() => setCreating(true)} onEdit={(it) => setEditing(it)}
        fields={(p) => [
          { label: 'Action', value: p.action }, { label: 'Scope', value: p.scope },
          { label: 'External', value: p.appliesToExternal ? 'on' : 'off' },
          { label: 'Internal', value: p.appliesToInternal ? 'on' : 'off' },
        ]} />
      {(creating || editing) && <DlpEditor policy={editing || undefined} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />}
    </>
  );
}
function DlpEditor({ policy, onClose, onSaved }: { policy?: Dlp; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!policy;
  const [form, setForm] = useState<Partial<Dlp> & { name: string }>(
    policy ?? { name: '', description: '', action: 'WARN', detectors: 'CREDIT_CARD,SSN', scope: 'BOTH', appliesToExternal: true, appliesToInternal: false, active: true }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try { isEdit ? await adm.updateDlp(policy!.id, form) : await adm.createDlp(form); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };
  const remove = async () => { if (!policy) return; if (!confirm('Delete policy?')) return; await adm.deleteDlp(policy.id); onSaved(); };
  return (
    <PolicyDrawer title={isEdit ? `Edit DLP · ${policy!.name}` : 'New DLP policy'} onClose={onClose} onSave={save} onDelete={isEdit ? remove : undefined} busy={busy} err={err} canSave={!!form.name}>
      <Field label="Name"><input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Description"><input style={input} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label="Action"><select style={select} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as Dlp['action'] })}>
        <option value="AUDIT">Audit only</option><option value="WARN">Warn user</option><option value="BLOCK">Block</option><option value="TOMBSTONE">Tombstone</option>
      </select></Field>
      <Field label="Scope"><select style={select} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as Dlp['scope'] })}>
        <option value="BOTH">Chats &amp; files</option><option value="CHATS">Chats only</option><option value="FILES">Files only</option>
      </select></Field>
      <Field label="Detectors (CSV; e.g. CREDIT_CARD, SSN, EMAIL, REGEX:^PROJ-\\d+)">
        <textarea style={{ ...input, minHeight: 70, fontFamily: 'ui-monospace,monospace', fontSize: 12 }} value={form.detectors || ''} onChange={(e) => setForm({ ...form, detectors: e.target.value })} />
      </Field>
      <Toggle label="Apply to external recipients" value={!!form.appliesToExternal} onChange={(v) => setForm({ ...form, appliesToExternal: v })} />
      <Toggle label="Apply to internal recipients" value={!!form.appliesToInternal} onChange={(v) => setForm({ ...form, appliesToInternal: v })} />
      <Toggle label="Active" value={!!form.active} onChange={(v) => setForm({ ...form, active: v })} />
    </PolicyDrawer>
  );
}

/* ── Sensitivity labels ──────────────────────────────────── */
function LabelsTab() {
  const [list, setList] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Label | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => { setLoading(true); adm.listLabels().then(setList).catch(() => setList([])).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <PolicyList title="sensitivity labels" items={list} loading={loading}
        onNew={() => setCreating(true)} onEdit={(it) => setEditing(it)}
        fields={(l) => [
          { label: 'Priority', value: String(l.priority) },
          { label: 'Encryption', value: l.requiresEncryption ? 'required' : 'off' },
          { label: 'Color', value: l.color || '—' },
          { label: 'Watermark', value: l.watermarkText ? 'set' : '—' },
        ]} />
      {(creating || editing) && <LabelEditor label={editing || undefined} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />}
    </>
  );
}
function LabelEditor({ label, onClose, onSaved }: { label?: Label; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!label;
  const [form, setForm] = useState<Partial<Label> & { name: string }>(
    label ?? { name: '', description: '', color: '#f59e0b', priority: 50, requiresEncryption: false, watermarkText: '' }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try { isEdit ? await adm.updateLabel(label!.id, form) : await adm.createLabel(form); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };
  const remove = async () => { if (!label) return; if (!confirm('Delete label?')) return; await adm.deleteLabel(label.id); onSaved(); };
  return (
    <PolicyDrawer title={isEdit ? `Edit label · ${label!.name}` : 'New sensitivity label'} onClose={onClose} onSave={save} onDelete={isEdit ? remove : undefined} busy={busy} err={err} canSave={!!form.name}>
      <Field label="Name"><input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Description"><input style={input} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label="Color"><input style={input} value={form.color || ''} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="#f59e0b" /></Field>
      <Field label="Priority (0 public · 100 top-secret)"><input type="number" style={input} value={form.priority ?? 50} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></Field>
      <Field label="Watermark text"><input style={input} value={form.watermarkText || ''} onChange={(e) => setForm({ ...form, watermarkText: e.target.value })} /></Field>
      <Toggle label="Requires encryption" value={!!form.requiresEncryption} onChange={(v) => setForm({ ...form, requiresEncryption: v })} />
    </PolicyDrawer>
  );
}

/* ── Information barriers ────────────────────────────────── */
function BarriersTab() {
  const [list, setList] = useState<Barrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Barrier | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => { setLoading(true); adm.listBarriers().then(setList).catch(() => setList([])).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <PolicyList title="information barriers" items={list} loading={loading}
        onNew={() => setCreating(true)} onEdit={(it) => setEditing(it)}
        fields={(b) => [
          { label: 'Type', value: b.segmentType },
          { label: 'A', value: b.segmentA }, { label: 'B', value: b.segmentB },
          { label: 'Action', value: b.action },
        ]} />
      {(creating || editing) && <BarrierEditor barrier={editing || undefined} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />}
    </>
  );
}
function BarrierEditor({ barrier, onClose, onSaved }: { barrier?: Barrier; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!barrier;
  const [form, setForm] = useState<Partial<Barrier> & { name: string; segmentA: string; segmentB: string }>(
    barrier ?? { name: '', description: '', segmentType: 'DEPARTMENT', segmentA: '', segmentB: '', action: 'BLOCK', active: true }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try { isEdit ? await adm.updateBarrier(barrier!.id, form) : await adm.createBarrier(form); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };
  const remove = async () => { if (!barrier) return; if (!confirm('Delete barrier?')) return; await adm.deleteBarrier(barrier.id); onSaved(); };
  return (
    <PolicyDrawer title={isEdit ? `Edit barrier · ${barrier!.name}` : 'New information barrier'} onClose={onClose} onSave={save} onDelete={isEdit ? remove : undefined} busy={busy} err={err} canSave={!!form.name && !!form.segmentA && !!form.segmentB}>
      <Field label="Name"><input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Description"><input style={input} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label="Segment type"><select style={select} value={form.segmentType} onChange={(e) => setForm({ ...form, segmentType: e.target.value as Barrier['segmentType'] })}>
        <option value="DEPARTMENT">Department</option><option value="ROLE">Role</option>
      </select></Field>
      <Field label="Segment A"><input style={input} value={form.segmentA} onChange={(e) => setForm({ ...form, segmentA: e.target.value })} placeholder="Trading" /></Field>
      <Field label="Segment B"><input style={input} value={form.segmentB} onChange={(e) => setForm({ ...form, segmentB: e.target.value })} placeholder="Research" /></Field>
      <Field label="Action"><select style={select} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as Barrier['action'] })}>
        <option value="BLOCK">Block</option><option value="WARN">Warn</option>
      </select></Field>
      <Toggle label="Active" value={!!form.active} onChange={(v) => setForm({ ...form, active: v })} />
    </PolicyDrawer>
  );
}

/* ── Retention ───────────────────────────────────────────── */
function RetentionTab() {
  const [list, setList] = useState<Retention[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Retention | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => { setLoading(true); adm.listRetention().then(setList).catch(() => setList([])).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <PolicyList title="retention policies" items={list} loading={loading}
        onNew={() => setCreating(true)} onEdit={(it) => setEditing(it)}
        fields={(r) => [
          { label: 'Applies to', value: r.appliesTo },
          { label: 'Scope', value: r.scope },
          { label: 'Keep', value: r.retainDays + ' days' },
          { label: 'Then', value: r.afterAction },
        ]} />
      {(creating || editing) && <RetentionEditor pol={editing || undefined} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />}
    </>
  );
}
function RetentionEditor({ pol, onClose, onSaved }: { pol?: Retention; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!pol;
  const [form, setForm] = useState<Partial<Retention> & { name: string }>(
    pol ?? { name: '', description: '', appliesTo: 'BOTH', scope: 'ORG', retainDays: 365, afterAction: 'DELETE', active: true }
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try { isEdit ? await adm.updateRetention(pol!.id, form) : await adm.createRetention(form); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Save failed'); }
    finally { setBusy(false); }
  };
  const remove = async () => { if (!pol) return; if (!confirm('Delete policy?')) return; await adm.deleteRetention(pol.id); onSaved(); };
  return (
    <PolicyDrawer title={isEdit ? `Edit retention · ${pol!.name}` : 'New retention policy'} onClose={onClose} onSave={save} onDelete={isEdit ? remove : undefined} busy={busy} err={err} canSave={!!form.name}>
      <Field label="Name"><input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Description"><input style={input} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label="Applies to"><select style={select} value={form.appliesTo} onChange={(e) => setForm({ ...form, appliesTo: e.target.value as Retention['appliesTo'] })}>
        <option value="BOTH">Messages &amp; files</option><option value="MESSAGES">Messages only</option><option value="FILES">Files only</option>
      </select></Field>
      <Field label="Scope (ORG · TEAM:<id> · CHANNEL:<id>)"><input style={input} value={form.scope || 'ORG'} onChange={(e) => setForm({ ...form, scope: e.target.value })} /></Field>
      <Field label="Retain days"><input type="number" style={input} value={form.retainDays ?? 365} onChange={(e) => setForm({ ...form, retainDays: Number(e.target.value) })} /></Field>
      <Field label="After retention period"><select style={select} value={form.afterAction} onChange={(e) => setForm({ ...form, afterAction: e.target.value as Retention['afterAction'] })}>
        <option value="DELETE">Delete</option><option value="ARCHIVE">Archive</option><option value="LEGAL_HOLD">Legal hold</option>
      </select></Field>
      <Toggle label="Active" value={!!form.active} onChange={(v) => setForm({ ...form, active: v })} />
    </PolicyDrawer>
  );
}

/* ── Audit log viewer ────────────────────────────────────── */
function AuditTab() {
  const [filters, setFilters] = useState({ action: '', entityType: '', from: '', to: '' });
  const [page, setPage] = useState(0);
  const [data, setData] = useState<adm.PagedAudit | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adm.searchAudit({ ...filters, page, size: 50 })
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [filters, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const doExport = async () => {
    const blob = await adm.exportAuditCsv(filters);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audit-export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input style={{ ...input, flex: 1, minWidth: 160 }} placeholder="Action (e.g. CREATE_USER)" value={filters.action} onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(0); }} />
        <input style={{ ...input, flex: 1, minWidth: 140 }} placeholder="Entity (User / Team / Channel)" value={filters.entityType} onChange={(e) => { setFilters({ ...filters, entityType: e.target.value }); setPage(0); }} />
        <input style={{ ...input, width: 200 }} type="datetime-local" value={filters.from} onChange={(e) => { setFilters({ ...filters, from: e.target.value }); setPage(0); }} />
        <input style={{ ...input, width: 200 }} type="datetime-local" value={filters.to} onChange={(e) => { setFilters({ ...filters, to: e.target.value }); setPage(0); }} />
        <Btn size="sm" variant="outline" onClick={doExport}><Ic.ArrR s={13} /> Export CSV</Btn>
      </div>
      <div style={{ ...card, padding: 0, maxHeight: '70vh', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elv)' }}>
            <tr><th style={headCell}>When</th><th style={headCell}>Actor</th><th style={headCell}>Action</th><th style={headCell}>Entity</th><th style={headCell}>Details</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ ...cell, color: 'var(--t3)', textAlign: 'center', padding: 30 }}>Loading…</td></tr>}
            {!loading && data?.content.map((a: AuditEntry) => (
              <tr key={a.id}>
                <td style={{ ...cell, color: 'var(--t3)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(a.timestamp)}</td>
                <td style={cell}>{a.username || '—'}</td>
                <td style={cell}><Badge variant="dimmed">{a.action}</Badge></td>
                <td style={{ ...cell, color: 'var(--t2)' }}>{a.entityType}{a.entityId ? `#${a.entityId}` : ''}</td>
                <td style={{ ...cell, fontSize: 12.5, color: 'var(--t2)' }}>{a.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <Btn size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><Ic.ChevL s={13} /> Prev</Btn>
          <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>Page {data.page + 1} of {data.totalPages} · {data.totalElements} entries</span>
          <Btn size="sm" variant="outline" disabled={data.last} onClick={() => setPage((p) => p + 1)}>Next <Ic.ChevR s={13} /></Btn>
        </div>
      )}
    </div>
  );
}

/* ── eDiscovery ──────────────────────────────────────────── */
function EDiscoveryTab() {
  const [filters, setFilters] = useState({ keyword: '', from: '', to: '' });
  const [page, setPage] = useState(0);
  const [data, setData] = useState<adm.PagedEDiscovery | null>(null);
  const [loading, setLoading] = useState(false);
  const run = useCallback(async () => {
    setLoading(true);
    try { setData(await adm.eDiscovery({ ...filters, page, size: 50 })); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, [filters, page]);
  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>Privileged search across all channel messages. Every search is admin-only; results may include regulated content. Use responsibly.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input style={{ ...input, flex: 1, minWidth: 200 }} placeholder="Keyword (substring match)" value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} />
        <input style={{ ...input, width: 200 }} type="datetime-local" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <input style={{ ...input, width: 200 }} type="datetime-local" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        <Btn size="sm" variant="primary" onClick={() => { setPage(0); run(); }}>{loading ? 'Searching…' : 'Search'}</Btn>
      </div>
      {data && (
        <div style={{ ...card, padding: 0, maxHeight: '70vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elv)' }}>
              <tr><th style={headCell}>When</th><th style={headCell}>Sender</th><th style={headCell}>Channel</th><th style={headCell}>Content</th></tr>
            </thead>
            <tbody>
              {data.content.length === 0 && <tr><td colSpan={4} style={{ ...cell, color: 'var(--t3)', textAlign: 'center', padding: 30 }}>No matches.</td></tr>}
              {data.content.map((m: EDiscoveryResult) => (
                <tr key={m.messageId}>
                  <td style={{ ...cell, color: 'var(--t3)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(m.createdAt)}</td>
                  <td style={cell}>{m.senderUsername || '—'}</td>
                  <td style={{ ...cell, color: 'var(--t2)' }}>#{m.channelName || '—'}</td>
                  <td style={{ ...cell, fontSize: 12.5 }}>{m.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <Btn size="sm" variant="outline" disabled={page === 0} onClick={() => { setPage((p) => Math.max(0, p - 1)); setTimeout(run); }}><Ic.ChevL s={13} /> Prev</Btn>
          <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>Page {data.page + 1} of {data.totalPages} · {data.totalElements} matches</span>
          <Btn size="sm" variant="outline" disabled={data.last} onClick={() => { setPage((p) => p + 1); setTimeout(run); }}>Next <Ic.ChevR s={13} /></Btn>
        </div>
      )}
    </div>
  );
}

/* ── Shared form pieces ──────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--bd)' }}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
      <div>
        <div style={{ fontSize: 13, color: 'var(--t1)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--t3)' }}>{hint}</div>}
      </div>
    </label>
  );
}
function PolicyDrawer({ title, onClose, onSave, onDelete, busy, err, canSave, children }: {
  title: string; onClose: () => void; onSave: () => void; onDelete?: () => void;
  busy: boolean; err: string | null; canSave: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,.5)' }} onClick={onClose}>
      <div className="il-slide-l" onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '94vw', height: '100vh', background: 'var(--bg-base)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Ic.Shield s={18} c="var(--primary)" />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', flex: 1 }}>{title}</div>
          <Btn size="icon-sm" variant="ghost" onClick={onClose}><Ic.X s={15} /></Btn>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {err && <div style={{ color: 'var(--err)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
          {children}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
            <div>{onDelete && <Btn size="sm" variant="danger" onClick={onDelete}>Delete</Btn>}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn size="sm" variant="primary" disabled={busy || !canSave} onClick={onSave}>{busy ? 'Saving…' : 'Save'}</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
