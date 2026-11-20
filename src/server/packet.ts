import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { FindingLabel, PacketDoc, PacketFinding, Report, Source } from '../contract/types';
import { checkCopy } from '../contract/copy';
import { llmJson } from './llm';
import { dataDir } from './store';

/**
 * A12: disclosure packet. POST /api/packet stores the PDF and its text (pdftotext, one entry per page).
 * During a check, Claude (or a regex fallback) pulls the seller's stated facts with page numbers, and code
 * reconciles each with what the city records already say in the report.
 */

const run = promisify(execFile);
const MAX_BYTES = 25 * 1024 * 1024;

export function packetDir(): string { return path.join(dataDir(), 'packets'); }
const safeId = (id: string) => /^pk-[a-f0-9]{12}$/.test(id);

export async function storePacket(bytes: Uint8Array, filename = 'packet.pdf'): Promise<{ packetFileId: string } | { error: 'invalid' | 'unavailable'; debug: string }> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return { error: 'invalid', debug: 'empty or too large' };
  if (Buffer.from(bytes.slice(0, 5)).toString('latin1') !== '%PDF-') return { error: 'invalid', debug: 'not a PDF' };
  const id = `pk-${randomBytes(6).toString('hex')}`;
  await mkdir(packetDir(), { recursive: true });
  const pdf = path.join(packetDir(), `${id}.pdf`);
  await writeFile(pdf, bytes);
  try {
    const { stdout } = await run('pdftotext', ['-layout', '-enc', 'UTF-8', pdf, '-'], { maxBuffer: 64 * 1024 * 1024, timeout: 60_000 });
    const pages = stdout.split('\f').map((t) => t.trim());
    if (pages.length > 1 && pages[pages.length - 1] === '') pages.pop(); // pdftotext ends every page with a form feed
    await writeFile(path.join(packetDir(), `${id}.json`), JSON.stringify({ id, filename: filename.slice(0, 200), at: new Date().toISOString(), pages }));
  } catch (e) {
    return { error: 'unavailable', debug: `pdftotext failed: ${(e as Error).message}` };
  }
  return { packetFileId: id };
}

export async function loadPacket(id: string): Promise<{ pages: string[]; filename: string } | null> {
  if (!safeId(id)) return null;
  try { return JSON.parse(await readFile(path.join(packetDir(), `${id}.json`), 'utf8')); } catch { return null; }
}

/** Which document a page belongs to, from its own text. */
export function docOf(page: string): PacketDoc {
  const t = page.toLowerCase();
  if (/transfer disclosure statement|\btds\b/.test(t)) return 'tds';
  if (/seller property questionnaire|\bspq\b/.test(t)) return 'spq';
  if (/report of residential (building )?record|\b3r\b/.test(t)) return '3r';
  if (/natural hazard disclosure|\bnhd\b/.test(t)) return 'nhd';
  if (/preliminary (title )?report|title insurance/.test(t)) return 'title';
  if (/wood destroying|termite|pest control|section 1/.test(t)) return 'pest';
  if (/homeowners'? association|\bhoa\b|cc&rs/.test(t)) return 'hoa';
  if (/inspection/.test(t)) return 'inspection';
  return 'other';
}

export interface PacketFact { topic: 'units' | 'baths' | 'beds' | 'sqft' | 'roof' | 'foundation' | 'permits' | 'other'; statement: string; value: number | null; page: number }

const NUMW: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const toNum = (s: string) => (/^\d/.test(s) ? Number(s.replace(/,/g, '')) : NUMW[s.toLowerCase()] ?? null);

/** Regex fallback: counts with the page they appear on. */
export function packetFactsRegex(pages: string[]): PacketFact[] {
  const out: PacketFact[] = [];
  const seen = new Set<string>();
  pages.forEach((text, i) => {
    const t = text.replace(/\s+/g, ' ');
    const grab = (topic: PacketFact['topic'], re: RegExp) => {
      const m = t.match(re);
      if (!m || seen.has(topic)) return;
      const v = toNum(m[1]);
      if (v == null) return;
      seen.add(topic);
      out.push({ topic, statement: m[0].trim().slice(0, 80), value: v, page: i + 1 });
    };
    grab('beds', /\b(\d+|one|two|three|four|five|six)\s+bed(room)?s?\b/i);
    grab('baths', /\b(\d+(?:\.\d)?|one|two|three|four|five)\s+(full\s+)?bath(room)?s?\b/i);
    grab('units', /\b(\d+|one|two|three|four)\s+(legal\s+)?(dwelling\s+)?units?\b/i);
    grab('sqft', /\b([\d,]{3,6})\s*(sq\.?\s*ft|square feet)/i);
  });
  return out;
}

const SCHEMA = {
  type: 'object',
  properties: {
    facts: {
      type: 'array', maxItems: 12,
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: ['units', 'baths', 'beds', 'sqft', 'roof', 'foundation', 'permits', 'other'] },
          statement: { type: 'string', description: 'Short plain paraphrase of what the document states, at most 80 characters' },
          value: { type: ['number', 'null'], description: 'The number stated, when the topic is a count or area' },
          page: { type: 'number', description: '1-based page number where it is stated' },
        },
        required: ['topic', 'statement', 'value', 'page'],
      },
    },
  },
  required: ['facts'],
} as const;

