'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApiError, Report, StepEvent } from '@contract/types';
import { S, fill } from '../strings.en';
import { G, U } from '../icons';
import { Button, Card, Collapse, Group, MetaLine, Row, SourceProvider, Spinner } from '../components/ui';
import { getReport } from '../api';
import { startRun, useRun } from '../lib/run-store';
import { errorText } from '../lib/errors';
import { partialDate } from '../lib/format';
import { ReportView } from '../report/ReportView';
import { Verdict, stepsSummary } from '../report/sections';
import { Hero } from '../report/ReportView';
import { SourceSheet } from '../report/actions';
import { AppShell } from '../components/AppShell';
import { track } from '../analytics';

function lastRunId(): string | null {
  try { return sessionStorage.getItem('hc-last-run'); } catch { return null; }
}

export function CheckScreen({ id }: { id: string }) {
  const router = useRouter();
  const run = useRun();
  const live = run && run.reportId === id ? run : null;
  const [fetched, setFetched] = useState<Report | null>(null);
  const [fetchError, setFetchError] = useState<ApiError | null>(null);
  const [src, setSrc] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlowLoad(true), 2500); return () => clearTimeout(t); }, [id]);

  // A refresh or a shared link: restore the stored report.
  useEffect(() => {
    if (live) return;
    let on = true;
    setFetchError(null);
    getReport(id).then((r) => { if (!on) return; if (r.ok) setFetched(r.value); else setFetchError(r.error); });
    return () => { on = false; };
  }, [id, live, reloadKey]);

  const report = live?.report ?? (live ? null : fetched);
  const address = report?.address ?? live?.address ?? null;

  useEffect(() => { document.title = fill(S.tabTitle, { page: address ?? S.stepsTitle }); }, [address]);
  useEffect(() => { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; }, []);

  const retry = useCallback(async () => {
    let text = live?.listingText ?? null;
    if (!text) { try { text = sessionStorage.getItem('hc-last-listing'); } catch { text = null; } }
    if (!text) { router.push('/'); return; }
    const r = await startRun(text, { packetFileId: live?.packetFileId });
    if ('reportId' in r && r.reportId !== id) router.replace(`/check/${encodeURIComponent(r.reportId)}`);
  }, [live, id, router]);

  const openSource = useCallback((n: number) => { setSrc(n); track('source_opened', { n }); }, []);
  const shownFor = useRef<string | null>(null);
  useEffect(() => {
    if (!report || shownFor.current === report.id) return;
    shownFor.current = report.id;
    const failed = Object.values(report.sections).filter((x) => x.state === 'error').length;
    track('report_shown', { decision: report.decision.tone, failedSections: failed, live: !!live });
  }, [report, live]);

  const streaming = !!live && live.status === 'running';
  const answer = report?.answer ?? live?.answer ?? '';
  const showVerdict = !!report || (live?.answer.length ?? 0) > 0;

  return (
    <AppShell back title={address ?? undefined} share={!!report}>
      <SourceProvider value={openSource}>
        <section className={`column${report ? ' wide' : ''}`} aria-labelledby="reportTitle">
          {report ? null : <div className="answer-head">
            <h1 id="reportTitle">{address ?? (fetchError ? S.appName : S.stepsTitle)}</h1>
          </div>}

          {fetchError && !live ? (
            <Card>
              {fetchError.kind === 'not_found' && lastRunId() === id ? (
                <Row tone="neutral" lead={<U name="failed" className="ink" />} title={S.interrupted}
                  end={<Button kind="text" size="sm" onClick={retry}>{S.retry}</Button>} />
              ) : (
                <Row tone={fetchError.kind === 'not_found' ? 'neutral' : 'error'} lead={<U name="failed" className="ink" />} title={errorText(fetchError)}
                  end={fetchError.retryable ? <Button kind="text" size="sm" onClick={() => setReloadKey((k) => k + 1)}>{S.retry}</Button> : <Button kind="text" size="sm" onClick={() => router.push('/')}>{S.startAnother}</Button>} />
              )}
            </Card>
          ) : null}

          {!live && !report && !fetchError ? <div className="loading-line"><Spinner />{slowLoad && lastRunId() === id ? S.stillChecking : S.loadingReport}</div> : null}

          {live ? <Steps steps={live.steps} progress={live.progress} startedAt={live.startedAt} lastEventAt={live.lastEventAt} writing={live.answer.length > 0 && !live.report} done={live.status === 'done' || !!live.report} onRetry={retry} /> : null}

          {live && (live.status === 'failed' || live.status === 'error') && !live.report ? (
            <Card>
              <Row tone="error" lead={<U name="failed" className="ink" />} title={live.error ? errorText(live.error) : S.runFailed}
                end={live.error && !live.error.retryable ? null : <Button kind="text" size="sm" onClick={retry}>{S.retry}</Button>} />
            </Card>
          ) : null}

          {showVerdict && !report ? <Verdict report={report} answer={answer} streaming={streaming && !report} /> : null}
        </section>
        {report ? <div className="rv-hero-wrap"><Hero report={report} answer={answer} /></div> : null}
        {report ? <ReportView key={report.id + report.createdAt} report={report} onRetry={retry} openSource={openSource} /> : null}
        <SourceSheet source={src != null && report ? report.sources[src - 1] ?? null : null} n={src ?? 0} onClose={() => setSrc(null)} />
      </SourceProvider>
    </AppShell>
  );
}

