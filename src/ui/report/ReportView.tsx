'use client';
import { useMemo, useState, type ReactNode } from 'react';
import type { ActionLogEntry, ClaimRow, Costs, GlanceTile, HazardCheck, HistoryRow, Report, SectionKey, SystemRow, Unknown } from '@contract/types';
import { HAZARD_STATUS, HISTORY_TONE, LABELS, SYSTEM_STATUS, DECISION_TONE } from '@contract/labels';
import { computeCosts } from '@contract/money';
import { S, fill } from '../strings.en';
import { G, U } from '../icons';
import { Button, Cited, Dialog, Pressable, Slider, useToast } from '../components/ui';
import { money, partialDate, plural } from '../lib/format';
import {
  ActionLog, Cases, CostsView, Hazards, History, InfoList, Packet, SectionBody, Sources, type AskAction,
} from './sections';
import { BookFlow, EmailDialog } from './actions';
import { ShareButton } from '../components/AppShell';
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
              <span className="b-label">{S.packetTitle}</span>
              <span className="b-big">{packet.findings.length}<small> {plural(packet.findings.length, S.packetFindingsOne, S.packetFindings).replace(/^\d+\s*/, '')}</small></span>
            </Pressable>
          ) : null}
        </section>

        <footer className="rv-foot">
          <div className="pills">
            <ShareButton />
            <Pressable className="pill" onClick={() => open(S.sourcesTitle, <Sources expanded sources={report.sources} onOpen={(n, el) => { setSheet(null); openSource(n, el); }} />)}>
              {fill(S.sourcesN, { n: report.sources.length })}
            </Pressable>
            {log.length ? (
              <Pressable className="pill" onClick={() => open(S.actionsTitle, <ActionLog entries={log} />)}>
                {fill(S.sentN, { n: log.length })}
              </Pressable>
            ) : null}
          </div>
          <p className="fineprint">{report.answerBy === 'rules' ? S.writtenByRules : S.writtenByAi}. {S.disclaimer}</p>
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
    <>
    <Aerial address={report.address} />
    <header className={`hero tone-${tone}`}>
      <div className="hero-main">
        <h1 className="hero-addr" id="reportTitle">{report.address}</h1>
        <p className="hero-answer"><b className="hero-verdict">{report.decision.title}.</b> {answer.replace(/\s*\[\d+\]/g, '')}</p>
      </div>
      {report.ledger.length ? <Ring rows={report.ledger} /> : null}
    </header>
    </>
  );
}

