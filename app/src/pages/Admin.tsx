import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { Icon } from '../components/Icon';
import { Avatar, Chip, Empty, Modal, Notice, Panel, Switch } from '../components/ui';
import { HANDLES, PERM_LABEL, PLAT, PLAT_KEYS, ROLES, ROLE_LABEL, ROLE_PERMS, TYPES, TYPE_KEYS } from '../lib/constants';
import { ago } from '../lib/format';
import { linkProps, navigate } from '../lib/router';
import type { Activity, Permission, Role } from '../lib/types';

const TABS = [['team', 'Team', 'users'], ['activity', 'Activity', 'clock'], ['roles', 'Roles & permissions', 'lock'], ['social', 'Social connections', 'at'], ['brand', 'Brand assets', 'brand'], ['styles', 'Creative styles', 'palette'], ['storage', 'Storage', 'drive'], ['backup', 'Backup', 'download'], ['auto', 'Automation', 'zap']] as const;

export function Admin({ params }: { params: URLSearchParams }) {
  const { can } = useStore();
  const tab = (params.get('tab') ?? 'team') as (typeof TABS)[number][0];
  if (!can('team.manage')) return <div className="page"><Empty icon="lock" title="Admins only">Ask an admin if you need to change workspace settings.</Empty></div>;
  return (
    <div className="page">
      <div className="page-head"><div><h1>Admin Panel</h1><p className="lead">Workspace settings. Only admins see this page.</p></div></div>
      <div className="admin">
        <nav className="panel subnav" aria-label="Admin sections">{TABS.map(([k, l, i]) => <a key={k} className="sb-link" style={{ height: 38 }} aria-current={tab === k} {...linkProps(`/admin?tab=${k}`)}><Icon name={i} size={16} />{l}</a>)}</nav>
        <div style={{ minWidth: 0 }}>{tab === 'team' ? <Team /> : tab === 'activity' ? <ActivityLog /> : tab === 'roles' ? <Roles /> : tab === 'social' ? <Social /> : tab === 'brand' ? <BrandAssets /> : tab === 'styles' ? <StyleAdmin /> : tab === 'storage' ? <Storage /> : tab === 'backup' ? <Backup /> : <Automation />}</div>
      </div>
    </div>
  );
}

