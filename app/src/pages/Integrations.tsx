import { useState } from 'react';
import { useStore } from '../data/store';
import { Icon } from '../components/Icon';
import { Chip, Notice, Panel } from '../components/ui';
import { PLAT, PLAT_KEYS } from '../lib/constants';
import { linkProps } from '../lib/router';

type Result = { ok: boolean; text: string; at: number } | 'running' | undefined;

export function Integrations() {
  const { api, data } = useStore();
  const [db, setDb] = useState<Result>();
  const [st, setSt] = useState<Result>();
  const test = async () => {
    setDb('running'); setSt('running');
    const t0 = performance.now();
    try {
      const h = await api.health();
      const ms = Math.round(performance.now() - t0);
      setDb({ ok: h.database, text: h.database ? `Responded in ${ms} ms` : h.detail ?? 'No response', at: Date.now() });
      setSt({ ok: h.storage, text: h.storage ? 'File storage is reachable' : h.detail ?? 'No response', at: Date.now() });
    } catch (e) {
      const text = (e as Error).message; setDb({ ok: false, text, at: Date.now() }); setSt({ ok: false, text, at: Date.now() });
    }
  };
  const chip = (r: Result) => r === 'running' ? <Chip cls="st-Generating" icon="loader">Testing</Chip> : r ? (r.ok ? <Chip cls="st-ok">Connected</Chip> : <Chip cls="st-Error">Problem</Chip>) : <Chip cls="st-off">Not tested</Chip>;
  const res = (r: Result) => r && r !== 'running' ? <div className="res">{r.text} · {new Date(r.at).toLocaleTimeString('en-GB')}</div> : null;

  return (
    <div className="page">
      <div className="page-head"><div><h1>AI & Integrations</h1><p className="lead">The services behind the dashboard, and what each one is connected to.</p></div>
        <div className="actions"><button className="btn" onClick={test}><Icon name="refresh" />Test connections</button></div></div>
      <div className="conn-grid">
        <section className="panel conn"><div className="conn-top"><span className="ico"><Icon name="drive" /></span><b>Database</b>{chip(db)}</div>
          <p>{api.mode === 'demo' ? 'Demo mode: sample data held in this browser tab.' : 'Supabase (Tokyo). Content, scripts, team and approvals. Rules are enforced in the database.'}</p>{res(db)}
          <div className="cf"><button className="btn sm" onClick={test}><Icon name="zap" size={16} />Test connection</button></div></section>
        <section className="panel conn"><div className="conn-top"><span className="ico"><Icon name="cloud" /></span><b>File storage</b>{chip(st)}</div>
          <p>Private Supabase storage. 1 GB on the free plan, 50 MB per file.</p>{res(st)}
          <div className="cf"><button className="btn sm" onClick={test}><Icon name="zap" size={16} />Test connection</button></div></section>
        <section className="panel conn"><div className="conn-top"><span className="ico"><Icon name="sparkles" /></span><b>Claude connector</b><Chip cls="st-warn">Being built</Chip></div>
          <p>Lets Claude Pro read the Brand Kit and styles and save scripts here. Until it’s live, open Claude from the Studio and paste the script back in.</p>
          <p className="muted" style={{ fontSize: 12 }}>Runs on your Claude Pro plan. No API key or extra cost.</p></section>
        <section className="panel conn"><div className="conn-top"><span className="ico"><Icon name="film" /></span><b>Video production</b><Chip cls="st-off">Manual</Chip></div>
          <p>Editors make videos from the Studio’s production brief and upload the file. Automatic rendering isn’t set up.</p></section>
      </div>
      <Panel icon="at" title="Social accounts" right={<a className="link" {...linkProps('/admin?tab=social')}>Manage <Icon name="arrowR" /></a>}>
        <div className="handles">{PLAT_KEYS.map((p) => { const s = data?.social.find((x) => x.platform === p); return <div key={p} className="handle"><span className="pl">{p}</span><span>{PLAT[p]}</span><Chip cls={s?.status === 'connected' ? 'st-ok' : 'st-off'}>{s?.status === 'connected' ? 'Connected' : s?.status === 'pending_review' ? 'In review' : 'Manual posting'}</Chip></div>; })}</div>
        <div style={{ marginTop: 12 }}><Notice>Direct posting needs each platform’s developer approval. Until then, the Publish step gives you the caption and file to post by hand.</Notice></div>
      </Panel>
    </div>
  );
}
