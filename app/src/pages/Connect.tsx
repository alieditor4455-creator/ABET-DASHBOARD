import { useMemo, useRef, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Icon } from '../components/Icon';
import { Notice } from '../components/ui';
import { friendlyError } from '../data/api';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const ALLOWED = /^https:\/\/(claude\.ai|claude\.com)\/api\/mcp\/auth_callback$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//;

/** OAuth consent page: Claude sends people here when they add the ABET connector. */
export function Connect() {
  const q = useMemo(() => new URLSearchParams(window.location.search), []);
  const redirect = q.get('redirect_uri') ?? '';
  const state = q.get('state');
  const challenge = q.get('code_challenge') ?? '';
  const bad = !URL_ || !KEY_ ? 'The connector isn’t available in demo mode.'
    : q.get('response_type') !== 'code' || !ALLOWED.test(redirect) ? 'This connection request didn’t come from Claude, so it was blocked.'
    : q.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(challenge) ? 'This connection request is missing its security check. Try connecting again from Claude.'
    : null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const client = useRef<SupabaseClient | null>(null);

  const back = (params: Record<string, string>) => {
    const u = new URL(redirect);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    if (state) u.searchParams.set('state', state);
    window.location.assign(u.toString());
  };

  const finish = async (sb: SupabaseClient) => {
    const p = await sb.rpc('my_profile');
    if (!p.data || !(p.data as { active: boolean }).active) throw new Error('Your account is waiting for an admin to approve it.');
    const { data: s } = await sb.auth.getSession();
    if (!s.session) throw new Error('Sign-in failed. Try again.');
    const r = await sb.rpc('create_oauth_code', { p_refresh_token: s.session.refresh_token, p_code_challenge: challenge, p_redirect_uri: redirect, p_client_id: q.get('client_id') });
    if (r.error) throw new Error(r.error.message);
    back({ code: r.data as string });
  };

  const allow = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (mfa && client.current) {
        const v = await client.current.auth.mfa.challengeAndVerify({ factorId: mfa, code: code.replace(/\s/g, '') });
        if (v.error) throw new Error('That code didn’t work. Try the newest code from your authenticator app.');
        await finish(client.current);
        return;
      }
      // A separate session just for Claude, so signing out of the dashboard doesn't disconnect it (and vice versa).
      const sb = createClient(URL_!, KEY_!, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'abet-claude-connect' } });
      client.current = sb;
      const s = await sb.auth.signInWithPassword({ email, password });
      if (s.error || !s.data.session) throw new Error(s.error?.message ?? 'Sign-in failed');
      const aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.data && aal.data.nextLevel === 'aal2' && aal.data.currentLevel !== 'aal2') {
        const f = await sb.auth.mfa.listFactors();
        const totp = (f.data?.totp ?? [])[0];
        if (totp) { setMfa(totp.id); setBusy(false); return; }
      }
      await finish(sb);
    } catch (err) { setError(friendlyError(err)); setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <form className="panel login" onSubmit={allow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/brand/mark.png" alt="ABET" style={{ width: 36, height: 'auto' }} />
          <Icon name="arrowR" /><span className="stat-ico"><Icon name="sparkles" /></span>
        </div>
        <div><h1 style={{ fontSize: 22 }}>Connect Claude to ABET Content OS</h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>Claude will work as you, with your role’s permissions.</p></div>
        {bad ? <Notice kind="err" icon="alert">{bad}</Notice> : <>
          <ul className="checks" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {['Read the Brand Kit, styles, content and calendar', 'Create drafts and save scripts and captions', 'Move items to production or review'].map((t) => <li key={t} className="check ok"><Icon name="checkc" size={16} /><span>{t}</span></li>)}
            <li className="check bad"><Icon name="xc" size={16} /><span>Approving and publishing stay with people in the dashboard</span></li>
          </ul>
          {!mfa ? <>
            <div className="field"><label htmlFor="cem">ABET Content OS email</label><input id="cem" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label htmlFor="cpw">Password</label><input id="cpw" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          </> : <div className="field"><label htmlFor="cotp">6-digit code from your authenticator app</label><input id="cotp" className="input" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} required value={code} onChange={(e) => setCode(e.target.value)} style={{ fontSize: 20, letterSpacing: '.2em', textAlign: 'center' }} /></div>}
          {error && <Notice kind="err" icon="alert">{error}</Notice>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={() => back({ error: 'access_denied' })} disabled={busy}>Cancel</button>
            <button type="submit" className="btn primary" style={{ flex: 1 }} disabled={busy}>{busy && <Icon name="loader" spin size={16} />}Allow and connect</button>
          </div>
        </>}
      </form>
    </div>
  );
}
