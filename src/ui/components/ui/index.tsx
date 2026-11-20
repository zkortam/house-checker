'use client';
/**
 * Primitives, one each [components §6]. Every screen is built only from these; no bare controls elsewhere.
 */
import {
  createContext, forwardRef, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes,
} from 'react';
import type { FindingLabel, Tone } from '@contract/types';
import { LABELS } from '@contract/labels';
import { S, fill } from '../../strings.en';
import { U, type UI } from '../../icons';

/* ---------- Button ---------- */

type BtnKind = 'primary' | 'quiet' | 'text';
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; icon?: keyof typeof UI; size?: 'md' | 'sm' }>(
  function Button({ kind = 'quiet', icon, size = 'md', className, children, type = 'button', ...rest }, ref) {
    return (
      <button ref={ref} type={type} className={`btn btn-${kind}${size === 'sm' ? ' btn-sm' : ''}${className ? ` ${className}` : ''}`} {...rest}>
        {icon ? <U name={icon} /> : null}
        <span>{children}</span>
      </button>
    );
  });

export function LinkButton({ href, kind = 'primary', icon, children }: { href: string; kind?: BtnKind; icon?: keyof typeof UI; children: ReactNode }) {
  return (
    <a className={`btn btn-${kind}`} href={href} target="_blank" rel="noopener noreferrer">
      {icon ? <U name={icon} /> : null}<span>{children}</span>
    </a>
  );
}

/** A plain pressable surface (tiles, list rows); the only other bare button. */
export const Pressable = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function Pressable({ type = 'button', ...rest }, ref) { return <button ref={ref} type={type} {...rest} />; });

/* ---------- IconButton and CloseButton: 48 px, 26 px glyph ---------- */

export const IconButton = forwardRef<HTMLButtonElement, { label: string; icon: keyof typeof UI; onClick?: () => void; small?: boolean }>(
  function IconButton({ label, icon, onClick, small }, ref) {
    return (
      <button ref={ref} type="button" className={`icon-btn${small ? ' sm' : ''}`} aria-label={label} onClick={onClick}>
        <U name={icon} />
      </button>
    );
  });

export function CloseButton({ onClick }: { onClick: () => void }) {
  return <IconButton label={S.close} icon="close" onClick={onClick} small />;
}

/* ---------- Card, Row, SectionLabel, MetaLine ---------- */

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <div id={id} className={`card${className ? ` ${className}` : ''}`}>{children}</div>;
}

export function Row({ lead, title, sub, end, onClick, expanded, controls, tone, className }: {
  lead?: ReactNode; title: ReactNode; sub?: ReactNode; end?: ReactNode; onClick?: () => void;
  expanded?: boolean; controls?: string; tone?: Tone; className?: string;
}) {
  const cls = `row${tone ? ` tone-${tone}` : ''}${className ? ` ${className}` : ''}`;
  const body = (
    <>
      {lead}
      <span className="row-body">
        <span className="row-title">{title}</span>
        {sub ? <span className="row-sub">{sub}</span> : null}
      </span>
      {end ? <span className="row-end">{end}</span> : null}
    </>
  );
  if (onClick) {
    return <button type="button" className={cls} onClick={onClick} aria-expanded={expanded} aria-controls={controls}>{body}</button>;
  }
  return <div className={cls}>{body}</div>;
}

export function SectionLabel({ children, id }: { children: ReactNode; id?: string }) {
  return <h2 className="section-label" id={id}>{children}</h2>;
}

export function Group({ id, title, children }: { id?: string; title?: string; children: ReactNode }) {
  const hid = useId();
  return (
    <section className="group" id={id} aria-labelledby={title ? hid : undefined}>
      {title ? <SectionLabel id={hid}>{title}</SectionLabel> : null}
      {children}
    </section>
  );
}

/** Facts set apart by space, never by dots or bars [craft §10a]. */
export function MetaLine({ items, className }: { items: Array<ReactNode | null | false | undefined>; className?: string }) {
  return <div className={`meta num${className ? ` ${className}` : ''}`}>{items.filter(Boolean).map((x, i) => <span key={i}>{x}</span>)}</div>;
}

/* ---------- Chip: status from LABELS only ---------- */

export function LabelChip({ label }: { label: FindingLabel }) {
  const l = LABELS[label];
  return <span className={`chip tone-${l.tone}`}>{l.text}</span>;
}

export function StatusDot({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`status tone-${tone}`}><span className="dot" aria-hidden="true" />{children}</span>;
}

/* ---------- Example chip button ---------- */

export function ChipButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="chip-btn" onClick={onClick}>{children}</button>;
}

/* ---------- Spinner (status loop, kept under reduced motion) ---------- */

export function Spinner({ label }: { label?: string }) {
  return <span className="spinner" role={label ? 'status' : undefined} aria-label={label}><U name="spinner" className="spin" /></span>;
}

