'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '../components/AppShell';
import { S } from '../strings.en';
import { readRecent, type RecentCheck } from '../lib/recent';
import { partialDate } from '../lib/format';

export function RecentCards({ items }: { items: RecentCheck[] }) {
  return (
    <ul className="recent-grid">
      {items.map((r) => (
        <li key={r.id}>
          <Link href={`/check/${r.id}`} className={`recent-card${r.tone === 'clear' ? '' : ' flag'}`}>
            <span className="rc-addr">{r.address}</span>
            <span className="rc-title">{r.title}</span>
            <span className="rc-date">{partialDate(r.at.slice(0, 10))}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function useRecent(): RecentCheck[] | null {
  const [xs, setXs] = useState<RecentCheck[] | null>(null);
  useEffect(() => { setXs(readRecent()); }, []);
  return xs;
}

export function RecentScreen() {
  const xs = useRecent();
  return (
    <AppShell>
      <section className="page" aria-labelledby="recentTitle">
        <h1 className="page-title" id="recentTitle">{S.recentTitle}</h1>
        {xs === null ? null : xs.length ? <RecentCards items={xs} /> : <p className="page-empty">{S.recentEmpty}</p>}
      </section>
    </AppShell>
  );
}
