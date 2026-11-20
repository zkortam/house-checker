'use client';
import { useMemo, useState, type ReactNode } from 'react';
import type { ActionLogEntry, ClaimRow, Costs, GlanceTile, HazardCheck, HistoryRow, Report, SectionKey, SystemRow, Unknown } from '@contract/types';
import { EMPTY_VALUE, HAZARD_STATUS, HISTORY_LEGEND, HISTORY_TONE, LABELS, SYSTEM_STATUS, DECISION_TONE } from '@contract/labels';
import { computeCosts } from '@contract/money';
import { S, fill } from '../strings.en';
import { G, U } from '../icons';
import { Button, Cited, Dialog, LabelChip, MetaLine, Pressable, Slider, useToast } from '../components/ui';
import { money, partialDate, plural } from '../lib/format';
import {
  ActionLog, Cases, CostsView, Hazards, History, InfoList, Packet, SectionBody, Sources, type AskAction,
} from './sections';
import { BookFlow, EmailDialog } from './actions';
import { track } from '../analytics';
import { packetOf } from './packet-types';

/** Kept for callers that scroll to a section id. */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = document.documentElement.classList.contains('reduce-motion');
  el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
}

type Sheet = { title: string; body: ReactNode } | null;
const COMPARE_ICON = { same: 'same', pending: 'pending', different: 'different', unknown: 'unknown' } as const;
const COMPARE_TONE = { same: 'success', pending: 'warning', different: 'error', unknown: 'neutral' } as const;

/* ======================================================================== */

