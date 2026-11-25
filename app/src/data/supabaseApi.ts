import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Api, ItemPatch, NewItem, NewScript, Snapshot } from './api';
import type { Asset, Caption, Comment, ContentItem, MfaFactor, Notification, ProductionJob, Platform, Profile, Role, Script, Session, Settings, Style, StyleReference } from '../lib/types';
import { TYPES } from '../lib/constants';

const BUCKET = 'content';

export function createSupabaseApi(url: string, key: string): Api {
  const sb: SupabaseClient = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  let uid: string | null = null;

  const ok = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data as T;
  };
  const toSession = (s: { user: { id: string; email?: string } } | null): Session | null =>
    s ? { userId: s.user.id, email: s.user.email ?? '' } : null;

  const api: Api = {
    mode: 'supabase',
    async getSession() {
      const { data } = await sb.auth.getSession();
      const s = toSession(data.session);
      uid = s?.userId ?? null;
      return s;
    },
    onAuth(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, s) => { const x = toSession(s); uid = x?.userId ?? null; cb(x); });
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const r = await sb.auth.signInWithPassword({ email, password });
      if (r.error) throw new Error(r.error.message);
    },
    async signUp(email, password, fullName) {
      const r = await sb.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin } });
      if (r.error) throw new Error(r.error.message);
      return { needsConfirm: !r.data.session };
    },
    async resetPassword(email) { ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })); },
    async signOut() { await sb.auth.signOut(); uid = null; },
    async myProfile() {
      const r = await sb.rpc('my_profile');
      if (r.error) throw new Error(r.error.message);
      return (r.data as Profile | null) ?? null;
    },

    async loadAll(): Promise<Snapshot> {
      const [profiles, styles, items, activity, settings, social, invitations, notifications] = await Promise.all([
        sb.from('profiles').select('*').order('created_at'),
        sb.from('styles').select('*').eq('archived', false).order('category').order('created_at'),
        sb.from('content_items').select('*').order('updated_at', { ascending: false }),
        sb.from('activity').select('*').order('created_at', { ascending: false }).limit(40),
        sb.from('app_settings').select('*').single(),
        sb.from('social_connections').select('*'),
        sb.from('invitations').select('*').order('created_at', { ascending: false }),
        sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(40),
      ]);
      return {
        profiles: ok(profiles) as Profile[], styles: ok(styles) as Style[], items: ok(items) as ContentItem[],
        activity: ok(activity) as Snapshot['activity'], settings: ok(settings) as Settings,
        social: ok(social) as Snapshot['social'], invitations: (invitations.data ?? []) as Snapshot['invitations'],
        notifications: (notifications.data ?? []) as Notification[],
      };
    },
    async createItem(n: NewItem) {
      const row = { ...n, owner_id: uid, created_by: uid };
      const item = ok(await sb.from('content_items').insert(row).select().single()) as ContentItem;
      await api.log(`created “${item.title}”`, item.id);
      return item;
    },
    async updateItem(id: string, patch: ItemPatch) {
      return ok(await sb.from('content_items').update(patch).eq('id', id).select().single()) as ContentItem;
    },
    async deleteItem(id) { ok(await sb.from('content_items').delete().eq('id', id)); },

    async listScripts(itemId) { return ok(await sb.from('scripts').select('*').eq('item_id', itemId).order('version', { ascending: false })) as Script[]; },
    async saveScript(itemId, s: NewScript) {
      const last = ok(await sb.from('scripts').select('version').eq('item_id', itemId).order('version', { ascending: false }).limit(1)) as { version: number }[];
      const version = (last[0]?.version ?? 0) + 1;
      const row = { item_id: itemId, version, title: s.title, length_label: s.length_label, units: s.units, source: s.source, created_by: uid };
      const saved = ok(await sb.from('scripts').insert(row).select().single()) as Script;
      await api.log(`saved script version ${version}`, itemId);
      return saved;
    },
    async approveScript(scriptId) { ok(await sb.from('scripts').update({ approved_by: uid, approved_at: new Date().toISOString() }).eq('id', scriptId)); },

    async listCaptions(itemId) { return ok(await sb.from('captions').select('*').eq('item_id', itemId)) as Caption[]; },
    async saveCaption(itemId, platform: Platform, body) {
      ok(await sb.from('captions').upsert({ item_id: itemId, platform, body, updated_at: new Date().toISOString() }));
    },

    async listAssets() { return ok(await sb.from('assets').select('*').order('created_at', { ascending: false })) as Asset[]; },
    async uploadAsset(file, itemId, kind) {
      const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
      const path = `${itemId ?? 'library'}/${Date.now()}_${safe}`;
      ok(await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false }));
      const asset = ok(await sb.from('assets').insert({
        item_id: itemId, name: file.name, kind, storage_path: path, size_bytes: file.size, created_by: uid,
        backup_verified: false,
      }).select().single()) as Asset;
      await api.log(`uploaded ${file.name}`, itemId);
      return asset;
    },
    async updateAsset(id, patch) { ok(await sb.from('assets').update(patch).eq('id', id)); },
    async assetUrl(a) {
      const r = await sb.storage.from(BUCKET).createSignedUrl(a.storage_path, 60 * 30);
      if (r.error) throw new Error(r.error.message);
      return r.data.signedUrl;
    },

    async saveStyle(s) {
      const row = { ...s, created_by: s.id ? undefined : uid };
      if (s.id) return ok(await sb.from('styles').update(row).eq('id', s.id).select().single()) as Style;
      return ok(await sb.from('styles').insert(row).select().single()) as Style;
    },
    async listReferences() { return ok(await sb.from('style_references').select('*').eq('archived', false).order('created_at', { ascending: false })) as StyleReference[]; },
    async addReference(r, file) {
      const asset = file ? await api.uploadAsset(file, null, 'Reference') : null;
      return ok(await sb.from('style_references').insert({ content_type: r.content_type, title: r.title.trim(), notes: r.notes.trim(), url: r.url?.trim() || null, asset_id: asset?.id ?? null, created_by: uid }).select().single()) as StyleReference;
    },
    async archiveReference(id, archived) { ok(await sb.from('style_references').update({ archived }).eq('id', id)); },
    async requestStyle(r) {
      const refs = ok(await sb.from('style_references').select('asset_id').in('id', r.reference_ids)) as { asset_id: string | null }[];
      return ok(await sb.from('styles').insert({
        name: r.name.trim(), category: TYPES[r.content_type].cat, content_type: r.content_type, description: '', status: 'in_development', active: false, is_custom: true,
        spec: [], output_formats: [], required_assets: [], execution_config: {}, reference_asset_ids: refs.map((x) => x.asset_id).filter(Boolean),
        source_reference_ids: r.reference_ids, claude_requested_at: new Date().toISOString(), claude_requested_by: uid, claude_note: r.note.trim() || null, created_by: uid,
      }).select().single()) as Style;
    },
    async updateProfile(id, patch) { ok(await sb.from('profiles').update(patch).eq('id', id)); },
    async invite(email, role: Role) { ok(await sb.from('invitations').upsert({ email: email.trim().toLowerCase(), role, invited_by: uid })); },
    async revokeInvite(email) { ok(await sb.from('invitations').delete().eq('email', email)); },
    async updateSettings(patch) { ok(await sb.from('app_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', true)); },
    async updateSocial(platform, patch) { ok(await sb.from('social_connections').update({ ...patch, updated_at: new Date().toISOString() }).eq('platform', platform)); },
    async addApproval(itemId, kind, decision, note) { ok(await sb.from('approvals').insert({ item_id: itemId, kind, decision, note: note ?? null, decided_by: uid })); },
    async log(message, itemId = null) {
      const r = await sb.from('activity').insert({ message, item_id: itemId, actor_id: uid, via: 'app' });
      if (r.error) console.warn('activity log failed', r.error.message);
    },
    async listComments(itemId) { return ok(await sb.from('comments').select('*').eq('item_id', itemId).order('created_at')) as Comment[]; },
    async addComment(itemId, body) { ok(await sb.from('comments').insert({ item_id: itemId, body: body.trim(), author_id: uid })); },
    async markNotificationsRead(ids) {
      let q = sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
      if (ids?.length) q = q.in('id', ids);
      ok(await q);
    },
    async mfaStatus() {
      const [aal, f] = await Promise.all([sb.auth.mfa.getAuthenticatorAssuranceLevel(), sb.auth.mfa.listFactors()]);
      if (aal.error) throw new Error(aal.error.message);
      const factors = ((f.data?.all ?? []) as { id: string; status: string; friendly_name?: string; factor_type: string }[])
        .filter((x) => x.factor_type === 'totp').map((x) => ({ id: x.id, status: x.status, friendly_name: x.friendly_name ?? null })) as MfaFactor[];
      return { current: aal.data.currentLevel ?? 'aal1', next: aal.data.nextLevel ?? 'aal1', factors };
    },
    async mfaEnroll() {
      const old = await sb.auth.mfa.listFactors();
      for (const f of ((old.data?.all ?? []) as { id: string; status: string; factor_type: string }[])) if (f.factor_type === 'totp' && f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
      const r = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `ABET ${new Date().toISOString().slice(0, 10)}` });
      if (r.error) throw new Error(r.error.message);
      return { factorId: r.data.id, qr: r.data.totp.qr_code, secret: r.data.totp.secret };
    },
    async mfaVerify(factorId, code) {
      const r = await sb.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') });
      if (r.error) throw new Error(/invalid|expired/i.test(r.error.message) ? 'That code didn’t work. Check the time on your phone and try the newest code.' : r.error.message);
    },
    async mfaRemove(factorId) { const r = await sb.auth.mfa.unenroll({ factorId }); if (r.error) throw new Error(r.error.message); },
    async signOutOthers() { const r = await sb.auth.signOut({ scope: 'others' }); if (r.error) throw new Error(r.error.message); },
    async claudeConnections() { return ok(await sb.rpc('my_claude_connections')) as { connected_at: string; client_id: string | null }[]; },
    async exportAll() {
      const tables = ['profiles', 'invitations', 'styles', 'content_items', 'scripts', 'captions', 'comments', 'approvals', 'assets', 'activity', 'app_settings', 'social_connections'];
      const out: Record<string, unknown> = { exported_at: new Date().toISOString(), source: 'ABET Content OS', note: 'Database records only. Uploaded files stay in storage; their paths are listed under assets.' };
      for (const name of tables) out[name] = ok(await sb.from(name).select('*'));
      await sb.from('app_settings').update({ last_backup_at: new Date().toISOString() }).eq('id', true);
      return out;
    },
    async capabilities() {
      try { const r = await fetch('/api/capabilities'); if (r.ok) return await r.json(); } catch { /* offline */ }
      return { claudeApi: false, renderers: [] };
    },
    async listJobs(itemId) { return ok(await sb.from('production_jobs').select('*').eq('item_id', itemId).order('created_at', { ascending: false }).limit(10)) as ProductionJob[]; },
    async generate(itemId, mode, request) {
      const { data } = await sb.auth.getSession();
      const r = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: JSON.stringify({ itemId, mode, request }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? `Generate failed (${r.status})`);
      return j as { jobId: string; engine: 'claude-api' | 'claude-queue' | 'claude-worker' };
    },
    async health() {
      const db = await sb.from('app_settings').select('id').limit(1);
      const st = await sb.storage.from(BUCKET).list('', { limit: 1 });
      return { database: !db.error, storage: !st.error, detail: db.error?.message ?? st.error?.message };
    },
  };
  return api;
}
