import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { Icon } from '../components/Icon';
import { Chip, Drawer, Empty, Notice } from '../components/ui';
import { STYLE_STATUS, TYPES, TYPE_KEYS } from '../lib/constants';
import { RENDERERS, rendererFor } from '../lib/renderers';
import { navigate } from '../lib/router';
import { fmtBytes } from '../lib/format';
import { StylePreview, useCapabilities } from './Studio';
import type { Asset, ContentType, Style, StyleStatus } from '../lib/types';

const FORMATS: Record<ContentType, string[]> = {
  reel: ['MP4 9:16 (1080×1920)', 'MP4 1:1', 'MP4 4:5'],
  yt: ['MP4 16:9 (1920×1080)', 'MP4 16:9 4K', 'Thumbnail PNG 1280×720'],
  explainer: ['MP4 16:9', 'MP4 9:16', 'MP4 1:1'],
  pdf: ['PDF A4', 'PDF Letter'],
  carousel: ['PNG 1080×1350 (4:5)', 'PNG 1080×1080 (1:1)', 'PDF (LinkedIn)'],
  ad: ['MP4 9:16', 'MP4 1:1', 'MP4 16:9', 'PNG 1080×1080', 'PNG 1080×1350', 'PNG 1200×628'],
};
const categoryOf = (s: Style) => s.content_type;

