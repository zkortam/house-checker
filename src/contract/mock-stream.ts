import type { Report, StreamEvent, StepEvent } from './types';

/**
 * Replays a fixture Report as the exact StreamEvent sequence Plan A's /api/check emits.
 * Plan B builds against this (NEXT_PUBLIC_MOCK=1); Plan A's contract test asserts its real stream
 * produces the same event types in the same order for the same fixture address.
 */
export async function* mockStream(report: Report, steps: StepEvent[], opts: { failStep?: string; speed?: number } = {}): AsyncGenerator<StreamEvent> {
  const speed = opts.speed ?? 1;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms / speed));
  yield { type: 'run', runId: 'mock-run', reportId: report.id, address: report.address };
  for (const s of steps) yield { ...s, status: 'running', detail: undefined };
  for (const s of steps) {
    await wait(250 + Math.random() * 350);
    if (s.id === opts.failStep) yield { ...s, status: 'failed', reason: `Couldn't reach ${s.title.replace(/^Read /, '')}`, retryable: true };
    else yield { ...s, status: 'done' };
  }
  yield { type: 'progress', text: 'Comparing with the listing' };
  for (const word of report.answer.split(/(?<= )/)) { await wait(25); yield { type: 'delta', text: word }; }
  yield { type: 'report', report };
  yield { type: 'done' };
}