/** A satellite picture of the lot (GET /api/aerial). Hidden if no imagery comes back. */
function Aerial({ address }: { address: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'none'>('loading');
  if (state === 'none') return null;
  return (
    <figure className={`aerial${state === 'ok' ? ' on' : ''}`}>
      <img src={`/api/aerial?address=${encodeURIComponent(address)}`} alt={fill(S.aerialAlt, { address })}
        onLoad={() => setState('ok')} onError={() => setState('none')} />
      <span className="aerial-pin" aria-hidden="true" />
      <figcaption>{S.aerialCredit}</figcaption>
    </figure>
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
    <div className="b-card span-2 claims">
      <div className="claims-head"><span className="b-label">{S.compareTitle}</span>
        <span className="cc" aria-hidden="true">{S.compareListing}</span><span aria-hidden="true" /><span className="cc" aria-hidden="true">{S.compareCity}</span></div>
      {rows.map((r) => {
        const l = LABELS[r.label];
        return (
          <Pressable key={r.key + r.title} className={`claim tone-${l.tone}`} onClick={() => onOpen(r)} aria-label={`${r.title}: ${l.text}`}>
            <span className="claim-t">{r.title}</span>
            <span className={`claim-v${r.listing ? '' : ' none'}`}>{r.listing ?? S.noRecord}</span>
            <span className="claim-ic"><U name={COMPARE_ICON[l.compare]} /></span>
            <span className={`claim-v${r.records ? '' : ' none'}`}>{r.records ?? S.noRecord}</span>
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
        <div><span className="b-label">{S.compareListing}</span><span className="cd-v">{row.listing ?? S.noRecord}</span></div>
        <span className="claim-ic lg"><U name={COMPARE_ICON[l.compare]} /></span>
        <div><span className="b-label">{S.compareCity}</span><span className="cd-v">{row.records ?? S.noRecord}</span></div>
      </div>
      <p className="sheet-text"><Cited text={row.why} /></p>
    </div>
  );
}

function TaxCard({ costs, price, setPrice, onHow }: { costs: Costs; price: number; setPrice: (n: number) => void; onHow: () => void }) {
  const rows = useMemo(() => (price === costs.price ? costs.rows : computeCosts(price, costs.inputs)), [price, costs]);
  const tax = rows.find((r) => r.kind === 'property_tax');
  const monthly = tax?.amount == null ? null : Math.round(tax.amount / 12);
  const min = Math.round((costs.price * 0.8) / 5000) * 5000;
  const max = Math.round((costs.price * 1.2) / 5000) * 5000;
  return (
    <div className="b-card span-2 tax">
      <span className="b-label">{S.taxPerMonth}</span>
      <span className="b-huge num" aria-live="polite">{money(monthly)}<small>{S.perMonth}</small></span>
      <div className="tax-slider">
        <Slider id="hc-price" min={min} max={max} step={5000} value={price} onChange={setPrice} label={S.priceLabel} />
        <span className="tax-price num">{money(price)}</span>
      </div>
      <Pressable className="b-link" onClick={onHow}>{S.howWorkedOut}<U name="caret" className="rot" /></Pressable>
    </div>
  );
}

function StatTile({ t, onOpen }: { t: GlanceTile; onOpen: () => void }) {
  return (
    <Pressable className={`b-card stat tone-${t.tone}`} onClick={onOpen}>
      <span className="b-label">{t.label}</span>
      <span className="b-big">{t.value ?? S.noRecord}</span>
      <span className="b-status">{t.status}</span>
    </Pressable>
  );
}

function HazardTile({ t, rows, onOpen }: { t: GlanceTile; rows: HazardCheck[]; onOpen: () => void }) {
  return (
    <Pressable className={`b-card stat tone-${t.tone}`} onClick={onOpen}>
      <span className="b-label">{t.label}</span>
      <span className="hz-dots" aria-hidden="true">
        {rows.map((h) => <span key={h.key} className={`hz-dot tone-${HAZARD_STATUS[h.status].tone}`} title={h.title} />)}
      </span>
      <span className="b-status">{t.status}</span>
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
            : <Button kind="primary" onClick={() => onAction(act())}>{label}</Button>;
          return (
            <div key={g.key} className="ask-card">
              <span className="ask-who">{g.title}</span>
              <span className="ask-q">{g.items[0].title}</span>
              <Pressable className="b-link" onClick={() => onOpen(g.title, g.items, button)}>
                {plural(g.items.length, S.questionsOne, S.questions)}<U name="caret" className="rot" />
              </Pressable>
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
    <Pressable className={`b-card span-2 hl-card tone-${tone}`} onClick={onAll}>
      <span className="b-label">{kind === 'good' ? S.goodNews : S.worthALook}</span>
      <ul className="hl-list">{lines.slice(0, 3).map((t, i) => <li key={i}>{t.replace(/\s*\[\d+\]/g, '')}</li>)}</ul>
      {lines.length > 3 ? <span className="b-link">{fill(S.showAllN, { n: lines.length })}</span> : null}
    </Pressable>
  );
}
function HlList({ lines, kind }: { lines: string[]; kind: 'good' | 'watch' }) {
  return <ul className={`hl-list sheet tone-${kind === 'good' ? 'success' : 'warning'}`}>{lines.map((t, i) => <li key={i}><Cited text={t} /></li>)}</ul>;
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
              <span className="bone-t">{r.title}</span>
              <span className="bone-track" aria-hidden="true">
                {pct != null ? <><span className="bone-fill" style={{ ['--p' as string]: `${pct}%` }} /><span className="bone-dot" style={{ ['--p' as string]: `${pct}%` }} /></> : <span className="bone-none" />}
              </span>
              <span className="bone-y num">{r.year ?? ''}</span>
            </Pressable>
          );
        })}
      </div>
      <div className="bone bone-axis" aria-hidden="true"><span /><span className="axis num"><span>{from}</span><span>{now}</span></span><span /></div>
    </div>
  );
}

/* ---------- Timeline: every record as a dot on one line ---------- */

function TimelineCard({ rows, onOpen }: { rows: HistoryRow[]; onOpen: () => void }) {
  const yr = (d: string) => Number(d.slice(0, 4)) + (d.length >= 7 ? (Number(d.slice(5, 7)) - 1) / 12 : 0.5);
  const now = new Date().getFullYear() + 1;
  const ys = rows.map((r) => yr(r.date));
  const from = Math.floor(Math.min(...ys, now - 12));
  return (
    <Pressable className="b-card span-4 tline" onClick={onOpen}>
      <span className="b-label">{S.timelineTitle}</span>
      <span className="b-big">{rows.length}<small>{fill(S.recordsSince, { year: rows[0].date.slice(0, 4) })}</small></span>
      <span className="tl-axis" aria-hidden="true">
        {rows.map((r, i) => (
          <span key={i} className={`tl-pin tone-${HISTORY_TONE[r.kind]}`} style={{ ['--p' as string]: `${((yr(r.date) - from) / (now - from)) * 100}%` }} />
        ))}
      </span>
      <span className="axis num" aria-hidden="true"><span>{from}</span><span>{now - 1}</span></span>
    </Pressable>
  );
}
