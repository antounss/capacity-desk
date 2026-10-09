// Regenerates every icon and splash image from the one mark defined below.
// Only needed when the icon changes; the generated files are committed.
//
//   npm install --save-dev sharp
//   node scripts/make-icons.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sharp = createRequire(import.meta.url)('sharp');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(root, 'android/app/src/main/res');

const BRAND = '#0b6e5f';

// The mark: three ledger rows of shrinking length, and hatching where hours are still free.
// Drawn in a 56 x 48 box.
const MARK = `
  <rect x="0" y="0" width="56" height="12" rx="2" fill="#fff"/>
  <rect x="0" y="18" width="40" height="12" rx="2" fill="#fff" opacity="0.75"/>
  <rect x="0" y="36" width="24" height="12" rx="2" fill="#fff" opacity="0.5"/>
  <g stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.9">
    <path d="M30 47 L39 37"/><path d="M38 47 L47 37"/><path d="M46 47 L55 37"/>
  </g>`;

/** The mark centred in a `size` x `size` square at `scale`, over an optional background shape. */
function svg(size, scale, background = '') {
  const x = (size - 56 * scale) / 2;
  const y = (size - 48 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${background}<g transform="translate(${x} ${y}) scale(${scale})">${MARK}</g></svg>`;
}

const square = (size, radius) => `<rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND}"/>`;
const circle = (size) => `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${BRAND}"/>`;

async function png(svgText, size, file) {
  mkdirSync(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svgText), { density: 300 }).resize(size, size).png().toFile(file);
}

// Launcher icons. The adaptive foreground keeps the mark inside the 66dp safe zone of
// the 108dp canvas, so no launcher mask can clip it.
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, factor] of Object.entries(densities)) {
  const dir = path.join(res, `mipmap-${name}`);
  await png(svg(108, 0.8), Math.round(108 * factor), path.join(dir, 'ic_launcher_foreground.png'));
  await png(svg(108, 1.15, square(108, 22)), Math.round(48 * factor), path.join(dir, 'ic_launcher.png'));
  await png(svg(108, 1.0, circle(108)), Math.round(48 * factor), path.join(dir, 'ic_launcher_round.png'));
}

// Splash screens: the brand colour with the mark in the middle.
const splash = {
  'drawable': [480, 320],
  'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280],
  'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920],
};
for (const [dir, [width, height]] of Object.entries(splash)) {
  const markSize = Math.round(Math.min(width, height) * 0.3);
  const mark = await sharp(Buffer.from(svg(108, 1.4)), { density: 300 }).resize(markSize, markSize).png().toBuffer();
  await sharp({ create: { width, height, channels: 4, background: BRAND } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toFile(path.join(res, dir, 'splash.png'));
}

// The in-app icon and the Google Play listing icon (512 x 512, full square: Play rounds it).
writeFileSync(path.join(root, 'public/icon.svg'), svg(108, 1.0, square(108, 0)));
await png(svg(108, 1.0, square(108, 0)), 512, path.join(root, 'docs/store/graphics/play-icon-512.png'));

console.log('Icons and splash screens written.');
