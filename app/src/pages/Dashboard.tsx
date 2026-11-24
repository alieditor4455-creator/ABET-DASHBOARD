import { useStore } from '../data/store';
import { Icon } from '../components/Icon';
import { Avatar, Empty, Panel, StatusChip } from '../components/ui';
import { TYPES } from '../lib/constants';
import { ago, fmtTime, isPast } from '../lib/format';
import { linkProps, navigate } from '../lib/router';

export function Dashboard() {
  const { data, profile, can } = useStore();
  if (!data) return null;
  const { items, profiles, styles, activity } = data;
  const person = (id: string | null) => profiles.find((p) => p.id === id);
  const styleName = (id: string | null) => styles.find((s) => s.id === id)?.name ?? '—';

  const prod = items.filter((i) => i.status === 'draft' || i.status === 'in_production');
  const review = items.filter((i) => i.status === 'in_review');
  const flagged = review.filter((i) => i.compliance_note);
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const done = items.filter((i) => (i.status === 'approved' || i.status === 'completed') && new Date(i.updated_at) >= month);
  const sched = items.filter((i) => i.scheduled_at && !isPast(i.scheduled_at) && !i.published_at).sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!));
  const making = items.filter((i) => i.status === 'in_production');
  const recent = items.slice(0, 7);
  const hr = new Date().getHours();
  const first = profile?.full_name.split(' ')[0] ?? '';

  const Card = ({ icon, title, sub, value, small, to, hl }: { icon: string; title: string; sub: string; value: number; small: string; to: string; hl?: boolean }) => (
    <a className="panel stat" {...linkProps(to)} style={{ textDecoration: 'none', color: 'inherit' }}>
      <span className="stat-top"><span className={`stat-ico${hl ? ' hl' : ''}`}><Icon name={icon} size={19} /></span><span className="stat-t"><b>{title}</b><span>{sub}</span></span><span className="stat-go"><Icon name="arrowUR" size={15} /></span></span>
      <span className="stat-v"><span className="num">{value}</span><small>{small}</small></span>
    </a>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'}{first ? `, ${first}` : ''}</h1>
          <p className="lead">{review.length ? `${review.length} item${review.length > 1 ? 's are' : ' is'} waiting for review${flagged.length ? `, ${flagged.length} with compliance notes` : ''}.` : 'Nothing is waiting for review.'} {sched.length ? `${sched.length} post${sched.length > 1 ? 's are' : ' is'} scheduled.` : ''}</p>
        </div>
        <div className="actions"><a className="btn" {...linkProps('/calendar')}><Icon name="calendar" />Open calendar</a></div>
      </div>

      {can('team.manage') && (!data.settings.last_backup_at || Date.now() - new Date(data.settings.last_backup_at).getTime() > 7 * 86400000) && (
        <div className="notice warn"><Icon name="download" size={16} /><span><b>Backup due.</b> {data.settings.last_backup_at ? 'It’s been more than a week since the last backup.' : 'No backup has been taken yet.'} <a className="link" {...linkProps('/admin?tab=backup')}>Download a backup</a></span></div>
      )}
      {data.items.some((i) => i.needs_script) && (
        <div className="notice"><Icon name="sparkles" size={16} /><span><b>{data.items.filter((i) => i.needs_script).length} in the Claude queue.</b> Ask Claude: “Write scripts for everything in the ABET Content OS Claude queue.” <a className="link" {...linkProps('/studio')}>View queue</a></span></div>
      )}
      <div className="stat-grid">
        <Card icon="wand" title="In production" sub="Drafts and editing" value={prod.length} small={`${making.length} with editors`} to="/production" />
        <Card icon="eye" title="Ready for review" sub="Awaiting approval" value={review.length} small={flagged.length ? `${flagged.length} with compliance notes` : 'No compliance notes'} to="/production" hl />
        <Card icon="checkc" title="Completed" sub="Approved this month" value={done.length} small="since the 1st" to="/assets" />
        <Card icon="calendar" title="Scheduled" sub="Queued to publish" value={sched.length} small={sched[0] ? `next ${new Date(sched[0].scheduled_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'none queued'} to="/calendar" />
      </div>

      <div className="dash-grid">
        <Panel icon="kanban" title="Recent projects" right={<a className="link" {...linkProps('/production')}>View all <Icon name="arrowR" /></a>} bodyClass="">
          {recent.length ? (
            <div className="rows" style={{ marginTop: 12 }}>
              <div className="row row-h"><span>Content</span><span>Style</span><span>Owner</span><span>Status</span><span style={{ textAlign: 'right' }}>Updated</span></div>
              {recent.map((i) => (
                <button key={i.id} className="row" onClick={() => navigate(`/studio/${i.id}`)}>
                  <span style={{ minWidth: 0 }}><span className="tt" style={{ display: 'block' }}>{i.title}</span><span className="sub" style={{ display: 'block' }}>{TYPES[i.type].name}</span></span>
                  <span className="sub">{styleName(i.style_id)}</span><span><Avatar profile={person(i.owner_id)} /></span><span><StatusChip status={i.status} /></span><span className="upd">{ago(i.updated_at)}</span>
                </button>
              ))}
            </div>
          ) : <Empty icon="wand" title="No content yet" action={<a className="btn primary sm" {...linkProps('/studio')}><Icon name="plus" size={16} />Create your first piece</a>}>Everything you create in Content Studio shows up here.</Empty>}
        </Panel>
        <Panel icon="calendar" title="Upcoming content" right={<a className="link" {...linkProps('/calendar')}>Calendar <Icon name="arrowR" /></a>} bodyClass="">
          <div className="up-list" style={{ marginTop: 8 }}>
            {sched.length ? sched.slice(0, 6).map((i) => {
              const d = new Date(i.scheduled_at!);
              return (
                <button key={i.id} className="up" onClick={() => navigate(`/studio/${i.id}`)}>
                  <span className="date-tile"><small>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</small><b>{d.getDate()}</b></span>
                  <span className="meta"><b>{i.title}</b><span>{fmtTime(i.scheduled_at!)} · {i.platforms.join(', ') || 'No platform'}</span></span>
                </button>
              );
            }) : <Empty title="Nothing scheduled">Approved content appears here once it has a publish date.</Empty>}
          </div>
        </Panel>
      </div>

      <div className="dash-grid">
        <Panel icon="zap" title="Production activity" bodyClass="">
          <div className="feed">
            {activity.length ? activity.slice(0, 7).map((a) => {
              const p = person(a.actor_id);
              return (
                <div className="fi" key={a.id}>
                  {a.via === 'claude' ? <span className="agent"><Icon name="sparkles" /></span> : <Avatar profile={p} />}
                  <div className="body"><b>{p?.full_name ?? 'System'}</b>{a.via === 'claude' ? ' (via Claude)' : ''} {a.message}<div className="when">{ago(a.created_at)}</div></div>
                </div>
              );
            }) : <Empty title="No activity yet">Changes by the team and by Claude are logged here.</Empty>}
          </div>
        </Panel>
        <Panel icon="film" title="With editors now" right={<span className="muted" style={{ fontSize: 12 }}>{making.length || ''}</span>} bodyClass="">
          <div style={{ marginTop: 12, paddingBottom: 12 }}>
            {making.length ? making.map((i) => (
              <button key={i.id} className="job-mini" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate(`/studio/${i.id}`)}>
                <div className="jt"><b>{i.title}</b><Avatar profile={person(i.owner_id)} /></div>
                <div className="js"><span>{TYPES[i.type].name}</span><span>updated {ago(i.updated_at)}</span></div>
              </button>
            )) : <Empty icon="film" title="Nobody is editing right now">When a script is sent to production, it shows here until the editor uploads the file.</Empty>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
