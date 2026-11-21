import type { ApiError, Report, StreamEvent } from '../contract/types';
import { LABELS, HAZARD_STATUS } from '../contract/labels';
import { runCheck } from './pipeline';
import { getReportOrWait } from './store';
import { askHomes, cogneeEnabled } from './sponsors/cognee';

/**
 * House Checker as an MCP server (Streamable HTTP, stateless, JSON responses). Any MCP client (Grok through the
 * xAI API's remote MCP tool, Claude, ChatGPT connectors, Cursor) can check a San Francisco home and read the report.
 * The tools return the same report the web app shows, as clean Markdown with numbered sources and record links.
 */

export const SERVER_INFO = { name: 'house-checker', title: 'House Checker', version: '1.0.0' };
export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

export const INSTRUCTIONS = [
  'House Checker compares a San Francisco home listing with the city\'s own records (permits, complaints, planning cases, tenant buyouts, hazard maps, taxes).',
  'Call check_home with a street address or pasted listing text. It reads live city data and takes about 20 seconds.',
  'Numbers in brackets like [3] cite the numbered sources at the end of the report; quote them when you pass findings on.',
  'It is not an inspection, appraisal or legal advice. It has no crime, school or demographic data by design.',
].join(' ');

const ASK_TOOL = {
  name: 'ask_checked_homes',
  title: 'Ask across checked homes',
  description: 'Ask a question across every San Francisco home House Checker has checked, answered from a Cognee knowledge graph of the reports (for example "Which homes had open city cases?" or "Which ones are in a landslide zone?"). Covers homes already checked; use check_home for a new one.',
  inputSchema: { type: 'object', properties: { question: { type: 'string', description: 'The question' } }, required: ['question'] },
  annotations: { title: 'Ask across checked homes', readOnlyHint: true, openWorldHint: false },
};

/** Tools on offer now: ask_checked_homes only when Cognee is configured. */
export const tools = () => (cogneeEnabled() ? [...TOOLS, ASK_TOOL] : TOOLS);

export const TOOLS = [
  {
    name: 'check_home',
    title: 'Check a San Francisco home',
    description: 'Check a San Francisco home against city records. Give a street address ("2055 42nd Ave") or paste the listing text (claims like units, baths, sq ft and an in-law unit get checked). Returns a verdict, listing-vs-city comparisons, open city cases, tenant and rent-control signals, hazards, monthly costs, questions to ask before an offer, and numbered sources with links. Takes about 20 seconds.',
    inputSchema: {
      type: 'object',
      properties: { listing: { type: 'string', description: 'A San Francisco street address, or the full listing text' } },
      required: ['listing'],
    },
    annotations: { title: 'Check a San Francisco home', readOnlyHint: true, openWorldHint: true },
  },
  {
    name: 'get_report',
    title: 'Get a saved report',
    description: 'Fetch a report House Checker already made, by its report id (returned by check_home).',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Report id' } }, required: ['id'] },
    annotations: { title: 'Get a saved report', readOnlyHint: true, openWorldHint: false },
  },
];

const ERRORS: Record<ApiError['kind'], string> = {
  invalid: 'No San Francisco street address found. Give a street number and name, like "2055 42nd Ave".',
  outside_sf: 'That address is outside San Francisco. House Checker only covers San Francisco.',
  not_found: 'The city has no record of that address. Check the street number and name.',
  offline: 'The city data service could not be reached. Try again in a minute.',
  timeout: 'The city records took too long to answer. Try again in a minute.',
  unavailable: 'House Checker could not finish that check. Try again in a minute.',
  rate: 'Too many checks right now. Try again in a few minutes.',
  refused: 'House Checker could not check that request.',
};

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const per = { once: 'once', year: 'a year', month: 'a month' } as const;

