import type { Report, StepEvent } from '../types';
import { report2055, steps2055 } from './2055-42nd-ave';
import { report57, steps57 } from './57-carmelita-st';

/** Both golden fixtures, with a matcher on listing text or address. */
export const FIXTURES: Array<{ key: string; match: RegExp; report: Report; steps: StepEvent[] }> = [
  { key: '2055-42nd-ave', match: /2055\s*a?\s*42nd/i, report: report2055, steps: steps2055 },
  { key: '57-carmelita-st', match: /\b57\s+carmelita/i, report: report57, steps: steps57 },
];

export function findFixture(text: string) {
  return FIXTURES.find((f) => f.match.test(text)) ?? null;
}

export { report2055, steps2055, report57, steps57 };
