import { beforeAll, describe, expect, it } from 'vitest';
import { FIXTURES } from '../../src/contract/fixtures';
import { mockStream } from '../../src/contract/mock-stream';
import type { StreamEvent } from '../../src/contract/types';
import { offline, run } from '../server/helpers';

beforeAll(() => offline());

/** Event types with consecutive repeats collapsed: run, step, progress, delta, report, done. */
const shape = (events: StreamEvent[]) => events.map((e) => e.type).filter((t, i, a) => i === 0 || a[i - 1] !== t);

describe.each(FIXTURES.map((f) => [f.key, f] as const))('stream order, %s', (_k, f) => {
  it('yields the same event types in the same order as mockStream', async () => {
    const mock: StreamEvent[] = [];
    for await (const e of mockStream(f.report, f.steps, { speed: 10_000 })) mock.push(e);
    const { events } = await run(f.report.listing.text);
    expect(shape(events)).toEqual(shape(mock));
    expect(events.at(-1)?.type).toBe('done');
    // Same step ids; every step runs, then ends done or failed; progress only once no step is running.
    const stepIds = (es: StreamEvent[]) => [...new Set(es.filter((e) => e.type === 'step').map((e) => (e as { id: string }).id))].sort();
    expect(stepIds(events)).toEqual(stepIds(mock));
    const open = new Set<string>();
    for (const e of events) {
      if (e.type === 'step') { if (e.status === 'running') open.add(e.id); else open.delete(e.id); }
      if (e.type === 'progress') expect([...open]).toEqual([]);
    }
    const report = events.find((e) => e.type === 'report') as { report: { answer: string } };
    expect(events.filter((e) => e.type === 'delta').map((e) => (e as { text: string }).text).join('')).toBe(report.report.answer);
  });
});
