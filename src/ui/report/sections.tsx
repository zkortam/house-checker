'use client';
import { useId, useMemo, useState, type ReactNode } from 'react';
import type {
  ActionLogEntry, CaseRow, ClaimRow, Costs, GlanceTile, HazardCheck, HistoryKind, HistoryRow, InfoRow, Report,
  SectionKey, SectionState, Source, SystemRow, Unknown,
} from '@contract/types';
import {
  DECISION_TONE, EMPTY_VALUE, HAZARD_STATUS, HISTORY_LEGEND, HISTORY_TONE, LABELS, SYSTEM_STATUS,
} from '@contract/labels';
import { computeCosts } from '@contract/money';
import { S, fill } from '../strings.en';
import { G, U } from '../icons';
import { Button, Card, Cited, Collapse, Group, LabelChip, MetaLine, Pressable, Row, Slider } from '../components/ui';
import { LOCALE, money, partialDate, plural } from '../lib/format';
import type { PacketDoc, PacketFinding, PacketSummary } from './packet-types';

export const sectionId = (k: SectionKey) => `sec-${k}`;

/* ---------- Section states: ok, empty, error; an error never reads as empty ---------- */

export function SectionBody({ state, children, onRetry }: { state: SectionState | undefined; children: ReactNode; onRetry?: () => void }) {
  if (!state || state.state === 'ok') return <>{children}</>;
  if (state.state === 'empty') {
    return <Card><Row lead={<U name="info" />} title={state.text} className="muted-row" /></Card>;
  }
  return (
    <Card>
      <Row tone="error" lead={<U name="failed" className="ink" />} title={fill(S.sectionError, { source: state.source })}
        end={state.retryable && onRetry ? <Button kind="text" size="sm" onClick={onRetry}>{S.retry}</Button> : null} />
    </Card>
  );
}

/* ---------- Verdict ---------- */

export function Verdict({ report, answer, streaming }: { report: Report | null; answer: string; streaming: boolean }) {
  const tone = report ? DECISION_TONE[report.decision.tone] : 'neutral';
  const icon = report?.decision.tone === 'stop' ? 'open' : report?.decision.tone === 'caution' ? 'failed' : 'same';
  return (
    <div className={`card verdict tone-${tone}`} aria-busy={streaming || undefined}>
      <div className="verdict-top">
        <span className="badge-ic" aria-hidden="true">{report ? <U name={icon} /> : <U name="spinner" className="spin" />}</span>
        <div className="row-body">
          {report ? <h2 className="verdict-title">{report.decision.title}</h2> : null}
          <p className="verdict-text"><Cited text={answer} /></p>
        </div>
      </div>
      {report ? (
        <div className="verdict-foot">
          <G glyph="permit" />
          <div className="row-body">
            <span className="row-title">{S.inspectionLabel}</span>
            <span className="row-sub"><Cited text={report.decision.inspection} /></span>
          </div>
        </div>
      ) : null}
      {/* answerBy absent (older stored reports) means AI wrote it. */}
      {report?.answerBy === 'rules'
        ? <p className="disclosure"><U name="info" className="ai-g" />{S.writtenByRules}</p>
        : <p className="disclosure"><U name="ai" className="ai-g" />{S.writtenByAi}</p>}
    </div>
  );
}

/* ---------- Glance tiles ---------- */

export function monthlyTax(costs: Costs): number | null {
  const r = costs.rows.find((x) => x.kind === 'property_tax');
  return r?.amount == null ? null : Math.round(r.amount / 12);
}

export function Glance({ tiles, costs, onJump }: { tiles: GlanceTile[]; costs: Costs; onJump: (k: SectionKey) => void }) {
  return (
    <section className="tiles three" aria-label={S.glanceTitle}>
      {tiles.map((t) => {
        const value = t.section === 'costs' ? money(monthlyTax(costs)) : t.value ?? EMPTY_VALUE;
        return (
          <Pressable key={t.section} className={`tile tone-${t.tone}`} onClick={() => onJump(t.section)}>
            <span className="tile-label"><G glyph={t.glyph} />{t.label}</span>
            <span className="tile-value">{value}</span>
            <span className="tile-status"><span className="dot" aria-hidden="true" />{t.status}</span>
          </Pressable>
        );
      })}
    </section>
  );
}

