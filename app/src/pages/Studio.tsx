import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../data/store';
import { Icon } from '../components/Icon';
import { Avatar, Chip, CopyButton, Empty, Notice, Panel, StatusChip, Thumb } from '../components/ui';
import { PLAT, PLAT_KEYS, PLAT_LIMIT, REC_STYLE, ROLE_LABEL, STYLE_CATS, TOPIC_SUGGESTIONS, TYPES, TYPE_KEYS } from '../lib/constants';
import { claudePrompt, complianceCheck, makeCaption, templateScript } from '../lib/script';
import { ago, fmtBytes, fmtDateTime, isPast, toLocalInput } from '../lib/format';
import { linkProps, navigate } from '../lib/router';
import type { Asset, ContentItem, ContentType, Platform, Script, ScriptUnit } from '../lib/types';

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
  const drafts = (data?.items ?? []).filter((i) => i.status === 'draft').slice(0, 8);
  return (
    <div className="page">
      <div className="studio-hero"><h1>What would you like to create?</h1><p>Pick a format and a topic. Claude writes the script in ABET’s voice, you choose the look, and your editors make it.</p></div>
      {!can('content.create') && <Notice kind="warn" icon="lock">Your role can review content but not create it. Ask an admin if you need to create.</Notice>}
      <div className="type-grid">
        {TYPE_KEYS.map((k) => (
          <a key={k} className="type-card" {...linkProps(`/studio?type=${k}`)} aria-disabled={!can('content.create')}>
            <span className="t-ico"><Icon name={TYPES[k].icon} size={22} /></span>
            <span><b>{TYPES[k].name}</b><p>{TYPES[k].desc}</p><small>{TYPES[k].meta}</small></span>
          </a>
        ))}
      </div>
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

/* ------------------------------------------------------------------ step 1: topic */
function NewTopic({ type }: { type: ContentType }) {
  const { api, run, can } = useStore();
  const T = TYPES[type];
  const [topic, setTopic] = useState('');
  const [adv, setAdv] = useState(false);
  const [audience, setAudience] = useState('Complete beginners');
  const [objective, setObjective] = useState('Education');
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!topic.trim()) return;
    setBusy(true);
    const item = await run(() => api.createItem({ title: topic.trim(), topic: topic.trim(), type, audience, objective }), 'Draft created');
    setBusy(false);
    if (item) navigate(`/studio/${item.id}?step=script`);
  };
  return (
    <div className="page">
      <div className="wiz-top"><a className="back" {...linkProps('/studio')}><Icon name="arrowL" size={16} />All formats</a><Stepper current={-1} max={-1} /></div>
      <div className="wiz">
        <div className="wiz-main">
          <section className="panel"><div className="panel-b topic-box" style={{ paddingTop: 24 }}>
            <label htmlFor="topic" className="muted" style={{ fontSize: 12.5, fontWeight: 500 }}>What is your {T.short.toLowerCase()} about?</label>
            <textarea id="topic" autoFocus maxLength={200} placeholder="e.g. What is a pip? Explain it for complete beginners." value={topic} onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); create(); } }} />
            <div className="sugg" aria-label="Suggestions">{TOPIC_SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => setTopic(s)}>{s}</button>)}</div>
          </div></section>
          <section className="panel"><div className="panel-b" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="sparkles" size={16} /><b style={{ fontWeight: 500 }}>Claude takes care of</b></div>
            <div className="claude-does">
              <div><Icon name="book" /><b>Research</b>Checks the topic against ABET’s guides.</div>
              <div><Icon name="users" /><b>Audience</b>Pitches it at the right level.</div>
              <div><Icon name="target" /><b>Strategy</b>Picks the angle, hook and call to action.</div>
              <div><Icon name="shield" /><b>Compliance</b>Adds the risk warning, avoids return claims.</div>
            </div>
            <button type="button" className="adv-toggle" aria-expanded={adv} onClick={() => setAdv(!adv)}><Icon name="chevR" size={16} />Advanced settings</button>
            {adv && (
              <div className="adv-grid">
                <div className="field"><label htmlFor="aud">Target audience</label><select id="aud" className="select" value={audience} onChange={(e) => setAudience(e.target.value)}>{['Complete beginners', 'Beginner traders', 'Intermediate traders', 'Experienced traders', 'Existing ABET clients', 'Potential clients'].map((o) => <option key={o}>{o}</option>)}</select></div>
                <div className="field"><label htmlFor="obj">Objective</label><select id="obj" className="select" value={objective} onChange={(e) => setObjective(e.target.value)}>{['Awareness', 'Education', 'Engagement', 'Brand trust', 'Lead generation', 'Conversion', 'Retention'].map((o) => <option key={o}>{o}</option>)}</select></div>
              </div>
            )}
          </div></section>
          <div className="wiz-foot"><span className="muted" style={{ fontSize: 12.5 }}>Nothing is published without approval.</span>
            <div className="r"><button className="btn primary" disabled={!topic.trim() || busy || !can('content.create')} onClick={create}>{busy ? <Icon name="loader" spin size={16} /> : null}Continue to script<Icon name="arrowR" /></button></div></div>
        </div>
        <aside className="panel summary"><div className="panel-h"><span className="ico"><Icon name={T.icon} size={16} /></span><h3>{T.name}</h3></div>
          <div className="panel-b"><dl><div className="sr-row"><dt>Format</dt><dd>{T.meta}</dd></div><div className="sr-row"><dt>Topic</dt><dd>{topic || '—'}</dd></div><div className="sr-row"><dt>Audience</dt><dd>{audience}</dd></div></dl></div></aside>
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

  if (!data) return null;
  if (!item) return <div className="page"><Empty icon="folder" title="This content no longer exists" action={<a className="btn" {...linkProps('/studio')}>Back to Studio</a>}>It may have been deleted, or the link is wrong.</Empty></div>;

  const approved = scripts?.find((s) => s.approved_at);
  const hasAsset = (assets?.length ?? 0) > 0;
  const max = !approved ? 0 : !item.style_id ? 1 : !hasAsset ? 2 : item.status === 'approved' || item.status === 'completed' ? 4 : 3;
  const auto: Step = !approved ? 'script' : !item.style_id ? 'style' : !hasAsset || item.status === 'draft' || item.status === 'in_production' ? 'produce' : item.status === 'in_review' ? 'review' : 'publish';
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
          {scripts === null || assets === null ? <Panel><div className="writing"><div className="ln" style={{ width: '50%', height: 22 }} /><div className="ln" style={{ width: '90%' }} /><div className="ln" style={{ width: '80%' }} /></div></Panel>
            : cur === 'script' ? <ScriptStep item={item} scripts={scripts} reload={loadScripts} onNext={() => goStep('style')} />
            : cur === 'style' ? <StyleStep item={item} onNext={() => goStep('produce')} onBack={() => goStep('script')} />
            : cur === 'produce' ? <ProduceStep item={item} script={approved!} assets={assets} reload={loadAssets} onNext={() => goStep('review')} />
            : cur === 'review' ? <ReviewStep item={item} script={approved!} assets={assets} onNext={() => goStep('publish')} onBack={() => goStep('script')} />
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
          </div></aside>
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
  const { api, run, can, profile } = useStore();
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

  if (mode === 'choose') return (
    <>
      <Panel icon="sparkles" title="Get the script">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="choice-grid">
            <div className="choice"><Icon name="sparkles" /><b>Ask Claude</b><p>Open Claude and paste the request below. Once the connector is set up, Claude saves the script here automatically.</p>
              <a className="btn primary sm" href={`https://claude.ai/new?q=${encodeURIComponent(prompt)}`} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} />Open Claude</a></div>
            <div className="choice"><Icon name="copy" /><b>Paste from Claude</b><p>Already have a script from Claude or anyone else? Paste it in. Blank lines separate the scenes.</p>
              <button className="btn sm" onClick={() => setMode('paste')} disabled={!canEdit}><Icon name="edit" size={16} />Paste a script</button></div>
            <div className="choice"><Icon name="file" /><b>Start from a template</b><p>A compliant starting structure for this format. Edit it into the final script.</p>
              <button className="btn sm" disabled={!canEdit} onClick={() => { const t = templateScript(item.type, item.topic); setTitle(t.title); setUnits(t.units); setDirty(true); setMode('edit'); }}><Icon name="file" size={16} />Use template</button></div>
          </div>
          <div className="prompt-box">{prompt}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><CopyButton text={prompt} label="Copy request" /><span className="muted" style={{ fontSize: 12 }}><Icon name="loader" spin size={13} /> Watching for a script from Claude</span></div>
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
  const { data, api, run } = useStore();
  const T = TYPES[item.type];
  const list = (data?.styles ?? []).filter((s) => s.category === T.cat || (item.type === 'explainer' && s.category === 'motion'));
  const rec = list.find((s) => s.name === REC_STYLE[item.type]);
  const [sel, setSel] = useState(item.style_id ?? rec?.id ?? list[0]?.id ?? null);
  const chosen = list.find((s) => s.id === sel);
  const next = async () => {
    if (sel !== item.style_id) { const r = await run(() => api.updateItem(item.id, { style_id: sel })); if (!r) return; }
    onNext();
  };
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div><h2 style={{ fontSize: 18 }}>Choose a creative style</h2><p className="muted" style={{ marginTop: 2 }}>{list.length} {STYLE_CATS.find((c) => c[0] === T.cat)?.[1].toLowerCase()} styles.</p></div>
        <a className="link" style={{ marginLeft: 'auto' }} {...linkProps('/styles')}><Icon name="upload" />Upload a reference</a>
      </div>
      <div className="gallery">
        {list.map((s) => (
          <button key={s.id} className={`sty${s.id === sel ? ' sel' : ''}`} aria-pressed={s.id === sel} onClick={() => setSel(s.id)}>
            <Thumb motif={s.motif}>{s.id === rec?.id && <span className="rec">Recommended</span>}<span className="sel-mark"><Icon name="check" /></span></Thumb>
            <span className="sty-b"><b>{s.name}</b><p>{s.description}</p></span>
          </button>
        ))}
      </div>
      {chosen && <details className="specs"><summary><Icon name="chevR" size={16} />{chosen.name}: technical specifications</summary><dl className="spec">{chosen.spec.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></details>}
      <div className="wiz-foot"><button className="btn" onClick={onBack}><Icon name="arrowL" />Script</button><div className="r"><button className="btn primary" disabled={!sel} onClick={next}>Continue<Icon name="arrowR" /></button></div></div>
    </>
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
  const isVid = /\.(mp4|mov|webm|m4v)$/i.test(asset.name) || asset.kind === 'Video';
  const isImg = /\.(png|jpe?g|gif|webp|svg)$/i.test(asset.name);
  return (
    <div className="media-frame">
      {isVid ? <video src={url} controls playsInline /> : isImg ? <img src={url} alt={asset.name} /> : <a className="btn" href={url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} />Open {asset.name}</a>}
    </div>
  );
}

function ReviewStep({ item, script, assets, onNext, onBack }: { item: ContentItem; script: Script; assets: Asset[]; onNext: () => void; onBack: () => void }) {
  const { api, run, can } = useStore();
  const [note, setNote] = useState('');
  const asset = assets[0];
  const checks = complianceCheck(script.title, script.units);
  const approve = async () => {
    const r = await run(() => api.updateItem(item.id, { status: 'approved' }), 'Approved');
    if (r) { await api.addApproval(item.id, 'creative', 'approved').catch(() => {}); onNext(); }
  };
  const changes = () => run(async () => {
    await api.updateItem(item.id, { status: 'draft' });
    await api.addApproval(item.id, 'creative', 'changes_requested', note || undefined).catch(() => {});
    await api.log(`requested changes on “${item.title}”${note ? `: ${note}` : ''}`, item.id);
  }, 'Sent back with your notes');
  return (
    <>
      <section className="panel"><div className="panel-b pv" style={{ paddingTop: 24 }}>
        <div>{asset ? <MediaView asset={asset} /> : <Empty icon="film" title="No file yet">Upload the finished file in Production.</Empty>}</div>
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
        <Panel icon="edit" title="Feedback (optional)"><textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change? This goes back to the owner with the item." aria-label="Feedback" /></Panel>
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
