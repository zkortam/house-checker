'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FIXTURES } from '@contract/fixtures';
import { S, fill } from '../strings.en';
import { U } from '../icons';
import { Button, ChipButton, FileAttach, Group, IconButton, Textarea } from '../components/ui';
import { uploadPacket } from '../api';
import { startRun } from '../lib/run-store';
import { useTabTitle } from '../lib/tab-title';
import { errorText } from '../lib/errors';
import { AppShell } from '../components/AppShell';
import { track } from '../analytics';

const DRAFT_KEY = 'hc-draft';

export function StartScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [packet, setPacket] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorOn, setErrorOn] = useState<'listing' | 'packet'>('listing');
  const [attachKey, setAttachKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const autoRan = useRef(false);

  useTabTitle(fill(S.tabTitle, { page: S.startTitle }));

  useEffect(() => {
    // A submit before hydration arrives as a plain GET with ?listing=; finish what the reader asked for.
    const q = new URLSearchParams(location.search).get('listing');
    if (q && q.trim().length >= 4 && !autoRan.current) {
      autoRan.current = true;
      update(q);
      try { history.replaceState(history.state, '', location.pathname); } catch { /* the query stays visible; harmless */ }
      void run(q);
      return;
    }
    try { const d = localStorage.getItem(DRAFT_KEY); if (d) setText(d); } catch { /* no saved draft */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(v: string) {
    setText(v);
    try { localStorage.setItem(DRAFT_KEY, v); } catch { /* draft kept in the field only */ }
  }

  function fillExample(key: string) {
    const f = FIXTURES.find((x) => x.key === key);
    if (!f) return;
    update(f.report.listing.text);
    field.current?.focus();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    await run(text);
  }

  async function run(raw: string) {
    if (busy) return;
    const t = raw.trim();
    if (t.length < 4) { setErrorOn('listing'); setError(S.errEmpty); field.current?.focus(); return; }
    setError(null);
    let packetFileId: string | undefined;
    if (packet) {
      // Never run silently without a packet the reader added: check it, and stop with a reason if it can't be used.
      const bad = await packetProblem(packet);
      if (bad) { setErrorOn('packet'); setError(bad); return; }
      setBusy(true);
      const up = await uploadPacket(packet);
      if (!up.ok) { setBusy(false); setErrorOn('packet'); setError(up.error.kind === 'invalid' ? S.packetNotPdf : S.packetUploadFailed); return; }
      packetFileId = up.value.packetFileId;
    }
    setBusy(true);
    const failStep = new URLSearchParams(location.search).get('fail') ?? undefined;
    track('check_started', { packet: !!packet });
    const r = await startRun(t, { packetFileId, failStep });
    setBusy(false);
    if ('reportId' in r) router.push(`/check/${encodeURIComponent(r.reportId)}`);
    else { setErrorOn('listing'); setError(errorText(r.error, 'start')); field.current?.focus(); }
  }

  return (
    <AppShell>
      <section className="column start" aria-labelledby="startTitle">
        <div className="answer-head">
          <h1 id="startTitle">{S.startTitle}</h1>
          <p className="lead">{S.startLead}</p>
        </div>
        <form className="group" noValidate onSubmit={submit}>
          <div className={`field-wrap${error && errorOn === 'listing' ? ' invalid' : ''}`}>
            <label htmlFor="listing" className="sr-only">{S.listingLabel}</label>
            <Textarea ref={field} variant="field" id="listing" name="listing" placeholder={S.listingPlaceholder} value={text}
              autoComplete="street-address" autoCapitalize="sentences" spellCheck={false} enterKeyHint="go"
              aria-invalid={(!!error && errorOn === 'listing') || undefined} aria-describedby={error && errorOn === 'listing' ? 'fieldError' : undefined}
              onChange={(e) => update(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }} />
            <div className="field-foot">
              <span className="attach-wrap">
                <FileAttach key={attachKey} label={packet ? packet.name : S.addPacket} onFile={(f) => { setPacket(f); if (errorOn === 'packet') setError(null); }} />
                {packet ? <IconButton small icon="close" label={fill(S.removePacket, { name: packet.name })}
                  onClick={() => { setPacket(null); setAttachKey((k) => k + 1); if (errorOn === 'packet') setError(null); }} /> : null}
              </span>
              <Button kind="primary" type="submit" className="btn-fixed" aria-busy={busy || undefined}>{S.checkButton}</Button>
            </div>
          </div>
          <div className="field-error" id="fieldError" role="alert" aria-live="assertive">{error}</div>
          <div className="chips" role="group" aria-label={S.examplesLabel}>
            <ChipButton onClick={() => fillExample('2055-42nd-ave')}>{S.example2055}</ChipButton>
            <ChipButton onClick={() => fillExample('57-carmelita-st')}>{S.example57}</ChipButton>
          </div>
        </form>
      </section>
    </AppShell>
  );
}

const PACKET_MAX_BYTES = 25 * 1024 * 1024; // same limit as POST /api/packet

/** Why this file can't be used as a disclosure packet, or null. Mirrors the server's checks so the reader hears it at once. */
async function packetProblem(f: File): Promise<string | null> {
  if (f.size === 0) return S.packetEmpty;
  if (f.size > PACKET_MAX_BYTES) return S.packetTooBig;
  try {
    const head = new Uint8Array(await f.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...head) !== '%PDF-') return S.packetNotPdf;
  } catch { /* unreadable here; let the server decide */ }
  return null;
}