/* ---------- Working view: steps, then one summary line ---------- */

type StepCount = { done: number; total: number };
/** Optional real counts on a step (requested as an additive contract field); never parsed out of the detail text. */
function countOf(s: StepEvent): StepCount | null {
  const c = s.count;
  return c && c.total > 0 ? c : null;
}

function useElapsed(startedAt: number, stop: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stop) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stop]);
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

function clock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const LONG_WAIT_SEC = 12;
/** No event for this long after every step finished: offer Retry (never retried on a hidden timer). */
const STALL_SEC = 60;

function Steps({ steps, progress, startedAt, lastEventAt, writing, done, onRetry }: { steps: StepEvent[]; progress: string | null; startedAt: number; lastEventAt: number; writing: boolean; done: boolean; onRetry: () => void }) {
  const elapsed = useElapsed(startedAt, done);
  const quiet = Math.floor((Date.now() - lastEventAt) / 1000);
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const failed = steps.filter((s) => s.status === 'failed');
  const running = steps.some((s) => s.status === 'running');
  const collapsed = done && !expanded;
  const list = (
    <div className="steps" aria-live="polite">
      {steps.map((s) => (
        <Row key={s.id} lead={<G glyph={s.glyph} />} title={s.title}
          tone={s.status === 'failed' ? 'error' : undefined}
          sub={<>
            <span className="step-sub">{s.status === 'failed' ? (s.reason ?? S.stepFailed) : s.detail ?? (s.status === 'running' ? S.stepWaiting : S.stepDone)}</span>
            {s.status === 'running' && countOf(s) ? (
              <span className="step-bar" aria-hidden="true"><span style={{ ['--p' as string]: Math.min(1, countOf(s)!.done / countOf(s)!.total) }} /></span>
            ) : null}
          </>}
          end={
            <span className="step-end">
              {s.status === 'failed' && s.retryable ? <Button kind="text" size="sm" onClick={onRetry}>{S.retry}</Button> : null}
              <span className="step-status" role="img" aria-label={s.status === 'running' ? S.stepRunning : s.status === 'done' ? S.stepDone : S.stepFailedShort}>
                <span className={s.status === 'running' ? 'on' : ''}><U name="spinner" className="spin" /></span>
                <span className={`ok${s.status === 'done' ? ' on' : ''}`}><U name="done" /></span>
                <span className={`bad${s.status === 'failed' ? ' on' : ''}`}><U name="failed" /></span>
              </span>
            </span>
          } />
      ))}
      {!steps.length ? <div className="loading-line pad"><Spinner /></div> : null}
    </div>
  );
  return (
    <Group>
      {!done ? (
        <div className="steps-head">
          <h2 className="section-label">{S.stepsTitle}</h2>
          <span className="elapsed num" aria-hidden="true">{fill(S.elapsed, { time: clock(elapsed) })}</span>
        </div>
      ) : null}
      {!done ? (
        <p className="steps-foot" aria-live="off">
          {!running && steps.length && quiet >= STALL_SEC ? <>{S.stalled}<Button kind="text" size="sm" onClick={onRetry}>{S.retry}</Button></>
            : !running && steps.length ? <><Spinner />{writing || !progress ? S.writing : progress}</>
            : elapsed >= LONG_WAIT_SEC ? S.longWait
            : !steps.length ? S.starting
            : fill(S.stepsProgress, { done: steps.filter((x) => x.status !== 'running').length, total: steps.length })}
        </p>
      ) : null}

      {done ? (
        <Card>
          <Row onClick={() => setExpanded(!expanded)} expanded={!collapsed} controls={id}
            lead={<U name={failed.length ? 'failed' : 'done'} className={failed.length ? 'ink-error' : undefined} />}
            title={stepsSummary(steps.length - failed.length)}
            sub={failed.length ? failed.map((f) => f.reason ?? f.title).join('. ') : undefined}
            end={<U name="caret" className="caret" />} />
          <Collapse open={!collapsed} id={id}>{list}</Collapse>
        </Card>
      ) : <Card>{list}</Card>}
    </Group>
  );
}