export function Styles({ params }: { params: URLSearchParams }) {
  const { data, api, can, run } = useStore();
  const caps = useCapabilities();
  const initial = (params.get('category') as ContentType | null) ?? 'reel';
  const [tab, setTab] = useState<ContentType | 'archived'>(TYPES[initial as ContentType] ? initial : 'reel');
  const [open, setOpen] = useState<Style | null>(null);
  const manage = can('styles.manage');
  useEffect(() => { if (params.get('new') && manage) void createStyle((params.get('category') as ContentType) ?? 'reel'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return null;
  const visible = data.styles.filter((s) => !s.archived);
  const list = tab === 'archived' ? data.styles.filter((s) => s.archived) : visible.filter((s) => categoryOf(s) === tab);

  async function createStyle(type: ContentType) {
    const s = await run(() => api.saveStyle({ name: `New ${TYPES[type].name} style`, category: TYPES[type].cat, content_type: type, description: '', status: 'draft', active: false, is_custom: true, spec: [], output_formats: [], required_assets: [], execution_config: {}, reference_asset_ids: [] }), 'Style created');
    if (s) { setTab(type); setOpen(s); navigate('/styles'); }
  }

  return (
    <div className="page">
      <div className="page-head"><div><h1>Creative Styles</h1><p className="lead">{manage ? 'ABET’s approved looks, built from your references. Only approved, active styles with a working production template can generate content.' : 'ABET’s approved looks. Pick one in Content Studio.'}</p></div>
        <div className="actions">{manage && tab !== 'archived' && <button className="btn primary" onClick={() => createStyle(tab as ContentType)}><Icon name="plus" />New {TYPES[tab as ContentType].name} style</button>}</div></div>
      <div className="tabs" role="tablist">
        {TYPE_KEYS.map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{TYPES[k].name} <span className="c">{visible.filter((s) => categoryOf(s) === k).length}</span></button>)}
        {manage && <button role="tab" aria-selected={tab === 'archived'} onClick={() => setTab('archived')}>Archived <span className="c">{data.styles.filter((s) => s.archived).length}</span></button>}
      </div>
      {list.length ? (
        <div className="gallery">
          {list.map((s) => {
            const built = !!rendererFor(s.template_kind) && !!caps?.renderers.includes(s.template_kind ?? '');
            return (
              <button key={s.id} className="sty" onClick={() => setOpen(s)}>
                <StylePreview assetId={s.preview_asset_id} motif={s.motif} />
                <span className="sty-b"><b>{s.name}</b><p>{s.description || 'No description yet'}</p>
                  {manage && <span className="sc-meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <Chip cls={STYLE_STATUS[s.status].cls}>{STYLE_STATUS[s.status].label}</Chip>
                    <Chip cls={s.active ? 'st-ok' : 'st-off'}>{s.active ? 'Active' : 'Inactive'}</Chip>
                    <Chip cls={built ? 'st-ok' : 'st-warn'}>{built ? 'Template ready' : 'No template yet'}</Chip>
                  </span>}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="panel"><Empty icon="palette" title={tab === 'archived' ? 'Nothing archived' : `No ${TYPES[tab as ContentType].name} styles yet`}
          action={manage && tab !== 'archived' ? <button className="btn primary sm" onClick={() => createStyle(tab as ContentType)}><Icon name="plus" size={16} />Add a style</button> : undefined}>
          {tab === 'archived' ? 'Archived styles are hidden from everyone and can be restored.' : manage ? 'Add a style, upload your reference videos or designs, and ask Claude to build its production template. It goes live once you approve it.' : 'An admin adds approved styles here.'}
        </Empty></div>
      )}
      {open && <StyleEditor style={open} onClose={() => setOpen(null)} onSaved={setOpen} />}
    </div>
  );
}

function StyleEditor({ style, onClose, onSaved }: { style: Style; onClose: () => void; onSaved: (s: Style) => void }) {
  const { api, run, can } = useStore();
  const caps = useCapabilities();
  const manage = can('styles.manage');
  const canApprove = manage && can('content.approve');
  const [d, setD] = useState<Style>(style);
  const [cfg, setCfg] = useState(JSON.stringify(style.execution_config ?? {}, null, 2));
  const [cfgErr, setCfgErr] = useState<string | null>(null);
  const [refs, setRefs] = useState<Asset[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const loadRefs = useCallback(async () => { const all = await api.listAssets(); setRefs(all.filter((a) => d.reference_asset_ids.includes(a.id))); }, [api, d.reference_asset_ids]);
  useEffect(() => { setD(style); setCfg(JSON.stringify(style.execution_config ?? {}, null, 2)); }, [style]);
  useEffect(() => { loadRefs(); }, [loadRefs]);
  const type = (d.content_type ?? 'reel') as ContentType;
  const built = !!rendererFor(d.template_kind) && !!caps?.renderers.includes(d.template_kind ?? '');
  const renderers = Object.values(RENDERERS).filter((r) => r.contentTypes.includes(type));

  const save = async (patch: Partial<Style> = {}) => {
    let execution_config = d.execution_config;
    try { execution_config = cfg.trim() ? JSON.parse(cfg) : {}; setCfgErr(null); } catch { setCfgErr('Execution settings must be valid JSON.'); return; }
    const s = await run(() => api.saveStyle({ ...d, execution_config, ...patch }), 'Style saved');
    if (s) { setD(s); onSaved(s); }
  };
  const upload = async (files: FileList | null, as: 'reference' | 'preview') => {
    if (!files?.length) return;
    setBusy(true);
    const ids: string[] = [];
    for (const f of Array.from(files)) { const a = await run(() => api.uploadAsset(f, null, 'Reference')); if (a) ids.push(a.id); }
    setBusy(false);
    if (!ids.length) return;
    if (as === 'preview') await save({ preview_asset_id: ids[0] });
    else await save({ reference_asset_ids: [...d.reference_asset_ids, ...ids] });
  };

  if (!manage) return (
    <Drawer title={style.name} onClose={onClose}>
      <StylePreview assetId={style.preview_asset_id} motif={style.motif} />
      <p style={{ color: 'var(--text-2)' }}>{style.description}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Chip>{TYPES[type].name}</Chip>{style.output_formats.map((f) => <Chip key={f}>{f}</Chip>)}</div>
      <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => navigate(`/studio?type=${type}`)}><Icon name="wand" />Create with this style</button>
      {style.spec.length > 0 && <details className="specs"><summary><Icon name="chevR" size={16} />Creative specifications</summary><dl className="spec">{style.spec.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></details>}
    </Drawer>
  );

  return (
    <Drawer title="Creative style" onClose={onClose} actions={<button className="btn sm primary" onClick={() => save()}><Icon name="check" size={16} />Save</button>}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip cls={STYLE_STATUS[d.status].cls}>{STYLE_STATUS[d.status].label}</Chip>
        <Chip cls={d.active ? 'st-ok' : 'st-off'}>{d.active ? 'Active' : 'Inactive'}</Chip>
        <Chip cls={built ? 'st-ok' : 'st-warn'}>{built ? 'Production template ready' : 'No production template yet'}</Chip>
      </div>

      <div className="field"><label htmlFor="sn">Style name</label><input id="sn" className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
      <div className="adv-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        <div className="field"><label htmlFor="sc">Category</label><select id="sc" className="select" value={type} onChange={(e) => setD({ ...d, content_type: e.target.value as ContentType, category: TYPES[e.target.value as ContentType].cat })}>{TYPE_KEYS.map((k) => <option key={k} value={k}>{TYPES[k].name}</option>)}</select></div>
        <div className="field"><label htmlFor="ss">Status</label><select id="ss" className="select" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as StyleStatus })}>
          {(Object.keys(STYLE_STATUS) as StyleStatus[]).map((k) => <option key={k} value={k} disabled={k === 'approved' && !canApprove}>{STYLE_STATUS[k].label}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor="sd">Short description</label><textarea id="sd" className="textarea" rows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3>Reference videos and images</h3>
        {refs.map((r) => <div key={r.id} className="handle"><Icon name={r.name.match(/\.(mp4|mov|webm|m4v)$/i) ? 'film' : 'image'} size={16} /><span>{r.name}</span><span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{fmtBytes(r.size_bytes)}</span>
          <button className="icon-btn" aria-label={`Remove ${r.name}`} onClick={() => save({ reference_asset_ids: d.reference_asset_ids.filter((x) => x !== r.id) })}><Icon name="x" /></button></div>)}
        <label className={`dropzone${over ? ' on' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files, 'reference'); }}>
          {busy ? <Icon name="loader" spin size={22} /> : <Icon name="upload" size={22} />}<b>Upload references</b><span>Videos, images or design files, up to 50 MB each.</span>
          <input type="file" hidden multiple accept="video/*,image/*,application/pdf" onChange={(e) => upload(e.target.files, 'reference')} /></label>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3>Preview</h3>
        <StylePreview assetId={d.preview_asset_id} motif={d.motif} />
        <label className="btn sm" style={{ alignSelf: 'flex-start' }}><Icon name="upload" size={16} />{d.preview_asset_id ? 'Replace preview' : 'Upload preview'}<input type="file" hidden accept="video/*,image/*" onChange={(e) => upload(e.target.files, 'preview')} /></label>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3>Production template</h3>
        {renderers.length ? (
          <select className="select" value={d.template_kind ?? ''} onChange={(e) => setD({ ...d, template_kind: e.target.value || null })} aria-label="Production template">
            <option value="">Not built yet</option>{renderers.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        ) : <Notice icon="info">No production template exists for this style yet. Upload your references, set the status to <b>In development</b>, and ask Claude (in Claude Code) to build the template from them. It then appears here to select, and you approve the style.</Notice>}
        <div className="field"><span className="lbl">Supported output formats</span>
          <div className="sugg">{FORMATS[type].map((f) => <button key={f} type="button" aria-pressed={d.output_formats.includes(f)} style={d.output_formats.includes(f) ? { borderColor: 'var(--text)', color: 'var(--text)' } : undefined}
            onClick={() => setD({ ...d, output_formats: d.output_formats.includes(f) ? d.output_formats.filter((x) => x !== f) : [...d.output_formats, f] })}>{d.output_formats.includes(f) ? '✓ ' : ''}{f}</button>)}</div></div>
        <div className="field"><label htmlFor="ra">Required assets (one per line)</label><textarea id="ra" className="textarea" rows={3} placeholder={'e.g. Presenter footage (talking head)\nB-roll of trading screens'} value={d.required_assets.join('\n')} onChange={(e) => setD({ ...d, required_assets: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} /></div>
        <details className="specs"><summary><Icon name="chevR" size={16} />Execution settings (advanced)</summary><div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p className="muted" style={{ fontSize: 12 }}>Settings passed to the production template, such as colours, durations and font sizes. Changing them updates the style without redeploying the dashboard.</p>
          <textarea className="textarea" rows={6} value={cfg} onChange={(e) => setCfg(e.target.value)} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 }} aria-label="Execution settings JSON" />
          {cfgErr && <Notice kind="err" icon="alert">{cfgErr}</Notice>}</div></details>
      </section>

      <details className="specs"><summary><Icon name="chevR" size={16} />Creative specifications</summary><div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p className="muted" style={{ fontSize: 12 }}>Typography, composition, pacing, transitions, easing, captions, sound. Filled in when Claude analyses your references.</p>
        {d.spec.map(([k, v], n) => (
          <div key={n} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 32px', gap: 8 }}>
            <input className="input" value={k} aria-label="Specification name" onChange={(e) => setD({ ...d, spec: d.spec.map((x, i) => (i === n ? [e.target.value, x[1]] : x)) })} />
            <input className="input" value={v} aria-label={k} onChange={(e) => setD({ ...d, spec: d.spec.map((x, i) => (i === n ? [x[0], e.target.value] : x)) })} />
            <button className="icon-btn" aria-label="Remove" onClick={() => setD({ ...d, spec: d.spec.filter((_, i) => i !== n) })}><Icon name="x" /></button>
          </div>
        ))}
        <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setD({ ...d, spec: [...d.spec, ['', '']] })}><Icon name="plus" size={16} />Add specification</button>
      </div></details>

      <section className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="setting" style={{ padding: 0, border: 0 }}><div className="st-t"><b>Active</b><span>Active, approved styles are available to the whole team in Content Studio.</span></div>
          <label className="switch"><input type="checkbox" checked={d.active} disabled={d.status !== 'approved'} onChange={(e) => save({ active: e.target.checked })} aria-label="Active" /><span /></label></div>
        {d.status !== 'approved' && <span className="muted" style={{ fontSize: 12 }}>Approve the style to activate it.</span>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canApprove && d.status !== 'approved' && <button className="btn sm primary" onClick={() => save({ status: 'approved', active: true })}><Icon name="check" size={16} />Approve and activate</button>}
          {d.archived ? <button className="btn sm" onClick={() => save({ archived: false })}><Icon name="refresh" size={16} />Restore</button>
            : <button className="btn sm ghost" onClick={async () => { await save({ archived: true, active: false }); onClose(); }}><Icon name="archive" size={16} />Archive</button>}
        </div>
      </section>
    </Drawer>
  );
}
