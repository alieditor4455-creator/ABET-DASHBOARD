import { useEffect, useRef, useState } from 'react';
import { useStore } from '../data/store';
import { friendlyError } from '../data/api';
import { Icon } from './Icon';
import { Avatar, Chip, Empty, Modal, Notice, PasswordInput } from './ui';
import { ago, fmtDateTime } from '../lib/format';
import { linkProps, navigate } from '../lib/router';
import type { Comment, MfaFactor } from '../lib/types';

/* ---------------------------------------------------------------- notification bell */
export function NotificationBell() {
  const { data, api, refresh, can } = useStore();
  const [open, setOpen] = useState(false);
  const admin = can('team.manage');
  const [tab, setTab] = useState<'mine' | 'team'>('mine');
  const ref = useRef<HTMLDivElement>(null);
  const all = data?.notifications ?? [];
  const mine = all.filter((n) => n.kind !== 'team');
  const team = all.filter((n) => n.kind === 'team');
  const list = admin && tab === 'team' ? team : admin ? mine : all;
  const unread = all.filter((n) => !n.read_at).length;
  const unreadMine = mine.filter((n) => !n.read_at).length;
  const unreadTeam = team.filter((n) => !n.read_at).length;
  const listUnread = list.filter((n) => !n.read_at);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const go = async (id: number, itemId: string | null) => {
    setOpen(false);
    await api.markNotificationsRead([id]).catch(() => {});
    refresh();
    if (itemId) navigate(`/studio/${itemId}`);
  };
  const markShown = async () => { await api.markNotificationsRead(listUnread.map((n) => n.id)).catch(() => {}); refresh(); };
  const icon = (k: string) => (k === 'review' ? 'eye' : k === 'approved' ? 'checkc' : k === 'comment' ? 'edit' : k === 'script' ? 'sparkles' : k === 'compliance' ? 'shield' : k === 'team' ? 'users' : 'bell');
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="circle-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="bell" />{unread > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="pop" role="dialog" aria-label="Notifications">
          <div className="panel-h" style={{ paddingBottom: 8 }}><h3>Notifications</h3>
            <span className="r">{listUnread.length > 0 && <button className="link" onClick={markShown}>Mark all read</button>}</span></div>
          {admin && (
            <div className="seg" role="tablist" aria-label="Notification type" style={{ margin: '0 16px 8px', display: 'flex' }}>
              <button type="button" role="tab" aria-selected={tab === 'mine'} aria-pressed={tab === 'mine'} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setTab('mine')}>For you{unreadMine ? ` · ${unreadMine}` : ''}</button>
              <button type="button" role="tab" aria-selected={tab === 'team'} aria-pressed={tab === 'team'} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setTab('team')}>Team activity{unreadTeam ? ` · ${unreadTeam}` : ''}</button>
            </div>
          )}
          <div className="feed" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {list.length ? list.map((n) => (
              <button key={n.id} className="fi" style={{ width: '100%', textAlign: 'left', opacity: n.read_at ? 0.6 : 1 }} onClick={() => go(n.id, n.item_id)}>
                <span className="agent"><Icon name={icon(n.kind)} /></span>
                <span className="body">{!n.read_at && <b style={{ color: 'var(--brand-ink)' }}>● </b>}{n.message}<span className="when" style={{ display: 'block' }}>{ago(n.created_at)}</span></span>
              </button>
            )) : admin && tab === 'team'
              ? <Empty title="No team activity yet">Sign-ups, sign-ins and what the team does show up here.</Empty>
              : <Empty title="You’re all caught up">Reviews, approvals, comments and scripts from Claude show up here.</Empty>}
          </div>
          {admin && tab === 'team' && <div style={{ padding: '8px 16px 14px', borderTop: '1px solid var(--border)' }}><a className="link" {...linkProps('/admin?tab=activity')} onClick={() => setOpen(false)}>View full activity log <Icon name="arrowR" size={14} /></a></div>}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- comments */
