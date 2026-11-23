import { useState } from 'react';
import { useStore } from '../data/store';
import { Icon } from '../components/Icon';
import { Avatar, Panel } from '../components/ui';
import { PLAT, TYPES, TYPE_KEYS } from '../lib/constants';
import { isoDay, isPast, localDay, fmtTime } from '../lib/format';
import { linkProps, navigate } from '../lib/router';
import type { ContentItem } from '../lib/types';

const pubState = (i: ContentItem) => (i.published_at || isPast(i.scheduled_at) ? 'Published' : 'Scheduled');
const DOT = { Scheduled: 'var(--s-gen)', Published: 'var(--s-done)' };

export function Calendar() {
  const { data, api, run, can } = useStore();
  const today = new Date();
  const [view, setView] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [owner, setOwner] = useState('all');
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  if (!data) return null;
  const person = (id: string) => data.profiles.find((p) => p.id === id);
  const its = data.items.filter((i) => i.scheduled_at && (type === 'all' || i.type === type) && (status === 'all' || pubState(i) === status) && (owner === 'all' || i.owner_id === owner));
  const on = (d: Date) => its.filter((i) => localDay(i.scheduled_at!) === isoDay(d)).sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!));

  const move = async (dayIso: string) => {
    setOver(null);
    const it = data.items.find((i) => i.id === drag); setDrag(null);
    if (!it?.scheduled_at) return;
    if (!can('content.publish')) { await run(() => Promise.reject(new Error('permission denied'))); return; }
    const old = new Date(it.scheduled_at); const [y, m, d] = dayIso.split('-').map(Number);
    const next = new Date(y, m - 1, d, old.getHours(), old.getMinutes());
    if (next.getTime() < Date.now()) { await run(() => Promise.reject(new Error('Choose a time in the future.'))); return; }
    await run(() => api.updateItem(it.id, { scheduled_at: next.toISOString() }), `Moved to ${next.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`);
  };
  const dropProps = (k: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(k); },
    onDragLeave: () => setOver(null),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); move(k); },
  });
  const dragProps = (i: ContentItem) => ({
    draggable: !i.published_at && !isPast(i.scheduled_at) && can('content.publish'),
    onDragStart: () => setDrag(i.id),
    onClick: () => navigate(`/studio/${i.id}`),
  });

  let title: string; let body: React.ReactNode;
  if (view === 'month') {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    title = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const cells = Array.from({ length: 42 }, (_, n) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + n));
    const rows = cells[35].getMonth() !== cursor.getMonth() ? 35 : 42;
    body = (
      <div className="month">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="dow">{d}</div>)}
        {cells.slice(0, rows).map((d) => {
          const k = isoDay(d);
          return (
            <div key={k} className={`day${d.getMonth() !== cursor.getMonth() ? ' out' : ''}${k === isoDay(today) ? ' today' : ''}${over === k ? ' drop' : ''}`} {...dropProps(k)}>
              <span className="dn">{d.getDate()}</span>
              {on(d).map((i) => <button key={i.id} className={`ev${pubState(i) === 'Published' ? ' past' : ''}`} {...dragProps(i)} title={`${i.title} · ${fmtTime(i.scheduled_at!)} · ${i.platforms.map((p) => PLAT[p]).join(', ')}`}><span className="d" style={{ background: DOT[pubState(i)] }} /><span>{i.title}</span></button>)}
            </div>
          );
        })}
      </div>
    );
  } else {
    const ws = new Date(cursor); ws.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, n) => new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + n));
    title = `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    body = (
      <div style={{ overflowX: 'auto' }}><div className="week" style={{ minWidth: 760 }}>
        {days.map((d) => {
          const k = isoDay(d);
          return (
            <div key={k} className={`wcol${k === isoDay(today) ? ' today' : ''}`}>
              <div className="wcol-h"><small>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</small><b>{d.getDate()}</b></div>
              <div className={`wcol-b${over === k ? ' drop' : ''}`} {...dropProps(k)}>
                {on(d).map((i) => (
                  <div key={i.id} className="wev" role="button" tabIndex={0} {...dragProps(i)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/studio/${i.id}`); }}>
                    <span className="tm">{fmtTime(i.scheduled_at!)} · {pubState(i)}</span><b>{i.title}</b>
                    <span className="type-line"><Icon name={TYPES[i.type].icon} size={15} />{TYPES[i.type].short}</span>
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Avatar profile={person(i.owner_id)} /><span className="muted" style={{ fontSize: 11 }}>{i.platforms.join(' · ')}</span></span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div></div>
    );
  }
  const shift = (dir: number) => setCursor((c) => (view === 'month' ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7 * dir)));

  // Suggestions from real data: approved but unscheduled content, and empty weekdays in the next two weeks.
  const ready = data.items.filter((i) => i.status === 'approved' && !i.scheduled_at);
  const next14 = Array.from({ length: 14 }, (_, n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1 + n));
  const empty = next14.filter((d) => d.getDay() !== 0 && d.getDay() !== 6 && !data.items.some((i) => i.scheduled_at && localDay(i.scheduled_at) === isoDay(d)));
  const upcoming = data.items.filter((i) => i.scheduled_at && !isPast(i.scheduled_at));
  const quiet = (Object.keys(PLAT) as (keyof typeof PLAT)[]).filter((p) => !upcoming.some((i) => i.platforms.includes(p)));

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-head"><div><h1>Content Calendar</h1><p className="lead">What’s going out, when, and where.</p></div>
        <div className="actions"><div className="seg" role="group" aria-label="View"><button aria-pressed={view === 'month'} onClick={() => setView('month')}>Month</button><button aria-pressed={view === 'week'} onClick={() => setView('week')}>Week</button></div></div></div>
      <div className="cal-wrap">
        <section className="panel" style={{ overflow: 'hidden' }}>
          <div className="cal-h">
            <button className="icon-btn" aria-label="Previous" onClick={() => shift(-1)}><Icon name="chevL" /></button><h2>{title}</h2><button className="icon-btn" aria-label="Next" onClick={() => shift(1)}><Icon name="chevR" /></button>
            <button className="btn sm" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate()))}>Today</button>
            <div className="r">
              <select className="select sm" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="all">All types</option>{TYPE_KEYS.map((k) => <option key={k} value={k}>{TYPES[k].name}</option>)}</select>
              <select className="select sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="all">All statuses</option><option>Scheduled</option><option>Published</option></select>
              <select className="select sm" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Team member"><option value="all">Everyone</option>{data.profiles.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
            </div>
          </div>
          {body}
          <div className="legend" style={{ padding: '12px 24px', borderTop: '1px solid var(--border)' }}><span><i style={{ background: 'var(--s-gen)' }} />Scheduled</span><span><i style={{ background: 'var(--s-done)' }} />Published</span>{can('content.publish') && <span className="muted">Drag a scheduled post to another day to move it.</span>}</div>
        </section>
        <Panel icon="sparkles" title="Planning suggestions">
          {ready.length ? ready.slice(0, 4).map((i, n) => (
            <div className="sug" key={i.id}>
              <p><b>{i.title}</b> is approved but not scheduled.{empty[n] ? ` ${empty[n].toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} has nothing planned.` : ''}</p>
              <a className="btn sm" style={{ alignSelf: 'flex-start' }} {...linkProps(`/studio/${i.id}?step=publish`)}><Icon name="calendar" size={16} />Schedule it</a>
            </div>
          )) : <div className="sug"><p>All approved content is scheduled.</p></div>}
          {quiet.length > 0 && <div className="sug"><p><Icon name="info" size={14} /> Nothing is planned for <b>{quiet.map((p) => PLAT[p]).join(', ')}</b> yet.</p></div>}
          {empty.length > 0 && <div className="sug"><p>{empty.length} weekday{empty.length > 1 ? 's' : ''} in the next two weeks have nothing scheduled.</p></div>}
          <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>For a full plan, ask Claude: “Look at the ABET calendar and suggest what to make next week.”</p>
        </Panel>
      </div>
    </div>
  );
}
