/**
 * Demo mode: an in-browser copy of the workspace with sample data, used when no Supabase
 * keys are configured and for automated tests. It applies the same workflow rules as the
 * database triggers so the app behaves the same way.
 */
import type { Api, ItemPatch, NewItem, NewScript, Snapshot } from './api';
import type { Activity, Asset, Caption, Comment, ContentItem, Invitation, Notification, ProductionJob, Permission, Profile, Script, Session, Settings, SocialConnection, Style } from '../lib/types';
import { ROLE_PERMS } from '../lib/constants';
import { templateScript } from '../lib/script';
import seedStyles from './styleSeed.json';

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const inDays = (d: number, h: number, m = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString(); };

export function createDemoApi(): Api {
  const me: Profile = { id: 'demo-ml', full_name: 'Marketing Lead', role: 'super_admin', active: true };
  const profiles: Profile[] = [
    me,
    { id: 'demo-hk', full_name: 'Hira K.', role: 'scriptwriter', active: true },
    { id: 'demo-oa', full_name: 'Omar A.', role: 'video_editor', active: true },
    { id: 'demo-zr', full_name: 'Zain R.', role: 'motion_designer', active: true },
    { id: 'demo-sm', full_name: 'Sana M.', role: 'graphic_designer', active: true },
    { id: 'demo-bt', full_name: 'Bilal T.', role: 'social_media_manager', active: true },
    { id: 'demo-mq', full_name: 'Mariam Q.', role: 'compliance_reviewer', active: true },
    { id: 'demo-new', full_name: 'New sign-up', role: 'viewer', active: false },
  ];
  // No preset styles: categories start empty until ABET's own reference-based styles are approved.
  void seedStyles;
  const styles: Style[] = [];
  const sid = (_name: string): string | null => null;
  const jobs: ProductionJob[] = [];
  const mk = (title: string, type: ContentItem['type'], style: string, owner: string, status: ContentItem['status'], upd: number, extra: Partial<ContentItem> = {}): ContentItem => ({
    id: uuid(), title, topic: title, type, style_id: sid(style), owner_id: owner, status, platforms: [], scheduled_at: null, published_at: null,
    compliance_note: null, audience: 'Complete beginners', objective: 'Education', needs_script: false, request_note: null, requested_by: null, created_by: owner, created_at: minsAgo(upd + 600), updated_at: minsAgo(upd), ...extra,
  });
  const items: ContentItem[] = [
    mk('What is a pip? In 30 seconds', 'reel', 'High-Retention Educational', 'demo-bt', 'completed', 180, { platforms: ['IG', 'TT'], scheduled_at: inDays(1, 18) }),
    mk('Forex vs. stocks: five differences', 'carousel', 'Step-by-Step Carousel', 'demo-sm', 'completed', 300, { platforms: ['IG', 'LI'], scheduled_at: inDays(2, 12, 30) }),
    mk('How leverage works, and how it works against you', 'explainer', 'Financial Chart Explainers', 'demo-zr', 'in_review', 12, { compliance_note: 'Risk warning missing on end card' }),
    mk('MT5 walkthrough: your first demo order', 'yt', 'Screen Recording Tutorials', 'demo-oa', 'in_production', 20),
    mk('Reading a candlestick in three steps', 'reel', 'Kinetic Typography', 'demo-oa', 'in_review', 95),
    mk('Stop-loss basics for beginners', 'reel', 'Premium Minimalist', 'demo-hk', 'draft', 40, { needs_script: true, request_note: 'Keep it under 45 seconds', requested_by: 'demo-hk' }),
    mk('Trading sessions: Tokyo, London, New York', 'ad', 'Market Hours Infographic', 'demo-sm', 'approved', 240),
    mk("Beginner's forex glossary", 'pdf', 'Beginner Guide', 'demo-sm', 'in_production', 5),
    mk('Try MT5 on a demo account', 'ad', 'Demo Account Offer', 'demo-oa', 'in_review', 25),
    mk('Why interest rates move currencies', 'explainer', 'Financial Chart Explainers', 'demo-hk', 'draft', 130),
    mk('Gold and the US dollar', 'reel', 'Financial Chart Animation', 'demo-zr', 'approved', 200),
    mk('Five beginner mistakes to avoid', 'reel', 'UGC Authentic', 'demo-bt', 'completed', 7400, { platforms: ['IG', 'TT'], scheduled_at: inDays(-5, 18), published_at: inDays(-5, 18) }),
    mk('Demo vs. live account', 'reel', 'Split-Screen Comparison', 'demo-bt', 'completed', 900, { platforms: ['IG', 'FB'], scheduled_at: inDays(4, 17) }),
    mk('Gold week in review', 'reel', 'Fast-Paced Social', 'demo-bt', 'completed', 600, { platforms: ['IG', 'X'], scheduled_at: inDays(5, 10) }),
  ];
  const scripts: Script[] = [];
  const captions: Caption[] = [];
  const assets: Asset[] = items.filter((i) => ['in_review', 'approved', 'completed'].includes(i.status)).map((i) => ({
    id: uuid(), item_id: i.id, name: `${i.title}.mp4`, kind: 'Video', storage_path: `demo/${i.id}`, size_bytes: 48_000_000, state: i.published_at ? 'published' : 'ready',
    backup_verified: false, created_by: i.owner_id, created_at: i.updated_at,
  }));
  const blobs = new Map<string, string>();
  const activity: Activity[] = [
    { id: 3, item_id: null, actor_id: 'demo-mq', via: 'app', message: 'added a compliance note to “How leverage works…”', created_at: minsAgo(12) },
    { id: 2, item_id: null, actor_id: 'demo-hk', via: 'claude', message: 'saved a script for “Stop-loss basics for beginners”', created_at: minsAgo(40) },
    { id: 1, item_id: null, actor_id: 'demo-sm', via: 'app', message: 'approved “Trading sessions: Tokyo, London, New York”', created_at: minsAgo(240) },
  ];
  let actId = 10;
  let settings: Settings = { last_backup_at: null, storage_limit_gb: 1, temp_cleanup_days: 30, auto_captions: true, auto_calendar_suggestions: true, notify_on_ready: true };
  const social: SocialConnection[] = (['IG', 'FB', 'YT', 'TT', 'LI', 'X'] as const).map((p) => ({ platform: p, handle: p, status: 'not_connected' }));
  const invitations: Invitation[] = [];
  const comments: Comment[] = [];
  const notifications: Notification[] = [
    { id: 2, user_id: me.id, item_id: null, kind: 'review', message: '“Reading a candlestick in three steps” is ready for review', read_at: null, created_at: minsAgo(95) },
    { id: 1, user_id: me.id, item_id: null, kind: 'comment', message: 'Hira K. commented on “Stop-loss basics for beginners”', read_at: minsAgo(30), created_at: minsAgo(40) },
  ];
  let session: Session | null = { userId: me.id, email: 'demo@abet.local' };
  const listeners = new Set<(s: Session | null) => void>();

  const can = (p: Permission) => ROLE_PERMS[me.role].includes(p);
  const fail = (m: string): never => { throw new Error(m); };
  const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60));

  const api: Api = {
    mode: 'demo',
    async getSession() { return session; },
    onAuth(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    async signIn() { session = { userId: me.id, email: 'demo@abet.local' }; listeners.forEach((l) => l(session)); },
    async signUp() { return { needsConfirm: false }; },
    async resetPassword() {},
    async signOut() { session = null; listeners.forEach((l) => l(null)); },
    async myProfile() { return me; },
    async loadAll(): Promise<Snapshot> {
      return delay({ profiles: [...profiles], styles: styles.filter((s) => !s.archived), items: [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at)), activity: [...activity].slice(0, 40), settings: { ...settings }, social: [...social], invitations: [...invitations], notifications: [...notifications] });
    },
    async createItem(n: NewItem) {
      if (!can('content.create')) fail('permission denied');
      const now = new Date().toISOString();
      const it: ContentItem = { id: uuid(), title: n.title, topic: n.topic, type: n.type, style_id: n.style_id ?? null, owner_id: me.id, status: 'draft', platforms: [], scheduled_at: null, published_at: null, compliance_note: null, audience: n.audience ?? null, objective: n.objective ?? null, needs_script: false, request_note: null, requested_by: null, created_by: me.id, created_at: now, updated_at: now };
      items.unshift(it); await api.log(`created “${it.title}”`, it.id); return delay(it);
    },
    async updateItem(id, patch: ItemPatch) {
      const it = items.find((i) => i.id === id) ?? fail('Not found');
      const next = { ...it, ...patch };
      if (patch.status && patch.status !== it.status) {
        if (patch.status === 'approved') {
          if (it.status !== 'in_review') fail('Only content in review can be approved');
          if (!can('content.approve')) fail('You do not have permission to approve content');
          if (next.compliance_note) fail('Resolve the compliance note before approving');
        } else if (patch.status === 'completed' && it.status !== 'approved') fail('Approve content before completing it');
        else if (patch.status === 'in_review' && !['draft', 'in_production'].includes(it.status)) fail('Only drafts or items in production can be sent for review');
        activity.unshift({ id: actId++, item_id: id, actor_id: me.id, via: 'app', message: `moved “${it.title}” from ${it.status} to ${patch.status}`, created_at: new Date().toISOString() });
      }
      if (('scheduled_at' in patch && patch.scheduled_at !== it.scheduled_at) || ('published_at' in patch && patch.published_at !== it.published_at)) {
        if (!['approved', 'completed'].includes(next.status)) fail('Only approved content can be scheduled or published');
        if (!can('content.publish')) fail('You do not have permission to publish');
      }
      Object.assign(it, next, { updated_at: new Date().toISOString() });
      return delay({ ...it });
    },
    async deleteItem(id) { const i = items.findIndex((x) => x.id === id); if (i >= 0 && items[i].status === 'draft') items.splice(i, 1); else fail('Only drafts can be deleted'); },
    async listScripts(itemId) {
      if (!scripts.some((s) => s.item_id === itemId)) {
        const it = items.find((i) => i.id === itemId);
        if (it && it.status !== 'draft') { const t = templateScript(it.type, it.topic); scripts.push({ id: uuid(), item_id: itemId, version: 1, title: t.title, length_label: t.length, units: t.units, source: 'claude', approved_by: 'demo-ml', approved_at: it.updated_at, created_by: it.owner_id, created_at: it.created_at }); }
      }
      return delay(scripts.filter((s) => s.item_id === itemId).sort((a, b) => b.version - a.version));
    },
    async saveScript(itemId, s: NewScript) {
      const version = Math.max(0, ...scripts.filter((x) => x.item_id === itemId).map((x) => x.version)) + 1;
      const row: Script = { id: uuid(), item_id: itemId, version, ...s, approved_by: null, approved_at: null, created_by: me.id, created_at: new Date().toISOString() };
      scripts.push(row); const it = items.find((i) => i.id === itemId); if (it) it.needs_script = false; await api.log(`saved script version ${version}`, itemId); return delay(row);
    },
    async approveScript(id) { const s = scripts.find((x) => x.id === id); if (s) { s.approved_by = me.id; s.approved_at = new Date().toISOString(); } },
    async listCaptions(itemId) { return captions.filter((c) => c.item_id === itemId); },
    async saveCaption(itemId, platform, body) { const c = captions.find((x) => x.item_id === itemId && x.platform === platform); if (c) c.body = body; else captions.push({ item_id: itemId, platform, body }); },
    async listAssets() { return delay([...assets]); },
    async uploadAsset(file, itemId, kind) {
      if (file.size > 50 * 1024 * 1024) fail('Payload too large');
      const a: Asset = { id: uuid(), item_id: itemId, name: file.name, kind, storage_path: `demo/${uuid()}`, size_bytes: file.size, state: 'ready', backup_verified: false, created_by: me.id, created_at: new Date().toISOString() };
      blobs.set(a.storage_path, URL.createObjectURL(file)); assets.unshift(a); await api.log(`uploaded ${file.name}`, itemId); return delay(a);
    },
    async updateAsset(id, patch) { const a = assets.find((x) => x.id === id); if (a) Object.assign(a, patch); },
    async assetUrl(a) { return blobs.get(a.storage_path) ?? ''; },
    async saveStyle(s) {
      if (!can('styles.manage')) fail('permission denied');
      if (s.id) { const x = styles.find((y) => y.id === s.id) ?? fail('Not found'); Object.assign(x, s); return { ...x }; }
      const n: Style = { description: '', motif: 'mini', complexity: 'Medium', spec: [], is_custom: true, archived: false, content_type: null, status: 'draft', active: false, reference_asset_ids: [], preview_asset_id: null, template_kind: null, template_version: 0, output_formats: [], required_assets: [], execution_config: {}, ...s, id: uuid() } as Style;
      styles.push(n); return n;
    },
    async updateProfile(id, patch) {
      if (!can('team.manage')) fail('Only admins can change roles');
      if (id === me.id && (patch.role || patch.active !== undefined)) fail('You cannot change your own role');
      const p = profiles.find((x) => x.id === id); if (p) Object.assign(p, patch);
    },
    async invite(email, role) { const e = email.trim().toLowerCase(); if (!invitations.some((i) => i.email === e)) invitations.unshift({ email: e, role, created_at: new Date().toISOString(), accepted_at: null }); },
    async revokeInvite(email) { const i = invitations.findIndex((x) => x.email === email); if (i >= 0) invitations.splice(i, 1); },
    async updateSettings(patch) { settings = { ...settings, ...patch }; },
    async updateSocial(platform, patch) { const s = social.find((x) => x.platform === platform); if (s) Object.assign(s, patch); },
    async addApproval() {},
    async log(message, itemId = null) { activity.unshift({ id: actId++, item_id: itemId, actor_id: me.id, via: 'app', message, created_at: new Date().toISOString() }); },
    async listComments(itemId) { return comments.filter((c) => c.item_id === itemId); },
    async addComment(itemId, body) { comments.push({ id: uuid(), item_id: itemId, author_id: me.id, body: body.trim(), via: 'app', created_at: new Date().toISOString() }); },
    async markNotificationsRead(ids) { notifications.forEach((n) => { if (!ids || ids.includes(n.id)) n.read_at = n.read_at ?? new Date().toISOString(); }); },
    async mfaStatus() { return { current: 'aal1', next: 'aal1', factors: [] }; },
    async mfaEnroll() { return fail('Two-step login isn’t available in demo mode.'); },
    async mfaVerify() { fail('Two-step login isn’t available in demo mode.'); },
    async mfaRemove() {},
    async signOutOthers() {},
    async claudeConnections() { return [{ connected_at: minsAgo(600), client_id: 'claude-demo' }]; },
    async exportAll() { settings = { ...settings, last_backup_at: new Date().toISOString() }; return { exported_at: new Date().toISOString(), source: 'ABET Content OS (demo)', profiles, styles, content_items: items, scripts, captions, comments, assets, activity }; },
    async capabilities() { return { claudeApi: false, renderers: [] }; },
    async listJobs(itemId) { return jobs.filter((j) => j.item_id === itemId); },
    async generate(itemId) {
      const it = items.find((i) => i.id === itemId) ?? fail('Not found');
      it.needs_script = true; it.requested_by = me.id;
      const j: ProductionJob = { id: uuid(), item_id: itemId, style_id: it.style_id, status: 'waiting_for_claude', stage: 'Waiting for Claude', progress: 10, steps: [{ name: 'Sent to the Claude queue', status: 'done', at: new Date().toISOString() }], error: null, result_asset_id: null, engine: 'claude-queue', created_by: me.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      jobs.unshift(j); return { jobId: j.id, engine: 'claude-queue' as const };
    },
    async health() { return { database: true, storage: true, detail: 'Demo mode: data lives in this browser tab.' }; },
  };
  return api;
}