export function Comments({ itemId }: { itemId: string }) {
  const { api, data, run } = useStore();
  const [list, setList] = useState<Comment[] | null>(null);
  const [body, setBody] = useState('');
  const load = () => api.listComments(itemId).then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps
  const person = (id: string) => data?.profiles.find((p) => p.id === id);
  const send = async () => {
    if (!body.trim()) return;
    const ok = await run(() => api.addComment(itemId, body), 'Comment added');
    if (ok !== undefined) { setBody(''); load(); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {list === null ? <span className="muted" style={{ fontSize: 12.5 }}>Loading…</span>
        : list.length ? list.map((c) => (
          <div key={c.id} className="fi" style={{ padding: 0 }}>
            <Avatar profile={person(c.author_id)} />
            <div className="body"><b>{person(c.author_id)?.full_name ?? 'Someone'}</b>{c.via === 'claude' ? ' (via Claude)' : ''}<div style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>{c.body}</div><div className="when">{ago(c.created_at)}</div></div>
          </div>))
        : <span className="muted" style={{ fontSize: 12.5 }}>No comments yet.</span>}
      <textarea className="textarea" rows={2} placeholder="Write a comment…" value={body} onChange={(e) => setBody(e.target.value)} aria-label="New comment"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }} />
      <button className="btn sm" style={{ alignSelf: 'flex-end' }} disabled={!body.trim()} onClick={send}><Icon name="send" size={16} />Comment</button>
    </div>
  );
}

/* ---------------------------------------------------------------- two-step login challenge */
export function MfaChallenge({ factorId }: { factorId: string }) {
  const { api, refresh } = useStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.mfaVerify(factorId, code); await refresh(); } catch (x) { setErr(friendlyError(x)); setBusy(false); }
  };
  return (
    <div className="login-wrap">
      <form className="panel login" onSubmit={submit}>
        <span className="stat-ico hl"><Icon name="lock" /></span>
        <div><h1 style={{ fontSize: 22 }}>Enter your login code</h1><p className="muted" style={{ marginTop: 4, fontSize: 13 }}>Open your authenticator app and enter the 6-digit code for ABET Content OS.</p></div>
        <div className="field"><label htmlFor="otp">6-digit code</label>
          <input id="otp" className="input" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} style={{ fontSize: 20, letterSpacing: '.2em', textAlign: 'center' }} /></div>
        {err && <Notice kind="err" icon="alert">{err}</Notice>}
        <button className="btn primary" style={{ height: 44 }} disabled={busy || code.replace(/\s/g, '').length < 6}>{busy && <Icon name="loader" spin size={16} />}Verify</button>
        <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => api.signOut()}>Sign out</button>
        <p className="muted" style={{ fontSize: 12 }}>Lost your phone? Ask an ABET admin to reset your two-step login.</p>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- account & security */
