import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const clientRoot = resolve(root, 'client');
const viteCli = resolve(clientRoot, 'node_modules/vite/bin/vite.js');
const apiHealth = 'http://127.0.0.1:3001/api/health';
const appUrl = 'http://127.0.0.1:5173';
const frontendRoot = 'http://127.0.0.1:5173/';
const children = [];
let stopping = false;

function stopChildren() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
}

process.on('SIGINT', stopChildren);
process.on('SIGTERM', stopChildren);

async function checkApiHealth() {
  try {
    const response = await fetch(apiHealth, { signal: AbortSignal.timeout(800) });
    if (!response.ok) return false;
    const data = await response.json();
    return data.ok === true && data.sandbox === true && data.apiVersion === 3;
  } catch {
    return false;
  }
}

async function checkFrontend() {
  try {
    const response = await fetch(frontendRoot, { signal: AbortSignal.timeout(800) });
    return response.ok && (await response.text()).includes('<div id="root">');
  } catch {
    return false;
  }
}

function startNode(args, cwd) {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', windowsHide: true });
  children.push(child);
  return child;
}

async function waitForApi(backend) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    if (await checkApiHealth()) return true;
    if (backend.exitCode !== null) break;
    await delay(250);
  }
  return false;
}

async function main() {
  if (!existsSync(viteCli)) throw new Error('Frontend dependencies are missing. Run `npm --prefix client install` first.');

  const alreadyReady = await checkApiHealth();
  if (!alreadyReady) {
    const backend = startNode(['server/index.js'], root);
    if (!await waitForApi(backend)) {
      stopChildren();
      throw new Error('Could not start the backend on port 3001. Close any stale SupplyPilot backend and run `npm start` again.');
    }
    console.log('SupplyPilot backend ready on http://127.0.0.1:3001');
  } else {
    console.log('Using the current SupplyPilot backend on port 3001.');
  }

  if (await checkFrontend()) {
    console.log(`Using the current SupplyPilot frontend at ${appUrl}`);
  } else {
    console.log(`Starting SupplyPilot frontend at ${appUrl}`);
    const frontend = startNode([viteCli, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], clientRoot);
    frontend.on('error', error => {
      console.error(`Frontend could not start: ${error.message}`);
      stopChildren();
      process.exitCode = 1;
    });
    frontend.on('exit', code => {
      stopChildren();
      if (code && code !== 0) process.exitCode = code;
    });
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
