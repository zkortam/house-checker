'use client';
import { useState, type ReactNode } from 'react';
import { setTheme, useSettings } from '../lib/settings';
import { SettingsDialog } from './SettingsDialog';
import Link from 'next/link';
import { S } from '../strings.en';
import { U } from '../icons';
import { IconButton, ToastDock, useToast } from './ui';

function ThemeButton() {
  const s = useSettings();
  const light = s?.scheme === 'light';
  return <IconButton label={light ? S.themeToDark : S.themeToLight} icon={light ? 'moon' : 'sun'} onClick={() => setTheme(light ? 'dark' : 'light')} />;
}

function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label={S.settingsOpen} icon="settings" onClick={() => setOpen(true)} />
      <SettingsDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
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
          <SettingsButton />
        </div>
      </header>
      <main id="content" tabIndex={-1}>{children}</main>
    </ToastDock>
  );
}
