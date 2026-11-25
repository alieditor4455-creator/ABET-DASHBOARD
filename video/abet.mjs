#!/usr/bin/env node
/**
 * Calls an ABET Content OS connector tool without a claude.ai connector.
 * Usage: node video/abet.mjs <tool> '<json arguments>'
 * The worker's key (x-abet-worker-key) is added by the Claude Code environment's network proxy;
 * it is never stored in this repository or visible to the session.
 */
const [tool, json = '{}'] = process.argv.slice(2);
if (!tool) { console.error("Usage: node video/abet.mjs <tool> '<json arguments>'  (tool 'list' lists tools)"); process.exit(2); }
const base = process.env.ABET_URL ?? 'https://abet-dashboard.netlify.app';
const body = tool === 'list'
  ? { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }
  : { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: JSON.parse(json) } };
// curl always goes through the environment's proxy, which overwrites this placeholder with the real key.
import { execFileSync } from 'node:child_process';
let out;
try {
  out = execFileSync('curl', ['-sS', '-m', '120', '-w', '\n%{http_code}', '-X', 'POST', `${base}/mcp`, '-H', 'content-type: application/json', '-H', 'x-abet-worker-key: proxy-injected', '--data-binary', '@-'],
    { input: JSON.stringify(body), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
} catch (e) { console.error(`Couldn't reach the dashboard: ${e.message.split('\n')[0]}`); process.exit(1); }
const cut = out.lastIndexOf('\n'); const text = out.slice(0, cut); const r = { status: Number(out.slice(cut + 1)) };
let j; try { j = JSON.parse(text); } catch { console.error(`HTTP ${r.status}: ${text.slice(0, 300)}`); process.exit(1); }
if (r.status === 401) { console.error('Not signed in: the worker key is missing or wrong on this environment (network secret for abet-dashboard.netlify.app, header x-abet-worker-key).'); process.exit(1); }
if (j.error) { console.error(j.error.message); process.exit(1); }
if (tool === 'list') { console.log(j.result.tools.map((t) => `${t.name}: ${t.title}`).join('\n')); process.exit(0); }
const res = j.result;
if (res.isError) { console.error(res.content?.[0]?.text ?? 'Tool error'); process.exit(1); }
console.log(JSON.stringify(res.structuredContent ?? res.content?.[0]?.text, null, 2));
