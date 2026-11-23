import { useState } from 'react';
import { useStore } from '../data/store';
import { Icon } from '../components/Icon';
import { Avatar, Chip, Empty, StatusChip } from '../components/ui';
import { STATUSES, STATUS_COLOR, STATUS_LABEL, TYPES, TYPE_KEYS } from '../lib/constants';
import { ago, isPast } from '../lib/format';
import { linkProps, navigate } from '../lib/router';
import type { ContentItem, Status } from '../lib/types';

export function Production() {
  const { data, api, run, can } = useStore();
  const [view, setView] = useState<'kanban' | 'list'>(() => { try { return (localStorage.getItem('abet-prod-view') as 'kanban' | 'list') || 'kanban'; } catch { return 'kanban'; } });
  const [type, setType] = useState('all');
  const [owner, setOwner] = useState('all');
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  if (!data) return null;
  const { items, profiles, styles } = data;
  const person = (id: string) => profiles.find((p) => p.id === id);
  const styleName = (id: string | null) => styles.find((s) => s.id === id)?.name ?? 'No style yet';
  const list = items.filter((i) => (type === 'all' || i.type === type) && (owner === 'all' || i.owner_id === owner));
  const owners = [...new Set(items.map((i) => i.owner_id))];
  const setV = (v: 'kanban' | 'list') => { setView(v); try { localStorage.setItem('abet-prod-view', v); } catch { /* ignore */ } };
  const label = (i: ContentItem) => (i.status === 'completed' && i.scheduled_at ? (i.published_at || isPast(i.scheduled_at) ? 'Published' : 'Scheduled') : undefined);

  const drop = async (to: Status) => {
    setOver(null);
    const it = items.find((i) => i.id === drag); setDrag(null);
    if (!it || it.status === to) return;
    if (to === 'in_review') { navigate(`/studio/${it.id}?step=produce`); return; }
    if (to === 'completed') { navigate(`/studio/${it.id}?step=publish`); return; }
    await run(() => api.updateItem(it.id, { status: to }), `Moved to ${STATUS_LABEL[to]}`);
  };

  return (
    <div className="page" style={{ maxWidth: 1440 }}>
      <div className="page-head">
        <div><h1>Production</h1><div className="prod-meta"><span>{items.length} items</span>{items[0] && <><span>·</span><span>updated {ago(items[0].updated_at)}</span></>}<span className="avs">{owners.slice(0, 5).map((o) => <Avatar key={o} profile={person(o)} />)}</span>{owners.length > 5 && <span>+{owners.length - 5}</span>}</div></div>
        <div className="actions">{can('content.create') && <a className="btn primary" {...linkProps('/studio')}><Icon name="plus" />New content</a>}</div>
      </div>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="View"><button aria-pressed={view === 'kanban'} onClick={() => setV('kanban')}><Icon name="kanban" size={15} />Kanban</button><button aria-pressed={view === 'list'} onClick={() => setV('list')}><Icon name="list" size={15} />List</button></div>
        <select className="select sm" value={type} onChange={(e) => setType(e.target.value)} aria-label="Content type"><option value="all">All types</option>{TYPE_KEYS.map((k) => <option key={k} value={k}>{TYPES[k].name}</option>)}</select>
        <select className="select sm" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Team member"><option value="all">Everyone</option>{profiles.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
      </div>

      {!items.length ? <div className="panel"><Empty icon="kanban" title="No content yet" action={can('content.create') ? <a className="btn primary sm" {...linkProps('/studio')}><Icon name="plus" size={16} />Create content</a> : undefined}>Everything you make in Content Studio appears here, from draft to published.</Empty></div>
        : view === 'list' ? (
          <section className="panel list">
            <table className="tbl"><thead><tr><th>Content</th><th>Type</th><th>Style</th><th>Owner</th><th>Status</th><th>Last updated</th></tr></thead><tbody>
              {[...list].sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || b.updated_at.localeCompare(a.updated_at)).map((i) => (
                <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/studio/${i.id}`)}>
                  <td className="tt">{i.title}{i.compliance_note && <> <Chip cls="st-warn" icon="alert">Compliance</Chip></>}</td>
                  <td><span className="type-line"><Icon name={TYPES[i.type].icon} size={15} />{TYPES[i.type].name}</span></td>
                  <td className="muted">{styleName(i.style_id)}</td>
                  <td><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Avatar profile={person(i.owner_id)} />{person(i.owner_id)?.full_name}</span></td>
                  <td><StatusChip status={i.status} label={label(i)} /></td><td className="muted">{ago(i.updated_at)}</td>
                </tr>))}
            </tbody></table>
            {!list.length && <Empty title="No content matches these filters" />}
          </section>
        ) : (
          <div className="kanban-wrap"><div className="kanban">
            {STATUSES.map((s) => {
              const col = list.filter((i) => i.status === s);
              return (
                <div key={s} className={`kcol${over === s ? ' drop' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }} onDrop={(e) => { e.preventDefault(); drop(s); }}>
                  <div className="kcol-h"><i style={{ background: STATUS_COLOR[s] }} /><b>{STATUS_LABEL[s]}</b>{s === 'draft' && can('content.create') && <span className="r"><a className="icon-btn" {...linkProps('/studio')} aria-label="New draft"><Icon name="plus" /></a></span>}</div>
                  <div className="kcol-sub">{col.length} item{col.length === 1 ? '' : 's'}</div>
                  {col.map((i) => (
                    <div key={i.id} className={`kcard${drag === i.id ? ' dragging' : ''}`} draggable tabIndex={0} role="button" aria-label={`${i.title}, ${STATUS_LABEL[i.status]}`}
                      onDragStart={(e) => { setDrag(i.id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', i.id); } catch { /* ignore */ } }} onDragEnd={() => { setDrag(null); setOver(null); }}
                      onClick={() => navigate(`/studio/${i.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/studio/${i.id}`); }}>
                      <div className="ktop"><StatusChip status={i.status} label={label(i)} /></div>
                      <div className="kl"><span className="kt">{i.title}</span><span className="type-line"><Icon name={TYPES[i.type].icon} size={15} />{TYPES[i.type].name}</span><span className="type-line"><Icon name="palette" size={15} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{styleName(i.style_id)}</span></span></div>
                      {i.compliance_note && <Chip cls="st-warn" icon="alert">Compliance note</Chip>}
                      <div className="kf"><Avatar profile={person(i.owner_id)} /><span className="upd"><Icon name="clock" size={13} />{ago(i.updated_at)}</span></div>
                    </div>
                  ))}
                  {s === 'draft' && can('content.create') && <a className="kadd" {...linkProps('/studio')}><Icon name="plus" size={16} />New content</a>}
                </div>
              );
            })}
          </div></div>
        )}
    </div>
  );
}
