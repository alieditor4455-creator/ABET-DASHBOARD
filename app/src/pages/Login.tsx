import { useState } from 'react';
import { useStore } from '../data/store';
import { friendlyError } from '../data/api';
import { Icon } from '../components/Icon';
import { Notice } from '../components/ui';

export function Login() {
  const { api } = useStore();
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === 'in') await api.signIn(email, password);
      else if (mode === 'up') {
        if (password.length < 10 || !/[a-z]/i.test(password) || !/\d/.test(password)) throw new Error('Use at least 10 characters, with letters and numbers.');
        const r = await api.signUp(email, password, name.trim() || email.split('@')[0]);
        if (r.needsConfirm) setMsg({ kind: 'ok', text: `We sent a confirmation link to ${email}. Open it, then sign in here.` });
      } else {
        await api.resetPassword(email);
        setMsg({ kind: 'ok', text: `If ${email} has an account, a reset link is on its way.` });
      }
    } catch (err) { setMsg({ kind: 'err', text: friendlyError(err) }); }
    setBusy(false);
  };

  return (
    <div className="login-wrap">
      <form className="panel login" onSubmit={submit}>
        <img src="/brand/wordmark-dark.png" alt="ABET" className="login-logo on-light" />
        <img src="/brand/wordmark-white.png" alt="ABET" className="login-logo on-dark" />
        <div>
          <h1 style={{ fontSize: 22 }}>{mode === 'in' ? 'Sign in to Content OS' : mode === 'up' ? 'Create your account' : 'Reset your password'}</h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>{mode === 'up' ? 'Invited team members get access straight away. Others wait for an admin to approve them.' : 'ABET Global’s content workspace.'}</p>
        </div>
        {mode === 'up' && <div className="field"><label htmlFor="nm">Full name</label><input className="input" id="nm" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></div>}
        <div className="field"><label htmlFor="em">Work email</label><input className="input" id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
        {mode !== 'reset' && <div className="field"><label htmlFor="pw">Password</label><input className="input" id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={mode === 'up' ? 8 : undefined} /></div>}
        {msg && <Notice kind={msg.kind} icon={msg.kind === 'ok' ? 'mail' : 'alert'}>{msg.text}</Notice>}
        <button className="btn primary" type="submit" disabled={busy} style={{ height: 44 }}>{busy && <Icon name="loader" spin size={16} />}{mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}</button>
        <div className="login-links">
          {mode !== 'in' && <button type="button" className="link" onClick={() => { setMode('in'); setMsg(null); }}>Back to sign in</button>}
          {mode === 'in' && <><button type="button" className="link" onClick={() => { setMode('up'); setMsg(null); }}>Create an account</button><button type="button" className="link" onClick={() => { setMode('reset'); setMsg(null); }}>Forgot password?</button></>}
        </div>
      </form>
    </div>
  );
}

export function Pending() {
  const { api, profile, refresh } = useStore();
  return (
    <div className="login-wrap">
      <div className="panel login">
        <span className="e-ico" style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--s-review-bg)', color: 'var(--s-review)', display: 'grid', placeItems: 'center' }}><Icon name="clock" /></span>
        <h1 style={{ fontSize: 22 }}>Waiting for approval</h1>
        <p style={{ color: 'var(--text-2)' }}>Hi {profile?.full_name}. Your account is created. An ABET admin needs to approve it before you can see the workspace. Ask them to open <b>Admin Panel → Team</b>.</p>
        <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={() => refresh()}><Icon name="refresh" size={16} />Check again</button><button className="btn ghost" onClick={() => api.signOut()}>Sign out</button></div>
      </div>
    </div>
  );
}