/* ---------- Good news / Worth a look ---------- */

export function Highlights({ good, watch }: { good: string[]; watch: string[] }) {
  return (
    <div className="hl-pair">
      {good.length ? (
        <Group title={S.goodNews}>
          <Card>{good.map((t, i) => <div key={i} className="hl tone-success"><U name="same" /><span><Cited text={t} /></span></div>)}</Card>
        </Group>
      ) : null}
      {watch.length ? (
        <Group title={S.worthALook}>
          <Card>{watch.map((t, i) => <div key={i} className="hl tone-warning"><U name="watch" /><span><Cited text={t} /></span></div>)}</Card>
        </Group>
      ) : null}
    </div>
  );
}

/* ---------- Ask before you offer: grouped by who answers, one action per group ---------- */

const RESOLVERS: Array<{ key: Unknown['resolver']; title: string; sub: string; icon: 'email' | 'city' | 'book' | 'copy' }> = [
  { key: 'listing_agent', title: S.askListingAgent, sub: S.askListingAgentSub, icon: 'email' },
  { key: 'city', title: S.askCity, sub: S.askCitySub, icon: 'city' },
  { key: 'specialist', title: S.askSpecialist, sub: S.askSpecialistSub, icon: 'book' },
  { key: 'buyer_agent', title: S.askBuyerAgent, sub: S.askBuyerAgentSub, icon: 'copy' },
];

export type AskAction = { kind: 'email_listing_agent' | 'email_city'; unknownIds: string[] } | { kind: 'book'; unknown: Unknown } | { kind: 'brief'; unknowns: Unknown[] };

export function Ask({ unknowns, log, onAction }: { unknowns: Unknown[]; log: ActionLogEntry[]; onAction: (a: AskAction) => void }) {
  return (
    <>
      {RESOLVERS.map((r) => {
        const items = unknowns.filter((u) => u.resolver === r.key);
        if (!items.length) return null;
        const ids = new Set(items.map((u) => u.id));
        const sent = log.find((e) => e.unknownIds.some((id) => ids.has(id)) && e.kind !== 'none');
        let button: ReactNode = null;
        if (sent) {
          button = <p className="done-line"><U name="done" />{sent.kind === 'book_specialist' ? S.requestSentLine : S.emailSentLine}</p>;
        } else if (r.key === 'listing_agent') {
          button = <Button kind="quiet" icon="email" onClick={() => onAction({ kind: 'email_listing_agent', unknownIds: items.map((u) => u.id) })}>{S.actionEmailAgent}</Button>;
        } else if (r.key === 'city') {
          button = <Button kind="quiet" icon="email" onClick={() => onAction({ kind: 'email_city', unknownIds: items.map((u) => u.id) })}>{S.actionEmailCity}</Button>;
        } else if (r.key === 'specialist') {
          button = <Button kind="quiet" icon="book" onClick={() => onAction({ kind: 'book', unknown: items[0] })}>{S.actionBook}</Button>;
        } else {
          button = <Button kind="quiet" icon="copy" onClick={() => onAction({ kind: 'brief', unknowns: items })}>{S.actionBrief}</Button>;
        }
        return (
          <div key={r.key} className="card ask">
            <div className="ask-head">
              <span className="badge-ic sm tone-neutral" aria-hidden="true"><U name={r.icon} /></span>
              <div className="row-body"><span className="row-title">{r.title}</span><span className="row-sub">{r.sub}</span></div>
            </div>
            <ol>
              {items.map((u) => (
                <li key={u.id}>
                  <div className="row-body">
                    <span className="row-title">{u.title}</span>
                    <span className="row-sub"><Cited text={u.why} /></span>
                  </div>
                </li>
              ))}
            </ol>
            {button}
          </div>
        );
      })}
    </>
  );
}

/* ---------- Listing vs city ---------- */

const COMPARE_ICON = { same: 'same', pending: 'pending', different: 'different', unknown: 'unknown' } as const;