export function ReportView({ report, onRetry, openSource }: { report: Report; onRetry?: () => void; openSource: (n: number, el: HTMLElement) => void }) {
  const [log, setLog] = useState<ActionLogEntry[]>(report.actions);
  const [email, setEmail] = useState<{ kind: 'email_listing_agent' | 'email_city'; ids: string[] } | null>(null);
  const [visit, setVisit] = useState<Unknown | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [price, setPrice] = useState(report.costs.price);
  const toast = useToast();

  const added = (e: ActionLogEntry) => {
    track(e.kind === 'book_specialist' ? 'specialist_requested' : 'email_sent', { kind: e.kind });
    setLog((xs) => (xs.some((x) => x.id === e.id) ? xs : [...xs, e]));
  };
  function onAction(a: AskAction) {
    setSheet(null);
    if (a.kind === 'book') setVisit(a.unknown);
    else if (a.kind === 'brief') {
      const text = a.unknowns.map((u, i) => `${i + 1}. ${u.title}`).join('\n');
      navigator.clipboard?.writeText(`${report.address}\n${text}`).then(() => toast.show(S.briefCopied), () => toast.show(S.linkNotCopied, { error: true }));
    } else setEmail({ kind: a.kind, ids: a.unknownIds });
  }

  const sec = (k: SectionKey) => report.sections[k];
  const open = (title: string, body: ReactNode, k?: SectionKey) => {
    if (k) track('tile_tapped', { section: k });
    setSheet({ title, body: k ? <SectionBody state={sec(k)} onRetry={onRetry}>{body}</SectionBody> : body });
  };
  const tile = (k: SectionKey) => report.glance.find((g) => g.section === k);
  const packet = packetOf(report);

  return (
    <>
      <div className="rv cascade">
        <section className="bento" aria-label={S.glanceTitle}>
          <ClaimsCard rows={report.ledger} onOpen={(r) => open(r.title, <ClaimDetail row={r} />, 'ledger')} />
          <TaxCard costs={report.costs} price={price} setPrice={setPrice}
            onHow={() => open(S.costsTitle, <CostsView costs={{ ...report.costs, price }} />, 'costs')} />
          {(['cases', 'tenants'] as const).map((k) => {
            const t = tile(k);
            return t ? <StatTile key={k} t={t} onOpen={() => open(k === 'cases' ? S.casesTitle : S.tenantsTitle,
              k === 'cases' ? (report.cases.length ? <Cases rows={report.cases} /> : <p className="sheet-empty">{t.status}</p>) : <InfoList rows={report.tenants} />, k)} /> : null;
          })}
          {tile('hazards') ? <HazardTile t={tile('hazards')!} rows={report.hazards} onOpen={() => open(S.hazardsTitle, <Hazards rows={report.hazards} />, 'hazards')} /> : null}
          {tile('upside') ? <StatTile t={tile('upside')!} onOpen={() => open(S.upsideTitle, <>
            <InfoList rows={report.upside} />
            {report.nearby.length ? <><h3 className="sheet-h">{S.nearbyTitle}</h3><InfoList rows={report.nearby} /></> : null}
          </>, 'upside')} /> : null}
        </section>

        <AskRow unknowns={report.unknowns} log={log} onAction={onAction}
          onOpen={(title, items, action) => open(title, <QuestionList items={items} action={action} />)} />

        <section className="bento" aria-label={S.detailsTitle}>
          <Highlight kind="good" lines={report.highlights.good} onAll={() => open(S.goodNews, <HlList lines={report.highlights.good} kind="good" />)} />
          <Highlight kind="watch" lines={report.highlights.watch} onAll={() => open(S.worthALook, <HlList lines={report.highlights.watch} kind="watch" />)} />
          {report.systems.length ? <BonesCard rows={report.systems} built={report.meta.yearBuilt}
            onOpen={(r) => open(r.title, <p className="sheet-text"><Cited text={r.text} /></p>, 'systems')} /> : null}
          {report.history.length ? <TimelineCard rows={report.history}
            onOpen={() => open(S.historyTitle, <History rows={report.history} />, 'history')} /> : null}
          {packet && packet.findings.length ? (
            <Pressable className="b-card span-4 pk-tile" onClick={() => open(S.packetTitle, <Packet packet={packet} />, 'packet')}>
              <span className="b-label"><G glyph="packet" />{S.packetTitle}</span>
              <span className="b-big">{packet.findings.length}<small> {plural(packet.findings.length, S.packetFindingsOne, S.packetFindings).replace(/^\d+\s*/, '')}</small></span>
            </Pressable>
          ) : null}
        </section>

        <footer className="rv-foot">
          <div className="pills">
            <button type="button" className="pill" onClick={() => open(S.sourcesTitle, <Sources sources={report.sources} onOpen={(n, el) => { setSheet(null); openSource(n, el); }} />)}>
              <U name="external" />{fill(S.sourcesN, { n: report.sources.length })}
            </button>
            {log.length ? (
              <button type="button" className="pill" onClick={() => open(S.actionsTitle, <ActionLog entries={log} />)}>
                <U name="done" />{fill(S.sentN, { n: log.length })}
              </button>
            ) : null}
          </div>
          <p className="fineprint">{S.disclaimer}</p>
        </footer>
      </div>

      <Dialog open={!!sheet} onClose={() => setSheet(null)} title={sheet?.title ?? ''}>
        <div className="sheet-body">{sheet?.body}</div>
      </Dialog>
      <EmailDialog report={report} kind={email?.kind ?? null} unknownIds={email?.ids ?? []} onClose={() => setEmail(null)} onSent={added} />
      <BookFlow report={report} unknown={visit} onClose={() => setVisit(null)} onSent={added} />
    </>
  );
}

/* ---------- Hero: address, verdict, ring of matching claims ---------- */

export function Hero({ report, answer }: { report: Report; answer: string }) {
  const tone = DECISION_TONE[report.decision.tone];
  return (
    <header className={`hero tone-${tone}`}>
      <div className="hero-main">
        <MetaLine items={[report.meta.neighborhood, report.meta.yearBuilt ? fill(S.built, { value: report.meta.yearBuilt }) : null,
          report.meta.zoning, fill(S.parcel, { value: report.parcelDisplay })]} />
        <h1 className="hero-addr" id="reportTitle">{report.address}</h1>
        <p className="hero-verdict"><span className="halo" aria-hidden="true" />{report.decision.title}</p>
        <p className="hero-answer"><Cited text={answer} /></p>
        <p className="hero-insp"><G glyph="permit" /><span><Cited text={report.decision.inspection} /></span></p>
        {report.answerBy === 'rules'
          ? <p className="disclosure"><U name="info" className="ai-g" />{S.writtenByRules}</p>
          : <p className="disclosure"><U name="ai" className="ai-g" />{S.writtenByAi}</p>}
      </div>
      <Ring rows={report.ledger} />
    </header>
  );
}

