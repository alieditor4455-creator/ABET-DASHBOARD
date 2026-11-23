import { useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { Icon } from '../components/Icon';
import { Chip, Drawer, Empty, Thumb } from '../components/ui';
import { STYLE_CATS, TYPES, TYPE_KEYS } from '../lib/constants';
import { navigate } from '../lib/router';
import type { Asset, Style, StyleCategory } from '../lib/types';
import { fmtBytes } from '../lib/format';

const MOTIFS = ['mini', 'caption', 'doc', 'cine', 'type', 'typeled', 'mg', 'corp', 'pod', 'ugc', 'screen', 'chart', 'ui', 'split', 'data', 'fast', 'edit', 'product', 'brand', 'interview', 'post', 'carousel', 'ad', 'pdfdoc', 'pdfcheck'];

export function Styles({ params }: { params: URLSearchParams }) {
  const { data, api, can, run } = useStore();
  const [tab, setTab] = useState<StyleCategory | 'refs'>('video');
  const [open, setOpen] = useState<Style | null>(null);
  const [edit, setEdit] = useState(false);
  const [refs, setRefs] = useState<Asset[]>([]);
  const [over, setOver] = useState(false);
  const loadRefs = () => api.listAssets().then((a) => setRefs(a.filter((x) => x.kind === 'Reference')));
  useEffect(() => { loadRefs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const id = params.get('open'); const s = data?.styles.find((x) => x.id === id); if (s) { setOpen(s); setTab(s.category); } }, [params, data?.styles]);
  if (!data) return null;
  const list = data.styles.filter((s) => s.category === tab);

  const newStyle = async () => {
    const cat = tab === 'refs' ? 'video' : tab;
    const base = data.styles.find((s) => s.category === cat);
    const s = await run(() => api.saveStyle({ name: `New style ${Date.now().toString().slice(-4)}`, category: cat, description: 'Describe the look and where to use it.', motif: base?.motif ?? 'mini', complexity: 'Medium', spec: base?.spec ?? [], is_custom: true }), 'Style created');
    if (s) { setTab(cat); setOpen(s); setEdit(true); }
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files)) await run(() => api.uploadAsset(f, null, 'Reference'));
    await loadRefs();
  };

  return (
    <div className="page">
      <div className="page-head"><div><h1>Creative Styles</h1><p className="lead">Reusable looks for every format. Pick one in the Studio, or open it to see the full specification.</p></div>
        <div className="actions">{can('styles.manage') && <button className="btn" onClick={newStyle}><Icon name="plus" />New style</button>}</div></div>
      <div className="tabs" role="tablist">
        {STYLE_CATS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l} <span className="c">{data.styles.filter((s) => s.category === k).length}</span></button>)}
        <button role="tab" aria-selected={tab === 'refs'} onClick={() => setTab('refs')}>References <span className="c">{refs.length}</span></button>
      </div>
      {tab === 'refs' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {can('content.create') && <label className={`dropzone${over ? ' on' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>
            <Icon name="upload" size={22} /><b>Upload reference videos or images</b><span>Up to 50 MB each. Ask Claude to study a reference and draft a new style from it.</span>
            <input type="file" hidden multiple accept="video/*,image/*" onChange={(e) => upload(e.target.files)} /></label>}
          {refs.length ? <div className="asset-grid">{refs.map((r) => <div key={r.id} className="asset"><Thumb motif="cine" /><div className="asset-b"><b>{r.name}</b><div className="m">{fmtBytes(r.size_bytes)}</div></div></div>)}</div>
            : <div className="panel"><Empty icon="image" title="No references yet">Uploads stay private to your workspace.</Empty></div>}
        </div>
      ) : (
        <div className="gallery">
          {list.map((s) => (
            <button key={s.id} className="sty" onClick={() => { setOpen(s); setEdit(false); }}>
              <Thumb motif={s.motif}>{s.is_custom && <span className="rec">Custom</span>}</Thumb>
              <span className="sty-b"><b>{s.name}</b><p>{s.description}</p></span>
            </button>
          ))}
        </div>
      )}
      {open && <StyleDrawer style={open} startEdit={edit} onClose={() => { setOpen(null); setEdit(false); if (params.get('open')) navigate('/styles'); }} onSaved={(s) => setOpen(s)} />}
    </div>
  );
}

function StyleDrawer({ style, startEdit, onClose, onSaved }: { style: Style; startEdit: boolean; onClose: () => void; onSaved: (s: Style) => void }) {
  const { api, run, can } = useStore();
  const [editing, setEditing] = useState(startEdit);
  const [d, setD] = useState(style);
  useEffect(() => setD(style), [style]);
  const save = async () => { const s = await run(() => api.saveStyle(d), 'Style saved'); if (s) { onSaved(s); setEditing(false); } };
  const typeFor = TYPE_KEYS.find((t) => TYPES[t].cat === style.category) ?? 'reel';
  return (
    <Drawer title={editing ? 'Edit style' : style.name} onClose={onClose} actions={can('styles.manage') && !editing ? <>
      <button className="btn sm" onClick={() => setEditing(true)}><Icon name="edit" size={16} />Edit</button>
      <button className="btn sm" onClick={async () => { const s = await run(() => api.saveStyle({ ...style, id: undefined, name: `${style.name} (copy)`, is_custom: true }), 'Style duplicated'); if (s) onSaved(s); }}><Icon name="copy" size={16} />Duplicate</button>
      <button className="btn sm ghost" onClick={async () => { const s = await run(() => api.saveStyle({ ...style, archived: true }), 'Style archived'); if (s) onClose(); }}><Icon name="archive" size={16} />Archive</button></> : undefined}>
      <Thumb motif={d.motif} style={{ borderRadius: 12 }} />
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field"><label htmlFor="sn">Name</label><input id="sn" className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="sd">Description</label><textarea id="sd" className="textarea" rows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></div>
          <div className="adv-grid">
            <div className="field"><label htmlFor="sc">Complexity</label><select id="sc" className="select" value={d.complexity} onChange={(e) => setD({ ...d, complexity: e.target.value as Style['complexity'] })}><option>Low</option><option>Medium</option><option>High</option></select></div>
            <div className="field"><label htmlFor="sm">Preview picture</label><select id="sm" className="select" value={d.motif} onChange={(e) => setD({ ...d, motif: e.target.value })}>{MOTIFS.map((m) => <option key={m}>{m}</option>)}</select></div>
          </div>
          <span className="lbl" style={{ fontSize: 12.5, fontWeight: 500 }}>Specifications</span>
          {d.spec.map(([k, v], n) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '160px minmax(0,1fr) 32px', gap: 8 }}>
              <input className="input" value={k} aria-label="Label" onChange={(e) => setD({ ...d, spec: d.spec.map((x, i) => (i === n ? [e.target.value, x[1]] : x)) })} />
              <input className="input" value={v} aria-label={k} onChange={(e) => setD({ ...d, spec: d.spec.map((x, i) => (i === n ? [x[0], e.target.value] : x)) })} />
              <button className="icon-btn" aria-label="Remove" onClick={() => setD({ ...d, spec: d.spec.filter((_, i) => i !== n) })}><Icon name="x" /></button>
            </div>
          ))}
          <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setD({ ...d, spec: [...d.spec, ['New field', '']] })}><Icon name="plus" size={16} />Add specification</button>
          <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={() => { setD(style); setEditing(false); }}>Cancel</button><button className="btn primary" onClick={save}><Icon name="check" />Save style</button></div>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>{style.description}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Chip>{STYLE_CATS.find((c) => c[0] === style.category)?.[1]}</Chip><Chip>{style.complexity} complexity</Chip>{style.is_custom && <Chip cls="st-Generating">Custom</Chip>}</div>
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => navigate(`/studio?type=${typeFor}`)}><Icon name="wand" />Create with this format</button>
          <details className="specs"><summary><Icon name="chevR" size={16} />Technical specifications</summary><dl className="spec">{style.spec.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></details>
        </>
      )}
    </Drawer>
  );
}
