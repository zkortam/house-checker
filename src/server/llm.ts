import { spawn } from 'node:child_process';

/**
 * Claude through the local Claude Code CLI (the user's subscription). No API key, no SDK.
 * `claude -p --output-format json --json-schema <schema> --tools "" -- <prompt>`; the structured result is in
 * `structured_output` (or `result` as a JSON string). Timeout, one retry, at most 3 at once, and the caller
 * always passes a deterministic fallback so the app works when the CLI is missing or slow.
 * Set HC_LLM=off to skip the CLI entirely (tests, offline demos).
 */

const MAX_CONCURRENT = 3;
let active = 0;
const queue: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) { active++; return; }
  await new Promise<void>((resolve) => queue.push(resolve));
  active++;
}
function release(): void { active--; const next = queue.shift(); if (next) next(); }

export function llmEnabled(): boolean {
  return (process.env.HC_LLM ?? 'on') !== 'off' && process.env.NODE_ENV !== 'test' && !process.env.VITEST;
}

export interface LlmOpts { timeoutMs?: number; retries?: number; system?: string }

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
    await acquire();
    try {
      const v = (await runOnce(schema, prompt, opts.timeoutMs ?? 90_000, opts.system)) as T;
      if (!opts.validate || opts.validate(v)) return { value: v, source: 'model' };
    } catch (e) {
      if (process.env.HC_DEBUG) console.warn('[llm]', (e as Error).message);
    } finally {
      release();
    }
  }
  return { value: fallback(), source: 'fallback' };
}
