#!/usr/bin/env node
// List the tools each MCP server in an embedded agent's .mcp.json offers, beside the ones its
// `allowedTools` grants today. Connects to each server the way the wrapper does (src/lib/agent-mcp.ts)
// and asks it for its tools. Run from the app repo root after reviewing its MCP endpoints and
// executables:
//   node --env-file=.env <skill dir>/scripts/discover-mcp-tools.mjs <agent>
// It writes nothing: grant only the tools the agent's job needs, by editing `allowedTools`.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const agent = process.argv[2];
if (!agent || !/^[a-z0-9][a-z0-9-]*$/.test(agent)) {
  console.error('Usage: discover-mcp-tools.mjs <agent>');
  process.exit(2);
}
const file = join(resolve(process.cwd(), '.claude', 'agents', agent), '.mcp.json');
if (!existsSync(file)) {
  console.log(`${agent} has no .mcp.json: nothing to discover.`);
  process.exit(0);
}

const resolveFromApp = createRequire(resolve('package.json')).resolve;
const [{ Client }, { StdioClientTransport }, { StreamableHTTPClientTransport }] = await Promise.all([
  import(pathToFileURL(resolveFromApp('@modelcontextprotocol/sdk/client/index.js')).href),
  import(pathToFileURL(resolveFromApp('@modelcontextprotocol/sdk/client/stdio.js')).href),
  import(pathToFileURL(resolveFromApp('@modelcontextprotocol/sdk/client/streamableHttp.js')).href),
]);

const missing = new Set();
const expand = (v) =>
  typeof v === 'string' ? v.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, n) => process.env[n] || (missing.add(n), ''))
    : Array.isArray(v) ? v.map(expand)
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, expand(x)]))
        : v;

let failed = false;
let servers;
try {
  servers = JSON.parse(readFileSync(file, 'utf8')).mcpServers ?? {};
} catch {
  console.error('Could not read the app agent MCP configuration as JSON.');
  process.exit(1);
}
for (const [name, declared] of Object.entries(servers)) {
  const { allowedTools: granted = [], ...server } = declared;
  missing.clear();
  const s = expand(server);
  console.log(`\n${name}`);
  if (missing.size) { failed = true; console.log(`  not started: ${[...missing].join(', ')} not set`); continue; }
  const client = new Client({ name: `discover-${name}`, version: '1.0.0' });
  try {
    await client.connect(s.type === 'http'
      ? new StreamableHTTPClientTransport(new URL(s.url), { requestInit: { headers: s.headers } })
      : new StdioClientTransport({ command: s.command, args: s.args, env: s.env, stderr: 'ignore' }));
    const found = [];
    let cursor;
    do {
      const page = await client.listTools(cursor ? { cursor } : undefined);
      found.push(...page.tools.map((t) => t.name));
      cursor = page.nextCursor;
    } while (cursor);
    for (const t of found) console.log(`  ${granted.includes(t) ? 'granted  ' : 'available'} ${t}`);
    for (const t of granted.filter((g) => !found.includes(g))) console.log(`  STALE    ${t}  (granted, but the server no longer offers it)`);
  } catch {
    failed = true;
    console.log('  could not discover tools; check the endpoint, credentials and command in the app environment');
  } finally {
    await client.close().catch(() => {});
  }
}
process.exit(failed ? 1 : 0);