function Team() {
  const { data, api, run, profile } = useStore();
  const [invite, setInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('scriptwriter');
  const [remove, setRemove] = useState<string | null>(null);
  if (!data) return null;
  const pending = data.profiles.filter((p) => !p.active);
  const members = data.profiles.filter((p) => p.active);
  const isSuper = profile?.role === 'super_admin';
  const roleOptions = ROLES.filter((r) => r !== 'super_admin' || isSuper);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {pending.length > 0 && (
        <Panel icon="clock" title={`Waiting for approval (${pending.length})`}>
          {pending.map((p) => (
            <div key={p.id} className="setting"><Avatar profile={p} /><div className="st-t"><b>{p.full_name}</b><span>Signed up without an invitation, or access was removed</span></div>
              <button className="btn sm primary" onClick={() => run(() => api.updateProfile(p.id, { active: true }), `${p.full_name} can now sign in as a Viewer`)}>Approve as Viewer</button></div>
          ))}
        </Panel>
      )}
      <Panel icon="users" title="Team" right={<button className="btn sm primary" onClick={() => setInvite(true)}><Icon name="userplus" size={16} />Invite</button>} bodyClass="">
        <div className="list" style={{ marginTop: 12 }}><table className="tbl"><thead><tr><th>Member</th><th>Role</th><th>Active items</th><th /></tr></thead><tbody>
          {members.map((p) => (
            <tr key={p.id}>
              <td><span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}><Avatar profile={p} />{p.full_name}{p.id === profile?.id && <span className="muted">(you)</span>}</span></td>
              <td><select className="select sm" value={p.role} disabled={p.id === profile?.id || (p.role === 'super_admin' && !isSuper)} aria-label={`Role for ${p.full_name}`}
                onChange={(e) => run(() => api.updateProfile(p.id, { role: e.target.value as Role }), `${p.full_name} is now ${ROLE_LABEL[e.target.value as Role]}`)}>
                {(p.role === 'super_admin' ? ROLES : roleOptions).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
              <td className="num">{data.items.filter((i) => i.owner_id === p.id && i.status !== 'completed').length}</td>
              <td style={{ textAlign: 'right' }}>{p.id !== profile?.id && <button className="btn sm ghost" onClick={() => setRemove(p.id)}>Remove</button>}</td>
            </tr>
          ))}
        </tbody></table></div>
      </Panel>
      {data.invitations.length > 0 && (
        <Panel icon="mail" title="Invitations">
          {data.invitations.map((i) => (
            <div key={i.email} className="setting"><Icon name="mail" /><div className="st-t"><b>{i.email}</b><span>{ROLE_LABEL[i.role]} · {i.accepted_at ? `joined ${ago(i.accepted_at)}` : `invited ${ago(i.created_at)}`}</span></div>
              {!i.accepted_at && <button className="btn sm ghost" onClick={() => run(() => api.revokeInvite(i.email), 'Invitation cancelled')}>Cancel</button>}</div>
          ))}
        </Panel>
      )}
      {invite && (
        <Modal title="Invite a team member" onClose={() => setInvite(false)} footer={<><button className="btn" onClick={() => setInvite(false)}>Cancel</button>
          <button className="btn primary" disabled={!/^\S+@\S+\.\S+$/.test(email)} onClick={async () => { const r = await run(() => api.invite(email, role), 'Invitation saved'); if (r !== undefined) { setInvite(false); setEmail(''); } }}><Icon name="check" />Save invitation</button></>}>
          <div className="field"><label htmlFor="ie">Email</label><input id="ie" className="input" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@abetglobal.com" /></div>
          <div className="field"><label htmlFor="ir">Role</label><select id="ir" className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>{roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
          <Notice>Then send them the dashboard link. When they create an account with this email, they get this role straight away.</Notice>
        </Modal>
      )}
      {remove && (
        <Modal title={`Remove ${data.profiles.find((p) => p.id === remove)?.full_name}?`} onClose={() => setRemove(null)} footer={<><button className="btn" onClick={() => setRemove(null)}>Cancel</button><button className="btn primary" onClick={async () => { await run(() => api.updateProfile(remove, { active: false }), 'Access removed'); setRemove(null); }}>Remove access</button></>}>
          <p style={{ color: 'var(--text-2)' }}>They won’t be able to sign in or see any content. Their work stays in the workspace, and you can restore access later.</p>
        </Modal>
      )}
    </div>
  );
}

function Roles() {
  const perms = Object.keys(PERM_LABEL) as Permission[];
  return (
    <Panel icon="lock" title="Roles & permissions">
      <p className="muted" style={{ marginBottom: 12, fontSize: 12.5 }}>Enforced by the database for every action, including actions Claude takes through the connector.</p>
      <div className="list"><table className="tbl perm"><thead><tr><th>Permission</th>{ROLES.map((r) => <th key={r} title={ROLE_LABEL[r]}>{ROLE_LABEL[r].split(' ').map((w) => w[0]).join('')}</th>)}</tr></thead>
        <tbody>{perms.map((p) => <tr key={p}><td>{PERM_LABEL[p]}</td>{ROLES.map((r) => <td key={r} className={ROLE_PERMS[r].includes(p) ? 'y' : 'n'}>{ROLE_PERMS[r].includes(p) ? <Icon name="check" size={16} /> : '–'}</td>)}</tr>)}</tbody></table></div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>{ROLES.map((r) => `${ROLE_LABEL[r].split(' ').map((w) => w[0]).join('')} = ${ROLE_LABEL[r]}`).join(' · ')}</p>
    </Panel>
  );
}

function Social() {
  const { data, api, run, can } = useStore();
  if (!data) return null;
  return (
    <Panel icon="at" title="Social connections">
      {PLAT_KEYS.map((p) => { const s = data.social.find((x) => x.platform === p); return (
        <div key={p} className="setting"><span className="pl" style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 12 }}>{p}</span>
          <div className="st-t"><b>{PLAT[p]}</b><span>{HANDLES[p] ?? s?.handle}</span></div>
          <select className="select sm" value={s?.status ?? 'not_connected'} disabled={!can('settings.manage')} aria-label={`${PLAT[p]} status`} onChange={(e) => run(() => api.updateSocial(p, { status: e.target.value as 'not_connected' }), 'Saved')}>
            <option value="not_connected">Manual posting</option><option value="pending_review">Developer app in review</option><option value="connected">Connected</option></select></div>
      ); })}
      <div style={{ marginTop: 12 }}><Notice>Direct posting through each platform’s official API is the next phase. Track each platform’s developer approval here; the Publish step uses manual posting until then.</Notice></div>
    </Panel>
  );
}

