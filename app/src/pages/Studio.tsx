import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../data/store';
import { Icon } from '../components/Icon';
import { Avatar, Chip, CopyButton, Empty, Notice, Panel, StatusChip, Thumb } from '../components/ui';
import { Comments } from '../components/Account';
import { PLAT, PLAT_KEYS, PLAT_LIMIT, ROLE_LABEL, TOPIC_SUGGESTIONS, TYPES, TYPE_KEYS } from '../lib/constants';
import { canGenerate, rendererFor, workerConfig } from '../lib/renderers';
import { claudePrompt, complianceCheck, makeCaption, templateScript } from '../lib/script';
import { ago, fmtBytes, fmtDateTime, isPast, toLocalInput } from '../lib/format';
import { linkProps, navigate } from '../lib/router';
import type { Asset, ContentItem, ContentType, Platform, ProductionJob, Script, ScriptUnit, VideoRequest } from '../lib/types';

const STEPS = [['script', 'Script'], ['style', 'Style'], ['produce', 'Production'], ['review', 'Review'], ['publish', 'Publish']] as const;
type Step = (typeof STEPS)[number][0];

export function Studio({ id, params }: { id: string | null; params: URLSearchParams }) {
  const type = params.get('type') as ContentType | null;
  if (id) return <ItemWizard key={id} id={id} step={params.get('step') as Step | null} />;
  if (type && TYPES[type]) return <NewTopic type={type} />;
  return <StudioHome />;
}