function Ring({ rows }: { rows: ClaimRow[] }) {
  const counts = { same: 0, pending: 0, different: 0, unknown: 0 };
  for (const r of rows) counts[LABELS[r.label].compare]++;
  const total = rows.length;
  const R = 54, C = 2 * Math.PI * R;
  let offset = 0;
  const segs = (['same', 'pending', 'different', 'unknown'] as const).filter((k) => counts[k]).map((k) => {
    const len = (counts[k] / Math.max(total, 1)) * C;
    const seg = { k, len, offset };
    offset += len;
    return seg;
  });
  return (
    <figure className="ring" aria-label={total ? `${counts.same} of ${total} ${S.ringLabel}` : S.ringNone}>
      <svg viewBox="0 0 132 132" aria-hidden="true">
        <circle cx="66" cy="66" r={R} className="ring-track" />
        {segs.map((s) => (
          <circle key={s.k} cx="66" cy="66" r={R} className={`ring-seg tone-${COMPARE_TONE[s.k]}`}
            strokeDasharray={`${Math.max(s.len - 4, 0.1)} ${C}`} strokeDashoffset={-s.offset} />
        ))}
      </svg>
      <figcaption>
        <span className="ring-num num">{counts.same}<small>/{total}</small></span>
        <span className="ring-cap">{total ? S.ringLabel : S.ringNone}</span>
      </figcaption>
    </figure>
  );
}

/* ---------- Bento cards ---------- */

function ClaimsCard({ rows, onOpen }: { rows: ClaimRow[]; onOpen: (r: ClaimRow) => void }) {
  if (!rows.length) return null;
  return (
    <div className="b-card span-2 rows-2 claims">
      <div className="claims-head"><span className="b-label">{S.compareTitle}</span>
        <span className="claims-cols" aria-hidden="true"><span>{S.compareListing}</span><span /><span>{S.compareCity}</span></span></div>
      {rows.map((r) => {
        const l = LABELS[r.label];
        return (
          <Pressable key={r.key + r.title} className={`claim tone-${l.tone}`} onClick={() => onOpen(r)} aria-label={`${r.title}: ${l.text}`}>
            <span className="claim-t">{r.title}</span>
            <span className="claim-v">{r.listing ?? EMPTY_VALUE}</span>
            <span className="claim-ic"><U name={COMPARE_ICON[l.compare]} /></span>
            <span className="claim-v">{r.records ?? EMPTY_VALUE}</span>
          </Pressable>
        );
      })}
    </div>
  );
}

function ClaimDetail({ row }: { row: ClaimRow }) {
  const l = LABELS[row.label];
  return (
    <div className="claim-detail">
      <div className={`cd-pair tone-${l.tone}`}>
        <div><span className="b-label">{S.compareListing}</span><span className="cd-v">{row.listing ?? EMPTY_VALUE}</span></div>
        <span className="claim-ic lg"><U name={COMPARE_ICON[l.compare]} /></span>
        <div><span className="b-label">{S.compareCity}</span><span className="cd-v">{row.records ?? EMPTY_VALUE}</span></div>
      </div>
      <LabelChip label={row.label} />
      <p className="sheet-text"><Cited text={row.why} /></p>
    </div>
  );
}

function TaxCard({ costs, price, setPrice, onHow }: { costs: Costs; price: number; setPrice: (n: number) => void; onHow: () => void }) {
  const rows = useMemo(() => (price === costs.price ? costs.rows : computeCosts(price, costs.inputs)), [price, costs]);
  const tax = rows.find((r) => r.kind === 'property_tax');
  const supp = rows.find((r) => r.kind === 'supplemental_tax');
  const transfer = rows.find((r) => r.kind === 'transfer_tax');
  const fees = rows.find((r) => r.kind === 'case_fees');
  const monthly = tax?.amount == null ? null : Math.round(tax.amount / 12);
  const min = Math.round((costs.price * 0.8) / 5000) * 5000;
  const max = Math.round((costs.price * 1.2) / 5000) * 5000;
  return (
    <div className="b-card span-2 tax">
      <span className="b-label"><G glyph="money" />{S.taxPerMonth}</span>
      <span className="b-huge num" aria-live="polite">{money(monthly)}<small>{S.perMonth}</small></span>
      <div className="tax-slider">
        <Slider id="hc-price" min={min} max={max} step={5000} value={price} onChange={setPrice} label={S.priceLabel} />
        <span className="tax-price num">{S.priceLabel} {money(price)}</span>
      </div>
      <div className="tax-minis">
        {supp ? <span><b className="num">{money(supp.amount)}</b>{S.supplementalShort}</span> : null}
        {transfer ? <span><b className="num">{money(transfer.amount)}</b>{S.transferShort}</span> : null}
        {fees ? <span className="tone-error"><b className="num ink">{money(fees.amount)}{S.perMonth}</b>{S.caseFeesShort}</span> : null}
      </div>
      <button type="button" className="b-link" onClick={onHow}>{S.howWorkedOut}<U name="caret" className="rot" /></button>
    </div>
  );
}

