import type { ContentType, Permission, Platform, Role, Status, StyleCategory } from './types';

export interface TypeInfo {
  name: string; short: string; desc: string; icon: string; meta: string; cat: StyleCategory;
  unit: string; kind: 'Video' | 'Graphic' | 'PDF'; ratio: '916' | '169' | '45' | 'a4'; platforms: Platform[];
}

export const TYPES: Record<ContentType, TypeInfo> = {
  reel: { name: 'Reels / Shorts', short: 'Reel', desc: 'Vertical videos for Instagram, TikTok and YouTube Shorts.', icon: 'clap', meta: '9:16 · 15–90 seconds', cat: 'video', unit: 'Scene', kind: 'Video', ratio: '916', platforms: ['IG', 'TT', 'YT', 'FB', 'LI', 'X'] },
  yt: { name: 'YouTube Videos', short: 'YouTube', desc: 'Long-form education, tutorials and webinars.', icon: 'yt', meta: '16:9 · 3–15 minutes', cat: 'video', unit: 'Chapter', kind: 'Video', ratio: '169', platforms: ['YT', 'LI', 'FB'] },
  explainer: { name: 'Explainer Videos', short: 'Explainer', desc: 'Concepts made clear with charts and simple visuals.', icon: 'present', meta: '16:9 or 9:16 · 1–3 minutes', cat: 'video', unit: 'Scene', kind: 'Video', ratio: '169', platforms: ['YT', 'IG', 'LI', 'FB', 'X'] },
  motion: { name: 'Motion Graphics', short: 'Motion', desc: 'Animated type, data and interface sequences.', icon: 'shapes', meta: 'Any ratio · 10–60 seconds', cat: 'motion', unit: 'Scene', kind: 'Video', ratio: '916', platforms: ['IG', 'TT', 'YT', 'LI', 'FB', 'X'] },
  graphic: { name: 'Graphic Design', short: 'Graphic', desc: 'Single social posts, thumbnails and banners.', icon: 'image', meta: '1:1 · 4:5 · 16:9', cat: 'graphic', unit: 'Block', kind: 'Graphic', ratio: '45', platforms: ['IG', 'FB', 'LI', 'X'] },
  carousel: { name: 'Carousels', short: 'Carousel', desc: 'Swipeable, step-by-step educational slides.', icon: 'carousel', meta: '4:5 · 5–10 slides', cat: 'graphic', unit: 'Slide', kind: 'Graphic', ratio: '45', platforms: ['IG', 'LI', 'FB'] },
  poster: { name: 'Posters', short: 'Poster', desc: 'Announcements, market hours and event visuals.', icon: 'poster', meta: '4:5 · A4 print', cat: 'graphic', unit: 'Block', kind: 'Graphic', ratio: '45', platforms: ['IG', 'FB', 'LI', 'X'] },
  ad: { name: 'Advertisements', short: 'Ad', desc: 'Paid creatives for Meta, YouTube and LinkedIn.', icon: 'megaphone', meta: 'Platform sizes · A/B variants', cat: 'ad', unit: 'Variant', kind: 'Video', ratio: '916', platforms: ['IG', 'FB', 'YT', 'LI'] },
  pdf: { name: 'PDFs', short: 'PDF', desc: 'Guides, checklists and e-books with ABET branding.', icon: 'file', meta: 'A4 · 4–30 pages', cat: 'pdf', unit: 'Section', kind: 'PDF', ratio: 'a4', platforms: [] },
};
export const TYPE_KEYS = Object.keys(TYPES) as ContentType[];

export const STATUSES: Status[] = ['draft', 'in_production', 'in_review', 'approved', 'completed'];
export const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draft', in_production: 'In production', in_review: 'In review', approved: 'Approved', completed: 'Completed',
};
export const STATUS_CLASS: Record<Status, string> = {
  draft: 'st-Draft', in_production: 'st-Generating', in_review: 'st-InReview', approved: 'st-Approved', completed: 'st-Completed',
};
export const STATUS_COLOR: Record<Status, string> = {
  draft: 'var(--s-draft)', in_production: 'var(--s-gen)', in_review: 'var(--s-review)', approved: 'var(--s-ok)', completed: 'var(--s-done)',
};

export const STYLE_CATS: [StyleCategory, string, string][] = [
  ['video', 'Video editing', 'film'], ['motion', 'Motion graphics', 'shapes'], ['graphic', 'Graphic design', 'image'],
  ['ad', 'Advertisements', 'megaphone'], ['pdf', 'PDF templates', 'file'],
];

