import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIXTURES } from '@contract/fixtures';
import { Verdict } from '../../src/ui/report/sections';

/** The verdict renders while the answer streams in, before the report exists (report === null). */
describe('Verdict while streaming', () => {
  it('renders with report null', () => {
    const html = renderToStaticMarkup(createElement(Verdict, { report: null, answer: 'Records show 2 units [1].', streaming: true }));
    expect(html).toContain('Records show');
  });
  it('says fixed rules when answerBy is rules, AI otherwise', () => {
    const r = FIXTURES[0].report;
    expect(renderToStaticMarkup(createElement(Verdict, { report: { ...r, answerBy: 'rules' } as typeof r, answer: '', streaming: false }))).toContain('fixed rules');
    expect(renderToStaticMarkup(createElement(Verdict, { report: r, answer: '', streaming: false }))).toContain('Written by AI');
  });
});
