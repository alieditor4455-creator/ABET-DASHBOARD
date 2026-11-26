import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { thumb } from '../lib/thumbs';
import { STATUS_CLASS, STATUS_LABEL, AVATAR_COLORS } from '../lib/constants';
import type { Profile, Status } from '../lib/types';
import { initials } from '../lib/format';
import { useStore } from '../data/store';

export function StatusChip({ status, label }: { status: Status; label?: string }) {
  return <span className={`chip ${STATUS_CLASS[status]}`}><span className="d" />{label ?? STATUS_LABEL[status]}</span>;
}

export function Chip({ children, cls = '', icon }: { children: ReactNode; cls?: string; icon?: string }) {
  return <span className={`chip ${cls}`}>{icon && <Icon name={icon} size={13} />}{children}</span>;
}

export function colorFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ profile, lg }: { profile?: Profile | null; lg?: boolean }) {
  const name = profile?.full_name || 'Unknown';
  return <span className={`av${lg ? ' lg' : ''}`} style={{ background: colorFor(profile?.id ?? name) }} title={name}>{initials(name)}</span>;
}

export function Thumb({ motif, children, style }: { motif: string; children?: ReactNode; style?: React.CSSProperties }) {
  return <span className="thumb" style={{ display: 'block', ...style }}><span style={{ display: 'block', width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: thumb(motif) }} />{children}</span>;
}

export function Empty({ icon, title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <span className="e-ico"><Icon name={icon} size={20} /></span>}
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Notice({ kind = '', icon = 'info', children }: { kind?: '' | 'warn' | 'err' | 'ok'; icon?: string; children: ReactNode }) {
  return <div className={`notice ${kind}`}><Icon name={icon} size={16} /><span>{children}</span></div>;
}

export function Panel({ icon, title, right, children, className = '', bodyClass = 'panel-b' }: { icon?: string; title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`panel ${className}`}>
      {title && <div className="panel-h">{icon && <span className="ico"><Icon name={icon} size={16} /></span>}<h2>{title}</h2>{right && <span className="r">{right}</span>}</div>}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

function useEsc(onClose: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEsc(onClose);
  return (
    <div className="scrim on" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-h"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children, actions }: { title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  useEsc(onClose);
  return (
    <div className="scrim on" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="dr-h"><h2>{title}</h2><div className="r">{actions}<button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div></div>
        <div className="dr-b">{children}</div>
      </aside>
    </div>
  );
}

export function Toast() {
  const { toastState } = useStore();
  return (
    <div className={`toast${toastState ? ' on' : ''}`} role="status" aria-live="polite">
      {toastState && <><Icon name={toastState.icon} size={16} />{toastState.msg}</>}
    </div>
  );
}

export function CopyButton({ text, label = 'Copy', className = 'btn sm' }: { text: string; label?: string; className?: string }) {
  const { toast } = useStore();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button ref={ref} type="button" className={className} onClick={() => {
      navigator.clipboard?.writeText(text).then(() => toast('Copied'), () => toast('Copy was blocked. Select the text and press Ctrl+C', 'alert'));
    }}><Icon name="copy" size={16} />{label}</button>
  );
}

export function Switch({ id, checked, onChange, disabled, label }: { id: string; checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean; label: string }) {
  return <label className="switch"><input type="checkbox" id={id} checked={checked} disabled={disabled} aria-label={label} onChange={(e) => onChange?.(e.target.checked)} /><span /></label>;
}

/** Password box with a show/hide (eye) button. */
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw-wrap">
      <input {...props} type={show ? 'text' : 'password'} className={`${props.className ?? 'input'} pw-input`} />
      <button type="button" className="pw-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} title={show ? 'Hide password' : 'Show password'}>
        <Icon name={show ? 'eyeoff' : 'eye'} size={18} />
      </button>
    </span>
  );
}