function BrandAssets() {
  return (
    <Panel icon="brand" title="Brand assets">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: 'var(--text-2)' }}>The Brand Kit uses logos and colours taken from abetglobal.com. To replace them with official vector files, send them to Claude and they’ll be added to the app.</p>
        <a className="btn" style={{ alignSelf: 'flex-start' }} {...linkProps('/brand')}><Icon name="brand" />Open Brand Kit</a>
      </div>
    </Panel>
  );
}

function StyleAdmin() {
  const { data } = useStore();
  if (!data) return null;
  const live = (k: string) => data.styles.filter((s) => s.content_type === k && !s.archived);
  return (
    <Panel icon="palette" title="Creative styles" right={<a className="link" {...linkProps('/styles')}>Manage styles <Icon name="arrowR" /></a>} bodyClass="">
      <div className="list" style={{ marginTop: 12 }}><table className="tbl"><thead><tr><th>Category</th><th>Approved and active</th><th>In progress</th></tr></thead><tbody>
        {TYPE_KEYS.map((k) => <tr key={k} style={{ cursor: 'pointer' }} onClick={() => navigate(`/styles?category=${k}`)}><td>{TYPES[k].name}</td>
          <td className="num">{live(k).filter((s) => s.status === 'approved' && s.active).length}</td><td className="num">{live(k).filter((s) => s.status !== 'approved').length}</td></tr>)}
      </tbody></table></div>
    </Panel>
  );
}

function Storage() {
  const { data, api, run, can } = useStore();
  if (!data) return null;
  const s = data.settings;
  return (
    <Panel icon="drive" title="Storage">
      <div className="setting"><div className="st-t"><b>Storage limit shown to the team</b><span>The free Supabase plan includes 1 GB. Raise this only after upgrading.</span></div>
        <select className="select sm" value={s.storage_limit_gb} disabled={!can('team.manage')} aria-label="Storage limit" onChange={(e) => run(() => api.updateSettings({ storage_limit_gb: +e.target.value }), 'Saved')}>{[1, 8, 10, 50, 100].map((g) => <option key={g} value={g}>{g} GB</option>)}</select></div>
      <div className="setting"><div className="st-t"><b>Never delete files automatically</b><span>Always on. Archive hides a file but keeps it.</span></div><Switch id="nd" checked disabled label="Never delete files" /></div>
      <div className="setting"><div className="st-t"><b>Database backups</b><span>The free plan has no automatic backups. Supabase Pro ($25/month) adds daily backups.</span></div><Chip cls="st-warn">Not included</Chip></div>
    </Panel>
  );
}

const KIND_LABEL: Record<string, string> = { '': 'All activity', content: 'Content', signup: 'Sign-ups', signin: 'Sign-ins' };
const KIND_ICON: Record<string, string> = { content: 'edit', signup: 'userplus', signin: 'logout', team: 'users', style: 'palette', claude: 'sparkles' };

