import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Api, Snapshot } from './api';
import { friendlyError } from './api';
import { createDemoApi } from './demoApi';
import { createSupabaseApi } from './supabaseApi';
import type { Permission, Profile, Session } from '../lib/types';
import { ROLE_PERMS } from '../lib/constants';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const forceDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');
export const api: Api = URL_ && KEY_ && !forceDemo ? createSupabaseApi(URL_, KEY_) : createDemoApi();

interface Ctx {
  api: Api;
  session: Session | null;
  profile: Profile | null;
  data: Snapshot | null;
  loading: boolean;
  authReady: boolean;
  refresh: () => Promise<void>;
  can: (p: Permission) => boolean;
  toast: (msg: string, icon?: string) => void;
  run: <T>(fn: () => Promise<T>, success?: string) => Promise<T | undefined>;
  toastState: { msg: string; icon: string; id: number } | null;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [toastState, setToast] = useState<Ctx['toastState']>(null);
  const tId = useRef(0);

  const toast = useCallback((msg: string, icon = 'check') => {
    const id = ++tId.current;
    setToast({ msg, icon, id });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const p = await api.myProfile();
      setProfile(p);
      if (p?.active) setData(await api.loadAll());
    } catch (e) { toast(friendlyError(e), 'alert'); }
  }, [toast]);

  useEffect(() => {
    let alive = true;
    api.getSession().then((s) => { if (alive) { setSession(s); setAuthReady(true); } });
    const off = api.onAuth((s) => { setSession(s); if (!s) { setProfile(null); setData(null); } });
    return () => { alive = false; off(); };
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 30000);
    return () => clearInterval(t);
  }, [session?.userId, refresh]);

  const can = useCallback((p: Permission) => !!profile?.active && ROLE_PERMS[profile.role].includes(p), [profile]);

  const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string) => {
    try {
      const r = await fn();
      if (success) toast(success);
      await refresh();
      return r;
    } catch (e) {
      toast(friendlyError(e), 'alert');
      await refresh();
      return undefined;
    }
  }, [refresh, toast]);

  const value = useMemo(() => ({ api, session, profile, data, loading, authReady, refresh, can, toast, run, toastState }),
    [session, profile, data, loading, authReady, refresh, can, toast, run, toastState]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore outside provider');
  return c;
}
