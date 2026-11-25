import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { Icon } from '../components/Icon';
import { Drawer, Empty, Notice } from '../components/ui';
import { TYPES, TYPE_KEYS } from '../lib/constants';
import { ago } from '../lib/format';
import { navigate } from '../lib/router';
import type { Asset, ContentType, StyleReference } from '../lib/types';

/** Thumbnail for a reference: image, video frame, PDF icon or link domain. */
export function RefThumb({ r, asset }: { r: StyleReference; asset?: Asset }) {
  const { api } = useStore();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let on = true; if (asset) api.assetUrl(asset).then((u) => on && setUrl(u || null), () => {}); return () => { on = false; }; }, [api, asset]);
  const path = asset?.storage_path ?? '';
  const isVid = /\.(mp4|mov|webm|m4v)$/i.test(path);
  const isImg = /\.(png|jpe?g|gif|webp)$/i.test(path);
  const box: React.CSSProperties = { display: 'grid', placeItems: 'center', width: '100%', aspectRatio: '16/10', background: 'var(--surface-3)', borderRadius: 'var(--r-md)', overflow: 'hidden', color: 'var(--muted)' };
  if (url && isImg) return <span style={box}><img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></span>;
  if (url && isVid) return <span style={box}><video src={`${url}#t=1`} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></span>;
  let host = '';
  try { host = r.url ? new URL(r.url).hostname.replace(/^www\./, '') : ''; } catch { /* bad link */ }
  return <span style={box}><span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 12.5 }}><Icon name={r.url && !asset ? 'external' : asset ? 'file' : 'image'} size={22} />{host || asset?.name || ''}</span></span>;
}

