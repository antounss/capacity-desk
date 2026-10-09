// Writes the privacy policy as Markdown and as a standalone HTML page, from the same
// JSON the app shows in Settings > About. One source, so the hosted policy and the
// in-app policy cannot disagree.
//
//   node scripts/build-privacy.mjs

import { readFileSync, writeFileSync } from 'node:fs';

const policy = JSON.parse(readFileSync(new URL('../src/content/privacy.json', import.meta.url), 'utf8'));
const out = (name) => new URL(`../docs/store/${name}`, import.meta.url);
const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const markdown = [
  `# ${policy.title}`,
  '',
  `Effective ${policy.effectiveDate}`,
  '',
  policy.summary,
  '',
  ...policy.sections.flatMap((s) => [
    `## ${s.heading}`,
    '',
    ...s.body.flatMap((line) => [line, '']),
    ...s.list.map((line) => `- ${line}`),
    ...(s.list.length ? [''] : []),
    ...s.after.flatMap((line) => [line, '']),
  ]),
].join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(policy.title)}</title>
<style>
  body { font-family: system-ui, sans-serif; line-height: 1.55; max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem; color: #16202e; background: #fff; }
  h1 { font-size: 1.8rem; line-height: 1.2; } h2 { font-size: 1.2rem; margin-top: 2rem; }
  .date { color: #566273; }
  @media (prefers-color-scheme: dark) { body { background: #0f151b; color: #e8edf2; } .date { color: #9aa7b5; } }
</style>
</head>
<body>
<h1>${escape(policy.title)}</h1>
<p class="date">Effective ${escape(policy.effectiveDate)}</p>
<p>${escape(policy.summary)}</p>
${policy.sections.map((s) => [
    `<h2>${escape(s.heading)}</h2>`,
    ...s.body.map((line) => `<p>${escape(line)}</p>`),
    ...(s.list.length ? ['<ul>', ...s.list.map((line) => `  <li>${escape(line)}</li>`), '</ul>'] : []),
    ...s.after.map((line) => `<p>${escape(line)}</p>`),
  ].join('\n')).join('\n')}
</body>
</html>
`;

writeFileSync(out('privacy-policy.md'), markdown);
writeFileSync(out('privacy-policy.html'), html);
console.log('Wrote docs/store/privacy-policy.md and privacy-policy.html');