export function AccountModal({ onClose }: { onClose: () => void }) {
  const { api, profile, run, toast } = useStore();
  const [factors, setFactors] = useState<MfaFactor[] | null>(null);
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [conns, setConns] = useState<{ connected_at: string; client_id: string | null }[]>([]);
  const [confirmOut, setConfirmOut] = useState(false);
  const load = async () => {
    const s = await api.mfaStatus().catch(() => ({ factors: [] as MfaFactor[] }));
    setFactors(s.factors.filter((f) => f.status === 'verified'));
    setConns(await api.claudeConnections().catch(() => []));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const on = (factors?.length ?? 0) > 0;

  return (
    <Modal title="Account & security" onClose={onClose} wide>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Avatar profile={profile} lg /><div><b>{profile?.full_name}</b><div className="muted" style={{ fontSize: 12.5 }}>Signed in to ABET Content OS</div></div></div>

      <ChangePassword />
      <section className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="lock" /><h3>Two-step login</h3><span style={{ marginLeft: 'auto' }}>{factors === null ? null : on ? <Chip cls="st-ok">On</Chip> : <Chip cls="st-warn">Off</Chip>}</span></div>
        <p style={{ fontSize: 13, color: 'var(--text-2)' }}>After your password, you enter a 6-digit code from an app on your phone (Google Authenticator, Microsoft Authenticator or 1Password). A stolen password alone can’t open your account. Strongly recommended for admins.</p>
        {!on && !enroll && <button className="btn primary sm" style={{ alignSelf: 'flex-start' }} onClick={async () => { try { setEnroll(await api.mfaEnroll()); } catch (e) { toast(friendlyError(e), 'alert'); } }}><Icon name="lock" size={16} />Turn on two-step login</button>}
        {enroll && (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
            <img src={enroll.qr} alt="QR code for your authenticator app" style={{ width: 168, height: 168, background: '#fff', borderRadius: 8, padding: 6 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-2)' }}><li>Open your authenticator app and scan this code.</li><li>Enter the 6-digit code it shows.</li></ol>
              <span className="muted" style={{ fontSize: 11.5, wordBreak: 'break-all' }}>Can’t scan? Enter this key: <code>{enroll.secret}</code></span>
              <div style={{ display: 'flex', gap: 8 }}><input className="input" inputMode="numeric" maxLength={7} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} aria-label="6-digit code" style={{ maxWidth: 160 }} />
                <button className="btn primary" disabled={code.replace(/\s/g, '').length < 6} onClick={async () => { const r = await run(() => api.mfaVerify(enroll.factorId, code), 'Two-step login is on'); if (r !== undefined) { setEnroll(null); setCode(''); load(); } }}>Confirm</button></div>
            </div>
          </div>
        )}
        {on && <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={async () => { for (const f of factors!) await run(() => api.mfaRemove(f.id)); toast('Two-step login is off'); load(); }}>Turn off</button>}
      </section>

      <section className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="sparkles" /><h3>Claude connections</h3></div>
        {conns.length ? conns.map((c, i) => <div key={i} className="handle"><Icon name="sparkles" size={16} /><span>Claude connected {fmtDateTime(c.connected_at)}</span></div>)
          : <p className="muted" style={{ fontSize: 13 }}>You haven’t connected Claude yet.</p>}
        <p style={{ fontSize: 12.5, color: 'var(--text-2)' }}>To disconnect Claude, or if you think someone else is signed in as you, sign out everywhere else. You stay signed in on this device; Claude asks you to connect again.</p>
        {!confirmOut ? <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmOut(true)}><Icon name="logout" size={16} />Sign out everywhere else</button>
          : <div style={{ display: 'flex', gap: 8 }}><button className="btn sm" onClick={() => setConfirmOut(false)}>Cancel</button><button className="btn sm primary" onClick={async () => { await run(() => api.signOutOthers(), 'Signed out everywhere else. Claude is disconnected'); setConfirmOut(false); }}>Yes, sign out other sessions</button></div>}
      </section>
    </Modal>
  );
}

/** Lets a signed-in person set a new password (e.g. after an admin gave them a temporary one). */
function ChangePassword() {
  const { api, run } = useStore();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const strong = pw.length >= 10 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
  const same = pw === pw2;
  return (
    <section className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="key" /><h3>Change password</h3></div>
      <div className="field"><label htmlFor="npw">New password</label><PasswordInput id="npw" className="input" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      <div className="field"><label htmlFor="npw2">Type it again</label><PasswordInput id="npw2" className="input" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
      <span className="muted" style={{ fontSize: 12 }}>{pw && !strong ? 'At least 10 characters, with letters and numbers.' : pw2 && !same ? 'The two passwords don’t match.' : 'Use at least 10 characters, with letters and numbers.'}</span>
      <button className="btn primary sm" style={{ alignSelf: 'flex-start' }} disabled={!strong || !same}
        onClick={async () => { const r = await run(() => api.changePassword(pw), 'Password changed'); if (r !== undefined) { setPw(''); setPw2(''); } }}>Save new password</button>
    </section>
  );
}