export const REC_STYLE: Record<ContentType, string> = {
  reel: 'High-Retention Educational', yt: 'Screen Recording Tutorials', explainer: 'Financial Chart Explainers',
  motion: 'Financial Chart Animation', graphic: 'Clean Editorial Post', carousel: 'Step-by-Step Carousel',
  poster: 'Market Hours Infographic', ad: 'Demo Account Offer', pdf: 'Beginner Guide',
};

export const PLAT: Record<Platform, string> = { IG: 'Instagram', FB: 'Facebook', YT: 'YouTube', TT: 'TikTok', LI: 'LinkedIn', X: 'X' };
export const PLAT_LIMIT: Record<Platform, number> = { IG: 2200, FB: 63206, YT: 5000, TT: 2200, LI: 3000, X: 280 };
export const PLAT_KEYS = Object.keys(PLAT) as Platform[];

export const ROLES: Role[] = ['super_admin', 'admin', 'marketing_manager', 'content_strategist', 'scriptwriter', 'video_editor', 'motion_designer', 'graphic_designer', 'social_media_manager', 'compliance_reviewer', 'viewer'];
export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin', admin: 'Admin', marketing_manager: 'Marketing Manager', content_strategist: 'Content Strategist',
  scriptwriter: 'Scriptwriter', video_editor: 'Video Editor', motion_designer: 'Motion Designer', graphic_designer: 'Graphic Designer',
  social_media_manager: 'Social Media Manager', compliance_reviewer: 'Compliance Reviewer', viewer: 'Viewer',
};

/** Mirrors public.role_permissions in the database. The database is the source of truth; this drives the UI only. */
export const ROLE_PERMS: Record<Role, Permission[]> = {
  super_admin: ['content.create', 'content.edit_any', 'content.approve', 'content.compliance', 'content.publish', 'styles.manage', 'team.manage', 'settings.manage'],
  admin: ['content.create', 'content.edit_any', 'content.approve', 'content.compliance', 'content.publish', 'styles.manage', 'team.manage'],
  marketing_manager: ['content.create', 'content.edit_any', 'content.approve', 'content.publish', 'styles.manage'],
  content_strategist: ['content.create', 'styles.manage'],
  scriptwriter: ['content.create'],
  video_editor: ['content.create', 'styles.manage'],
  motion_designer: ['content.create', 'styles.manage'],
  graphic_designer: ['content.create', 'styles.manage'],
  social_media_manager: ['content.create', 'content.publish'],
  compliance_reviewer: ['content.approve', 'content.compliance'],
  viewer: [],
};
export const PERM_LABEL: Record<Permission, string> = {
  'content.create': 'Create content', 'content.edit_any': "Edit anyone's content", 'content.approve': 'Approve content',
  'content.compliance': 'Compliance sign-off', 'content.publish': 'Publish and schedule', 'styles.manage': 'Manage styles',
  'team.manage': 'Manage team', 'settings.manage': 'Connections and settings',
};

/* Verified from abetglobal.com */
export const RISK_FULL = 'ABET provides trading in complex financial instruments like contracts for difference (CFDs) that are traded on leverage, and foreign exchange (Currencies, or "Currency"). Given that leverage can be used both favorably and unfavorably, they are very risky. These products might not be suitable for all investors due to the possibility of losing all invested funds. It\'s best to limit your risk exposure to amounts you can afford to lose. Before making a choice, be sure you understand the dangers involved in trading, your skill level, and your investing objectives. Seek outside legal assistance if necessary.';
export const REG_LINE = 'ABET is a registered trading services provider in Anguilla under registration number A000000977.';
/* Written for Content OS: needs compliance approval */
export const RISK_SHORT = 'CFDs are complex instruments traded on leverage and carry a high risk of losing money. Only trade with money you can afford to lose.';

export const HANDLES: Record<string, string> = {
  IG: 'instagram.com/abet.global', FB: 'facebook.com/abetglobal', YT: 'youtube.com/@abetglobal', LI: 'linkedin.com/company/abetglobal',
  X: 'x.com/abetglobal', TG: 't.me/abet_global', PIN: 'pinterest.com/abetglobal',
};

export const TOPIC_SUGGESTIONS = ['What is a pip?', 'How leverage works', 'Stop-loss basics', 'Reading a candlestick', 'Forex trading sessions', 'Demo vs. live account'];
export const AVATAR_COLORS = ['#AE1818', '#3559A8', '#127A84', '#6B4FA0', '#9A5B00', '#1D7447', '#51555F'];