export function Compare({ rows }: { rows: ClaimRow[] }) {
  return <Card className="cmp-card">{rows.map((r) => <CompareRow key={r.key + r.title} row={r} />)}</Card>;
}

function CompareRow({ row }: { row: ClaimRow }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const l = LABELS[row.label];
  return (
    <div className={`cmp-wrap tone-${l.tone}`}>
      <Pressable className="row cmp-row" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="row-body">
          <span className="cmp-head"><span className="row-title">{row.title}</span><LabelChip label={row.label} /></span>
          <span className="cmp">
            <span className="cmp-cell"><span className="cmp-k">{S.compareListing}</span><span className="cmp-v">{row.listing ?? EMPTY_VALUE}</span></span>
            <span className="cmp-ic" aria-label={l.text}><U name={COMPARE_ICON[l.compare]} /></span>
            <span className="cmp-cell"><span className="cmp-k">{S.compareCity}</span><span className="cmp-v">{row.records ?? EMPTY_VALUE}</span></span>
          </span>
          <span className="more">{open ? S.moreHide : S.moreShow}<U name="caret" className="caret" /></span>
        </span>
      </Pressable>
      <Collapse open={open} id={id}><p className="evidence flush"><Cited text={row.why} /></p></Collapse>
    </div>
  );
}

/* ---------- Open cases ---------- */

export function Cases({ rows }: { rows: CaseRow[] }) {
  return (
    <Card>
      {rows.map((c, i) => (
        <div key={i} className={`row tone-${LABELS[c.label].tone}`}>
          <G glyph={c.glyph} />
          <span className="row-body">
            <span className="row-title">{c.title}</span>
            <span className="case-chip"><LabelChip label={c.label} /></span>
            <span className="row-sub"><Cited text={c.text} /></span>
            {c.stake ? <span className="row-sub stake"><Cited text={c.stake} /></span> : null}
          </span>
        </div>
      ))}
    </Card>
  );
}

/* ---------- Costs: price slider, big monthly tax, two mini tiles ---------- */

export function CostsView({ costs }: { costs: Costs }) {
  const [price, setPrice] = useState(costs.price);
  const [open, setOpen] = useState(false);
  const id = useId();
  const rows = useMemo(() => (price === costs.price ? costs.rows : computeCosts(price, costs.inputs)), [price, costs]);
  const min = Math.round((costs.price * 0.8) / 5000) * 5000;
  const max = Math.round((costs.price * 1.2) / 5000) * 5000;
  const tax = rows.find((r) => r.kind === 'property_tax');
  const supp = rows.find((r) => r.kind === 'supplemental_tax');
  const transfer = rows.find((r) => r.kind === 'transfer_tax');
  const fees = rows.find((r) => r.kind === 'case_fees');
  const monthly = tax?.amount == null ? null : Math.round(tax.amount / 12);
  return (
    <div className="card cost">
      <div>
        <div className="price-line">
          <label htmlFor={id + 'p'}>{S.priceLabel}</label>
          <span className="price-val" aria-live="polite">{money(price)}</span>
        </div>
        <Slider id={id + 'p'} min={min} max={max} step={5000} value={price} onChange={setPrice} label={S.priceLabel} />
        <div className="slider-ends" aria-hidden="true"><span>{money(min)}</span><span>{money(max)}</span></div>
      </div>
      <div className="hero-num">
        <span className="tile-label">{S.taxPerMonth}</span>
        <span className="big">{money(monthly)}<small>{S.perMonth}</small></span>
        <span className="row-sub num">{fill(S.perYear, { value: money(tax?.amount) })}</span>
      </div>
      <div className="mini-grid">
        {supp ? (
          <div className="mini"><span className="k">{S.supplementalShort}</span><span className="v">{money(supp.amount)}</span><span className="s">{S.oneTime}</span></div>
        ) : null}
        {transfer ? (
          <div className="mini"><span className="k">{S.transferShort}</span><span className="v">{money(transfer.amount)}</span><span className="s">{S.sellerUsuallyPays}</span></div>
        ) : null}
        {fees ? (
          <div className="mini tone-error"><span className="k">{S.caseFeesShort}</span><span className="v">{money(fees.amount)}</span><span className="s">{S.perMonth}</span></div>
        ) : null}
      </div>
      <div className="cost-more">
      <Pressable className="more more-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {open ? S.moreHide : S.moreShow}<U name="caret" className="caret" />
      </Pressable>
      <Collapse open={open} id={id}>
        <ul className="cost-why">
          {rows.map((r) => <li key={r.kind}><span className="row-title">{r.title}</span><span className="row-sub"><Cited text={r.text} /></span></li>)}
        </ul>
      </Collapse>
      </div>
    </div>
  );
}