export function References({ initial }: { initial: ContentType }) {
  const { api, run, can, data, session } = useStore();
  const [tab, setTab] = useState<ContentType>(initial);
  const [refs, setRefs] = useState<StyleReference[] | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);
  const manage = can('styles.manage');
  const load = useCallback(async () => {
    const [r, a] = await Promise.all([api.listReferences(), api.listAssets()]);
    setRefs(r); setAssets(a.filter((x) => x.kind === 'Reference'));
  }, [api]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSel([]); }, [tab]);

  const list = (refs ?? []).filter((r) => r.content_type === tab);
  const name = (id: string) => data?.profiles.find((p) => p.id === id)?.full_name ?? 'Someone';
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 8 ? s : [...s, id]));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p className="muted" style={{ fontSize: 13, maxWidth: 640 }}>Collect videos, designs and links you like for each category. Use one when you create content (“Make it like this”), or{manage ? ' select a few and ' : ' ask an admin to '}turn them into a new ABET style that Claude builds for approval.</p>
        {can('content.create') && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Add reference</button>}
      </div>
      <div className="tabs" role="tablist">
        {TYPE_KEYS.map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{TYPES[k].name} <span className="c">{(refs ?? []).filter((r) => r.content_type === k).length}</span></button>)}
      </div>
      {manage && sel.length > 0 && (
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', flexWrap: 'wrap' }}>
          <b style={{ fontWeight: 500 }}>{sel.length} selected</b>
          <button className="btn sm ghost" onClick={() => setSel([])}>Clear</button>
          <button className="btn sm primary" style={{ marginLeft: 'auto' }} onClick={() => setAsking(true)}><Icon name="sparkles" size={16} />Turn into a style</button>
        </div>
      )}
      {refs === null ? <div className="panel"><div className="writing"><div className="ln" style={{ width: '40%' }} /><div className="ln" style={{ width: '70%' }} /></div></div>
        : list.length ? (
          <div className="gallery">
            {list.map((r) => {
              const asset = assets.find((a) => a.id === r.asset_id);
              const on = sel.includes(r.id);
              return (
                <div key={r.id} className={`sty${on ? ' sel' : ''}`} style={{ cursor: 'default' }}>
                  <div style={{ position: 'relative', padding: 8, paddingBottom: 0 }}>
                    <RefThumb r={r} asset={asset} />
                    {manage && <label style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', borderRadius: 999, padding: '4px 10px', fontSize: 12, boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,.1))' }}>
                      <input type="checkbox" checked={on} onChange={() => toggle(r.id)} aria-label={`Select ${r.title}`} />Select</label>}
                  </div>
                  <span className="sty-b"><b>{r.title}</b>{r.notes && <p>{r.notes}</p>}
                    <span className="muted" style={{ fontSize: 11.5 }}>{name(r.created_by)} · {ago(r.created_at)}</span>
                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      <button className="btn sm" onClick={() => navigate(`/studio?type=${r.content_type}&ref=${r.id}`)}><Icon name="sparkles" size={15} />Make it like this</button>
                      {asset && <button className="btn sm ghost" onClick={async () => { const u = await api.assetUrl(asset).catch(() => ''); if (u) window.open(u, '_blank', 'noopener'); }}><Icon name="eye" size={15} />Open</button>}
                      {!asset && r.url && <a className="btn sm ghost" href={r.url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={15} />Open</a>}
                      {(manage || r.created_by === session?.userId) && <button className="btn sm ghost" onClick={() => run(async () => { await api.archiveReference(r.id, true); await load(); }, 'Reference removed')} aria-label={`Remove ${r.title}`}><Icon name="archive" size={15} /></button>}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="panel"><Empty icon="image" title={`No ${TYPES[tab].name} references yet`} action={can('content.create') ? <button className="btn primary sm" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add reference</button> : undefined}>
            Add videos, designs or links whose look you like. Files work best: Claude can study them frame by frame.
          </Empty></div>
        )}
      {adding && <AddReference type={tab} onClose={() => setAdding(false)} onAdded={async (t) => { setAdding(false); setTab(t); await load(); }} />}
      {asking && <RequestStyle type={tab} ids={sel} onClose={() => setAsking(false)} onDone={() => { setAsking(false); setSel([]); navigate(`/styles?view=styles&category=${tab}`); }} />}
    </>
  );
}

function AddReference({ type, onClose, onAdded }: { type: ContentType; onClose: () => void; onAdded: (t: ContentType) => void }) {
  const { api, run } = useStore();
  const [t, setT] = useState<ContentType>(type);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const tooBig = files.some((f) => f.size > 50 * 1024 * 1024);
  const linkOk = !url.trim() || /^https?:\/\/\S+$/i.test(url.trim());
  const ready = title.trim() && (files.length || url.trim()) && linkOk && !tooBig;
  const save = async () => {
    setBusy(true);
    let okCount = 0;
    if (files.length) {
      for (const [i, f] of files.entries()) {
        const r = await run(() => api.addReference({ content_type: t, title: files.length > 1 ? `${title.trim()} (${i + 1})` : title.trim(), notes, url: url.trim() || null }, f));
        if (r) okCount++;
      }
    } else if (await run(() => api.addReference({ content_type: t, title: title.trim(), notes, url: url.trim() }))) okCount++;
    setBusy(false);
    if (okCount) onAdded(t);
  };
  return (
    <Drawer title="Add reference" onClose={onClose} actions={<button className="btn primary" disabled={!ready || busy} onClick={save}>{busy ? <Icon name="loader" spin size={16} /> : <Icon name="check" />}Save</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field"><label htmlFor="rc">Category</label><select id="rc" className="select" value={t} onChange={(e) => setT(e.target.value as ContentType)}>{TYPE_KEYS.map((k) => <option key={k} value={k}>{TYPES[k].name}</option>)}</select></div>
        <div className="field"><label htmlFor="rt">Name</label><input id="rt" className="input" maxLength={100} placeholder="e.g. Academy film, Bold red poster" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label htmlFor="rn">What do you like about it?</label><textarea id="rn" className="textarea" rows={3} maxLength={1000} placeholder="e.g. The glowing cards, the word-by-word captions, the calm pacing" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="field"><label htmlFor="rf">Files (videos, images or PDFs, up to 50 MB each)</label><input id="rf" type="file" multiple accept="video/*,image/*,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          {tooBig && <Notice kind="err" icon="alert">One file is over 50 MB. Trim it or export a smaller version.</Notice>}</div>
        <div className="field"><label htmlFor="ru">Or a link (optional)</label><input id="ru" className="input" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          {!linkOk && <span className="muted" style={{ fontSize: 12 }}>Links start with https://</span>}
          <span className="muted" style={{ fontSize: 12 }}>Files work best. Claude may not be able to open Instagram or TikTok links.</span></div>
      </div>
    </Drawer>
  );
}

function RequestStyle({ type, ids, onClose, onDone }: { type: ContentType; ids: string[]; onClose: () => void; onDone: () => void }) {
  const { api, run, refresh } = useStore();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const send = async () => {
    const s = await run(() => api.requestStyle({ name, content_type: type, reference_ids: ids, note }), 'Sent to Claude: you’ll be notified when the style is ready to approve');
    if (s) { await refresh(); onDone(); }
  };
  return (
    <Drawer title="Turn into a style" onClose={onClose} actions={<button className="btn primary" disabled={!name.trim()} onClick={send}><Icon name="sparkles" />Ask Claude to build it</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p className="muted" style={{ fontSize: 13 }}>Claude studies the {ids.length} selected {TYPES[type].name} reference{ids.length === 1 ? '' : 's'}, adapts the look to ABET’s brand and compliance rules, renders a preview and saves it as a draft style. You approve it before the team can use it.</p>
        <div className="field"><label htmlFor="sn">Style name</label><input id="sn" className="input" maxLength={60} placeholder="e.g. Academy Orbit" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="snote">Notes for Claude (optional)</label><textarea id="snote" className="textarea" rows={3} maxLength={600} placeholder="e.g. Keep the dark look but use more ABET red. Slower pacing." value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <Notice icon="info">Claude builds new styles during its hourly run (9am–9pm Pakistan time).</Notice>
      </div>
    </Drawer>
  );
}
