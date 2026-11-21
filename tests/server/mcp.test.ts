import { describe, expect, it } from 'vitest';
import { POST } from '../../app/api/mcp/route';

const call = (body: unknown) => POST(new Request('http://localhost/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

describe('MCP endpoint', () => {
  it('initializes with the asked protocol version and lists the tools', async () => {
    const init = await (await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {} } })).json();
    expect(init.result.protocolVersion).toBe('2025-03-26');
    expect(init.result.capabilities.tools).toBeTruthy();
    const list = await (await call({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json();
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(['check_home', 'get_report']);
  });
  it('accepts notifications with 202 and rejects unknown methods', async () => {
    expect((await call({ jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(202);
    const r = await (await call({ jsonrpc: '2.0', id: 3, method: 'nope' })).json();
    expect(r.error.code).toBe(-32601);
  });
  it('returns a tool error for an empty listing', async () => {
    const r = await (await call({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'check_home', arguments: { listing: '' } } })).json();
    expect(r.result.isError).toBe(true);
  });
});
