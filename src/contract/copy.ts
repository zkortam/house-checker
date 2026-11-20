/**
 * Copy rules (Surf copy-and-voice + internationalisation). Plan A runs checkCopy() on every model- or
 * rule-written string before it enters a Report; Plan B runs it over strings.en.ts in a unit test.
 * Drafted emails are the buyer's own voice and are exempt from the first-person rule only.
 */
export interface CopyProblem { rule: string; match: string }

const RULES: Array<{ rule: string; re: RegExp; exemptInEmail?: boolean }> = [
  { rule: 'no em dash (use the EMPTY_VALUE glyph only for a missing value)', re: /—/ },
  { rule: 'no exclamation marks', re: /!/ },
  { rule: 'no we/our/us', re: /\b(we|our|us|we're|we've)\b/i, exemptInEmail: true },
  { rule: 'no please/simply/just', re: /\b(please|simply|just)\b/i, exemptInEmail: true },
  { rule: 'no "Something went wrong"', re: /something went wrong/i },
  { rule: 'no "successfully"', re: /successfully/i },
  { rule: 'no N/A', re: /\bN\/A\b/ },
  { rule: 'no (s) plurals', re: /\w\(s\)/ },
  { rule: 'no "illegal" or "misrepresented" about a listing', re: /\b(illegal(ly)? (listing|sale)|misrepresent)/i },
  { rule: 'no markdown', re: /(\*\*|__|^#+\s|`)/m },
];

export function checkCopy(text: string, opts: { email?: boolean; maxLength?: number } = {}): CopyProblem[] {
  const problems: CopyProblem[] = [];
  for (const r of RULES) {
    if (opts.email && r.exemptInEmail) continue;
    const m = text.match(r.re);
    if (m) problems.push({ rule: r.rule, match: m[0] });
  }
  if (opts.maxLength && text.length > opts.maxLength) problems.push({ rule: `at most ${opts.maxLength} characters`, match: text.slice(0, 40) });
  return problems;
}

/** Every [n] must point at an existing source (1-based). */
export function checkCitations(text: string, sourceCount: number): CopyProblem[] {
  const out: CopyProblem[] = [];
  for (const m of text.matchAll(/\[(\d+)\]/g)) {
    const n = Number(m[1]);
    if (n < 1 || n > sourceCount) out.push({ rule: 'citation points at no source', match: m[0] });
  }
  return out;
}
