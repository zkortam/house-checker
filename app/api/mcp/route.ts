import { INSTRUCTIONS, PROTOCOL_VERSIONS, SERVER_INFO, TOOLS, callTool } from '@/server/mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/mcp: a stateless MCP server over Streamable HTTP (JSON-RPC 2.0, JSON responses, no sessions).
 * Optional HC_MCP_TOKEN: when set, clients must send "Authorization: Bearer <token>".
 */

type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, mcp-protocol-version, mcp-session-id', 'access-control-allow-methods': 'POST, GET, OPTIONS' };

const ok = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const err = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function handle(msg: Rpc, base: string): Promise<object | null> {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg?.id, -32600, 'Invalid request');
  const isNotification = msg.id === undefined;
  switch (msg.method) {
    case 'initialize': {
      const asked = String(msg.params?.protocolVersion ?? '');
      return ok(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping': return ok(msg.id, {});
    case 'tools/list': return ok(msg.id, { tools: TOOLS });
    case 'tools/call': {
      const name = String(msg.params?.name ?? '');
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        return ok(msg.id, await callTool(name, args, base));
      } catch (e) {
        const code = (e as { code?: number }).code ?? -32603;
        return code === -32602 ? err(msg.id, code, (e as Error).message) : ok(msg.id, { content: [{ type: 'text', text: 'House Checker could not finish that check. Try again in a minute.' }], isError: true });
      }
    }
    case 'resources/list': return ok(msg.id, { resources: [] });
    case 'prompts/list': return ok(msg.id, { prompts: [] });
    default:
      return isNotification ? null : err(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: Request): Promise<Response> {
  const token = process.env.HC_MCP_TOKEN;
  if (token && req.headers.get('authorization') !== `Bearer ${token}`) return Response.json(err(null, -32001, 'Unauthorized'), { status: 401, headers: CORS });
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json(err(null, -32700, 'Parse error'), { status: 400, headers: CORS }); }
  const base = new URL(req.url).origin;
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]) as Rpc[];
  const replies = (await Promise.all(msgs.map((m) => handle(m, base)))).filter(Boolean);
  if (!replies.length) return new Response(null, { status: 202, headers: CORS }); // notifications only
  return Response.json(batch ? replies : replies[0], { headers: { ...CORS, 'cache-control': 'no-store' } });
}

/** No server-initiated stream: this server only answers requests. */
export async function GET(): Promise<Response> {
  return new Response('House Checker MCP server. POST JSON-RPC to this URL.', { status: 405, headers: { ...CORS, allow: 'POST, OPTIONS' } });
}

export async function DELETE(): Promise<Response> { return new Response(null, { status: 405, headers: CORS }); }
export async function OPTIONS(): Promise<Response> { return new Response(null, { status: 204, headers: CORS }); }