export function reportMarkdown(r: Report, base: string): string {
  const L: string[] = [];
  const url = `${base}/check/${encodeURIComponent(r.id)}`;
  L.push(`# ${r.address}, San Francisco`);
  L.push(`**${r.decision.title}.** ${r.answer}`);
  if (r.decision.inspection) L.push(`Inspection: ${r.decision.inspection}`);
  const facts = [r.meta.neighborhood, r.meta.yearBuilt ? `built ${r.meta.yearBuilt}` : null, r.meta.zoning ? `zoning ${r.meta.zoning}` : null, `parcel ${r.parcelDisplay}`].filter(Boolean);
  L.push(facts.join(' · '));
  L.push(`Full report: ${url}  (report id: ${r.id})`);

  if (r.ledger.length) {
    const ok = r.ledger.filter((x) => LABELS[x.label].compare === 'same').length;
    L.push(`\n## Listing vs city (${ok} of ${r.ledger.length} match)`);
    for (const x of r.ledger) L.push(`- **${x.title}**: listing ${x.listing ?? 'not stated'}, city ${x.records ?? 'no record'}. ${LABELS[x.label].text}. ${x.why}`);
  }
  if (r.cases.length) {
    L.push('\n## Open city cases');
    for (const c of r.cases) L.push(`- **${c.title}** (${LABELS[c.label].text}). ${c.text}${c.stake ? ` ${c.stake}` : ''}`);
  }
  if (r.highlights.good.length) { L.push('\n## Good news'); for (const t of r.highlights.good) L.push(`- ${t}`); }
  if (r.highlights.watch.length) { L.push('\n## Worth a look'); for (const t of r.highlights.watch) L.push(`- ${t}`); }
  if (r.tenants.length) { L.push('\n## Tenants and rentals'); for (const x of r.tenants) L.push(`- **${x.title}**: ${x.text}`); }
  const hz = r.hazards.filter((h) => h.status !== 'clear');
  const clear = r.hazards.filter((h) => h.status === 'clear').map((h) => h.title.toLowerCase());
  if (r.hazards.length) {
    L.push('\n## Hazards');
    for (const h of hz) L.push(`- **${h.title}** (${HAZARD_STATUS[h.status].text}): ${h.text}`);
    if (clear.length) L.push(`- Clear: ${clear.join(', ')}`);
  }
  const costs = r.costs.rows.filter((c) => c.amount != null);
  if (costs.length) {
    L.push(`\n## Costs at ${money(r.costs.price)}`);
    for (const c of costs) L.push(`- ${c.title}: ${c.estimate ? 'about ' : ''}${money(c.amount!)} ${per[c.per]}`);
  }
  if (r.upside.length) { L.push('\n## Room to grow'); for (const x of r.upside) L.push(`- **${x.title}**: ${x.text}`); }
  if (r.systems.length) { L.push('\n## Building systems'); for (const s of r.systems) L.push(`- **${s.title}** (${s.year ?? 'no record'}): ${s.text}`); }
  if (r.nearby.length) { L.push('\n## Nearby'); for (const x of r.nearby) L.push(`- ${x.text}`); }
  if (r.unknowns.length) {
    const who = { listing_agent: 'ask the listing agent', city: 'ask the city', specialist: 'needs a specialist', buyer_agent: 'ask your agent' } as const;
    L.push('\n## Ask before you offer');
    for (const u of r.unknowns) L.push(`- **${u.title}** (${u.specialist ?? who[u.resolver]}). ${u.why}`);
  }
  if (r.sources.length) {
    L.push('\n## Sources');
    r.sources.forEach((s, i) => L.push(`${i + 1}. ${s.title} (${s.publisher}${s.date ? `, ${s.date}` : ''})${s.url ? ` ${s.url}` : ''}`));
  }
  L.push(`\nChecked ${r.checkedAt.slice(0, 10)} from public city records. Not an inspection, appraisal or legal advice.`);
  return L.join('\n');
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
const text = (t: string, isError = false): ToolResult => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError } : {}) });

export async function callTool(name: string, args: Record<string, unknown>, base: string): Promise<ToolResult> {
  if (name === 'check_home') {
    const listing = typeof args.listing === 'string' ? args.listing.trim().slice(0, 20_000) : '';
    if (!listing) return text(ERRORS.invalid, true);
    let error: ApiError | null = null;
    const emit = async (e: StreamEvent) => { if (e.type === 'error') error = e.error; };
    const report = await runCheck(listing, emit);
    if (!report) {
      const e = error as ApiError | null;
      const more = e?.suggest?.length ? ` Closest addresses on record: ${e.suggest.join(', ')}.` : '';
      return text((e ? ERRORS[e.kind] : ERRORS.unavailable) + more, true);
    }
    return text(reportMarkdown(report, base));
  }
  if (name === 'get_report') {
    const id = typeof args.id === 'string' ? args.id.trim() : '';
    const report = id ? await getReportOrWait(id) : null;
    return report ? text(reportMarkdown(report, base)) : text('No report with that id. Run check_home again.', true);
  }
  if (name === 'ask_checked_homes' && cogneeEnabled()) {
    const question = typeof args.question === 'string' ? args.question.trim().slice(0, 1000) : '';
    if (!question) return text('Ask a question, like "Which homes had open city cases?"', true);
    try {
      const answer = await askHomes(question);
      return text(answer || 'No answer yet. Reports take a minute to be added after a check.');
    } catch {
      return text('The memory of checked homes is not available right now. Try again in a minute.', true);
    }
  }
  throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
}