/* ------------------------------------------------------------------ home */
function StudioHome() {
  const { data, can } = useStore();
  const drafts = (data?.items ?? []).filter((i) => i.status === 'draft' && !i.needs_script).slice(0, 8);
  const queued = (data?.items ?? []).filter((i) => i.needs_script);
  return (
    <div className="page">
      <div className="studio-hero"><h1>What would you like to create?</h1><p>Choose a category, enter a topic, pick one of ABET’s approved styles and click Generate.</p></div>
      {!can('content.create') && <Notice kind="warn" icon="lock">Your role can review content but not create it. Ask an admin if you need to create.</Notice>}
      <div className="type-grid">
        {TYPE_KEYS.map((k) => (
          <a key={k} className="type-card" {...linkProps(`/studio?type=${k}`)} aria-disabled={!can('content.create')}>
            <span className="t-ico"><Icon name={TYPES[k].icon} size={22} /></span>
            <span><b>{TYPES[k].name}</b><p>{TYPES[k].desc}</p><small>{TYPES[k].meta}</small></span>
          </a>
        ))}
      </div>
      {queued.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><h2>In the Claude queue</h2><Chip cls="st-Generating">{queued.length}</Chip></div>
          <Notice icon="sparkles">To work through the queue, ask Claude: <b>“Write scripts for everything in the ABET Content OS Claude queue.”</b></Notice>
          <div className="drafts">
            {queued.map((i) => (
              <a key={i.id} className="draft-card" {...linkProps(`/studio/${i.id}`)}>
                <span className="t-ico"><Icon name="sparkles" size={16} /></span>
                <span style={{ minWidth: 0 }}><b>{i.title}</b><span>{TYPES[i.type].name} · {i.request_note ?? 'waiting for Claude'}</span></span>
              </a>
            ))}
          </div>
        </section>
      )}
      {drafts.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}><h2>Continue a draft</h2><a className="link" style={{ marginLeft: 'auto' }} {...linkProps('/production')}>All drafts <Icon name="arrowR" /></a></div>
          <div className="drafts">
            {drafts.map((i) => (
              <a key={i.id} className="draft-card" {...linkProps(`/studio/${i.id}`)}>
                <span className="t-ico"><Icon name={TYPES[i.type].icon} size={16} /></span>
                <span style={{ minWidth: 0 }}><b>{i.title}</b><span>{TYPES[i.type].name} · {ago(i.updated_at)}</span></span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ create: topic + style + generate */
const AUDIENCES = ['Complete beginners', 'Beginner traders', 'Intermediate traders', 'Experienced traders', 'Existing ABET clients', 'Potential clients'];
const OBJECTIVES = ['Awareness', 'Education', 'Engagement', 'Brand trust', 'Lead generation', 'Conversion', 'Retention'];

export function useCapabilities() {
  const { api } = useStore();
  const [caps, setCaps] = useState<{ claudeApi: boolean; renderers: string[] } | null>(null);
  useEffect(() => { api.capabilities().then(setCaps).catch(() => setCaps({ claudeApi: false, renderers: [] })); }, [api]);
  return caps;
}

export function StylePreview({ assetId, motif }: { assetId: string | null; motif?: string }) {
  const { api } = useStore();
  const [url, setUrl] = useState<{ u: string; video: boolean } | null>(null);
  useEffect(() => {
    let on = true;
    if (!assetId) { setUrl(null); return; }
    api.listAssets().then(async (all) => {
      const a = all.find((x) => x.id === assetId);
      if (!a) return;
      const u = await api.assetUrl(a).catch(() => '');
      if (on && u) setUrl({ u, video: /\.(mp4|mov|webm|m4v)$/i.test(a.name) });
    });
    return () => { on = false; };
  }, [api, assetId]);
  if (url) return <span className="thumb" style={{ display: 'block' }}>{url.video ? <video src={url.u} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={url.u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</span>;
  return <Thumb motif={motif || 'mini'} />;
}

function NewTopic({ type }: { type: ContentType }) {
  const { api, run, can, data } = useStore();
  const caps = useCapabilities();
  const T = TYPES[type];
  const [topic, setTopic] = useState('');
  const [adv, setAdv] = useState(false);
  const [audience, setAudience] = useState('');
  const [objective, setObjective] = useState('');
  const [styleId, setStyleId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'' | 'full' | 'script' | 'video'>('');
  const [note, setNote] = useState('');
  const styles = (data?.styles ?? []).filter((s) => s.content_type === type && s.status === 'approved' && s.active && !s.archived);
  const style = styles.find((s) => s.id === styleId) ?? null;
  const functional = !!style && canGenerate(style.template_kind, caps?.renderers);
  const byClaude = rendererFor(style?.template_kind)?.engine === 'claude-worker';
  const wc = workerConfig(style?.execution_config);
  const [req, setReq] = useState<VideoRequest>({ output: 'video', aspect: '16:9', length: '' });
  useEffect(() => { if (style) setReq({ output: wc.outputs[0], aspect: wc.aspects[0], length: wc.lengths[Math.min(1, wc.lengths.length - 1)] }); }, [style?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const what = req.output === 'pdf' ? 'PDF' : req.output === 'slides' ? 'carousel' : req.output === 'image' ? 'image' : 'video';
  const outLabel = { video: 'Video', image: 'Static image', slides: 'Slides', pdf: 'PDF' } as const;

  const start = async (mode: 'full' | 'script') => {
    if (!topic.trim()) return;
    const m = mode === 'full' && byClaude ? 'video' : mode;
    setBusy(m);
    const item = await run(() => api.createItem({ title: topic.trim(), topic: topic.trim(), type, style_id: style?.id ?? null, audience: audience || null, objective: objective || null }));
    if (!item) { setBusy(''); return; }
    if (note.trim()) await api.updateItem(item.id, { request_note: note.trim() }).catch(() => {});
    const r = await run(() => api.generate(item.id, m, m === 'video' ? req : undefined), m === 'video' ? `Sent to Claude: your ${what} is on its way` : m === 'full' ? 'Generating…' : 'Writing the script…');
    setBusy('');
    navigate(`/studio/${item.id}${r ? '' : '?step=script'}`);
  };

  return (
    <div className="page">
      <div className="wiz-top"><a className="back" {...linkProps('/studio')}><Icon name="arrowL" size={16} />All categories</a></div>
      <div className="wiz">
        <div className="wiz-main">
          <section className="panel"><div className="panel-b topic-box" style={{ paddingTop: 24 }}>
            <label htmlFor="topic" className="muted" style={{ fontSize: 12.5, fontWeight: 500 }}>1 · Topic</label>
            <textarea id="topic" autoFocus maxLength={200} placeholder="e.g. What is Forex?" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <div className="sugg" aria-label="Suggestions">{TOPIC_SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => setTopic(s)}>{s}</button>)}</div>
            <button type="button" className="adv-toggle" aria-expanded={adv} onClick={() => setAdv(!adv)}><Icon name="chevR" size={16} />Advanced (optional): audience and objective</button>
            {adv && (
              <div className="adv-grid">
                <div className="field"><label htmlFor="aud">Target audience</label><select id="aud" className="select" value={audience} onChange={(e) => setAudience(e.target.value)}><option value="">Let Claude decide</option>{AUDIENCES.map((o) => <option key={o}>{o}</option>)}</select></div>
                <div className="field"><label htmlFor="obj">Objective</label><select id="obj" className="select" value={objective} onChange={(e) => setObjective(e.target.value)}><option value="">Let Claude decide</option>{OBJECTIVES.map((o) => <option key={o}>{o}</option>)}</select></div>
              </div>
            )}
          </div></section>

          <section className="panel"><div className="panel-b" style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="muted" style={{ fontSize: 12.5, fontWeight: 500 }}>2 · Creative style</span>
            {styles.length ? (
              <div className="gallery">
                {styles.map((s) => {
                  const ok = canGenerate(s.template_kind, caps?.renderers);
                  return (
                    <button key={s.id} className={`sty${s.id === styleId ? ' sel' : ''}`} aria-pressed={s.id === styleId} onClick={() => setStyleId(s.id === styleId ? null : s.id)}>
                      <StylePreview assetId={s.preview_asset_id} motif={s.motif} />
                      <span className="sel-mark" style={{ position: 'absolute', top: 10, left: 10 }}><Icon name="check" /></span>
                      <span className="sty-b"><b>{s.name}</b><p>{s.description}</p>{!ok && <span className="muted" style={{ fontSize: 11.5 }}>Production template not built yet</span>}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <Empty icon="palette" title={`No approved ${T.name} styles yet`} action={can('styles.manage') ? <a className="btn sm" {...linkProps(`/styles?category=${type}&new=1`)}><Icon name="plus" size={16} />Add a style</a> : undefined}>
                ABET’s creative styles are built from your own references. {can('styles.manage') ? 'Upload references to start a new style.' : 'An admin adds them in Creative Styles.'}
              </Empty>
            )}
          </div></section>

          {style && byClaude && (
            <section className="panel"><div className="panel-b" style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span className="muted" style={{ fontSize: 12.5, fontWeight: 500 }}>3 · Shape and length</span>
              {wc.outputs.length > 1 && <div className="field"><span className="lbl">Output</span><div className="seg" role="group" aria-label="Output">{wc.outputs.map((o) => <button key={o} type="button" aria-pressed={req.output === o} onClick={() => setReq({ ...req, output: o })}>{outLabel[o]}</button>)}</div></div>}
              {wc.aspects.length > 1 && <div className="field"><span className="lbl">Shape</span><div className="seg" role="group" aria-label="Shape">{wc.aspects.map((a) => <button key={a} type="button" aria-pressed={req.aspect === a} onClick={() => setReq({ ...req, aspect: a })}>{a === '16:9' ? '16:9 landscape' : a === '9:16' ? '9:16 vertical' : a === '1:1' ? '1:1 square' : a === '4:5' ? '4:5 portrait' : a}</button>)}</div></div>}
              {req.output !== 'image' && <div className="field"><span className="lbl">Length</span><div className="seg" role="group" aria-label="Length">{wc.lengths.map((l) => <button key={l} type="button" aria-pressed={req.length === l} onClick={() => setReq({ ...req, length: l })}>{l}</button>)}</div></div>}
              <div className="field"><label htmlFor="cnote">Notes for Claude (optional)</label><input id="cnote" className="input" maxLength={400} placeholder="e.g. Mention the free demo account. Keep it simple for beginners." value={note} onChange={(e) => setNote(e.target.value)} /></div>
              <p className="muted" style={{ fontSize: 12.5 }}>Claude writes the script and builds the {what} in this style, then it appears here for review. The Claude video worker runs every hour, 9am–9pm (Pakistan time).</p>
            </div></section>
          )}
          {caps && !caps.claudeApi && <Notice icon="info">The Claude API isn’t connected yet, so Claude writes through the <b>Claude queue</b>: someone with Claude asks it to “write scripts for everything in the ABET Content OS Claude queue”, and the result appears here automatically.</Notice>}
          <div className="wiz-foot">
            <button className="btn" disabled={!topic.trim() || !!busy || !can('content.create')} onClick={() => start('script')} title="Claude writes the script; you or your editors produce it">{busy === 'script' ? <Icon name="loader" spin size={16} /> : <Icon name="file" />}Write script only</button>
            <div className="r">
              <button className="btn primary" style={{ height: 44 }} disabled={!topic.trim() || !functional || !!busy || !can('content.create')}
                title={!style ? 'Choose an approved style' : !functional ? 'This style’s production template isn’t built yet' : undefined} onClick={() => start('full')}>
                {busy === 'full' || busy === 'video' ? <Icon name="loader" spin size={16} /> : <Icon name="sparkles" />}{style && byClaude ? `Generate ${what}` : 'Generate content'}</button>
            </div>
          </div>
        </div>
        <aside className="panel summary"><div className="panel-h"><span className="ico"><Icon name={T.icon} size={16} /></span><h3>{T.name}</h3></div>
          <div className="panel-b"><dl>
            <div className="sr-row"><dt>Format</dt><dd>{T.meta}</dd></div>
            <div className="sr-row"><dt>Topic</dt><dd>{topic || '—'}</dd></div>
            <div className="sr-row"><dt>Style</dt><dd>{style?.name ?? '—'}</dd></div>
            <div className="sr-row"><dt>Claude</dt><dd>{style && byClaude ? 'Claude video worker' : caps ? (caps.claudeApi ? 'Claude API' : 'Claude queue') : '…'}</dd></div>
          </dl>
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Claude researches the topic, picks the audience and angle, writes the hook, script, storyboard and captions in ABET’s voice. Compliance and publishing approvals still apply.</p></div></aside>
      </div>
    </div>
  );
}

function Stepper({ current, max, onGo }: { current: number; max: number; onGo?: (n: number) => void }) {
  return (
    <div style={{ marginLeft: 'auto' }} className="stepper" role="list">
      <span role="listitem" className={`step ${current === -1 ? 'cur' : 'done'}`}><span className="n">{current === -1 ? 1 : <Icon name="check" size={13} />}</span>Topic</span>
      {STEPS.map(([k, l], n) => (
        <span key={k} style={{ display: 'contents' }}>
          <span className="step-sep" />
          <span role="listitem" className={`step${n === current ? ' cur' : n < current || (n <= max && n !== current) ? ' done' : ''}${n > max ? ' locked' : ''}`}
            onClick={() => n <= max && onGo?.(n)} onKeyDown={(e) => { if (e.key === 'Enter' && n <= max) onGo?.(n); }} tabIndex={n <= max && onGo ? 0 : -1}>
            <span className="n">{n < current ? <Icon name="check" size={13} /> : n + 2}</span>{l}
          </span>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ wizard for an existing item */
function ItemWizard({ id, step }: { id: string; step: Step | null }) {
  const { data, api } = useStore();
  const item = data?.items.find((i) => i.id === id);
  const [scripts, setScripts] = useState<Script[] | null>(null);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const loadScripts = useCallback(async () => setScripts(await api.listScripts(id)), [api, id]);
  const loadAssets = useCallback(async () => setAssets((await api.listAssets()).filter((a) => a.item_id === id && a.kind !== 'Reference')), [api, id]);
  useEffect(() => { loadScripts(); loadAssets(); }, [loadScripts, loadAssets, item?.updated_at]);
  const [job, setJob] = useState<ProductionJob | null>(null);

  if (!data) return null;
  if (!item) return <div className="page"><Empty icon="folder" title="This content no longer exists" action={<a className="btn" {...linkProps('/studio')}>Back to Studio</a>}>It may have been deleted, or the link is wrong.</Empty></div>;

  const approved = scripts?.find((s) => s.approved_at);
  const hasAsset = (assets?.length ?? 0) > 0;
  const hasStyles = data.styles.some((s) => s.content_type === item.type && s.status === 'approved' && s.active);
  // A file made by Claude (or uploaded) can be reviewed straight away; script approval happens with the file.
  const fileReady = hasAsset && ['in_review', 'approved', 'completed'].includes(item.status);
  const videoLive = job?.kind === 'video' && ['queued', 'running', 'waiting_for_claude'].includes(job.status);
  const max = fileReady ? (item.status === 'in_review' ? 3 : 4) : !approved ? 0 : !hasAsset ? 2 : item.status === 'approved' || item.status === 'completed' ? 4 : 3;
  const auto: Step = fileReady ? (item.status === 'in_review' ? 'review' : 'publish') : !approved ? 'script' : !item.style_id && hasStyles && !hasAsset ? 'style' : !hasAsset || item.status === 'draft' || item.status === 'in_production' ? 'produce' : item.status === 'in_review' ? 'review' : 'publish';
  const cur = step && STEPS.findIndex(([k]) => k === step) <= max ? step : auto;
  const curIdx = STEPS.findIndex(([k]) => k === cur);
  const goStep = (s: Step) => navigate(`/studio/${id}?step=${s}`);
  const T = TYPES[item.type];
  const style = data.styles.find((s) => s.id === item.style_id);
  const owner = data.profiles.find((p) => p.id === item.owner_id);

  return (
    <div className="page">
      <div className="wiz-top"><a className="back" {...linkProps('/studio')}><Icon name="arrowL" size={16} />Studio</a><Stepper current={curIdx} max={max} onGo={(n) => goStep(STEPS[n][0])} /></div>
      <div className="wiz">
        <div className="wiz-main">
          <JobPanel itemId={item.id} onJob={setJob} onDone={() => { loadScripts(); loadAssets(); }} />
          {videoLive && !step ? null : scripts === null || assets === null ? <Panel><div className="writing"><div className="ln" style={{ width: '50%', height: 22 }} /><div className="ln" style={{ width: '90%' }} /><div className="ln" style={{ width: '80%' }} /></div></Panel>
            : cur === 'script' ? <ScriptStep item={item} scripts={scripts} reload={loadScripts} onNext={() => goStep('style')} />
            : cur === 'style' ? <StyleStep item={item} onNext={() => goStep('produce')} onBack={() => goStep('script')} />
            : cur === 'produce' ? <ProduceStep item={item} script={approved!} assets={assets} reload={loadAssets} onNext={() => goStep('review')} />
            : cur === 'review' ? <ReviewStep item={item} script={approved ?? scripts[0]} assets={assets} videoJob={job?.kind === 'video' ? job : null} onNext={() => goStep('publish')} onBack={() => goStep('script')} />
            : <PublishStep item={item} assets={assets} />}
        </div>
        <aside className="panel summary"><div className="panel-h"><span className="ico"><Icon name={T.icon} size={16} /></span><h3>{T.name}</h3></div>
          <div className="panel-b"><dl>
            <div className="sr-row"><dt>Title</dt><dd title={item.title}>{item.title}</dd></div>
            <div className="sr-row"><dt>Status</dt><dd><StatusChip status={item.status} label={item.status === 'completed' && item.scheduled_at ? (item.published_at || isPast(item.scheduled_at) ? 'Published' : 'Scheduled') : undefined} /></dd></div>
            <div className="sr-row"><dt>Owner</dt><dd style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}><Avatar profile={owner} />{owner?.full_name}</dd></div>
            <div className="sr-row"><dt>Script</dt><dd>{approved ? <Chip cls="st-Approved">v{approved.version} approved</Chip> : scripts?.length ? <Chip cls="st-Draft">v{scripts[0].version} draft</Chip> : '—'}</dd></div>
            <div className="sr-row"><dt>Style</dt><dd>{style?.name ?? '—'}</dd></div>
            <div className="sr-row"><dt>File</dt><dd>{hasAsset ? assets![0].name : '—'}</dd></div>
            {item.scheduled_at && <div className="sr-row"><dt>Publish</dt><dd>{fmtDateTime(item.scheduled_at)}</dd></div>}
          </dl>
          {item.compliance_note && <div style={{ marginTop: 12 }}><Notice kind="warn" icon="alert"><b>Compliance:</b> {item.compliance_note}</Notice></div>}
          {item.needs_script && <div style={{ marginTop: 12 }}><Chip cls="st-Generating" icon="sparkles">In the Claude queue</Chip></div>}
          </div>
          <div className="panel-h" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}><span className="ico"><Icon name="edit" size={16} /></span><h3>Comments</h3></div>
          <div className="panel-b"><Comments itemId={item.id} /></div></aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ step: script */
function parsePasted(text: string): ScriptUnit[] {
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return parts.map((p, n) => {
    const m = p.match(/^(?:\*\*)?([^:\n]{2,40}):(?:\*\*)?\s*([\s\S]*)$/);
    return m ? { label: m[1].trim(), tc: '', vo: m[2].trim(), on: '', vis: '' } : { label: `Part ${n + 1}`, tc: '', vo: p, on: '', vis: '' };
  });
}

function ScriptStep({ item, scripts, reload, onNext }: { item: ContentItem; scripts: Script[]; reload: () => Promise<void>; onNext: () => void }) {
  const { api, run, can, profile, data, toast } = useStore();
  const [queueNote, setQueueNote] = useState('');
  const latest = scripts[0];
  const [mode, setMode] = useState<'choose' | 'paste' | 'edit'>(latest ? 'edit' : 'choose');
  const [title, setTitle] = useState(latest?.title ?? item.title);
  const [units, setUnits] = useState<ScriptUnit[]>(latest?.units ?? []);
  const [paste, setPaste] = useState('');
  const [dirty, setDirty] = useState(false);
  const [notes, setNotes] = useState(false);
  const canEdit = can('content.edit_any') || item.owner_id === profile?.id;
  const prompt = claudePrompt(item.type, item.topic, null, item.id);
  const lastVersion = useRef(latest?.version ?? 0);

  // Pick up scripts Claude saves through the connector.
  useEffect(() => {
    if (latest && latest.version !== lastVersion.current && !dirty) { lastVersion.current = latest.version; setTitle(latest.title); setUnits(latest.units); setMode('edit'); }
  }, [latest, dirty]);
  useEffect(() => { if (mode !== 'choose') return; const t = setInterval(reload, 10000); return () => clearInterval(t); }, [mode, reload]);

  const checks = useMemo(() => complianceCheck(title, units), [title, units]);
  const pass = checks.every((c) => c.ok);
  const save = async (andApprove = false) => {
    const s = await run(() => api.saveScript(item.id, { title, length_label: latest?.length_label ?? null, units, source: 'manual' }), andApprove ? undefined : 'Script saved');
    if (s && andApprove) await run(() => api.approveScript(s.id), 'Script approved');
    setDirty(false); await reload();
    return s;
  };
  const approve = async () => {
    if (dirty || !latest) { await save(true); return; }
    await run(() => api.approveScript(latest.id), 'Script approved'); await reload();
  };
  const setUnit = (n: number, patch: Partial<ScriptUnit>) => { setUnits((u) => u.map((x, i) => (i === n ? { ...x, ...patch } : x))); setDirty(true); };

  const openClaude = async () => {
    // Copy the request, then open a blank Claude chat. Pasting it yourself avoids Claude's warning for prompts arriving by link.
    try { await navigator.clipboard.writeText(prompt); toast('Request copied. Paste it into Claude with Ctrl+V'); } catch { toast('Copy the request below, then paste it into Claude', 'info'); }
    window.open('https://claude.ai/new', '_blank', 'noopener');
  };
  const caps = useCapabilities();
  const writeWithClaude = async () => {
    if (queueNote.trim()) await run(() => api.updateItem(item.id, { request_note: queueNote.trim() }));
    await run(() => api.generate(item.id, 'script'), caps?.claudeApi ? 'Claude is writing the script' : 'Sent to the Claude queue');
    await reload();
  };
  const queue = (on: boolean) => run(() => api.updateItem(item.id, on ? { needs_script: true, request_note: queueNote.trim() || null, requested_by: profile?.id ?? null } : { needs_script: false }), on ? 'Sent to the Claude queue' : 'Removed from the Claude queue');
  const requester = data?.profiles.find((p) => p.id === item.requested_by);

  if (mode === 'choose') return (
    <>
      {item.needs_script && (
        <Notice kind="ok" icon="sparkles"><b>In the Claude queue</b>{requester ? `, requested by ${requester.full_name}` : ''}. {item.request_note ? `Note: “${item.request_note}”. ` : ''}The script appears here automatically when Claude saves it.
          {canEdit && <> <button className="link" onClick={() => queue(false)}>Remove from queue</button></>}</Notice>
      )}
      <Panel icon="sparkles" title="Get the script">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div className="choice" style={{ gridColumn: '1 / -1' }}><Icon name="sparkles" /><b>Write with Claude</b><p>Claude researches the topic and writes the full script and captions in ABET’s voice. {caps ? (caps.claudeApi ? 'It runs right here and takes about a minute.' : 'The Claude API isn’t connected yet, so this goes to the Claude queue and appears here when someone with Claude runs it.') : ''}</p>
              {!item.needs_script ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Note for Claude (optional), e.g. keep it under 45 seconds" value={queueNote} onChange={(e) => setQueueNote(e.target.value)} aria-label="Note for Claude" disabled={!canEdit} />
                <button className="btn primary sm" disabled={!canEdit} onClick={writeWithClaude}><Icon name="sparkles" size={16} />Write with Claude</button></div>
                : <Chip cls="st-Generating" icon="clock">Waiting for Claude</Chip>}
              <button className="link" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={openClaude}>Or copy the request into your own Claude chat</button></div>
            <div className="choice"><Icon name="copy" /><b>Paste a script</b><p>Already have a script? Paste it in. Blank lines separate the scenes.</p>
              <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setMode('paste')} disabled={!canEdit}><Icon name="edit" size={16} />Paste a script</button></div>
            <div className="choice"><Icon name="file" /><b>Start from a template</b><p>A compliant starting structure for this format. Edit it into the final script.</p>
              <button className="btn sm" style={{ alignSelf: 'flex-start' }} disabled={!canEdit} onClick={() => { const t = templateScript(item.type, item.topic); setTitle(t.title); setUnits(t.units); setDirty(true); setMode('edit'); }}><Icon name="file" size={16} />Use template</button></div>
          </div>
          <details className="specs"><summary><Icon name="chevR" size={16} />Show the request sent to Claude</summary><div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}><div className="prompt-box">{prompt}</div><CopyButton text={prompt} label="Copy request" /></div></details>
          <span className="muted" style={{ fontSize: 12 }}><Icon name="loader" spin size={13} /> Watching for a script from Claude</span>
        </div>
      </Panel>
    </>
  );

  if (mode === 'paste') return (
    <Panel icon="edit" title="Paste the script">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <textarea className="textarea" rows={14} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Hook: What is a pip? Here is the simple answer.\n\nExplain: A pip is the smallest standard price move…'} aria-label="Script text" />
        <div className="wiz-foot"><button className="btn" onClick={() => setMode('choose')}>Cancel</button><div className="r"><button className="btn primary" disabled={!paste.trim()} onClick={() => { setUnits(parsePasted(paste)); setDirty(true); setMode('edit'); }}>Continue<Icon name="arrowR" /></button></div></div>
      </div>
    </Panel>
  );

  return (
    <>
      <section className="panel"><div className="panel-b" style={{ paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="script-head">
          <input className="input" style={{ fontFamily: 'var(--f-display)', fontSize: 20, fontWeight: 600, height: 48, flex: 1, minWidth: 220 }} value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} aria-label="Script title" readOnly={!canEdit} />
          <div className="script-meta">{latest && <Chip icon="clock">v{latest.version}{latest.source === 'claude' ? ' · from Claude' : ''}</Chip>}{latest?.approved_at && !dirty && <Chip cls="st-Approved">Approved</Chip>}{dirty && <Chip cls="st-InReview">Unsaved changes</Chip>}</div>
        </div>
        <button type="button" className="adv-toggle" aria-expanded={notes} onClick={() => setNotes(!notes)} style={{ alignSelf: 'flex-start' }}><Icon name="chevR" size={16} />Show timing and production notes</button>
        <div>
          {units.map((u, n) => (
            <div className="unit-edit" key={n}>
              {notes && <div className="row2"><input className="input" value={u.label} onChange={(e) => setUnit(n, { label: e.target.value })} aria-label="Section" readOnly={!canEdit} /><input className="input" value={u.tc} onChange={(e) => setUnit(n, { tc: e.target.value })} aria-label="Timing" placeholder="0:00–0:03" readOnly={!canEdit} /><span /></div>}
              {!notes && <b style={{ fontSize: 12.5, fontWeight: 500 }}>{u.label}{u.tc ? <span className="muted" style={{ fontWeight: 400 }}> · {u.tc}</span> : null}</b>}
              <textarea className="textarea" rows={2} value={u.vo} onChange={(e) => setUnit(n, { vo: e.target.value })} aria-label={`${u.label} script`} style={{ fontSize: 15 }} readOnly={!canEdit} />
              {notes && <div className="row3"><input className="input" value={u.on} placeholder="On screen" onChange={(e) => setUnit(n, { on: e.target.value })} aria-label="On screen" readOnly={!canEdit} /><input className="input" value={u.vis} placeholder="Visual direction" onChange={(e) => setUnit(n, { vis: e.target.value })} aria-label="Visual" readOnly={!canEdit} /></div>}
            </div>
          ))}
          {canEdit && <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => { setUnits((x) => [...x, { label: `Part ${x.length + 1}`, tc: '', vo: '', on: '', vis: '' }]); setDirty(true); }}><Icon name="plus" size={16} />Add section</button>}
        </div>
      </div></section>
      <Panel icon="shield" title="Compliance check" right={pass ? <Chip cls="st-Approved">Passed</Chip> : <Chip cls="st-Error">Needs changes</Chip>}>
        <div className="checks">{checks.map((c) => <div key={c.msg} className={`check ${c.ok ? 'ok' : 'bad'}`}><Icon name={c.ok ? 'checkc' : 'xc'} size={16} /><span>{c.msg}</span></div>)}</div>
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Automatic checks only. A compliance reviewer still approves the final content.</p>
      </Panel>
      <div className="wiz-foot">
        {canEdit && <button className="btn" disabled={!dirty} onClick={() => save()}><Icon name="check" />Save</button>}
        {canEdit && <button className="btn" onClick={() => setMode('choose')}><Icon name="refresh" />Start over</button>}
        <div className="r">
          {canEdit && <button className="btn" disabled={!pass || (!!latest?.approved_at && !dirty)} onClick={approve}><Icon name="check" />{latest?.approved_at && !dirty ? 'Approved' : 'Approve'}</button>}
          <button className="btn primary" disabled={!pass || !(latest?.approved_at) || dirty} onClick={onNext} title={!latest?.approved_at ? 'Approve the script first' : undefined}>Continue<Icon name="arrowR" /></button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ step: style */
function StyleStep({ item, onNext, onBack }: { item: ContentItem; onNext: () => void; onBack: () => void }) {
  const { data, api, run, can } = useStore();
  const T = TYPES[item.type];
  const list = (data?.styles ?? []).filter((s) => s.content_type === item.type && s.status === 'approved' && s.active && !s.archived);
  const [sel, setSel] = useState(item.style_id ?? null);
  const chosen = list.find((s) => s.id === sel);
  const next = async () => {
    if (sel !== item.style_id) { const r = await run(() => api.updateItem(item.id, { style_id: sel })); if (!r) return; }
    onNext();
  };
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div><h2 style={{ fontSize: 18 }}>Choose a creative style</h2><p className="muted" style={{ marginTop: 2 }}>{list.length} approved {T.name} style{list.length === 1 ? '' : 's'}.</p></div>
        {can('styles.manage') && <a className="link" style={{ marginLeft: 'auto' }} {...linkProps(`/styles?category=${item.type}&new=1`)}><Icon name="plus" />Add a style</a>}
      </div>
      {list.length ? (
        <div className="gallery">
          {list.map((s) => (
            <button key={s.id} className={`sty${s.id === sel ? ' sel' : ''}`} aria-pressed={s.id === sel} onClick={() => setSel(s.id)}>
              <StylePreview assetId={s.preview_asset_id} motif={s.motif} />
              <span className="sel-mark" style={{ position: 'absolute', top: 10, left: 10 }}><Icon name="check" /></span>
              <span className="sty-b"><b>{s.name}</b><p>{s.description}</p></span>
            </button>
          ))}
        </div>
      ) : <div className="panel"><Empty icon="palette" title={`No approved ${T.name} styles yet`}>You can continue without a style; your editors produce it from the brief.</Empty></div>}
      {chosen && chosen.spec.length > 0 && <details className="specs"><summary><Icon name="chevR" size={16} />{chosen.name}: creative specifications</summary><dl className="spec">{chosen.spec.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></details>}
      <div className="wiz-foot"><button className="btn" onClick={onBack}><Icon name="arrowL" />Script</button><div className="r"><button className="btn primary" onClick={next}>{sel ? 'Continue' : 'Continue without a style'}<Icon name="arrowR" /></button></div></div>
    </>
  );
}

/* ------------------------------------------------------------------ live production progress */
function JobPanel({ itemId, onDone, onJob }: { itemId: string; onDone: () => void; onJob?: (j: ProductionJob | null) => void }) {
  const { api, refresh } = useStore();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const prev = useRef<string | null>(null);
  const load = useCallback(async () => {
    const j = await api.listJobs(itemId).catch(() => []);
    setJobs(j);
    onJob?.(j[0] ?? null);
    const st = j[0]?.status ?? null;
    if (prev.current && prev.current !== st && (st === 'succeeded' || st === 'failed')) { onDone(); refresh(); }
    prev.current = st;
  }, [api, itemId, onDone, refresh, onJob]);
  useEffect(() => { load(); }, [load]);
  const job = jobs[0];
  const live = job && ['queued', 'running', 'waiting_for_claude'].includes(job.status);
  useEffect(() => { if (!live) return; const t = setInterval(load, job.status === 'waiting_for_claude' ? 10000 : job.kind === 'video' ? 5000 : 3000); return () => clearInterval(t); }, [live, load, job?.status, job?.kind]);
  if (!job || (job.status === 'succeeded' && Date.now() - new Date(job.updated_at).getTime() > 10 * 60000)) return null;
  const cls = job.status === 'failed' ? 'err' : job.status === 'succeeded' ? 'ok' : '';
  const video = job.kind === 'video';
  const what = job.request?.output === 'pdf' ? 'PDF' : job.request?.output === 'slides' ? 'carousel' : job.request?.output === 'image' ? 'image' : 'video';
  return (
    <section className="panel"><div className="panel-b" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="ico"><Icon name={job.status === 'failed' ? 'alert' : job.status === 'succeeded' ? 'checkc' : 'loader'} spin={live} /></span>
        <b style={{ fontWeight: 500 }}>{job.status === 'waiting_for_claude' ? (video ? `Waiting for Claude to make your ${what}` : 'Waiting for Claude (Claude queue)') : job.status === 'succeeded' && video ? `Your ${what} is ready for review` : job.stage}</b>
        <span className="muted num" style={{ marginLeft: 'auto', fontSize: 12.5 }}>{job.progress}%</span>
      </div>
      <div className={`bar ${cls === 'err' ? 'brand' : 'gen'}`}><span style={{ width: `${job.progress}%` }} /></div>
      <div className="checks">{job.steps.map((s, n) => <div key={n} className={`check ${s.status === 'failed' ? 'bad' : 'ok'}`}><Icon name={s.status === 'failed' ? 'xc' : s.status === 'running' ? 'loader' : s.status === 'warning' ? 'alert' : 'checkc'} size={16} spin={s.status === 'running'} /><span>{s.name}{s.detail ? ` · ${s.detail}` : ''}</span></div>)}</div>
      {job.status === 'failed' && <Notice kind="err" icon="alert">{job.error}</Notice>}
      {video && job.request && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip>{job.request.aspect}</Chip>{job.request.output !== 'image' && job.request.length && <Chip>{job.request.length}</Chip>}{job.worker && <Chip icon="sparkles">{job.worker}</Chip>}</div>}
      {job.status === 'waiting_for_claude' && video && <p className="muted" style={{ fontSize: 12.5 }}>The Claude video worker checks for new requests every hour, 9am–9pm (Pakistan time). Claude writes the script, builds the {what} and puts it here for review. You can leave this page; you’ll get a notification.</p>}
      {job.status === 'waiting_for_claude' && !video && <p className="muted" style={{ fontSize: 12.5 }}>Someone with Claude asks it to “write scripts for everything in the ABET Content OS Claude queue”. You can leave this page; you’ll get a notification.</p>}
      {live && job.status !== 'waiting_for_claude' && <p className="muted" style={{ fontSize: 12.5 }}>You can leave this page. Production continues and you’ll get a notification.</p>}
    </div></section>
  );
}

/* ------------------------------------------------------------------ step: production */
function briefText(item: ContentItem, script: Script, styleName: string, spec: [string, string][]) {
  const lines = [
    `PRODUCTION BRIEF: ${item.title}`, `Format: ${TYPES[item.type].name} (${TYPES[item.type].meta})`, `Style: ${styleName}`, '',
    'STYLE SPECIFICATIONS', ...spec.map(([k, v]) => `- ${k}: ${v}`), '', 'SCRIPT',
    ...script.units.flatMap((u) => [`[${u.label}${u.tc ? ` · ${u.tc}` : ''}]`, u.vo, u.on ? `On screen: ${u.on}` : '', u.vis ? `Visual: ${u.vis}` : '', '']).filter((l, i, a) => !(l === '' && a[i - 1] === '')),
    'BRAND RULES', '- ABET logo top-left; brand red #AE1818 and ink #191B22; Space Grotesk headings, Poppins text.',
    '- End card must show the risk warning. Label all prices "Example".', '- Max file size for upload: 50 MB.',
  ];
  return lines.join('\n');
}

function ProduceStep({ item, script, assets, reload, onNext }: { item: ContentItem; script: Script; assets: Asset[]; reload: () => Promise<void>; onNext: () => void }) {
  const { data, api, run, can, profile } = useStore();
  const style = data?.styles.find((s) => s.id === item.style_id);
  const brief = briefText(item, script, style?.name ?? '—', style?.spec ?? []);
  const makers = (data?.profiles ?? []).filter((p) => p.active && p.role !== 'viewer' && p.role !== 'compliance_reviewer');
  const [owner, setOwner] = useState(item.owner_id);
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);
  const canEdit = can('content.edit_any') || item.owner_id === profile?.id;
  const T = TYPES[item.type];
  const accept = T.kind === 'Video' ? 'video/*' : T.kind === 'PDF' ? 'application/pdf' : 'image/*,application/pdf';

  const upload = async (files: FileList | null) => {
    const f = files?.[0]; if (!f) return;
    if (f.size > 50 * 1024 * 1024) { await run(() => Promise.reject(new Error('Payload too large'))); return; }
    setUploading(true);
    await run(() => api.uploadAsset(f, item.id, T.kind), 'File uploaded and saved to the Asset Library');
    setUploading(false); await reload();
  };
  const sendToProduction = () => run(async () => {
    if (owner !== item.owner_id) await api.updateItem(item.id, { owner_id: owner });
    await api.updateItem(item.id, { status: 'in_production' });
    await api.log(`sent “${item.title}” to production`, item.id);
  }, 'Sent to production');
  const sendForReview = async () => { const r = await run(() => api.updateItem(item.id, { status: 'in_review' }), 'Sent for review'); if (r) onNext(); };

  return (
    <>
      <Panel icon="users" title="Who’s making it?">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 240, flex: 1 }}><label htmlFor="own">Editor or designer</label>
            <select id="own" className="select" value={owner} onChange={(e) => setOwner(e.target.value)} disabled={!canEdit}>{makers.map((p) => <option key={p.id} value={p.id}>{p.full_name} · {ROLE_LABEL[p.role]}</option>)}</select></div>
          {item.status === 'draft' && canEdit && <button className="btn primary" onClick={sendToProduction}><Icon name="send" />Send to production</button>}
          {item.status === 'in_production' && owner !== item.owner_id && canEdit && <button className="btn" onClick={() => run(() => api.updateItem(item.id, { owner_id: owner }), 'Reassigned')}>Reassign</button>}
          {item.status === 'in_production' && <StatusChip status="in_production" label={`With ${data?.profiles.find((p) => p.id === item.owner_id)?.full_name ?? 'editor'}`} />}
        </div>
      </Panel>
      <Panel icon="file" title="Production brief" right={<CopyButton text={brief} label="Copy brief" />}>
        <div className="prompt-box" style={{ maxHeight: 260, overflow: 'auto' }}>{brief}</div>
      </Panel>
      <Panel icon="upload" title="Finished file">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {assets.map((a) => <div key={a.id} className="handle"><Icon name={a.kind === 'Video' ? 'film' : a.kind === 'PDF' ? 'file' : 'image'} size={16} /><span>{a.name}</span><span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{fmtBytes(a.size_bytes)} · {ago(a.created_at)}</span></div>)}
          {can('content.create') && (
            <label className={`dropzone${over ? ' on' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>
              {uploading ? <Icon name="loader" spin size={22} /> : <Icon name="upload" size={22} />}
              <b>{uploading ? 'Uploading…' : assets.length ? 'Upload a new version' : `Upload the finished ${T.kind.toLowerCase()}`}</b>
              <span>Up to 50 MB. Saved to the Asset Library automatically.</span>
              <input type="file" hidden accept={accept} onChange={(e) => upload(e.target.files)} disabled={uploading} />
            </label>
          )}
        </div>
      </Panel>
      <div className="wiz-foot"><div className="r">
        {(item.status === 'draft' || item.status === 'in_production') && <button className="btn primary" disabled={!assets.length} title={!assets.length ? 'Upload the file first' : undefined} onClick={sendForReview}><Icon name="eye" />Send for review</button>}
        {item.status !== 'draft' && item.status !== 'in_production' && <button className="btn primary" onClick={onNext}>Continue<Icon name="arrowR" /></button>}
      </div></div>
    </>
  );
}

/* ------------------------------------------------------------------ step: review */
function MediaView({ asset }: { asset: Asset }) {
  const { api } = useStore();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { let on = true; api.assetUrl(asset).then((u) => on && setUrl(u || null), () => on && setErr(true)); return () => { on = false; }; }, [api, asset]);
  if (err) return <Notice kind="err" icon="alert">Couldn’t load this file. Try again in a moment.</Notice>;
  if (!url) return <div className="media-frame"><span className="muted">{asset.storage_path.startsWith('demo/') ? 'Sample item: no real file in demo mode' : 'Loading preview…'}</span></div>;
  const isVid = /\.(mp4|mov|webm|m4v)$/i.test(asset.name) || /\.(mp4|mov|webm|m4v)$/i.test(asset.storage_path) || asset.kind === 'Video';
  const isImg = /\.(png|jpe?g|gif|webp|svg)$/i.test(asset.name) || /\.(png|jpe?g|gif|webp)$/i.test(asset.storage_path);
  return (
    <div className="media-frame">
      {isVid ? <video src={url} controls playsInline /> : isImg ? <img src={url} alt={asset.name} /> : <a className="btn" href={url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} />Open {asset.name}</a>}
    </div>
  );
}

function ReviewStep({ item, script, assets, videoJob, onNext, onBack }: { item: ContentItem; script: Script | undefined; assets: Asset[]; videoJob: ProductionJob | null; onNext: () => void; onBack: () => void }) {
  const { api, run, can } = useStore();
  const [note, setNote] = useState('');
  const [shown, setShown] = useState(0);
  const asset = assets[Math.min(shown, assets.length - 1)];
  const checks = script ? complianceCheck(script.title, script.units) : [];
  const approve = async () => {
    const r = await run(() => api.updateItem(item.id, { status: 'approved' }), 'Approved');
    if (r) { await api.addApproval(item.id, 'creative', 'approved').catch(() => {}); onNext(); }
  };
  const changes = () => run(async () => {
    await api.updateItem(item.id, videoJob ? { status: 'draft', request_note: note || null } : { status: 'draft' });
    await api.addApproval(item.id, 'creative', 'changes_requested', note || undefined).catch(() => {});
    await api.log(`requested changes on “${item.title}”${note ? `: ${note}` : ''}`, item.id);
    // Made by Claude: send it straight back to Claude with the notes, same shape and length.
    if (videoJob?.request) await api.generate(item.id, 'video', videoJob.request);
  }, videoJob ? 'Sent back to Claude with your notes' : 'Sent back with your notes');
  return (
    <>
      <section className="panel"><div className="panel-b pv" style={{ paddingTop: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{asset ? <MediaView key={asset.id} asset={asset} /> : <Empty icon="film" title="No file yet">Upload the finished file in Production.</Empty>}
          {assets.length > 1 && <div className="seg" role="group" aria-label="Files">{assets.map((a, n) => <button key={a.id} type="button" aria-pressed={a.id === asset?.id} onClick={() => setShown(n)}>{n + 1}</button>)}</div>}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div><div className="muted" style={{ fontSize: 12.5 }}>{TYPES[item.type].name}</div><h2 style={{ fontSize: 20, marginTop: 4 }}>{item.title}</h2></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><StatusChip status={item.status} />{asset && <Chip icon="cloud">{asset.name} · {fmtBytes(asset.size_bytes)}</Chip>}</div>
          <div className="checks">{checks.map((c) => <div key={c.msg} className={`check ${c.ok ? 'ok' : 'bad'}`}><Icon name={c.ok ? 'checkc' : 'xc'} size={16} /><span>{c.msg}</span></div>)}</div>
          {item.compliance_note && <Notice kind="warn" icon="alert"><b>Compliance note:</b> {item.compliance_note}</Notice>}
          {can('content.compliance') && (item.compliance_note
            ? <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => run(async () => { await api.updateItem(item.id, { compliance_note: null }); await api.addApproval(item.id, 'compliance', 'note_resolved').catch(() => {}); }, 'Compliance note resolved')}><Icon name="check" size={16} />Mark note as resolved</button>
            : <div style={{ display: 'flex', gap: 8 }}><input className="input" placeholder="Add a compliance note (blocks approval)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Compliance note" /><button className="btn sm" disabled={!note.trim()} onClick={() => run(() => api.updateItem(item.id, { compliance_note: note.trim() }), 'Compliance note added').then(() => setNote(''))}>Add</button></div>)}
        </div>
      </div></section>
      {item.status === 'in_review' && can('content.approve') && (
        <Panel icon="edit" title="Feedback (optional)"><textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={videoJob ? 'What should Claude change? “Request changes” sends it back to Claude with these notes.' : 'What should change? This goes back to the owner with the item.'} aria-label="Feedback" /></Panel>
      )}
      <div className="wiz-foot">
        <button className="btn" onClick={onBack}><Icon name="arrowL" />Script</button>
        {asset && <DownloadButton asset={asset} />}
        <div className="r">
          {item.status === 'in_review' && can('content.approve') && <><button className="btn" onClick={changes}><Icon name="edit" />Request changes</button>
            <button className="btn primary" disabled={!!item.compliance_note} title={item.compliance_note ? 'Resolve the compliance note first' : undefined} onClick={approve}><Icon name="check" />Approve</button></>}
          {item.status === 'in_review' && !can('content.approve') && <span className="muted" style={{ fontSize: 13 }}>Waiting for an approver.</span>}
          {(item.status === 'approved' || item.status === 'completed') && <button className="btn primary" onClick={onNext}>Publish<Icon name="arrowR" /></button>}
        </div>
      </div>
    </>
  );
}

function DownloadButton({ asset }: { asset: Asset }) {
  const { api, toast } = useStore();
  return <button className="btn" onClick={async () => {
    try { const u = await api.assetUrl(asset); if (!u) { toast('No file in demo mode', 'info'); return; } const a = document.createElement('a'); a.href = u; a.download = asset.name; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
    catch { toast('Couldn’t get the download link', 'alert'); }
  }}><Icon name="download" />Download</button>;
}

/* ------------------------------------------------------------------ step: publish */
export function PublishPanel({ item, assets, onDone }: { item: ContentItem; assets: Asset[]; onDone?: () => void }) {
  const { data, api, run, can } = useStore();
  const T = TYPES[item.type];
  const conn = Object.fromEntries((data?.social ?? []).map((s) => [s.platform, s.status === 'connected'])) as Record<Platform, boolean>;
  const [plats, setPlats] = useState<Platform[]>(item.platforms.length ? item.platforms : T.platforms.slice(0, 2));
  const [caps, setCaps] = useState<Partial<Record<Platform, string>>>({});
  const [tab, setTab] = useState<Platform | null>(null);
  const [when, setWhen] = useState<'now' | 'later'>(item.scheduled_at && !isPast(item.scheduled_at) ? 'later' : 'now');
  const [at, setAt] = useState(() => toLocalInput(item.scheduled_at ? new Date(item.scheduled_at) : new Date(Date.now() + 86400000)));
  useEffect(() => { api.listCaptions(item.id).then((cs) => setCaps((c) => ({ ...Object.fromEntries(cs.map((x) => [x.platform, x.body])), ...c }))); }, [api, item.id]);
  const active = tab && plats.includes(tab) ? tab : plats[0] ?? null;
  const cap = active ? caps[active] ?? makeCaption(active, item.title) : '';

  if (!T.platforms.length) return <Notice>PDFs aren’t posted to social platforms. Download it from the Asset Library or share it from abetglobal.com.</Notice>;
  if (!can('content.publish')) return <Notice kind="warn" icon="lock">Your role can’t publish. A marketing manager or social media manager can schedule this.</Notice>;

  const submit = async () => {
    const over = plats.find((p) => (caps[p] ?? makeCaption(p, item.title)).length > PLAT_LIMIT[p]);
    if (over) { await run(() => Promise.reject(new Error(`${PLAT[over]} caption is over ${PLAT_LIMIT[over]} characters.`))); return; }
    const sched = when === 'now' ? new Date() : new Date(at);
    if (when === 'later' && sched.getTime() < Date.now()) { await run(() => Promise.reject(new Error('Pick a time in the future.'))); return; }
    const r = await run(async () => {
      for (const p of plats) await api.saveCaption(item.id, p, caps[p] ?? makeCaption(p, item.title));
      await api.updateItem(item.id, { platforms: plats, scheduled_at: sched.toISOString(), status: 'completed', ...(when === 'now' ? { published_at: sched.toISOString() } : {}) });
      if (when === 'now') for (const a of assets) await api.updateAsset(a.id, { state: 'published' });
      await api.log(`${when === 'now' ? 'marked as published' : 'scheduled'} “${item.title}” for ${plats.map((p) => PLAT[p]).join(', ')}`, item.id);
      return true;
    }, when === 'now' ? 'Marked as published' : `Scheduled for ${fmtDateTime(sched.toISOString())}`);
    if (r) onDone?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="field"><span className="lbl">Platforms</span>
        <div className="plat-pick">{PLAT_KEYS.map((p) => {
          const sup = T.platforms.includes(p);
          return <button key={p} type="button" className="pp" aria-pressed={plats.includes(p)} disabled={!sup} onClick={() => setPlats((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))}>
            <span className="pl">{p}</span><span><b>{PLAT[p]}</b><span>{!sup ? 'Format not supported' : conn[p] ? 'Connected' : 'Manual posting'}</span></span></button>;
        })}</div></div>
      {active && <div className="field"><span className="lbl">Caption</span>
        <div className="tabs" role="tablist">{plats.map((p) => <button key={p} role="tab" aria-selected={p === active} onClick={() => setTab(p)}>{PLAT[p]}</button>)}</div>
        <textarea className="textarea" rows={7} value={cap} onChange={(e) => setCaps((c) => ({ ...c, [active]: e.target.value }))} aria-label={`Caption for ${PLAT[active]}`} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CopyButton text={cap} label="Copy caption" /><span className={`cap-count${cap.length > PLAT_LIMIT[active] ? ' over' : ''}`} style={{ marginLeft: 'auto' }}>{cap.length} / {PLAT_LIMIT[active]}</span></div></div>}
      <div className="field"><span className="lbl">When</span>
        <div className="seg" role="group"><button type="button" aria-pressed={when === 'now'} onClick={() => setWhen('now')}>Posted now</button><button type="button" aria-pressed={when === 'later'} onClick={() => setWhen('later')}>Schedule</button></div>
        {when === 'later' && <input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} style={{ maxWidth: 260, marginTop: 8 }} aria-label="Publish time" />}</div>
      <Notice>Direct posting isn’t connected yet. Copy each caption, download the file and post it on the platform. Then mark it here so the calendar and reports stay accurate.</Notice>
      <div className="wiz-foot"><div className="r">{assets[0] && <DownloadButton asset={assets[0]} />}<button className="btn primary" disabled={!plats.length} onClick={submit}><Icon name={when === 'now' ? 'check' : 'calendar'} />{when === 'now' ? 'Mark as published' : 'Schedule'}</button></div></div>
    </div>
  );
}

function PublishStep({ item, assets }: { item: ContentItem; assets: Asset[] }) {
  if (item.status === 'completed' && item.scheduled_at) return (
    <section className="panel"><Empty icon="checkc" title={item.published_at ? 'Published' : 'Scheduled'} action={<div style={{ display: 'flex', gap: 8 }}><a className="btn" {...linkProps('/calendar')}><Icon name="calendar" />Open calendar</a><a className="btn primary" {...linkProps('/studio')}><Icon name="plus" />Create another</a></div>}>
      {item.title} · {item.platforms.map((p) => PLAT[p]).join(', ')} · {fmtDateTime(item.scheduled_at)}</Empty></section>
  );
  return <Panel icon="send" title="Publish"><PublishPanel item={item} assets={assets} /></Panel>;
}
