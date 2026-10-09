// Builds the preview and writes dist-preview/capacity-desk-preview.html: a page
// fragment (title, styles, root element, script) with no <html>, <head> or <body> of
// its own, which is the form a hosting page that supplies its own skeleton expects.
//
//   npm run preview:page

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', '--config', 'preview/vite.config.ts'], {
  cwd: root, stdio: 'inherit', shell: process.platform === 'win32',
});

const built = readFileSync(new URL('../dist-preview/preview/index.html', import.meta.url), 'utf8');
const styles = [...built.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const scripts = [...built.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((code) => code.trim());
if (!styles || scripts.length === 0) throw new Error('The single-file build did not inline its styles or script.');

const page = [
  '<title>Capacity Desk</title>',
  `<style>${styles}</style>`,
  '<div id="root"></div>',
  ...scripts.map((code) => `<script type="module">${code}</script>`),
].join('\n');

const out = new URL('../dist-preview/capacity-desk-preview.html', import.meta.url);
writeFileSync(out, page);
console.log(`Wrote ${fileURLToPath(out)} (${(page.length / 1_000_000).toFixed(2)} MB)`);
