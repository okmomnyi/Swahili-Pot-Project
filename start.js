#!/usr/bin/env node
'use strict';

/*
 * SwahiliPot IMS — one-command dev launcher.
 *
 * Starts the backend (Express API) and the frontend (Vite) together, with
 * colour-prefixed logs, and stops both cleanly on Ctrl+C. Cross-platform
 * (Windows / macOS / Linux) and needs no extra dependencies — just Node.
 *
 *   node start.js          (or)   npm run dev
 *
 * First time? Install dependencies once with:   npm run install:all
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const procs = [
  { name: 'server', cwd: path.join(__dirname, 'server'), color: '\x1b[36m' }, // cyan
  { name: 'client', cwd: path.join(__dirname, 'client'), color: '\x1b[32m' }, // green
];

// Make sure dependencies are installed before trying to run.
for (const p of procs) {
  if (!fs.existsSync(path.join(p.cwd, 'node_modules'))) {
    console.error(
      `\n[!] ${p.name} dependencies are not installed.\n` +
        `    Run this once first:  npm run install:all\n`
    );
    process.exit(1);
  }
}

const children = [];
let shuttingDown = false;

function killChild(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    // Kill the whole process tree (npm spawns node/vite as grandchildren).
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      /* ignore */
    }
  } else {
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nStopping SwahiliPot IMS…');
  children.forEach(killChild);
  // Give children a moment to die, then exit.
  setTimeout(() => process.exit(code), 400);
}

function prefixStream(stream, out, prefix) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) out.write(`${prefix}${line}\n`);
  });
}

function run({ name, cwd, color }) {
  const prefix = `${color}[${name}]${RESET} `;
  // shell:true so "npm" resolves on every OS (npm.cmd on Windows).
  const child = spawn('npm', ['run', 'dev'], { cwd, shell: true });
  prefixStream(child.stdout, process.stdout, prefix);
  prefixStream(child.stderr, process.stderr, prefix);
  child.on('exit', (exitCode) => {
    if (!shuttingDown) {
      console.log(`${prefix}process exited (code ${exitCode}); shutting everything down.`);
      shutdown(exitCode || 0);
    }
  });
  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Starting SwahiliPot IMS — backend + frontend. Press Ctrl+C to stop.\n');
procs.forEach(run);
