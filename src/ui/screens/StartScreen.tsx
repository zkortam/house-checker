'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FIXTURES } from '@contract/fixtures';
import { S, fill } from '../strings.en';
import { U } from '../icons';
import { Button, ChipButton, FileAttach, Group, Textarea } from '../components/ui';
import { uploadPacket } from '../api';
import { startRun } from '../lib/run-store';
import { errorText } from '../lib/errors';
import { AppShell } from '../components/AppShell';
import { track } from '../analytics';

const DRAFT_KEY = 'hc-draft';

export function StartScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [packet, setPacket] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { const d = localStorage.getItem(DRAFT_KEY); if (d) setText(d); } catch { /* no saved draft */ }
    document.title = fill(S.tabTitle, { page: S.startTitle });
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
    if (busy) return;
    const t = text.trim();
    if (t.length < 4) { setError(S.errEmpty); field.current?.focus(); return; }
    setError(null);
    setBusy(true);
    let packetFileId: string | undefined;
    if (packet) {
      const up = await uploadPacket(packet);
      if (up.ok) packetFileId = up.value.packetFileId;
    }
    const failStep = new URLSearchParams(location.search).get('fail') ?? undefined;
    track('check_started', { packet: !!packet });
    const r = await startRun(t, { packetFileId, failStep });
    setBusy(false);
    if ('reportId' in r) router.push(`/check/${encodeURIComponent(r.reportId)}`);
    else { setError(errorText(r.error)); field.current?.focus(); }
  }

  return (
    <AppShell>
      <section className="column" aria-labelledby="startTitle">
        <div className="answer-head">
          <h1 id="startTitle">{S.startTitle}</h1>
          <p className="lead">{S.startLead}</p>
        </div>
        <form className="group" noValidate onSubmit={submit}>
          <div className={`field-wrap${error ? ' invalid' : ''}`}>
            <label htmlFor="listing" className="sr-only">{S.listingLabel}</label>
            <Textarea ref={field} variant="field" id="listing" name="listing" placeholder={S.listingPlaceholder} value={text}
              autoComplete="street-address" autoCapitalize="sentences" spellCheck={false} enterKeyHint="go"
              aria-invalid={!!error || undefined} aria-describedby={error ? 'fieldError' : undefined}
              onChange={(e) => update(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }} />
            <div className="field-foot">
              <FileAttach label={packet ? packet.name : S.addPacket} onFile={setPacket} />
              <Button kind="primary" type="submit" className="btn-fixed" aria-busy={busy || undefined}>{S.checkButton}</Button>
            </div>
          </div>
          <div className="field-error" id="fieldError" role="alert" aria-live="assertive">{error}</div>
          <div className="chips" role="group" aria-label={S.examplesLabel}>
            <ChipButton onClick={() => fillExample('2055-42nd-ave')}>{S.example2055}</ChipButton>
            <ChipButton onClick={() => fillExample('57-carmelita-st')}>{S.example57}</ChipButton>
          </div>
        </form>
        <Group title={S.whatTitle}>
          <div className="tiles what-tiles">
            <div className="tile"><span className="tile-label"><U name="house" />{S.what1Title}</span><span className="row-sub">{S.what1Text}</span></div>
            <div className="tile"><span className="tile-label"><U name="open" />{S.what2Title}</span><span className="row-sub">{S.what2Text}</span></div>
            <div className="tile"><span className="tile-label"><U name="cost" />{S.what3Title}</span><span className="row-sub">{S.what3Text}</span></div>
            <div className="tile"><span className="tile-label"><U name="ask" />{S.what4Title}</span><span className="row-sub">{S.what4Text}</span></div>
          </div>
        </Group>
      </section>
    </AppShell>
  );
}
