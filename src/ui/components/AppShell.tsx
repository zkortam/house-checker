'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { S } from '../strings.en';
import { U } from '../icons';
import { IconButton, ToastDock, useToast } from './ui';

function scheme(): 'light' | 'dark' {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'light' ? 'light' : 'dark';
}

function ThemeButton() {
  const [s, setS] = useState<'light' | 'dark' | null>(null);
  useEffect(() => { setS(scheme()); }, []);
  const toggle = () => {
    const next = scheme() === 'dark' ? 'light' : 'dark';
    const d = document.documentElement;
    d.setAttribute('data-theme', next);
    d.setAttribute('data-theme-scheme', next);
    d.style.colorScheme = next;
    try { localStorage.setItem('hc-theme', next); } catch { /* the choice lasts for this visit only */ }
    setS(next);
  };
  return <IconButton label={s === 'light' ? S.themeToDark : S.themeToLight} icon={s === 'light' ? 'moon' : 'sun'} onClick={toggle} />;
}

function ShareButton() {
  const toast = useToast();
  const share = async () => {
    const url = location.href;
    if (navigator.share) {
      try { await navigator.share({ title: document.title, url }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); toast.show(S.linkCopied); } catch { toast.show(S.linkNotCopied, { error: true }); }
  };
  return <IconButton label={S.share} icon="share" onClick={share} />;
}

export function AppShell({ children, back, title, share }: { children: ReactNode; back?: boolean; title?: string; share?: boolean }) {
  return (
    <ToastDock>
      <a className="skip" href="#content">{S.skip}</a>
      <header className="header">
        <div className="header-row">
          {back ? (
            <Link href="/" className="icon-btn" aria-label={S.back}><U name="back" /></Link>
          ) : (
            <Link href="/" className="wordmark"><U name="house" /><span>{S.appName}</span></Link>
          )}
          <div className="header-title">{back ? title : null}</div>
          {share ? <ShareButton /> : null}
          <ThemeButton />
        </div>
      </header>
      <main id="content" tabIndex={-1}>{children}</main>
    </ToastDock>
  );
}
