'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { ActionLogEntry, ApiError, EmailDraft, Report, SlotOffer, Source, Unknown } from '@contract/types';
import { S, fill } from '../strings.en';
import { Button, ConfirmDialog, Dialog, Input, LinkButton, MetaLine, SlotOption, Spinner, Textarea, useToast } from '../components/ui';
import { book, getSlots, newKey, sendEmail } from '../api';
import { money, partialDate, slotDayLabel, slotLabel, slotTimeLabel } from '../lib/format';
import { errorText } from '../lib/errors';
import { pageOf } from './packet-types';

/* ---------- Source sheet: tap a citation ---------- */

export function SourceSheet({ source, n, onClose }: { source: Source | null; n: number; onClose: () => void }) {
  return (
    <Dialog open={!!source} onClose={onClose} size="sm" title={source?.title ?? ''}
      foot={source ? (
        <>
          <Button kind="text" onClick={onClose}>{S.close}</Button>
          {source.url ? <LinkButton href={source.url}>{S.openRecord}</LinkButton> : null}
        </>
      ) : null}>
      {source ? (
        <div className="src-dlg-meta">
          <MetaLine items={[fill(S.sourceN, { n }), source.publisher, source.date ? partialDate(source.date) : null, source.dataset]} />
          {!source.url ? <p className="row-sub">{pageOf(source) ? fill(S.sourcePage, { n: pageOf(source)! }) : S.noLink}</p> : null}
        </div>
      ) : null}
    </Dialog>
  );
}

/* ---------- Email: edit, Send, 5 s Undo window, then one POST ---------- */

export function EmailDialog({ report, kind, unknownIds, onClose, onSent }: {
  report: Report; kind: 'email_listing_agent' | 'email_city' | null; unknownIds: string[];
  onClose: () => void; onSent: (e: ActionLogEntry) => void;
}) {
  const open = kind != null;
  const draft: EmailDraft | null = kind === 'email_city' ? report.drafts.cityEmail : report.drafts.listingAgentEmail;
  const storeKey = `hc-email-${report.id}-${kind}`;
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [toError, setToError] = useState(false);
  const toast = useToast();
  const ids = useId();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    let saved: { to: string; subject: string; body: string } | null = null;
    try { saved = JSON.parse(localStorage.getItem(storeKey) ?? 'null'); } catch { saved = null; }
    setTo(saved?.to ?? draft?.to ?? '');
    setSubject(saved?.subject ?? draft?.subject ?? '');
    setBody(saved?.body ?? draft?.body ?? '');
    setToError(false);
  }, [open, storeKey, draft]);

  function save(next: { to: string; subject: string; body: string }) {
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* autosave is a convenience; the dialog still holds the text */ }
  }

  function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) { setToError(true); return; }
    const req = {
      reportId: report.id, unknownIds: unknownIds.length ? unknownIds : draft?.unknownIds ?? [], kind: kind!,
      to: to.trim(), subject, body, idempotencyKey: newKey(),
    };
    onClose();
    let cancelled = false;
    toast.show(S.emailSending, {
      undo: () => { cancelled = true; toast.show(S.emailUndone); },
      onExpire: async () => {
        if (cancelled) return;
        const res = await sendEmail(req);
        if (res.ok) {
          try { localStorage.removeItem(storeKey); } catch { /* nothing to clear */ }
          toast.show(/outbox/i.test(res.entry.summary) ? S.emailOutbox : S.emailSent);
          onSent(res.entry);
        } else {
          toast.show(`${S.emailNotSent}. ${errorText(res.error)}`, { error: true });
        }
      },
    });
  }

  const isCity = kind === 'email_city';
  return (
    <Dialog open={open} onClose={onClose} title={isCity ? S.emailTitleCity : S.emailTitleAgent}
      foot={<>
        <Button kind="text" onClick={onClose}>{S.cancel}</Button>
        <Button kind="primary" className="btn-fixed" onClick={submit}>{S.send}</Button>
      </>}>
      <form className="ovl-form" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="form-row">
          <label htmlFor={ids + 'to'}>{S.emailTo}</label>
          <Input id={ids + 'to'} type="email" inputMode="email" autoComplete="email" enterKeyHint="next" invalid={toError}
            placeholder={isCity ? S.emailToPlaceholderCity : S.emailToPlaceholderAgent} value={to}
            aria-describedby={toError ? ids + 'err' : undefined}
            onChange={(e) => { setTo(e.target.value); save({ to: e.target.value, subject, body }); }} />
          {toError ? <span className="field-error" id={ids + 'err'} role="alert">{S.emailErrTo}</span> : null}
        </div>
        <div className="form-row">
          <label htmlFor={ids + 'sub'}>{S.emailSubject}</label>
          <Input id={ids + 'sub'} type="text" autoComplete="off" enterKeyHint="next" value={subject}
            onChange={(e) => { setSubject(e.target.value); save({ to, subject: e.target.value, body }); }} />
        </div>
        <div className="form-row">
          <label htmlFor={ids + 'body'} className="sr-only">{S.emailBody}</label>
          <Textarea ref={bodyRef} id={ids + 'body'} value={body} autoCapitalize="sentences"
            onChange={(e) => { setBody(e.target.value); save({ to, subject, body: e.target.value }); }} />
        </div>
      </form>
    </Dialog>
  );
}

