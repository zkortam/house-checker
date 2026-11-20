/** Recent checks, kept in this browser only (a per-viewer convenience; the reports themselves live on the server). */
export type RecentCheck = { id: string; address: string; title: string; tone: string; at: string };

const KEY = 'hc-recent';
const MAX = 12;

export function readRecent(): RecentCheck[] {
  try {
    const xs = JSON.parse(localStorage.getItem(KEY) ?? '[]') as RecentCheck[];
    return Array.isArray(xs) ? xs.filter((x) => x && typeof x.id === 'string' && typeof x.address === 'string') : [];
  } catch { return []; }
}

export function addRecent(c: RecentCheck): void {
  try {
    const xs = readRecent().filter((x) => x.id !== c.id && x.address !== c.address);
    localStorage.setItem(KEY, JSON.stringify([c, ...xs].slice(0, MAX)));
  } catch { /* the list is a convenience */ }
}
