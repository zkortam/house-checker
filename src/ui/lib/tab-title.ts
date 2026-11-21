'use client';
import { useEffect } from 'react';

/**
 * Sets the tab title and keeps it: Next re-applies the layout's metadata title after a client
 * navigation, which would otherwise replace "<address> on House Checker" with the generic one.
 */
export function useTabTitle(title: string) {
  useEffect(() => {
    document.title = title;
    const el = document.querySelector('title');
    if (!el) return;
    const mo = new MutationObserver(() => { if (document.title !== title) document.title = title; });
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    const head = new MutationObserver(() => { if (document.title !== title) document.title = title; });
    head.observe(document.head, { childList: true });
    return () => { mo.disconnect(); head.disconnect(); };
  }, [title]);
}