/* ---------- Specialist request: pick a time, confirm, then one POST (no undo: the confirm is the gate) ---------- */

export function BookFlow({ report, unknown, onClose, onSent }: {
  report: Report; unknown: Unknown | null; onClose: () => void; onSent: (e: ActionLogEntry) => void;
}) {
  const [offer, setOffer] = useState<SlotOffer | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickError, setPickError] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!unknown) return;
    setOffer(null); setErr(null); setSlot(null); setConfirming(false); setPickError(false);
    let live = true;
    getSlots(report.id, unknown.id).then((r) => { if (!live) return; if (r.ok) setOffer(r.value); else setErr(r.error); });
    return () => { live = false; };
  }, [unknown, report.id]);

  async function confirm() {
    if (!unknown || !slot || busy) return;
    setBusy(true);
    const res = await book({ reportId: report.id, unknownId: unknown.id, slot, idempotencyKey: newKey() });
    setBusy(false);
    setConfirming(false);
    onClose();
    if (res.ok) { toast.show(S.bookSent); onSent(res.entry); }
    else toast.show(`${S.bookNotSent}. ${errorText(res.error)}`, { error: true });
  }

  const who = offer?.provider ?? unknown?.specialist ?? '';
  return (
    <>
      <Dialog open={!!unknown && !confirming} onClose={onClose} title={S.bookTitle}
        foot={<>
          <Button kind="text" onClick={onClose}>{S.cancel}</Button>
          <Button kind="primary" className="btn-fixed" onClick={() => { if (!slot) { setPickError(true); return; } setConfirming(true); }}>{S.continue}</Button>
        </>}>
        {offer ? (
          <>
            <div className="confirm-facts">
              <span className="row-title">{offer.provider}</span>
              <span>{fill(S.bookConfirmScope, { value: offer.scope })}</span>
              <MetaLine items={[offer.priceUsd != null ? fill(S.bookConfirmPrice, { value: money(offer.priceUsd) }) : S.bookConfirmPriceUnknown, S.noPaidPlacement]} />
            </div>
            {offer.slots.length ? (
              <div className="slot-list" role="radiogroup" aria-label={S.bookTimes}>
                {offer.slots.map((s) => (
                  <SlotOption key={s} checked={slot === s} onSelect={() => { setSlot(s); setPickError(false); }}>
                    <span className="slot-day">{slotDayLabel(s)}</span><span className="slot-time">{slotTimeLabel(s)}</span>
                  </SlotOption>
                ))}
              </div>
            ) : <p className="row-sub">{S.bookNoSlots}</p>}
            {pickError ? <p className="field-error" role="alert">{S.bookPickSlot}</p> : null}
          </>
        ) : err ? (
          <p className="row-sub">{S.bookSlotsFailed}. {errorText(err)}</p>
        ) : (
          <div className="loading-line"><Spinner />{S.bookLoadingSlots}</div>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirming}
        title={slot ? fill(S.bookConfirmTitle, { who, when: slotLabel(slot) }) : ''}
        facts={offer ? (
          <>
            <span>{fill(S.bookConfirmScope, { value: offer.scope })}</span>
            <span>{offer.priceUsd != null ? fill(S.bookConfirmPrice, { value: money(offer.priceUsd) }) : S.bookConfirmPriceUnknown}</span>
            <span>{S.bookConfirmEmail}</span>
          </>
        ) : null}
        confirmLabel={S.sendRequest}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