function StatTile({ t, onOpen }: { t: GlanceTile; onOpen: () => void }) {
  return (
    <Pressable className={`b-card stat tone-${t.tone}`} onClick={onOpen}>
      <span className="b-label"><G glyph={t.glyph} />{t.label}</span>
      <span className="b-big">{t.value ?? EMPTY_VALUE}</span>
      <span className="b-status"><span className="dot" aria-hidden="true" />{t.status}</span>
    </Pressable>
  );
}

function HazardTile({ t, rows, onOpen }: { t: GlanceTile; rows: HazardCheck[]; onOpen: () => void }) {
  return (
    <Pressable className={`b-card stat tone-${t.tone}`} onClick={onOpen}>
      <span className="b-label"><G glyph={t.glyph} />{t.label}</span>
      <span className="hz-dots" aria-hidden="true">
        {rows.map((h) => <span key={h.key} className={`hz-dot tone-${HAZARD_STATUS[h.status].tone}`} title={h.title} />)}
      </span>
      <span className="b-status"><span className="dot" aria-hidden="true" />{t.value ? `${t.value} · ` : ''}{t.status}</span>
    </Pressable>
  );
}

/* ---------- Ask before you offer: one card per person who can answer ---------- */

const RESOLVERS: Array<{ key: Unknown['resolver']; title: string; icon: 'email' | 'city' | 'book' | 'copy' }> = [
  { key: 'listing_agent', title: S.askListingAgent, icon: 'email' },
  { key: 'city', title: S.askCity, icon: 'city' },
  { key: 'specialist', title: S.askSpecialist, icon: 'book' },
  { key: 'buyer_agent', title: S.askBuyerAgent, icon: 'copy' },
];

