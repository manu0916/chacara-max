import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../dist/', import.meta.url);
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(new URL('../public/', import.meta.url), output, { recursive: true });
const result = spawnSync(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'pages', 'functions', 'build',
  'functions', '--outfile=dist/_worker.js',
], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
