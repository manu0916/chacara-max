import { cpSync, mkdirSync, rmSync } from 'node:fs';
const output = new URL('../dist/', import.meta.url);
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(new URL('../public/', import.meta.url), output, { recursive: true });
// Git-connected Pages and `wrangler pages deploy` compile the root functions/
// directory themselves. Do not write the CLI's multipart upload bundle as a
// JavaScript file named dist/_worker.js.
console.log('Static assets ready in dist/. Pages will compile functions/.');
