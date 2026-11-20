'use client';
import { useCallback, useEffect, useId, useState } from 'react';
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
import { SourceSheet } from '../report/actions';
import { AppShell } from '../components/AppShell';

export function CheckScreen({ id }: { id: string }) {
  const router = useRouter();
  const run = useRun();
  const live = run && run.reportId === id ? run : null;
  const [fetched, setFetched] = useState<Report | null>(null);
  const [fetchError, setFetchError] = useState<ApiError | null>(null);
  const [src, setSrc] = useState<number | null>(null);

  // A refresh or a shared link: restore the stored report.
  useEffect(() => {
    if (live) return;
    let on = true;
    setFetchError(null);
    getReport(id).then((r) => { if (!on) return; if (r.ok) setFetched(r.value); else setFetchError(r.error); });
    return () => { on = false; };
  }, [id, live]);

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

  const openSource = useCallback((n: number) => setSrc(n), []);

  const streaming = !!live && live.status === 'running';
  const answer = report?.answer ?? live?.answer ?? '';
  const showVerdict = !!report || (live?.answer.length ?? 0) > 0;

  return (
    <AppShell back title={address ?? undefined} share={!!report}>
      <SourceProvider value={openSource}>
        <section className="column" aria-labelledby="reportTitle">
          <div className="answer-head">
            <h1 id="reportTitle">{address ?? (fetchError ? S.appName : S.stepsTitle)}</h1>
            {report ? (
              <MetaLine items={[
                fill(S.parcel, { value: report.parcelDisplay }), report.meta.neighborhood, report.meta.zoning,
                report.meta.yearBuilt ? fill(S.built, { value: report.meta.yearBuilt }) : null,
                fill(S.checkedOn, { value: partialDate(report.checkedAt.slice(0, 10)) }),
              ]} />
            ) : null}
          </div>

          {fetchError && !live ? (
            <Card>
              <Row tone={fetchError.kind === 'not_found' ? 'neutral' : 'error'} lead={<U name="failed" className="ink" />} title={errorText(fetchError)}
                end={fetchError.retryable ? <Button kind="text" size="sm" onClick={() => router.refresh()}>{S.retry}</Button> : <Button kind="text" size="sm" onClick={() => router.push('/')}>{S.startAnother}</Button>} />
            </Card>
          ) : null}

          {!live && !report && !fetchError ? <div className="loading-line"><Spinner />{S.loadingReport}</div> : null}

          {live ? <Steps steps={live.steps} progress={live.progress} done={live.status === 'done' || !!live.report} onRetry={retry} /> : null}

          {live && (live.status === 'failed' || live.status === 'error') && !live.report ? (
            <Card>
              <Row tone="error" lead={<U name="failed" className="ink" />} title={live.error ? errorText(live.error) : S.runFailed}
                end={live.error && !live.error.retryable ? null : <Button kind="text" size="sm" onClick={retry}>{S.retry}</Button>} />
            </Card>
          ) : null}

          {showVerdict ? <Verdict report={report} answer={answer} streaming={streaming && !report} /> : null}
        </section>
        {report ? <ReportView key={report.id + report.createdAt} report={report} onRetry={retry} openSource={openSource} /> : null}
        <SourceSheet source={src != null && report ? report.sources[src - 1] ?? null : null} n={src ?? 0} onClose={() => setSrc(null)} />
      </SourceProvider>
    </AppShell>
  );
}

/* ---------- Working view: steps, then one summary line ---------- */

function Steps({ steps, progress, done, onRetry }: { steps: StepEvent[]; progress: string | null; done: boolean; onRetry: () => void }) {
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
          sub={s.status === 'failed' ? (s.reason ?? S.stepFailed) : s.detail}
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
      {!running && progress ? <p className="progress-line">{progress}</p> : null}
      {!steps.length ? <div className="loading-line pad"><Spinner />{S.starting}</div> : null}
    </div>
  );
  return (
    <Group title={done ? undefined : S.stepsTitle}>
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

