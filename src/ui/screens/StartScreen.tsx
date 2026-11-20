'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FIXTURES } from '@contract/fixtures';
import { S, fill } from '../strings.en';
import { Button, FileAttach, IconButton, Textarea } from '../components/ui';
import { uploadPacket } from '../api';
import { startRun } from '../lib/run-store';
import { useTabTitle } from '../lib/tab-title';
import { errorText } from '../lib/errors';
import { RecentCards, useRecent } from './RecentScreen';
import { AppShell } from '../components/AppShell';
import { track } from '../analytics';

const DRAFT_KEY = 'hc-draft';

export function StartScreen() {
  const recent = useRecent();
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
      <section className="page start" aria-labelledby="startTitle">
        <h1 className="page-title" id="startTitle">{S.startTitle}</h1>
        <form noValidate onSubmit={submit} className="prompt-form">
          <div className={`prompt${error && errorOn === 'listing' ? ' invalid' : ''}`}>
            <label htmlFor="listing" className="sr-only">{S.listingLabel}</label>
            <Textarea ref={field} variant="field" id="listing" name="listing" placeholder={S.listingPlaceholder} value={text}
              autoComplete="street-address" autoCapitalize="sentences" spellCheck={false} enterKeyHint="go" autoFocus
              aria-invalid={(!!error && errorOn === 'listing') || undefined} aria-describedby={error ? 'fieldError' : undefined}
              onChange={(e) => update(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !text.includes('\n')) { e.preventDefault(); submit(e); } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }} />
            <div className="prompt-foot">
              <span className="attach-wrap">
                <FileAttach key={attachKey} label={packet ? packet.name : S.disclosuresWord} onFile={(f) => { setPacket(f); if (errorOn === 'packet') setError(null); }} />
                {packet ? <IconButton small icon="close" label={fill(S.removePacket, { name: packet.name })}
                  onClick={() => { setPacket(null); setAttachKey((k) => k + 1); if (errorOn === 'packet') setError(null); }} /> : null}
              </span>
              <Button kind="primary" type="submit" className="btn-fixed" aria-busy={busy || undefined}>{S.checkButton}</Button>
            </div>
          </div>
          <div className="prompt-under" aria-live="assertive">
            {error ? <span className="field-error" id="fieldError" role="alert">{error}</span> : null}
          </div>
        </form>
        {recent && recent.length ? (
          <section aria-labelledby="recentHead" className="start-recent">
            <h2 className="section-head" id="recentHead">{S.recentTitle}</h2>
            <RecentCards items={recent.slice(0, 4)} />
          </section>
        ) : null}
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