export async function readPacketFacts(pages: string[]): Promise<PacketFact[]> {
  const text = pages.map((p, i) => `--- page ${i + 1} ---\n${p.slice(0, 4000)}`).join('\n').slice(0, 60_000);
  const { value } = await llmJson<{ facts: PacketFact[] }>(SCHEMA,
    `This is the text of a San Francisco home disclosure packet (inspection, pest, TDS, SPQ, 3R, NHD, title, HOA). List what the seller or inspector states about: number of legal units, baths, bedrooms, square feet, roof, foundation, and permits or unpermitted work. Only facts stated in the text, each with its page number.\n\n${text}`,
    () => ({ facts: packetFactsRegex(pages) }),
    { timeoutMs: 90_000, validate: (v) => Array.isArray(v.facts) && v.facts.every((f) => f.page >= 1 && f.page <= pages.length && (f.value == null || text.includes(String(f.value)) || text.includes(f.value.toLocaleString('en-US')))) });
  return value.facts.filter((f) => f.page >= 1 && f.page <= pages.length);
}

/** Reconcile packet facts against the report's ledger; returns findings for report.packet and the page sources they cite. */
export function reconcilePacket(report: Report, facts: PacketFact[], packetId: string, pages: string[] = []): { sources: Source[]; findings: PacketFinding[] } {
  const findings: PacketFinding[] = [];
  const sources: Source[] = [];
  const base = report.sources.length;
  const cite = (page: number) => {
    const id = `packet:${packetId}:p${page}`;
    let i = sources.findIndex((s) => s.id === id);
    if (i < 0) { const src: Source = { id, title: `Disclosure packet, page ${page}`, publisher: 'Seller disclosure', date: null, url: null, page }; sources.push(src); i = sources.length - 1; }
    return `[${base + i + 1}]`;
  };
  const titles: Record<string, string> = { units: 'Units', baths: 'Baths', beds: 'Bedrooms', sqft: 'Sq ft' };
  for (const f of facts) {
    if (!(f.topic in titles) || f.value == null) continue;
    const ledger = report.ledger.find((r) => r.key === f.topic);
    const recNum = ledger?.records ? Number(ledger.records.replace(/[^\d.]/g, '').split('.')[0]) : null;
    const val = f.topic === 'sqft' ? f.value.toLocaleString('en-US') : String(f.value);
    let label: FindingLabel = 'not_settled';
    if (recNum != null && Number.isFinite(recNum) && recNum > 0) label = (f.topic === 'sqft' ? Math.abs(recNum - f.value) / recNum <= 0.1 : recNum === f.value) ? 'matches' : 'records_differ';
    const said = f.statement.replace(/[.!]+$/, '').replace(/—/g, ',').trim();
    // "Seller questionnaire says ..." already names who said it; otherwise lead with the packet.
    const lead = /\b(says|states|reports|notes|lists|shows|describes|discloses)\b/i.test(said) ? said[0].toUpperCase() + said.slice(1) : `The packet states ${said}`;
    const ref = ledger?.why.match(/\[\d+\]/)?.[0];
    const city = !ledger ? '' : ledger.records ? ` City records show ${ledger.records}${ref ? ' ' + ref : ''}.` : ` City records give no count${ref ? ' ' + ref : ''}.`;
    const why = `${lead} ${cite(f.page)}.${city}`;
    if (checkCopy(why).length) continue;
    const statement = f.statement.replace(/—/g, ',').slice(0, 90);
    if (!checkCopy(statement).length) findings.push({ doc: docOf(pages[f.page - 1] ?? ''), topic: f.topic, statement, page: f.page, label, records: ledger?.records ?? null, text: why });
  }
  return { sources, findings };
}
