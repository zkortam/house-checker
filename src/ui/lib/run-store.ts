'use client';
/**
 * The live check. One module-level run survives the client-side hop from "/" to "/check/[id]",
 * so the steps keep streaming while the URL already names the report.
 */
import { useSyncExternalStore } from 'react';
import type { ApiError, Report, StepEvent } from '@contract/types';
import { getReport, runCheck } from '../api';

export interface RunState {
  seq: number;
  startedAt: number;
  lastEventAt: number;
  listingText: string;
  packetFileId?: string;
  reportId: string | null;
  address: string | null;
  steps: StepEvent[];
  progress: string | null;
  answer: string;
  report: Report | null;
  status: 'running' | 'done' | 'failed' | 'error';
  /** The stream dropped after the run started; the server keeps going, and the report is fetched once we're back online. */
  reconnecting: boolean;
  error: ApiError | null;
}

let state: RunState | null = null;
let ctrl: AbortController | null = null;
let seq = 0;
const subs = new Set<() => void>();

function set(next: RunState | null) { state = next; subs.forEach((f) => f()); }
function patch(s: number, p: Partial<RunState>) { if (state && state.seq === s) set({ ...state, ...p }); }

export function getRun(): RunState | null { return state; }

export function useRun(): RunState | null {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => null);
}

/** Starts a check. Resolves with the report id at the `run` event, or with the error that ended it first. */
export function startRun(listingText: string, opts: { packetFileId?: string; failStep?: string } = {}): Promise<{ reportId: string } | { error: ApiError }> {
  ctrl?.abort();
  ctrl = new AbortController();
  const my = ++seq;
  const signal = ctrl.signal;
  set({
    seq: my, startedAt: Date.now(), lastEventAt: Date.now(), listingText, packetFileId: opts.packetFileId, reportId: null, address: null, steps: [], progress: null,
    answer: '', report: null, status: 'running', error: null, reconnecting: false,
  });
  try { sessionStorage.setItem('hc-last-listing', listingText); } catch { /* storage blocked: Retry then needs the start page */ }

  // The stream gets its own controller so going offline can end it without counting as a cancel.
  const stream = new AbortController();
  signal.addEventListener('abort', () => stream.abort(), { once: true });
  let dropped = false;
  const onOffline = () => { if (state?.seq === my && state.status === 'running' && state.reportId) { dropped = true; stream.abort(); } };
  window.addEventListener('offline', onOffline);

  return new Promise((resolve) => {
    let settled = false;
    const settle = (v: { reportId: string } | { error: ApiError }) => { if (!settled) { settled = true; resolve(v); } };
    (async () => {
      let sawDone = false;
      try {
      for await (const ev of runCheck({ listingText, packetFileId: opts.packetFileId }, { signal: stream.signal, failStep: opts.failStep })) {
        if (!state || state.seq !== my) return;
        if (ev.type !== 'error') patch(my, { lastEventAt: Date.now() });
        switch (ev.type) {
          case 'run':
            patch(my, { reportId: ev.reportId, address: ev.address });
            try { sessionStorage.setItem('hc-last-run', ev.reportId); } catch { /* a reload then shows the plain not-found state */ }
            settle({ reportId: ev.reportId });
            break;
          case 'step': {
            const steps = [...state.steps];
            const i = steps.findIndex((s) => s.id === ev.id);
            if (i >= 0) steps[i] = ev; else steps.push(ev);
            patch(my, { steps });
            break;
          }
          case 'progress': patch(my, { progress: ev.text }); break;
          case 'delta': patch(my, { answer: state.answer + ev.text, progress: null }); break;
          case 'report': patch(my, { report: ev.report }); break;
          case 'done': sawDone = true; patch(my, { status: 'done', progress: null }); break;
          case 'error':
            // A dropped connection after the run started is recoverable: the server finishes the run anyway.
            if (state.reportId && (ev.error.kind === 'offline' || ev.error.kind === 'timeout')) { dropped = true; break; }
            patch(my, { status: 'error', error: ev.error });
            settle({ error: ev.error });
            return;
        }
        if (dropped) break;
      }
      if (sawDone || !state || state.seq !== my || signal.aborted) return;
      if (state.reportId && (dropped || !state.report)) { await recover(my, state.reportId); return; }
      patch(my, { status: 'failed' });
      settle({ error: { kind: 'unavailable', retryable: true } });
      } finally { window.removeEventListener('offline', onOffline); }
    })();
  });
}

/** Wait until online, then fetch the finished report (GET waits for an in-flight run). Gives up after a few tries. */
async function recover(my: number, reportId: string) {
  patch(my, { reconnecting: true });
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!navigator.onLine) await new Promise<void>((r) => window.addEventListener('online', () => r(), { once: true }));
    if (!state || state.seq !== my) return;
    const r = await getReport(reportId);
    if (!state || state.seq !== my) return;
    if (r.ok) { patch(my, { report: r.value, status: 'done', reconnecting: false, progress: null, lastEventAt: Date.now() }); return; }
    if (r.error.kind === 'not_found' || r.error.kind === 'invalid') break;
    await new Promise((f) => setTimeout(f, 2000 * (attempt + 1)));
  }
  patch(my, { status: 'failed', reconnecting: false });
}

export function clearRun() { ctrl?.abort(); set(null); }
