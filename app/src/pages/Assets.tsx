import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { Icon } from '../components/Icon';
import { Chip, Empty, Modal, Notice, Thumb } from '../components/ui';
import { PublishPanel } from './Studio';
import { fmtBytes, ago } from '../lib/format';
import { navigate } from '../lib/router';
import type { Asset } from '../lib/types';

const TABS = ['All content', 'Videos', 'Graphics', 'PDFs', 'References', 'Published', 'Archived'] as const;
type Tab = (typeof TABS)[number];
const FILTER: Record<Tab, (a: Asset) => boolean> = {
  'All content': (a) => a.state !== 'archived' && a.kind !== 'Reference',
  Videos: (a) => a.kind === 'Video' && a.state !== 'archived',
  Graphics: (a) => a.kind === 'Graphic' && a.state !== 'archived',
  PDFs: (a) => a.kind === 'PDF' && a.state !== 'archived',
  References: (a) => a.kind === 'Reference' && a.state !== 'archived',
  Published: (a) => a.state === 'published',
  Archived: (a) => a.state === 'archived',
};

export function Assets() {
  const { api, data, run, toast } = useStore();
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [tab, setTab] = useState<Tab>('All content');
  const [preview, setPreview] = useState<{ a: Asset; url: string } | null>(null);
  const [publish, setPublish] = useState<Asset | null>(null);
  const load = useCallback(async () => setAssets(await api.listAssets()), [api]);
  useEffect(() => { load(); }, [load]);
  if (!data || !assets) return <div className="page"><h1>Asset Library</h1></div>;

  const used = assets.filter((a) => a.state !== 'archived').reduce((s, a) => s + a.size_bytes, 0);
  const limit = data.settings.storage_limit_gb * 1024 ** 3;
  const pct = Math.min(100, (used / limit) * 100);
  const list = assets.filter(FILTER[tab]);
  const itemOf = (a: Asset) => data.items.find((i) => i.id === a.item_id);
  const motifOf = (a: Asset) => data.styles.find((s) => s.id === itemOf(a)?.style_id)?.motif ?? (a.kind === 'PDF' ? 'pdfdoc' : a.kind === 'Graphic' ? 'post' : 'cine');
  const url = async (a: Asset) => { try { const u = await api.assetUrl(a); if (!u) toast('Sample item: no real file in demo mode', 'info'); return u; } catch { toast('Couldn’t get the file link', 'alert'); return ''; } };

  return (
    <div className="page">
      <div className="page-head"><div><h1>Asset Library</h1><p className="lead">Every finished file and reference, stored privately for the team.</p></div></div>
      <section className="panel"><div className="panel-b storage" style={{ paddingTop: 16, paddingBottom: 16 }}>
        <div className="s-l"><span className="muted" style={{ fontSize: 12.5, display: 'block' }}>Storage used</span><b className="num">{fmtBytes(used)}</b> <span className="muted">of {data.settings.storage_limit_gb} GB</span></div>
        <div className={`bar ${pct > 85 ? 'brand' : ''}`}><span style={{ width: `${pct}%` }} /></div>
        <span className="muted" style={{ fontSize: 12 }}>Files are never deleted automatically. Archive moves a file out of the main view and keeps it.</span>
      </div></section>
      {pct > 85 && <Notice kind="warn" icon="alert">Storage is almost full. The free plan holds 1 GB. Archive old drafts or ask an admin about adding Cloudflare R2 storage.</Notice>}
      <div className="tabs" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={t === tab} onClick={() => setTab(t)}>{t} <span className="c">{assets.filter(FILTER[t]).length}</span></button>)}</div>
      {list.length ? (
        <div className="asset-grid">
          {list.map((a) => {
            const it = itemOf(a);
            return (
              <article key={a.id} className="asset">
                <Thumb motif={motifOf(a)}><span className="ar">{a.kind}</span>
                  <span className="acts">
                    <button aria-label="Preview" title="Preview" onClick={async () => { const u = await url(a); if (u) setPreview({ a, url: u }); }}><Icon name="eye" size={16} /></button>
                    <button aria-label="Download" title="Download" onClick={async () => { const u = await url(a); if (u) window.open(u, '_blank', 'noopener'); }}><Icon name="download" size={16} /></button>
                    {it && <button aria-label="Open in Studio" title="Open in Studio" onClick={() => navigate(`/studio/${it.id}`)}><Icon name="repeat" size={16} /></button>}
                    {it && (it.status === 'approved' || it.status === 'completed') && a.state !== 'archived' && <button aria-label="Publish" title="Publish" onClick={() => setPublish(a)}><Icon name="send" size={16} /></button>}
                    <button aria-label={a.state === 'archived' ? 'Restore' : 'Archive'} title={a.state === 'archived' ? 'Restore' : 'Archive'}
                      onClick={() => run(() => api.updateAsset(a.id, { state: a.state === 'archived' ? (it?.published_at ? 'published' : 'ready') : 'archived' }), a.state === 'archived' ? 'Restored' : 'Archived. The file is kept').then(load)}><Icon name={a.state === 'archived' ? 'refresh' : 'archive'} size={16} /></button>
                  </span></Thumb>
                <div className="asset-b"><b title={a.name}>{a.name}</b>
                  <div className="m"><span>{fmtBytes(a.size_bytes)}</span>·<span>{ago(a.created_at)}</span><Chip cls={a.state === 'published' ? 'st-Completed' : a.state === 'archived' ? 'st-off' : it?.status === 'in_review' ? 'st-InReview' : 'st-ok'}>{a.state === 'ready' && it?.status === 'in_review' ? 'In review' : a.state[0].toUpperCase() + a.state.slice(1)}</Chip></div></div>
              </article>
            );
          })}
        </div>
      ) : <div className="panel"><Empty icon="folder" title="Nothing here yet">{tab === 'Archived' ? 'Archived files are kept and can be restored.' : 'Files uploaded in the Studio’s Production step are saved here automatically.'}</Empty></div>}

      {preview && <Modal title={preview.a.name} onClose={() => setPreview(null)} wide>
        <div className="media-frame">{/\.(mp4|mov|webm|m4v)$/i.test(preview.a.name) ? <video src={preview.url} controls playsInline /> : /\.(png|jpe?g|gif|webp|svg)$/i.test(preview.a.name) ? <img src={preview.url} alt={preview.a.name} /> : <a className="btn" href={preview.url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} />Open file</a>}</div>
      </Modal>}
      {publish && itemOf(publish) && <Modal title={`Publish “${itemOf(publish)!.title}”`} onClose={() => setPublish(null)} wide>
        <PublishPanel item={itemOf(publish)!} assets={[publish]} onDone={() => { setPublish(null); load(); }} />
      </Modal>}
    </div>
  );
}
