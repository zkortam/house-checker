'use client';
/**
 * The live check. One module-level run survives the client-side hop from "/" to "/check/[id]",
 * so the steps keep streaming while the URL already names the report.
 */
import { useSyncExternalStore } from 'react';
import type { ApiError, Report, StepEvent } from '@contract/types';
import { runCheck } from '../api';

export interface RunState {
  seq: number;
  startedAt: number;
  listingText: string;
  packetFileId?: string;
  reportId: string | null;
  address: string | null;
  steps: StepEvent[];
  progress: string | null;
  answer: string;
  report: Report | null;
  status: 'running' | 'done' | 'failed' | 'error';
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
    seq: my, startedAt: Date.now(), listingText, packetFileId: opts.packetFileId, reportId: null, address: null, steps: [], progress: null,
    answer: '', report: null, status: 'running', error: null,
  });
  try { sessionStorage.setItem('hc-last-listing', listingText); } catch { /* storage blocked: Retry then needs the start page */ }

  return new Promise((resolve) => {
    let settled = false;
    const settle = (v: { reportId: string } | { error: ApiError }) => { if (!settled) { settled = true; resolve(v); } };
    (async () => {
      let sawDone = false;
      for await (const ev of runCheck({ listingText, packetFileId: opts.packetFileId }, { signal, failStep: opts.failStep })) {
        if (!state || state.seq !== my) return;
        switch (ev.type) {
          case 'run':
            patch(my, { reportId: ev.reportId, address: ev.address });
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
            patch(my, { status: 'error', error: ev.error });
            settle({ error: ev.error });
            return;
        }
      }
      if (!sawDone && state && state.seq === my && !signal.aborted) {
        patch(my, { status: 'failed' });
        settle({ error: { kind: 'unavailable', retryable: true } });
      }
    })();
  });
}

export function clearRun() { ctrl?.abort(); set(null); }
