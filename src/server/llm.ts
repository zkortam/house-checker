import { spawn } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude, two ways. With ANTHROPIC_API_KEY set (the hosted site), the Messages API with structured output
 * (model HC_MODEL, default claude-haiku-5-5). Otherwise the local Claude Code CLI (the user's subscription).
 * `claude -p --output-format json --json-schema <schema> --tools "" -- <prompt>`; the structured result is in
 * `structured_output` (or `result` as a JSON string). Timeout, one retry, at most 3 at once, and the caller
 * always passes a deterministic fallback so the app works when the CLI is missing or slow.
 * Set HC_LLM=off to skip the CLI entirely (tests, offline demos).
 */

const MAX_CONCURRENT = 3;
let active = 0;
const queue: Waiter[] = [];

/**
 * A slot for one CLI call. Background calls (the permit reader) may use all but one slot, so the writer, which is on
 * the user's critical path, always has one free. `first` also jumps the queue; gives up after maxWaitMs.
 */
type Waiter = { first: boolean; take: () => void };
const cap = () => (process.env.ANTHROPIC_API_KEY ? 8 : MAX_CONCURRENT); // the API takes more at once than the local CLI
const can = (first: boolean) => active < (first ? cap() : cap() - 1);
async function acquire(first = false, maxWaitMs = Infinity): Promise<boolean> {
  if (can(first)) { active++; return true; }
  return new Promise<boolean>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const w: Waiter = { first, take: () => { if (timer) clearTimeout(timer); active++; resolve(true); } };
    if (first) queue.unshift(w); else queue.push(w);
    if (Number.isFinite(maxWaitMs)) timer = setTimeout(() => { const i = queue.indexOf(w); if (i >= 0) queue.splice(i, 1); resolve(false); }, maxWaitMs);
  });
}
function release(): void {
  active--;
  const i = queue.findIndex((w) => can(w.first));
  if (i >= 0) queue.splice(i, 1)[0].take();
}

export function llmEnabled(): boolean {
  return (process.env.HC_LLM ?? 'on') !== 'off' && process.env.NODE_ENV !== 'test' && !process.env.VITEST;
}

/** Which backend runs the calls: the API when a key is set, else the local CLI. */
export function llmBackend(): 'api' | 'cli' { return process.env.ANTHROPIC_API_KEY ? 'api' : 'cli'; }

/** Structured outputs need additionalProperties:false on every object and no numeric or length constraints. */
function apiSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(apiSchema);
  if (!s || typeof s !== 'object') return s;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
    if (['maxItems', 'minItems', 'maxLength', 'minLength', 'minimum', 'maximum', 'multipleOf'].includes(k)) continue;
    out[k] = k === 'properties' ? Object.fromEntries(Object.entries(v as object).map(([pk, pv]) => [pk, apiSchema(pv)])) : apiSchema(v);
  }
  const t = out.type;
  if (t === 'object' || (Array.isArray(t) && t.includes('object'))) out.additionalProperties = false;
  // A nullable enum ({type:[X,'null'], enum:[..., null]}) must be written as anyOf for structured outputs.
  if (Array.isArray(t) && Array.isArray(out.enum) && t.includes('null')) {
    const { type: _t, enum: values, ...rest } = out as { type: string[]; enum: unknown[] };
    const other = t.filter((x) => x !== 'null');
    return { ...rest, anyOf: [{ type: other.length === 1 ? other[0] : other, enum: values.filter((v) => v !== null) }, { type: 'null' }] };
  }
  return out;
}

let client: Anthropic | null = null;
async function runApi(schema: object, prompt: string, timeoutMs: number, system?: string): Promise<unknown> {
  client ??= new Anthropic({ maxRetries: 1 });
  const res = await client.messages.create({
    model: process.env.HC_MODEL || 'claude-haiku-5-5',
    max_tokens: 16000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: apiSchema(schema) as Record<string, unknown> } },
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: prompt }],
  }, { timeout: timeoutMs });
  if (res.stop_reason === 'refusal') throw new Error('model declined');
  if (res.stop_reason === 'max_tokens') throw new Error('model ran out of tokens');
  const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return JSON.parse(text);
}

export interface LlmOpts { timeoutMs?: number; retries?: number; system?: string; first?: boolean; maxWaitMs?: number }

function runOnce(schema: object, prompt: string, timeoutMs: number, system?: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const bin = process.env.CLAUDE_BIN || 'claude';
    const args = ['-p', '--output-format', 'json', '--no-session-persistence', '--json-schema', JSON.stringify(schema), '--tools', ''];
    if (system) args.push('--system-prompt', system);
    args.push('--', prompt);
    const child = spawn(/*turbopackIgnore: true*/ bin, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`claude CLI timed out after ${timeoutMs} ms`)); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(out);
        if (parsed.is_error) return reject(new Error(`claude CLI error: ${parsed.subtype ?? ''} ${String(parsed.result ?? '').slice(0, 200)}`));
        if (parsed.structured_output != null) return resolve(parsed.structured_output);
        if (typeof parsed.result === 'string') return resolve(JSON.parse(parsed.result));
        reject(new Error('claude CLI returned no structured output'));
      } catch (e) {
        reject(new Error(`claude CLI exit ${code}: ${(err || out).slice(0, 300)} ${(e as Error).message}`));
      }
    });
  });
}

/** Structured call with fallback. `validate` may reject an answer (copy rules, invented numbers); a rejected answer is retried once. */
export async function llmJson<T>(schema: object, prompt: string, fallback: () => T, opts: LlmOpts & { validate?: (v: T) => boolean } = {}): Promise<{ value: T; source: 'model' | 'fallback' }> {
  if (!llmEnabled()) return { value: fallback(), source: 'fallback' };
  const tries = 1 + (opts.retries ?? 1);
  for (let i = 0; i < tries; i++) {
    if (!(await acquire(opts.first, opts.maxWaitMs))) break; // no slot in time: the fallback keeps the run moving
    try {
      const run = llmBackend() === 'api' ? runApi : runOnce;
      const v = (await run(schema, prompt, opts.timeoutMs ?? 90_000, opts.system)) as T;
      if (!opts.validate || opts.validate(v)) return { value: v, source: 'model' };
    } catch (e) {
      if (process.env.HC_DEBUG) console.warn('[llm]', (e as Error).message);
    } finally {
      release();
    }
  }
  return { value: fallback(), source: 'fallback' };
}