function ActivityLog() {
  const { api, data } = useStore();
  const [kind, setKind] = useState('');
  const [actor, setActor] = useState('');
  const [range, setRange] = useState('7');
  const [rows, setRows] = useState<Activity[] | null>(null);
  const [more, setMore] = useState(false);
  const since = range === 'all' ? undefined : new Date(Date.now() - Number(range) * 86400000).toISOString();
  const load = useCallback(async (before?: number) => {
    const r = await api.listActivity({ kind: kind || undefined, actorId: actor || undefined, since, before }).catch(() => []);
    setRows((old) => (before && old ? [...old, ...r] : r)); setMore(r.length === 100);
  }, [api, kind, actor, since]);
  useEffect(() => { setRows(null); load(); }, [load]);
  const people = data?.profiles ?? [];
  const who = (a: Activity) => people.find((p) => p.id === a.actor_id);
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  let lastDay = '';
  return (
    <Panel icon="clock" title="Team activity" right={<span className="muted" style={{ fontSize: 12.5 }}>Who signed up, signed in and what they did. Admins also get these in the bell.</span>}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="seg" role="group" aria-label="Type">{Object.entries(KIND_LABEL).map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}</div>
        <select className="select" style={{ width: 'auto', minWidth: 170 }} value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Person"><option value="">Everyone</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
        <select className="select" style={{ width: 'auto' }} value={range} onChange={(e) => setRange(e.target.value)} aria-label="Period"><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All time</option></select>
      </div>
      {rows === null ? <div className="writing"><div className="ln" style={{ width: '60%' }} /><div className="ln" style={{ width: '80%' }} /></div>
        : !rows.length ? <Empty icon="clock" title="Nothing here yet">No activity matches these filters.</Empty>
        : <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((a) => {
              const d = day(a.created_at); const head = d !== lastDay ? d : ''; lastDay = d;
              const p = who(a);
              return (
                <div key={a.id}>
                  {head && <div className="muted" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '14px 0 6px' }}>{head}</div>}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                    {p ? <Avatar profile={p} /> : <span className="ico"><Icon name={a.via === 'claude' ? 'sparkles' : 'users'} size={16} /></span>}
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>
                      <b style={{ fontWeight: 600 }}>{p?.full_name ?? (a.via === 'claude' ? 'Claude' : 'Someone')}</b> {a.message}
                      {a.item_id && <a className="link" style={{ marginLeft: 6, fontSize: 12.5 }} {...linkProps(`/studio/${a.item_id}`)}>Open</a>}
                    </div>
                    <Chip icon={KIND_ICON[a.kind ?? 'content'] ?? 'edit'}>{(a.kind ?? 'content') === 'content' ? (a.via === 'claude' ? 'Claude' : 'Content') : ({ signup: 'Sign-up', signin: 'Sign-in' } as Record<string, string>)[a.kind ?? ''] ?? a.kind}</Chip>
                    <span className="muted num" style={{ fontSize: 12, whiteSpace: 'nowrap' }} title={new Date(a.created_at).toLocaleString('en-GB')}>{ago(a.created_at)}</span>
                  </div>
                </div>
              );
            })}
            {more && <button className="btn sm" style={{ alignSelf: 'center', marginTop: 12 }} onClick={() => load(rows[rows.length - 1].id)}>Show older</button>}
          </div>}
    </Panel>
  );
}

function Backup() {
  const { data, api, run } = useStore();
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const last = data.settings.last_backup_at;
  const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
  const download = async () => {
    setBusy(true);
    const dump = await run(() => api.exportAll(), 'Backup downloaded');
    setBusy(false);
    if (!dump) return;
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `abet-content-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <Panel icon="download" title="Backup">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: 'var(--text-2)' }}>The free plan has no automatic backups. Download a full copy of the workspace (content, scripts, captions, comments, approvals, team and settings) once a week and keep it somewhere safe, such as ABET’s Google Drive.</p>
        <div className="setting"><div className="st-t"><b>Last backup</b><span>{last ? `${new Date(last).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} (${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`})` : 'Never'}</span></div>
          {days === null || days > 7 ? <Chip cls="st-warn">Due</Chip> : <Chip cls="st-ok">Up to date</Chip>}</div>
        <button className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={download}>{busy ? <Icon name="loader" spin size={16} /> : <Icon name="download" />}Download full backup</button>
        <Notice>Uploaded videos and images aren’t inside this file; they stay in storage, and the backup lists where each one is. Supabase Pro ($25/month) adds automatic daily backups of everything.</Notice>
      </div>
    </Panel>
  );
}

function Automation() {
  const { data, api, run, can } = useStore();
  if (!data) return null;
  const s = data.settings;
  const t = (k: 'auto_captions' | 'auto_calendar_suggestions' | 'notify_on_ready') => (v: boolean) => run(() => api.updateSettings({ [k]: v }), 'Saved');
  return (
    <Panel icon="zap" title="Automation">
      <div className="setting"><div className="st-t"><b>Prepare platform captions automatically</b><span>When content reaches the Publish step</span></div><Switch id="a1" checked={s.auto_captions} disabled={!can('team.manage')} onChange={t('auto_captions')} label="Auto captions" /></div>
      <div className="setting"><div className="st-t"><b>Show planning suggestions</b><span>On the Content Calendar</span></div><Switch id="a2" checked={s.auto_calendar_suggestions} disabled={!can('team.manage')} onChange={t('auto_calendar_suggestions')} label="Calendar suggestions" /></div>
      <div className="setting"><div className="st-t"><b>Require approval before publishing</b><span>Always on. Every post needs a person to approve it.</span></div><Switch id="a3" checked disabled label="Require approval" /></div>
    </Panel>
  );
}
