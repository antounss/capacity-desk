// End-to-end smoke test: drives the built app in a real browser, the way a user would.
// It is optional and not part of `npm test`.
//
//   npm install --save-dev playwright      (once; then: npx playwright install chromium)
//   npm run build && npm run preview                (in one terminal)
//   npm run e2e                                    (in another)
//
// Set CHROMIUM=/path/to/chrome to use an already-installed browser.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const URL = process.env.APP_URL || 'http://localhost:4173/';
const SAMPLE = path.join(__dirname, '..', 'docs', 'sample-data.json');
// The sample week starts on its first shift's Monday; "now" is pinned to that Thursday 10:30.
const sample = JSON.parse(fs.readFileSync(SAMPLE, 'utf8'));
const THURSDAY = sample.data.shifts[0].date;

const steps = [];
async function step(name, fn) {
  const started = Date.now();
  await fn();
  steps.push(name);
  console.log(`ok  ${name} (${Date.now() - started} ms)`);
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, timezoneId: 'Asia/Beirut', acceptDownloads: true });
  const page = await context.newPage();
  const problems = [];
  const offDevice = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('request', (r) => { if (!r.url().startsWith(URL) && !/^(data|blob):/.test(r.url())) offDevice.push(r.url()); });
  await page.clock.setFixedTime(new Date(`${THURSDAY}T10:30:00+03:00`));

  const tab = (name) => page.click(`nav[aria-label="Sections"] >> text=${name}`);
  const quick = (name) => page.click(`nav[aria-label="Quick actions"] >> text=${name}`);
  const sheet = () => page.locator('[role=dialog]');
  const text = (selector) => page.locator(selector).innerText();

  await step('first run shows setup, and setup can be completed', async () => {
    await page.goto(URL);
    await page.click('text=Set up my week');
    await page.locator('input[type=time]').first().fill('23:30');
    await page.click('text=Next: classes');
    await page.click('text=Add a class or fixed commitment');
    await sheet().locator('input').first().fill('Calculus III');
    await sheet().locator('button:has-text("Mon")').click();
    await sheet().locator('button:has-text("Wed")').click();
    await sheet().locator('text=Add on 2 days').click();
    assert.equal(await page.locator('li:has-text("Calculus III")').count(), 2);
    await page.click('text=Next: training');
    await page.click('text=Add a weekly session');
    await sheet().locator('input').first().fill('Pull day');
    await sheet().locator('button:has-text("Save")').click();
    await page.click('text=Next: courses');
    await page.click('text=Add a course');
    await sheet().locator('input').first().fill('Calculus III');
    await sheet().locator('button:has-text("Save")').click();
    await page.click('text=Open my week');
    await page.waitForSelector('text=of buffer this week');
    // 2 classes x 1.5 h = 3 h of classes in the ledger breakdown.
    await page.click('text=Show the fixed breakdown');
    assert.match(await text('dl >> nth=1'), /Classes\s+3 h/);
  });

  await step('data survives closing and reopening the app', async () => {
    await page.reload();
    await page.waitForSelector('text=of buffer this week');
    await tab('Schedule');
    assert.equal(await page.locator('li:has-text("Calculus III")').count(), 2);
    assert.equal(await page.locator('li:has-text("Pull day")').count(), 1);
  });

  await step('a backup imports through Settings, after a confirmation', async () => {
    await tab('Settings');
    await page.setInputFiles('input[type=file]', SAMPLE);
    await page.waitForSelector('text=Replace everything with this backup?');
    assert.match(await sheet().innerText(), /5 courses, 19 assessments, 12 blocks/);
    await page.click('text=Replace my data');
    await page.waitForSelector('text=Backup imported.');
    await tab('Week');
    await page.waitForSelector('text=7 conflicts');
  });

  await step('logging a finished block takes 3 taps and shows up in today', async () => {
    const started = Date.now();
    await quick('Log block'); // tap 1
    await sheet().locator('button:has-text("Sharp")').click(); // tap 2: energy 5
    await sheet().locator('button:has-text("Log block")').click(); // tap 3 (course and length are preselected)
    const elapsed = Date.now() - started;
    await page.waitForSelector('li:has-text("09:40 to 10:30")');
    assert.match(await text('li:has-text("09:40 to 10:30")'), /Calculus III: Midterm[\s\S]*Done, counts as 0\.8 h/);
    console.log(`    automated log flow: ${elapsed} ms for 3 taps`);
  });

  await step('a one-tap energy check-in replaces the predicted factor', async () => {
    assert.match(await text('p:has-text("Energy factor")'), /0\.75 predicted/);
    await quick('Energy');
    await sheet().locator('button:has-text("Good")').click();
    await sheet().locator('button:has-text("Done")').click();
    assert.match(await text('p:has-text("Energy factor")'), /0\.90 from your check-in/);
  });

  await step('marking training done is one tap in the sheet', async () => {
    await quick('Trained');
    await sheet().locator('button:has-text("Done")').click();
    assert.match(await sheet().innerText(), /Done\s+Undo/);
    await page.keyboard.press('Escape');
    await page.waitForSelector('li:has-text("Pull") >> text=Training, hard, done');
  });

  await step('adding a shift on top of a block raises a conflict immediately', async () => {
    const before = await text('#conflicts h2');
    await quick('Add shift');
    // Friday 15:00 to 18:00, on top of the Friday 15:30 Calculus block.
    const friday = new Date(new Date(`${THURSDAY}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
    await sheet().locator('input[type=date]').fill(friday);
    await sheet().locator('input[type=time]').first().fill('15:00');
    await sheet().locator('input[type=time]').nth(1).fill('18:00');
    await sheet().locator('button:has-text("Save")').click();
    await page.waitForSelector('[role=status]:has-text("New conflict:")');
    assert.notEqual(await text('#conflicts h2'), before);
    assert.equal(await page.locator('#conflicts li:has-text("takes your Fri 15:30")').count(), 1);
  });

  await step('a fix resolves its conflict, and Undo brings it back', async () => {
    const item = page.locator('#conflicts li:has-text("takes your Fri 15:30")');
    await item.locator('button').first().click();
    await page.waitForSelector('[role=status]:has-text("Done: Move")');
    assert.equal(await item.count(), 0);
    await page.click('[role=status] >> text=Undo');
    await page.waitForSelector('#conflicts li:has-text("takes your Fri 15:30")');
  });

  await step('accepting a suggestion adds the block to the plan', async () => {
    const first = page.locator('#suggestions li').first();
    const title = await first.locator('div.font-medium').innerText();
    const count = await page.locator('#suggestions li').count();
    await first.locator('button:has-text("Add")').click();
    await page.waitForFunction((n) => document.querySelectorAll('#suggestions li').length !== n, count);
    assert.ok(title.length > 0);
  });

  await step('entering a score changes what the course still needs', async () => {
    await tab('Grades');
    const course = page.locator('article:has-text("Calculus III")');
    assert.match(await course.innerText(), /Needs 92\.4% on the remaining 90%/);
    await course.locator('button:has-text("Midterm")').click();
    await sheet().locator('input[placeholder="Not graded yet"]').fill('80');
    await sheet().locator('button:has-text("Save")').click();
    // earned = 8.8 + 24 = 32.8; required = (92 - 32.8) / 0.60 = 98.7%
    await page.waitForSelector('article:has-text("Needs 98.7% on the remaining 60%")');
    await course.locator('summary:has-text("Show the maths")').click();
    assert.match(await course.innerText(), /\(92 - 32\.8\) \/ 60% = 98\.7%/);
  });

  await step('a course with weights under 100% is flagged', async () => {
    assert.match(await page.locator('article:has-text("Technical Writing")').innerText(), /Weights add up to 90%, not 100%/);
  });

  await step('changing an energy factor in Tuning changes effective hours, and reset restores it', async () => {
    await tab('Week');
    const before = await text('h1 + p');
    await tab('Settings');
    await page.click('summary:has-text("Energy factors")');
    await page.locator('label:has-text("Energy 4") input').fill('0.5');
    await tab('Week');
    const after = await text('h1 + p');
    assert.notEqual(after, before);
    await tab('Settings');
    await page.click('text=Reset all tuning to defaults');
    await tab('Week');
    assert.equal(await text('h1 + p'), before);
  });

  await step('a saved number can be cleared and retyped (120 minutes of overhead becomes 90)', async () => {
    await tab('Settings');
    const field = page.locator('label:has-text("Meals and daily overhead") input');
    await field.click();
    for (let i = 0; i < 3; i++) await field.press('Backspace');
    await field.pressSequentially('90');
    await page.locator('h1').click(); // leave the field
    assert.equal(await field.inputValue(), '90');
    await tab('Week');
    await page.click('text=Show the fixed breakdown');
    assert.match(await text('dl >> nth=1'), /Meals and daily overhead\s+10\.5 h/); // 7 days x 1.5 h
  });

  let exported;
  await step('the JSON export is a complete backup that imports back unchanged', async () => {
    await tab('Settings');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=Export a full backup (JSON)')]);
    exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(exported.format, 'capacity-desk-backup');
    assert.equal(exported.data.blocks.length, 14); // 12 from the sample + 1 logged + 1 accepted suggestion
    assert.equal(exported.data.dayLogs.find((l) => l.date === THURSDAY).energy, 4);
  });

  await step('the CSV export lists every block', async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=Export blocks (CSV)')]);
    const lines = fs.readFileSync(await download.path(), 'utf8').trim().split('\r\n');
    assert.equal(lines[0], 'date,start,duration_min,category,title,course,status,energy_1_to_5');
    assert.equal(lines.length, 15);
  });

  await step('erasing all data asks first, then returns to first-run setup', async () => {
    await page.click('text=Erase all data');
    await sheet().locator('button:has-text("Erase everything")').click();
    await page.waitForSelector('text=Set up my week');
    await page.reload();
    await page.waitForSelector('text=Set up my week');
  });

  await step('the exported backup restores everything', async () => {
    await page.click('text=Skip setup and look around');
    await tab('Settings');
    const file = path.join(require('node:os').tmpdir(), 'capacity-desk-roundtrip.json');
    fs.writeFileSync(file, JSON.stringify(exported));
    await page.setInputFiles('input[type=file]', file);
    await page.click('text=Replace my data');
    await page.waitForSelector('text=Backup imported.');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=Export a full backup (JSON)')]);
    const again = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.deepEqual(again.data, exported.data);
  });

  await step('a file that is not a backup is refused with a reason', async () => {
    const file = path.join(require('node:os').tmpdir(), 'not-a-backup.json');
    fs.writeFileSync(file, '{"hello": 1}');
    await page.setInputFiles('input[type=file]', file);
    await page.waitForSelector('text=This is not a Capacity Desk backup file.');
  });

  await step('no errors were logged and nothing was requested from outside the app', async () => {
    assert.deepEqual(problems, []);
    assert.deepEqual(offDevice, []);
  });

  await browser.close();
  console.log(`\n${steps.length} steps passed`);
})().catch((error) => {
  console.error(`\nFAILED after ${steps.length} steps:`, error);
  process.exit(1);
});
