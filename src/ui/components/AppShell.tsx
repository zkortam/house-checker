'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SettingsDialog } from './SettingsDialog';
import { S } from '../strings.en';
import { U } from '../icons';
import { Pressable, ToastDock, useToast } from './ui';

/** Places: a rail from 744 px, a tab pill below it (Surf Studio shell). Settings holds theme, text size and motion. */
const PLACES = [
  { href: '/', label: S.navCheck, icon: 'house' as const, match: (p: string) => p === '/' || p.startsWith('/check') },
  { href: '/recent', label: S.navRecent, icon: 'pending' as const, match: (p: string) => p.startsWith('/recent') },
];

function Places({ kind }: { kind: 'rail' | 'tabs' }) {
  const path = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  return (
    <nav className={kind} aria-label={S.mainNav}>
      <ul>
        {PLACES.map((p) => {
          const on = p.match(path);
          return (
            <li key={p.href}>
              <Link href={p.href} className="place" aria-current={on ? 'page' : undefined}>
                <U name={p.icon} weight={on ? 'fill' : 'regular'} /><span>{p.label}</span>
              </Link>
            </li>
          );
        })}
        {kind === 'tabs' ? (
          <li><Pressable className="place" onClick={() => setOpen(true)}><U name="settings" /><span>{S.navSettings}</span></Pressable></li>
        ) : null}
      </ul>
      {kind === 'rail' ? (
        <Pressable className="place" onClick={() => setOpen(true)}><U name="settings" /><span>{S.navSettings}</span></Pressable>
      ) : null}
      <SettingsDialog open={open} onClose={() => setOpen(false)} />
    </nav>
  );
}

export function ShareButton() {
  const toast = useToast();
  const share = async () => {
    const url = location.href;
    if (navigator.share) {
      try { await navigator.share({ title: document.title, url }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); toast.show(S.linkCopied); } catch { toast.show(S.linkNotCopied, { error: true }); }
  };
  return <Pressable className="pill" onClick={share}>{S.share}</Pressable>;
}

/** `back`, `title` and `share` are accepted for older callers; the rail replaces the header that used them. */
export function AppShell({ children }: { children: ReactNode; back?: boolean; title?: string; share?: boolean }) {
  return (
    <ToastDock>
      <a className="skip" href="#content">{S.skip}</a>
      <Places kind="rail" />
      <main id="content" tabIndex={-1} className="with-rail">{children}</main>
      <Places kind="tabs" />
    </ToastDock>
  );
}
