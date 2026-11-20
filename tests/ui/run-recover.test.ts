import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Report, StreamEvent } from '@contract/types';
import { FIXTURES } from '@contract/fixtures';

const report = FIXTURES[0].report as Report;
let script: StreamEvent[] = [];
const getReport = vi.fn(async () => ({ ok: true as const, value: report }));

vi.mock('../../src/ui/api', () => ({
  runCheck: async function* () { for (const ev of script) yield ev; },
  getReport: (...a: unknown[]) => getReport(...(a as [])),
}));

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.window = { addEventListener() {}, removeEventListener() {} };
  if (!('navigator' in globalThis) || (globalThis.navigator as Navigator).onLine === undefined) {
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  }
});

const settle = () => new Promise((r) => setTimeout(r, 20));

describe('run store: a dropped stream after the run started', () => {
  it('fetches the finished report instead of failing', async () => {
    const { startRun, getRun } = await import('../../src/ui/lib/run-store');
    script = [
      { type: 'run', runId: 'r1', reportId: report.id, address: report.address },
      { type: 'error', error: { kind: 'offline', retryable: true } },
    ];
    const r = await startRun('2055 42nd Ave');
    expect(r).toEqual({ reportId: report.id });
    await settle();
    expect(getReport).toHaveBeenCalledWith(report.id);
    expect(getRun()?.status).toBe('done');
    expect(getRun()?.report?.id).toBe(report.id);
    expect(getRun()?.reconnecting).toBe(false);
  });

  it('still fails at once when the error comes before the run exists', async () => {
    const { startRun, getRun } = await import('../../src/ui/lib/run-store');
    getReport.mockClear();
    script = [{ type: 'error', error: { kind: 'offline', retryable: true } }];
    const r = await startRun('2055 42nd Ave');
    expect(r).toEqual({ error: { kind: 'offline', retryable: true } });
    expect(getRun()?.status).toBe('error');
    expect(getReport).not.toHaveBeenCalled();
  });
});
