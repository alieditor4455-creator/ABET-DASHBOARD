import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Avatar } from './ui';
import { useStore } from '../data/store';
import { linkProps, navigate } from '../lib/router';
import { ROLE_LABEL, TYPES, TYPE_KEYS } from '../lib/constants';
import type { Permission } from '../lib/types';

export const NAV: [string, [string, string, string, Permission?][]][] = [
  ['Overview', [['dashboard', 'Dashboard', 'home']]],
  ['Create', [['studio', 'Content Studio', 'wand'], ['styles', 'Creative Styles', 'palette'], ['assets', 'Asset Library', 'folder']]],
  ['Manage', [['production', 'Production', 'kanban'], ['calendar', 'Content Calendar', 'calendar']]],
  ['Settings', [['brand', 'Brand Kit', 'brand'], ['integrations', 'AI & Integrations', 'plug'], ['admin', 'Admin Panel', 'shield', 'team.manage']]],
];

function useTheme() {
  const [dark, setDark] = useState(() => {
    try { const t = localStorage.getItem('abet-theme'); if (t) return t === 'dark'; } catch { /* storage blocked */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.classList.toggle('is-dark', dark);
  }, [dark]);
  return [dark, () => setDark((d) => { const n = !d; try { localStorage.setItem('abet-theme', n ? 'dark' : 'light'); } catch { /* ignore */ } return n; })] as const;
}

export function Shell({ section, children }: { section: string; children: ReactNode }) {
  const { profile, data, can, api } = useStore();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('abet-sb') === '1'; } catch { return false; } });
  const [mobOpen, setMobOpen] = useState(false);
  const [pal, setPal] = useState(false);
  const [dark, toggleDark] = useTheme();
  const active = data?.items.filter((i) => i.status !== 'completed').length ?? 0;

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal(true); } };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { setMobOpen(false); document.querySelector('.content')?.scrollTo(0, 0); }, [section]);

  return (
    <div className={`app${collapsed ? ' collapsed' : ''}${mobOpen ? ' mob-open' : ''}`}>
      <aside className="sidebar" aria-label="Primary">
        <div className="sb-head">
          <img className="sb-wm on-light" src="/brand/wordmark-dark.png" alt="ABET" />
          <img className="sb-wm on-dark" src="/brand/wordmark-white.png" alt="ABET" />
          <img className="sb-mark" src="/brand/mark.png" alt="ABET" />
          <span className="sb-tag">Content OS</span>
        </div>
        <nav className="sb-nav">
          {NAV.map(([g, links]) => {
            const visible = links.filter(([, , , perm]) => !perm || can(perm));
            if (!visible.length) return null;
            return (
              <div key={g}>
                <div className="sb-label">{g}</div>
                {visible.map(([id, label, icon]) => (
                  <a key={id} className={`sb-link${section === id ? ' active' : ''}`} {...linkProps(`/${id === 'dashboard' ? '' : id}`)} title={label} aria-current={section === id ? 'page' : undefined}>
                    <Icon name={icon} /><span>{label}</span>{id === 'production' && <span className="cnt">{active}</span>}
                  </a>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sb-foot">
          <div className="sb-user"><Avatar profile={profile} lg /><div className="who"><b>{profile?.full_name}</b><span>{profile ? ROLE_LABEL[profile.role] : ''}</span></div></div>
          <button className="sb-collapse" onClick={() => api.signOut()}><Icon name="logout" size={16} /><span>Sign out</span></button>
          <button className="sb-collapse" onClick={() => setCollapsed((c) => { try { localStorage.setItem('abet-sb', c ? '0' : '1'); } catch { /* ignore */ } return !c; })}><Icon name="chevsL" size={16} /><span>Collapse</span></button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="circle-btn menu-btn" aria-label="Open navigation" onClick={() => setMobOpen((o) => !o)}><Icon name="menu" /></button>
          <button className="search" onClick={() => setPal(true)} aria-label="Search"><Icon name="search" size={17} /><span>Search content, styles and pages</span><kbd>⌘K</kbd></button>
          <div className="tb-right">
            {api.mode === 'demo' && <span className="preview-flag" title="Demo mode: sample data kept in this browser tab only."><i />Demo<span className="long">&nbsp;· sample data</span></span>}
            <button className="circle-btn" id="themeBtn" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleDark}><Icon name={dark ? 'sun' : 'moon'} /></button>
            {can('content.create') && <a className="btn primary tb-create" {...linkProps('/studio')} aria-label="Create content"><Icon name="plus" /><span>Create content</span></a>}
          </div>
        </header>
        <main className="content" onClick={() => setMobOpen(false)}>{children}</main>
      </div>
      {pal && <Palette onClose={() => setPal(false)} />}
    </div>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const { data, can } = useStore();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  type Item = { k: string; label: string; icon: string; go: string; g?: string };
  const all: Item[] = [
    ...NAV.flatMap(([, l]) => l.filter(([, , , p]) => !p || can(p)).map(([id, label, icon]) => ({ k: 'Pages', label, icon, go: `/${id === 'dashboard' ? '' : id}` }))),
    ...(can('content.create') ? TYPE_KEYS.map((t) => ({ k: 'Create', label: `New ${TYPES[t].name}`, icon: TYPES[t].icon, go: `/studio?type=${t}` })) : []),
    ...(data?.items ?? []).map((i) => ({ k: 'Content', label: i.title, icon: TYPES[i.type].icon, go: `/studio/${i.id}` })),
    ...(data?.styles ?? []).map((s) => ({ k: 'Styles', label: s.name, icon: 'palette', go: `/styles?open=${s.id}`, g: s.category })),
  ];
  const list = all.filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase())).slice(0, q ? 40 : 14);
  const go = (i?: Item) => { onClose(); if (i) navigate(i.go); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);
  let last = '';
  return (
    <div className="scrim on" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-label="Search">
        <div className="pal-in"><Icon name="search" /><input autoFocus value={q} placeholder="Search content, styles and pages" aria-label="Search"
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => { if (e.key === 'ArrowDown') { setSel((s) => Math.min(s + 1, list.length - 1)); e.preventDefault(); } else if (e.key === 'ArrowUp') { setSel((s) => Math.max(s - 1, 0)); e.preventDefault(); } else if (e.key === 'Enter') go(list[sel]); }} /><kbd>Esc</kbd></div>
        <div className="pal-list">
          {!list.length && <div className="empty"><b>No results</b><p>Try “calendar”, a style name or a content title.</p></div>}
          {list.map((i, n) => {
            const head = i.k !== last ? <div className="pal-sec">{i.k}</div> : null; last = i.k;
            return <div key={`${i.k}-${i.go}-${n}`}>{head}<button className={`pal-item${n === sel ? ' sel' : ''}`} onClick={() => go(i)}><Icon name={i.icon} size={16} /><span>{i.label}</span>{i.g && <span className="g">{i.g}</span>}</button></div>;
          })}
        </div>
      </div>
    </div>
  );
}