function AskRow({ unknowns, log, onAction, onOpen }: {
  unknowns: Unknown[]; log: ActionLogEntry[]; onAction: (a: AskAction) => void;
  onOpen: (title: string, items: Unknown[], action: ReactNode) => void;
}) {
  const groups = RESOLVERS.map((r) => ({ ...r, items: unknowns.filter((u) => u.resolver === r.key) })).filter((g) => g.items.length);
  if (!groups.length) return null;
  return (
    <section className="ask-row" aria-labelledby="askTitle">
      <h2 className="rv-h" id="askTitle">{S.askTitle}</h2>
      <div className={`ask-grid n${groups.length}`}>
        {groups.map((g) => {
          const ids = new Set(g.items.map((u) => u.id));
          const sent = log.find((e) => e.unknownIds.some((id) => ids.has(id)) && e.kind !== 'none');
          const act = (): AskAction => g.key === 'listing_agent' ? { kind: 'email_listing_agent', unknownIds: [...ids] }
            : g.key === 'city' ? { kind: 'email_city', unknownIds: [...ids] }
            : g.key === 'specialist' ? { kind: 'book', unknown: g.items[0] } : { kind: 'brief', unknowns: g.items };
          const label = g.key === 'listing_agent' ? S.actionEmailAgent : g.key === 'city' ? S.actionEmailCity : g.key === 'specialist' ? S.actionBook : S.actionBrief;
          const button = sent
            ? <p className="done-line"><U name="done" />{sent.kind === 'book_specialist' ? S.requestSentLine : S.emailSentLine}</p>
            : <Button kind="primary" icon={g.icon === 'city' ? 'email' : g.icon} onClick={() => onAction(act())}>{label}</Button>;
          return (
            <div key={g.key} className="ask-card">
              <span className="ask-ic" aria-hidden="true"><U name={g.icon} /></span>
              <span className="ask-who">{g.title}</span>
              <span className="ask-q">{g.items[0].title}</span>
              <button type="button" className="b-link" onClick={() => onOpen(g.title, g.items, button)}>
                {plural(g.items.length, S.questionsOne, S.questions)}<U name="caret" className="rot" />
              </button>
              <div className="ask-btn">{button}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function QuestionList({ items, action }: { items: Unknown[]; action: ReactNode }) {
  return (
    <div className="q-list">
      <ol>{items.map((u) => <li key={u.id}><span className="row-title">{u.title}</span><span className="row-sub"><Cited text={u.why} /></span></li>)}</ol>
      {action}
    </div>
  );
}

/* ---------- Good news / Worth a look: three lines, the rest on tap ---------- */

function Highlight({ kind, lines, onAll }: { kind: 'good' | 'watch'; lines: string[]; onAll: () => void }) {
  if (!lines.length) return null;
  const tone = kind === 'good' ? 'success' : 'warning';
  return (
    <div className={`b-card span-2 hl-card tone-${tone}`}>
      <span className="b-label ink"><U name={kind === 'good' ? 'same' : 'watch'} />{kind === 'good' ? S.goodNews : S.worthALook}</span>
      <HlList lines={lines.slice(0, 3)} kind={kind} />
      {lines.length > 3 ? <button type="button" className="b-link" onClick={onAll}>{fill(S.showAllN, { n: lines.length })}<U name="caret" className="rot" /></button> : null}
    </div>
  );
}
function HlList({ lines, kind }: { lines: string[]; kind: 'good' | 'watch' }) {
  return <ul className={`hl-list tone-${kind === 'good' ? 'success' : 'warning'}`}>{lines.map((t, i) => <li key={i}><span className="dot" aria-hidden="true" /><span><Cited text={t} /></span></li>)}</ul>;
}

/* ---------- The bones: each system on one age axis ---------- */

function BonesCard({ rows, built, onOpen }: { rows: SystemRow[]; built: number | null; onOpen: (r: SystemRow) => void }) {
  const now = new Date().getFullYear();
  const from = Math.min(built ?? now - 80, ...rows.map((r) => r.year ?? now));
  return (
    <div className="b-card span-2 bones">
      <span className="b-label">{S.bonesTitle}</span>
      <div className="bone-list">
        {rows.map((r, i) => {
          const st = SYSTEM_STATUS[r.status];
          const pct = r.year ? ((r.year - from) / Math.max(now - from, 1)) * 100 : null;
          return (
            <Pressable key={i} className={`bone tone-${st.tone}`} onClick={() => onOpen(r)} aria-label={`${r.title}: ${r.year ?? st.text}`}>
              <span className="bone-t"><G glyph={r.glyph} />{r.title}</span>
              <span className="bone-track" aria-hidden="true">
                {pct != null ? <><span className="bone-fill" style={{ width: `${pct}%` }} /><span className="bone-dot" style={{ left: `${pct}%` }} /></> : <span className="bone-none" />}
              </span>
              <span className="bone-y num">{r.year ?? EMPTY_VALUE}</span>
            </Pressable>
          );
        })}
      </div>
      <div className="axis num" aria-hidden="true"><span>{from}</span><span>{now}</span></div>
    </div>
  );
}

/* ---------- Timeline: every record as a dot on one line ---------- */

function TimelineCard({ rows, onOpen }: { rows: HistoryRow[]; onOpen: () => void }) {
  const yr = (d: string) => Number(d.slice(0, 4)) + (d.length >= 7 ? (Number(d.slice(5, 7)) - 1) / 12 : 0.5);
  const now = new Date().getFullYear() + 1;
  const ys = rows.map((r) => yr(r.date));
  const from = Math.floor(Math.min(...ys, now - 12)) - 1;
  const kinds = Array.from(new Set(rows.map((r) => r.kind)));
  const last = rows[rows.length - 1];
  return (
    <Pressable className="b-card span-2 tline" onClick={onOpen}>
      <span className="b-label">{S.timelineTitle}</span>
      <span className="tl-axis" aria-hidden="true">
        {rows.map((r, i) => (
          <span key={i} className={`tl-pin tone-${HISTORY_TONE[r.kind]}`} style={{ left: `${((yr(r.date) - from) / (now - from)) * 100}%` }} />
        ))}
      </span>
      <span className="axis num" aria-hidden="true"><span>{from}</span><span>{now - 1}</span></span>
      <span className="tl-last"><span className="num">{partialDate(last.date)}</span> {last.text.replace(/\s*\[\d+\]/g, '')}</span>
      <span className="legend" aria-hidden="true">
        {kinds.map((k) => <span key={k} className={`tone-${HISTORY_TONE[k]}`}><span className="dot" />{HISTORY_LEGEND[k]}</span>)}
      </span>
    </Pressable>
  );
}