/* ---------- Fields: 16 px on touch, no helper text ---------- */

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { variant?: 'field' | 'input' }>(
  function Textarea({ variant = 'input', className, ...rest }, ref) {
    return <textarea ref={ref} className={`${variant}${className ? ` ${className}` : ''}`} {...rest} />;
  });

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ invalid, className, ...rest }, ref) {
    return <input ref={ref} className={`input${invalid ? ' invalid' : ''}${className ? ` ${className}` : ''}`} aria-invalid={invalid || undefined} {...rest} />;
  });

export function FileAttach({ label, onFile }: { label: string; onFile: (f: File | null) => void }) {
  const id = useId();
  return (
    <label className="attach" htmlFor={id}>
      <U name="attach" />
      <span>{label}</span>
      <input id={id} type="file" accept="application/pdf" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}

export function Slider({ id, min, max, step, value, onChange, label }: { id: string; min: number; max: number; step: number; value: number; onChange: (n: number) => void; label: string }) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <input id={id} className="slider" type="range" min={min} max={max} step={step} value={value} aria-label={label}
      style={{ ['--fill' as string]: fill }} onChange={(e) => onChange(Number(e.target.value))} />
  );
}

export function SlotOption({ checked, onSelect, children }: { checked: boolean; onSelect: () => void; children: ReactNode }) {
  return <button type="button" role="radio" aria-checked={checked} className="slot" onClick={onSelect}>{children}</button>;
}

/* ---------- Segmented control (one choice of a few) and Switch (on or off) ---------- */

export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void;
}) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  const move = (d: number) => onChange(options[(i + d + options.length) % options.length].value);
  return (
    <div className="seg" role="radiogroup" aria-label={label} style={{ ['--seg-n' as string]: options.length, ['--seg-i' as string]: i }}>
      <span className="seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} tabIndex={o.value === value ? 0 : -1}
          className="seg-opt" onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1); }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
          }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, labelledBy, describedBy }: { checked: boolean; onChange: (v: boolean) => void; labelledBy: string; describedBy?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelledBy} aria-describedby={describedBy}
      className="switch" onClick={() => onChange(!checked)}>
      <span className="switch-knob" aria-hidden="true" />
    </button>
  );
}

/* ---------- Collapse: grid rows, the one height animation allowed ---------- */

export function Collapse({ open, id, children }: { open: boolean; id?: string; children: ReactNode }) {
  return (
    <div className={`collapse${open ? ' open' : ''}`} id={id} inert={!open || undefined}>
      <div>{children}</div>
    </div>
  );
}

/* ---------- Dialog: sheet under 640 px, centred from 640; Back and Escape close the top one ---------- */

const EXIT_MS = 192; // --ovl-dur 240 x --exit-ratio 0.8, read from the same tokens

/** Open dialogs, bottom to top. */
const openStack: object[] = [];
function dropFromStack(t: object) { const i = openStack.lastIndexOf(t); if (i >= 0) openStack.splice(i, 1); }

export function Dialog({ open, onClose, title, children, foot, size = 'md', labelledTitle = true }: {
  open: boolean; onClose: () => void; title: ReactNode; children?: ReactNode; foot?: ReactNode; size?: 'sm' | 'md'; labelledTitle?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const pushed = useRef(false);
  const tid = useId();
  const [mounted, setMounted] = useState(open);
  const [token] = useState(() => ({}));
  useEffect(() => () => dropFromStack(token), [token]);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => { if (open) setMounted(true); }, [open]);

  useLayoutEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
      d.removeAttribute('data-state');
      requestAnimationFrame(() => requestAnimationFrame(() => d.setAttribute('data-state', 'open')));
      openStack.push(token);
      try { history.pushState({ hcDialog: true }, ''); pushed.current = true; } catch { pushed.current = false; }
    } else if (!open && d.open) {
      // Leave the stack after this popstate has been handled by every listener, never inside onPop.
      dropFromStack(token);
      d.setAttribute('data-state', 'closed');
      const t = setTimeout(() => {
        d.close();
        setMounted(false);
        const o = opener.current as HTMLElement | null;
        if (o && typeof o.focus === 'function') o.focus({ preventScroll: true });
      }, EXIT_MS);
      if (pushed.current) {
        pushed.current = false;
        if (history.state && (history.state as { hcDialog?: boolean }).hcDialog) {
          // Drop the entry this dialog pushed without navigating back through the app's own history.
          try { history.replaceState(null, ''); } catch { /* replaceState refused: the extra entry stays harmless */ }
        }
      }
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    // Back closes only the topmost open dialog; a sheet under a source sheet stays open.
    const onPop = () => { if (pushed.current && openStack[openStack.length - 1] === token) { pushed.current = false; onCloseRef.current(); } };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open]);

  if (!mounted) return null;
  return (
    <dialog
      ref={ref}
      className={`ovl${size === 'sm' ? ' sm' : ''}`}
      aria-labelledby={labelledTitle ? tid : undefined}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ovl-inner">
        <div className="ovl-head">
          <h2 className="ovl-title" id={tid}>{title}</h2>
          <CloseButton onClick={onClose} />
        </div>
        {children}
        {foot ? <div className="ovl-foot">{foot}</div> : null}
      </div>
    </dialog>
  );
}