/* ---------- Systems as year tiles ---------- */

export function Systems({ rows }: { rows: SystemRow[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const id = useId();
  return (
    <>
      <div className="tiles three">
        {rows.map((r, i) => {
          const st = SYSTEM_STATUS[r.status];
          return (
            <Pressable key={i} className={`tile sys tone-${st.tone}`} aria-expanded={sel === i} aria-controls={id} onClick={() => setSel(sel === i ? null : i)}>
              <span className="tile-label"><G glyph={r.glyph} />{r.title}</span>
              <span className="tile-value">{r.year ?? EMPTY_VALUE}</span>
              <span className="tile-status"><span className="dot" aria-hidden="true" />{st.text}</span>
            </Pressable>
          );
        })}
      </div>
      <Collapse open={sel != null} id={id}>
        {sel != null ? <div className="card detail-card"><span className="row-title">{rows[sel].title}</span><p className="row-sub"><Cited text={rows[sel].text} /></p></div> : null}
      </Collapse>
    </>
  );
}

/* ---------- Info rows: tenants, upside, nearby ---------- */

export function InfoList({ rows }: { rows: InfoRow[] }) {
  return <Card>{rows.map((r, i) => <InfoItem key={i} row={r} />)}</Card>;
}

function InfoItem({ row }: { row: InfoRow }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={row.muted ? 'muted-row' : undefined}>
      <Row onClick={() => setOpen(!open)} expanded={open} controls={id} lead={<G glyph={row.glyph} />} title={row.title}
        end={<U name="caret" className="caret" />} />
      <Collapse open={open} id={id}><p className="evidence"><span><Cited text={row.text} /></span></p></Collapse>
    </div>
  );
}

/* ---------- Hazards as a 2-column checklist ---------- */

const HZ_ICON = { clear: 'same', note: 'failed', unknown: 'unknown' } as const;

export function Hazards({ rows }: { rows: HazardCheck[] }) {
  const [sel, setSel] = useState<number | null>(() => {
    const i = rows.findIndex((r) => r.status === 'note');
    return i >= 0 ? i : null;
  });
  const id = useId();
  return (
    <div className="card">
      <div className="hz-grid">
        {rows.map((h, i) => {
          const st = HAZARD_STATUS[h.status];
          return (
            <Pressable key={h.key} className={`hz tone-${st.tone}`} aria-expanded={sel === i} aria-controls={id} onClick={() => setSel(sel === i ? null : i)}>
              <U name={HZ_ICON[h.status]} />
              <span><span className="hz-title">{h.title}</span><small>{st.text}</small></span>
            </Pressable>
          );
        })}
      </div>
      <Collapse open={sel != null} id={id}>
        {sel != null ? <p className="evidence flush hz-detail"><span className="row-title">{rows[sel].title}</span> <Cited text={rows[sel].text} /></p> : null}
      </Collapse>
    </div>
  );
}

/* ---------- History as a dot timeline with legend ---------- */

export function History({ rows }: { rows: HistoryRow[] }) {
  const kinds = Array.from(new Set(rows.map((r) => r.kind))) as HistoryKind[];
  return (
    <div className="card">
      <ol className="tl">
        {rows.map((h, i) => (
          <li key={i} className={`tl-item tone-${HISTORY_TONE[h.kind]}`}>
            <span className="tl-dot" aria-hidden="true" />
            <span className="row-body">
              <span className="tl-date">{partialDate(h.date)}</span>
              <span><span className="sr-only">{HISTORY_LEGEND[h.kind]}: </span><Cited text={h.text} /></span>
            </span>
          </li>
        ))}
      </ol>
      <div className="legend" aria-hidden="true">
        {kinds.map((k) => <span key={k} className={`tone-${HISTORY_TONE[k]}`}><span className="dot" />{HISTORY_LEGEND[k]}</span>)}
      </div>
    </div>
  );
}

/* ---------- Sources, collapsed ---------- */

export function Sources({ sources, onOpen, expanded = false }: { sources: Source[]; onOpen: (n: number, el: HTMLElement) => void; expanded?: boolean }) {
  const [open, setOpen] = useState(expanded);
  const id = useId();
  return (
    <div className="card">
      {expanded ? null : <Row onClick={() => setOpen(!open)} expanded={open} controls={id} lead={<U name="external" />}
        title={open ? S.sourcesHide : fill(S.sourcesShow, { n: sources.length })} end={<U name="caret" className="caret" />} />}
      <Collapse open={open} id={id}>
        <ol className="src-list">
          {sources.map((s, i) => (
            <li key={s.id}>
              <Pressable className="row src-row" onClick={(e) => onOpen(i + 1, e.currentTarget)}>
                <span className="src-n num">{i + 1}</span>
                <span className="row-body">
                  <span className="row-title">{s.title}</span>
                  <MetaLine items={[s.publisher, s.date ? partialDate(s.date) : null]} />
                </span>
              </Pressable>
            </li>
          ))}
        </ol>
      </Collapse>
    </div>
  );
}

/* ---------- What you sent ---------- */

const timeFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function ActionLog({ entries }: { entries: ActionLogEntry[] }) {
  return (
    <Card>
      {entries.map((e) => (
        <Row key={e.id} lead={<U name={e.kind === 'book_specialist' ? 'book' : 'email'} />} title={e.summary}
          sub={<MetaLine items={[timeFmt.format(new Date(e.at)), e.to]} />} />
      ))}
    </Card>
  );
}

export function stepsSummary(n: number): string { return plural(n, S.stepsDoneOne, S.stepsDone); }

/* ---------- Disclosure packet vs city records ---------- */

const DOC_NAME: Record<PacketDoc, string> = {
  inspection: S.docInspection, pest: S.docPest, tds: S.docTds, spq: S.docSpq, '3r': S.doc3r,
  nhd: S.docNhd, title: S.docTitle, hoa: S.docHoa, other: S.docOther,
};

export function Packet({ packet }: { packet: PacketSummary }) {
  return (
    <Card className="cmp-card">
      <Row lead={<G glyph="packet" />} title={packet.fileName ?? S.packetDefaultName}
        sub={<MetaLine items={[
          plural(packet.pages, S.packetPagesOne, S.packetPages),
          plural(packet.findings.length, S.packetFindingsOne, S.packetFindings),
        ]} />} />
      {packet.findings.map((f, i) => <PacketRow key={i} f={f} />)}
    </Card>
  );
}

function PacketRow({ f }: { f: PacketFinding }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const l = LABELS[f.label];
  return (
    <div className={`cmp-wrap tone-${l.tone}`}>
      <Pressable className="row cmp-row" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="row-body">
          <span className="cmp-head">
            <span className="row-title">{DOC_NAME[f.doc] ?? S.docOther}</span>
            <LabelChip label={f.label} />
          </span>
          <span className="pk-page">{fill(S.packetPage, { n: f.page })}</span>
          <span className="cmp">
            <span className="cmp-cell"><span className="cmp-k">{S.packetSays}</span><span className="cmp-v pk-v">{f.statement}</span></span>
            <span className="cmp-ic" aria-label={l.text}><U name={COMPARE_ICON[l.compare]} /></span>
            <span className="cmp-cell"><span className="cmp-k">{S.compareCity}</span><span className="cmp-v">{f.records ?? EMPTY_VALUE}</span></span>
          </span>
          <span className="more">{open ? S.moreHide : S.moreShow}<U name="caret" className="caret" /></span>
        </span>
      </Pressable>
      <Collapse open={open} id={id}><p className="evidence flush"><Cited text={f.text} /></p></Collapse>
    </div>
  );
}
