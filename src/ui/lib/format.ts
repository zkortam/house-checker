import { EMPTY_VALUE } from '@contract/labels';

/** One locale for the whole app; Intl everywhere [internationalisation §25, §29]. */
export const LOCALE = 'en';

const usd = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdCompact = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });
const num = new Intl.NumberFormat(LOCALE);
const dayFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short', year: 'numeric', timeZone: 'UTC' });
/** Visits happen at the house, so times are San Francisco time wherever the reader is (the email says Pacific too). */
const SF_TZ = 'America/Los_Angeles';
const slotFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: SF_TZ });
const slotDay = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', timeZone: SF_TZ });
const slotTime = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit', timeZone: SF_TZ });

export function money(n: number | null | undefined): string { return n == null ? EMPTY_VALUE : usd.format(n); }
export function moneyCompact(n: number): string { return usdCompact.format(n); }
export function count(n: number | null | undefined): string { return n == null ? EMPTY_VALUE : num.format(n); }

/** "2025-05-16" | "2025-05" | "2025" without new Date('YYYY-MM-DD') parsing quirks. */
export function partialDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY_VALUE;
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  if (!mo) return y;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, d ? Number(d) : 1));
  return d ? dayFmt.format(date) : monthFmt.format(date);
}

export function slotLabel(iso: string): string { return slotFmt.format(new Date(iso)); }
export function slotDayLabel(iso: string): string { return slotDay.format(new Date(iso)); }
export function slotTimeLabel(iso: string): string { return slotTime.format(new Date(iso)); }

const pr = new Intl.PluralRules(LOCALE);
/** One plural helper [copy-and-voice §36]. */
export function plural(n: number, one: string, other: string): string {
  return (pr.select(n) === 'one' ? one : other).replace('{n}', num.format(n));
}

const list = new Intl.ListFormat(LOCALE, { style: 'long', type: 'conjunction' });
export function listOf(items: string[]): string { return list.format(items); }