/** A confirm names who, when and what; its buttons are the verb and Cancel [feedback §31]. */
export function ConfirmDialog({ open, title, facts, confirmLabel, onConfirm, onCancel, busy }: {
  open: boolean; title: string; facts: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onCancel} title={title} size="sm"
      foot={<>
        <Button kind="text" onClick={onCancel}>{S.cancel}</Button>
        <Button kind="primary" onClick={onConfirm} aria-busy={busy || undefined} className="btn-fixed">{confirmLabel}</Button>
      </>}>
      <div className="confirm-facts">{facts}</div>
    </Dialog>
  );
}

/* ---------- Toasts: 4 s outcomes, 5 s with Undo and a drain ---------- */

const TOAST_MS = 4000;
const UNDO_MS = 5000;
type ToastItem = { id: number; text: string; undo?: () => void; life: number; error?: boolean; leaving?: boolean };
type ToastApi = { show: (text: string, opts?: { undo?: () => void; onExpire?: () => void; error?: boolean }) => () => void };
const ToastCtx = createContext<ToastApi>({ show: () => () => undefined });
export const useToast = () => useContext(ToastCtx);

export function ToastDock({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 240);
  }, []);

  const show = useCallback<ToastApi['show']>((text, opts = {}) => {
    const id = nextId.current++;
    const life = opts.undo ? UNDO_MS : TOAST_MS;
    let done = false;
    const timer = setTimeout(() => { if (done) return; done = true; remove(id); opts.onExpire?.(); }, life);
    const undo = opts.undo ? () => { if (done) return; done = true; clearTimeout(timer); remove(id); opts.undo?.(); } : undefined;
    setItems((xs) => [...xs.slice(-2), { id, text, undo, life, error: opts.error }]);
    return () => { if (done) return; done = true; clearTimeout(timer); remove(id); };
  }, [remove]);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.filter((t) => !t.error).map((t) => <ToastView key={t.id} t={t} />)}
      </div>
      <div className="toasts toasts-alert" role="alert" aria-live="assertive">
        {items.filter((t) => t.error).map((t) => <ToastView key={t.id} t={t} />)}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastView({ t }: { t: ToastItem }) {
  const drain = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!t.undo || !drain.current) return;
    const el = drain.current;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('draining')));
  }, [t.undo]);
  return (
    <div className={`toast${t.leaving ? ' out' : ''}`}>
      <span>{t.text}</span>
      {t.undo ? <Button kind="text" onClick={t.undo}>{S.undo}</Button> : null}
      {t.undo ? <span ref={drain} className="drain" aria-hidden="true" /> : null}
    </div>
  );
}

/* ---------- Cited text: [n] becomes a source link, nothing else is parsed ---------- */

const SourceCtx = createContext<(n: number, el: HTMLElement) => void>(() => undefined);
export const SourceProvider = SourceCtx.Provider;

export function Cited({ text }: { text: string }) {
  const open = useContext(SourceCtx);
  // Split into plain text and citation runs; keep each run glued to the word before it and the punctuation after it.
  const re = /((?:\s*\[\d+\])+)/g;
  const parts = text.split(re);
  const out: ReactNode[] = [];
  let carry = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i % 2 === 0) {
      let t = carry + p;
      carry = '';
      const next = parts[i + 1];
      if (next) {
        const m = /(\S*)$/.exec(t);
        const word = m ? m[1] : '';
        t = t.slice(0, t.length - word.length);
        if (t) out.push(<span key={`t${i}`}>{t}</span>);
        const after = parts[i + 2] ?? '';
        const pm = /^[.,;:)]+/.exec(after);
        const punct = pm ? pm[0] : '';
        if (punct) parts[i + 2] = after.slice(punct.length);
        const nums = Array.from(next.matchAll(/\[(\d+)\]/g)).map((x) => Number(x[1]));
        out.push(
          <span key={`c${i}`} className="cite-run">
            {word}
            {nums.map((n, j) => (
              <button key={j} type="button" className="cite" aria-label={fill(S.sourceN, { n })} onClick={(e) => { e.stopPropagation(); open(n, e.currentTarget); }}>
                {n}
              </button>
            ))}
            {punct}
          </span>,
        );
        i++;
      } else if (t) out.push(<span key={`t${i}`}>{t}</span>);
    }
  }
  return <>{out}</>;
}
