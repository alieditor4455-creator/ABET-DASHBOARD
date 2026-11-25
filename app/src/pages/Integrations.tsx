import { useEffect, useState } from 'react';
import { useCapabilities } from './Studio';
import { ago } from '../lib/format';
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
  const caps = useCapabilities();
  const [conns, setConns] = useState<number | null>(null);
  const [ws, setWs] = useState<Awaited<ReturnType<typeof api.workerStatus>> | null>(null);
  useEffect(() => {
    api.claudeConnections().then((c) => setConns(c.length), () => setConns(null));
    api.workerStatus().then(setWs, () => setWs(null));
  }, [api]);
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
        <section className="panel conn"><div className="conn-top"><span className="ico"><Icon name="sparkles" /></span><b>Claude connector</b><Chip cls="st-ok">Live</Chip></div>
          <p>Claude (Claude chat or Claude Code) connects to the dashboard to read the Brand Kit and styles, write scripts, and make videos from the queue. Address: <code>{typeof window !== 'undefined' ? window.location.origin : ''}/mcp</code></p>
          <p className="muted" style={{ fontSize: 12 }}>{conns === null ? 'Checking your connections…' : conns ? `You have connected Claude ${conns} time${conns === 1 ? '' : 's'}. Manage it in Account & security.` : 'You haven’t connected Claude from your account yet.'}</p></section>
        <section className="panel conn"><div className="conn-top"><span className="ico"><Icon name="cpu" /></span><b>Claude API</b>{caps ? (caps.claudeApi ? <Chip cls="st-ok">Live</Chip> : <Chip cls="st-off">Not set</Chip>) : <Chip cls="st-off">…</Chip>}</div>
          <p>Writes scripts inside the dashboard when someone clicks <b>Write script only</b>. {caps?.claudeApi ? 'Uses ABET’s Anthropic API key (set in Netlify), billed per use.' : 'Without a key, scripts go to the Claude queue instead.'}</p></section>
        <section className="panel conn"><div className="conn-top"><span className="ico"><Icon name="film" /></span><b>Claude video worker</b>{ws ? (ws.running ? <Chip cls="st-Generating" icon="loader">Working</Chip> : <Chip cls="st-ok">Scheduled</Chip>) : <Chip cls="st-off">…</Chip>}</div>
          <p>Makes the videos, carousels, PDFs and ads requested in Content Studio, and builds new styles from references. Runs every hour, 9am–9pm (Pakistan time), on ABET’s Claude account.</p>
          {ws && <p className="muted" style={{ fontSize: 12 }}>{ws.waiting} waiting · {ws.running} in progress{ws.styleRequests ? ` · ${ws.styleRequests} style request${ws.styleRequests === 1 ? '' : 's'}` : ''} · {ws.last ? `last ${ws.last.status === 'succeeded' ? 'delivered' : 'failed'} ${ago(ws.last.at)}${ws.last.worker ? ` by ${ws.last.worker}` : ''}` : 'nothing made yet'}</p>}</section>
        <section className="panel conn"><div className="conn-top"><span className="ico"><Icon name="megaphone" /></span><b>Voiceover</b><Chip cls="st-off">Captions only</Chip></div>
          <p>Videos use word-by-word captions. A free AI voice (Kokoro) is ready to add to the video worker when you want voiceovers.</p></section>
      </div>
      <Panel icon="at" title="Social accounts" right={<a className="link" {...linkProps('/admin?tab=social')}>Manage <Icon name="arrowR" /></a>}>
        <div className="handles">{PLAT_KEYS.map((p) => { const s = data?.social.find((x) => x.platform === p); return <div key={p} className="handle"><span className="pl">{p}</span><span>{PLAT[p]}</span><Chip cls={s?.status === 'connected' ? 'st-ok' : 'st-off'}>{s?.status === 'connected' ? 'Connected' : s?.status === 'pending_review' ? 'In review' : 'Manual posting'}</Chip></div>; })}</div>
        <div style={{ marginTop: 12 }}><Notice>Direct posting needs each platform’s developer approval. Until then, the Publish step gives you the caption and file to post by hand.</Notice></div>
      </Panel>
    </div>
  );
}
