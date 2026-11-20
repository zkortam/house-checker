import { describe, expect, it } from 'vitest';
import { checkCopy } from '@contract/copy';
import { S } from '@/ui/strings.en';

describe('strings.en.ts', () => {
  it('every UI string passes checkCopy and stays under 110 characters', () => {
    const problems = Object.entries(S).flatMap(([k, v]) => checkCopy(v, { maxLength: 110 }).map((p) => `${k}: ${p.rule} (${p.match})`));
    expect(problems).toEqual([]);
  });
  it('has no em dash', () => {
    expect(Object.values(S).filter((v) => v.includes('—'))).toEqual([]);
  });
});
