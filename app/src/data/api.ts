import type {
  Activity, Asset, Caption, VideoRequest, Comment, MfaFactor, Notification, ProductionJob, ContentItem, ContentType, Invitation, Platform, Profile, Role, Script, ScriptUnit,
  Session, Settings, SocialConnection, Style,
} from '../lib/types';

export interface Snapshot {
  profiles: Profile[];
  styles: Style[];
  items: ContentItem[];
  activity: Activity[];
  settings: Settings;
  social: SocialConnection[];
  invitations: Invitation[];
  notifications: Notification[];
}

export interface NewItem { title: string; topic: string; type: ContentType; style_id?: string | null; audience?: string | null; objective?: string | null }
export type ItemPatch = Partial<Pick<ContentItem, 'title' | 'topic' | 'style_id' | 'owner_id' | 'status' | 'platforms' | 'scheduled_at' | 'published_at' | 'compliance_note' | 'audience' | 'objective' | 'needs_script' | 'request_note' | 'requested_by'>>;
export interface NewScript { title: string; length_label: string | null; units: ScriptUnit[]; source: 'manual' | 'claude' }

export interface Api {
  mode: 'supabase' | 'demo';
  // auth
  getSession(): Promise<Session | null>;
  onAuth(cb: (s: Session | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, fullName: string): Promise<{ needsConfirm: boolean }>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  myProfile(): Promise<Profile | null>;
  // workspace
  loadAll(): Promise<Snapshot>;
  createItem(n: NewItem): Promise<ContentItem>;
  updateItem(id: string, patch: ItemPatch): Promise<ContentItem>;
  deleteItem(id: string): Promise<void>;
  listScripts(itemId: string): Promise<Script[]>;
  saveScript(itemId: string, s: NewScript): Promise<Script>;
  approveScript(scriptId: string): Promise<void>;
  listCaptions(itemId: string): Promise<Caption[]>;
  saveCaption(itemId: string, platform: Platform, body: string): Promise<void>;
  listAssets(): Promise<Asset[]>;
  uploadAsset(file: File, itemId: string | null, kind: Asset['kind']): Promise<Asset>;
  updateAsset(id: string, patch: Partial<Pick<Asset, 'state' | 'item_id' | 'name'>>): Promise<void>;
  assetUrl(a: Asset): Promise<string>;
  saveStyle(s: Partial<Style> & { name: string; category: Style['category'] }): Promise<Style>;
  updateProfile(id: string, patch: Partial<Pick<Profile, 'role' | 'active' | 'full_name'>>): Promise<void>;
  invite(email: string, role: Role): Promise<void>;
  revokeInvite(email: string): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  updateSocial(platform: Platform, patch: Partial<Pick<SocialConnection, 'status' | 'handle'>>): Promise<void>;
  addApproval(itemId: string, kind: 'creative' | 'compliance', decision: 'approved' | 'changes_requested' | 'note_resolved', note?: string): Promise<void>;
  log(message: string, itemId?: string | null): Promise<void>;
  listComments(itemId: string): Promise<Comment[]>;
  addComment(itemId: string, body: string): Promise<void>;
  markNotificationsRead(ids?: number[]): Promise<void>;
  // two-step login
  mfaStatus(): Promise<{ current: string; next: string; factors: MfaFactor[] }>;
  mfaEnroll(): Promise<{ factorId: string; qr: string; secret: string }>;
  mfaVerify(factorId: string, code: string): Promise<void>;
  mfaRemove(factorId: string): Promise<void>;
  signOutOthers(): Promise<void>;
  claudeConnections(): Promise<{ connected_at: string; client_id: string | null }[]>;
  exportAll(): Promise<Record<string, unknown>>;
  // production
  capabilities(): Promise<{ claudeApi: boolean; renderers: string[] }>;
  listJobs(itemId: string): Promise<ProductionJob[]>;
  /** Starts generation. mode 'full' = script + render with the item's style; 'script' = script only. */
  generate(itemId: string, mode: 'full' | 'script' | 'video', request?: VideoRequest): Promise<{ jobId: string; engine: 'claude-api' | 'claude-queue' | 'claude-worker' }>;
  /** Real health checks used by AI & Integrations. */
  health(): Promise<{ database: boolean; storage: boolean; detail?: string }>;
}

/** Turns database errors into short sentences people can act on. */
export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/row-level security|permission denied/i.test(msg)) return 'Your role doesn’t allow this. Ask an admin if you need access.';
  if (/Invalid login credentials/i.test(msg)) return 'That email and password don’t match.';
  if (/Email not confirmed/i.test(msg)) return 'Confirm your email first. Check your inbox for the link.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Can’t reach the server. Check your connection and try again.';
  if (/exceeded the maximum allowed size|Payload too large/i.test(msg)) return 'That file is over the 50 MB limit.';
  return msg.replace(/^ERROR:\s*/, '');
}
