#!/usr/bin/env node
// One command for a local demo with photo reading:
//   npm run demo
// Starts the Gemma bridge (needs Ollama + gemma4:e2b) and the app, and prints the address for a phone
// on the same Wi-Fi. The phone's photo goes to /gemma on this laptop, which the dev server proxies to the bridge.
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const model = process.env.GEMMA_MODEL ?? 'gemma4:e2b';
const ollama = process.env.OLLAMA_URL ?? 'http://localhost:11434';

try {
  const tags = await (await fetch(`${ollama}/api/tags`)).json();
  const ok = (tags.models ?? []).some((m) => m.name === model || m.model === model);
  console.log(ok ? `✓ Ollama is running with ${model}` : `! Ollama is running but ${model} is missing. Run: ollama pull ${model}`);
} catch {
  console.log(`! Ollama is not reachable at ${ollama}. Open the Ollama app, or run: ollama serve`);
  console.log('  The app still works; the photo button stays hidden until Gemma is available.');
}

const run = (name, args) => {
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  const tag = (s) => s.toString().split(/\r?\n/).filter(Boolean).map((l) => `[${name}] ${l}`).join('\n');
  child.stdout.on('data', (d) => console.log(tag(d)));
  child.stderr.on('data', (d) => console.error(tag(d)));
  child.on('exit', (code) => {
    console.log(`[${name}] exited (${code})`);
    process.exit(code ?? 0);
  });
  return child;
};

const children = [
  run('gemma', ['server/gemma-bridge.mjs']),
  run('app', ['node_modules/vite/bin/vite.js', '--host', '--port', '5173']),
];

const ips = Object.values(networkInterfaces()).flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
setTimeout(() => {
  console.log('\n  Open on this laptop:  http://localhost:5173');
  for (const ip of ips) console.log(`  Open on your phone:   http://${ip}:5173   (same Wi-Fi / hotspot)`);
  console.log('  Press Ctrl+C to stop.\n');
}, 1500);

const stop = () => { for (const c of children) c.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
