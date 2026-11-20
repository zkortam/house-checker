'use client';
/**
 * Display settings. Same storage keys the boot script in app/layout.tsx reads before first paint:
 * hc-theme ('light' | 'dark' | 'system'), hc-font-size ('small' | 'large'; unset = default),
 * hc-reduce-motion ('1' on, '0' off; unset = follow the device).
 */
import { useSyncExternalStore } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'default' | 'large';
export type MotionPref = 'on' | 'off' | 'device';
export interface Settings { theme: ThemePref; font: FontSize; motion: MotionPref; reduced: boolean; scheme: 'light' | 'dark' }

const subs = new Set<() => void>();
let snap: Settings | null = null;

function read(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function write(k: string, v: string | null) {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* the setting applies for this visit only */ }
}
const osReduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const osLight = () => matchMedia('(prefers-color-scheme: light)').matches;

function compute(): Settings {
  const t = read('hc-theme');
  const theme: ThemePref = t === 'light' || t === 'dark' || t === 'system' ? t : 'dark';
  const f = read('hc-font-size');
  const font: FontSize = f === 'small' || f === 'large' ? f : 'default';
  const m = read('hc-reduce-motion');
  const motion: MotionPref = m === '1' ? 'on' : m === '0' ? 'off' : 'device';
  const reduced = motion === 'on' || (motion === 'device' && osReduce());
  const scheme = theme === 'system' ? (osLight() ? 'light' : 'dark') : theme;
  return { theme, font, motion, reduced, scheme };
}

/** Stamp the document exactly as the boot script does. */
function apply(s: Settings) {
  const d = document.documentElement;
  d.setAttribute('data-theme', s.scheme);
  d.setAttribute('data-theme-scheme', s.scheme);
  d.style.colorScheme = s.scheme;
  d.classList.toggle('reduce-motion', s.reduced);
  if (s.font === 'default') d.removeAttribute('data-font-size'); else d.setAttribute('data-font-size', s.font);
}

function refresh() { snap = compute(); apply(snap); subs.forEach((f) => f()); }

let listening = false;
function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', refresh);
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', refresh);
  window.addEventListener('storage', (e) => { if (e.key?.startsWith('hc-')) refresh(); });
}

export function useSettings(): Settings | null {
  return useSyncExternalStore(
    (f) => { listen(); subs.add(f); return () => subs.delete(f); },
    () => { if (!snap) snap = compute(); return snap; },
    () => null,
  );
}

export function setTheme(t: ThemePref) { write('hc-theme', t); refresh(); }
export function setFont(f: FontSize) { write('hc-font-size', f === 'default' ? null : f); refresh(); }
export function setMotion(m: MotionPref) { write('hc-reduce-motion', m === 'on' ? '1' : m === 'off' ? '0' : null); refresh(); }
