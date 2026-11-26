export type Role =
  | 'super_admin' | 'admin' | 'marketing_manager' | 'content_strategist' | 'scriptwriter'
  | 'video_editor' | 'motion_designer' | 'graphic_designer' | 'social_media_manager'
  | 'compliance_reviewer' | 'viewer';

export type Permission =
  | 'content.create' | 'content.edit_any' | 'content.approve' | 'content.compliance'
  | 'content.publish' | 'styles.manage' | 'team.manage' | 'settings.manage';

/** Six content categories: reel = Short Form, yt = Long Form, explainer, pdf, carousel, ad = Ads. */
export type ContentType = 'reel' | 'yt' | 'explainer' | 'pdf' | 'carousel' | 'ad';
export type Status = 'draft' | 'in_production' | 'in_review' | 'approved' | 'completed';
export type StyleCategory = 'video' | 'motion' | 'graphic' | 'ad' | 'pdf';
export type Platform = 'IG' | 'FB' | 'YT' | 'TT' | 'LI' | 'X';

export interface Profile { id: string; full_name: string; role: Role; active: boolean; created_at?: string }
export interface Invitation { email: string; role: Role; created_at: string; accepted_at: string | null }

export interface Style {
  id: string; category: StyleCategory; name: string; description: string; motif: string;
  complexity: 'Low' | 'Medium' | 'High'; spec: [string, string][]; is_custom: boolean; archived: boolean;
  content_type: ContentType | null; status: StyleStatus; active: boolean;
  reference_asset_ids: string[]; preview_asset_id: string | null;
  template_kind: string | null; template_version: number; output_formats: string[];
  required_assets: string[]; execution_config: Record<string, unknown>;
  approved_by?: string | null; approved_at?: string | null;
  source_reference_ids?: string[]; claude_requested_at?: string | null; claude_built_at?: string | null; claude_note?: string | null;
}

/** A reference video, design or link the team collected for a category. */
export interface StyleReference {
  id: string; content_type: ContentType; title: string; notes: string; asset_id: string | null; url: string | null;
  archived: boolean; created_by: string; created_at: string;
}
export type StyleStatus = 'draft' | 'in_development' | 'pending_approval' | 'approved';
export interface ProductionJob {
  id: string; item_id: string; style_id: string | null; status: 'queued' | 'running' | 'succeeded' | 'failed' | 'waiting_for_claude';
  stage: string; progress: number; steps: { name: string; status: string; at?: string; detail?: string }[];
  error: string | null; result_asset_id: string | null; engine: string | null; created_by: string; created_at: string; updated_at: string;
  kind?: 'script' | 'full' | 'video'; request?: VideoRequest; worker?: string | null; claimed_at?: string | null;
}

/** What the requester chose for a Claude-made file. */
export interface VideoRequest { output: 'video' | 'image' | 'slides' | 'pdf'; aspect: string; length: string; reference_ids?: string[] }

export interface ContentItem {
  id: string; title: string; topic: string; type: ContentType; style_id: string | null;
  owner_id: string; status: Status; platforms: Platform[]; scheduled_at: string | null; published_at: string | null;
  compliance_note: string | null; audience: string | null; objective: string | null;
  needs_script: boolean; request_note: string | null; requested_by: string | null;
  created_by: string; created_at: string; updated_at: string;
}

export interface ScriptUnit { label: string; tc: string; vo: string; on: string; vis: string }
export interface Script {
  id: string; item_id: string; version: number; title: string; length_label: string | null;
  units: ScriptUnit[]; source: 'manual' | 'claude'; approved_by: string | null; approved_at: string | null;
  created_by: string; created_at: string;
}

export interface Caption { item_id: string; platform: Platform; body: string }

export interface Asset {
  id: string; item_id: string | null; name: string; kind: 'Video' | 'Graphic' | 'PDF' | 'Reference';
  storage_path: string; size_bytes: number; state: 'ready' | 'published' | 'archived';
  backup_verified: boolean; created_by: string; created_at: string;
}

export interface Activity { id: number; item_id: string | null; actor_id: string | null; via: 'app' | 'claude' | 'system'; message: string; created_at: string; kind?: 'content' | 'signup' | 'signin' | 'team' | 'style' | 'claude' }

export interface Settings {
  last_backup_at?: string | null;
  storage_limit_gb: number; temp_cleanup_days: number; auto_captions: boolean;
  auto_calendar_suggestions: boolean; notify_on_ready: boolean;
}

export interface SocialConnection { platform: Platform; handle: string; status: 'not_connected' | 'connected' | 'error' | 'pending_review' }

export interface Session { userId: string; email: string }

export interface Comment { id: string; item_id: string; author_id: string; body: string; via: 'app' | 'claude'; created_at: string }
export interface Notification { id: number; user_id: string; item_id: string | null; kind: string; message: string; read_at: string | null; created_at: string }
export interface MfaFactor { id: string; status: string; friendly_name?: string | null }
