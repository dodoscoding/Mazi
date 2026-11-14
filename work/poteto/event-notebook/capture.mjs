import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.MAZI_NOTEBOOK_CAPTURE_URL || 'http://127.0.0.1:8038';
const output = 'work/poteto/event-notebook';
mkdirSync('.impeccable/review', { recursive: true });
const browser = await chromium.launch();
async function session(name) {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  const response = await page.request.post(`${base}/api/entry`, { data: { name, code: 'synthetic-shared-code' } });
  if (!response.ok()) throw Error('Synthetic entry failed');
  const profile = await response.json();
  return { context, page, group: profile.group_id };
}
const alice = await session('Alice');
const ben = await session('Ben');
const { memories } = await (await ben.page.request.get(`${base}/api/atlas?group=${ben.group}`)).json();
const event = memories.find((memory) => memory.kind === 'memory');
async function seed(member, text) {
  const saved = await (await member.page.request.get(`${base}/api/memories/notebook?group=${member.group}&event=${event.id}`)).json();
  const mine = saved.sections.flatMap((section) => section.notes).find((note) => note.ownership.kind === 'mine');
  const response = await member.page.request.post(`${base}/api/memories/note`, { data: { group: member.group, event: event.id, target: mine?.ownership.target || { kind: 'new' }, text } });
  if (!response.ok()) throw Error(`Synthetic note seed failed: ${response.status()}`);
}
await seed(alice, 'The playlist ended, so we sang the last song ourselves. I still remember everyone getting the words wrong.');
await seed(ben, 'We moved the kitchen table just to make room for one more dance. Best decision of the night.');
const memory = {
  ...event,
  title: 'Party night', shortTitle: 'Party night', date: '2024-07-12', year: 2024,
  approximate: false, source: 'whatsapp',
  description: 'The songs we kept playing. The stories we still tell.',
  photos: [
    { src: '/media/birthday.webp', alt: 'Synthetic friends gathered around a candlelit birthday cake', caption: 'One more song before we go.' },
    { src: '/media/table.webp', alt: 'Synthetic candlelit table after a shared evening', caption: 'The table after midnight.' },
  ],
  messages: [
    { name: 'Alice', time: '2024-07-12 21:14', text: 'Who put this song on? Nobody is allowed to leave now.' },
    { name: 'Ben', time: '2024-07-12 21:16', text: 'One more song. Famous last words.' },
    { name: 'Maya', time: '2024-07-12 21:18', text: 'Saving this night for the group archive.' },
  ],
  people: { shared: ['Alice'], conversation: ['Alice', 'Ben', 'Maya'] },
};
const reports = [];
for (const [name, viewport] of [['desktop', { width: 1440, height: 1024 }], ['mobile', { width: 390, height: 844 }]]) {
  const page = await ben.context.newPage({ viewport });
  await page.setViewportSize(viewport);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/atlas?*', (route) => route.fulfill({ json: { memories: [memory] } }));
  await page.goto(`${base}/#/memory/${event.id}?notebook=1`);
  await page.locator('.event-notebook .notebook-note').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.activeElement === document.querySelector('.memory-detail h1'));
  await page.screenshot({ path: `${output}/${name}-arrival.png` });
  await page.getByRole('button', { name: 'Show conversation', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  await page.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true });
  const axe = await new AxeBuilder({ page }).analyze();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  reports.push({ viewport: name, overflow, pageErrors: errors, violations: axe.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) })) });
  await page.getByRole('button', { name: 'Edit your recollection', exact: true }).click();
  await page.getByLabel('Your recollection', { exact: true }).fill('And then someone found the old playlist…');
  await page.locator('.notebook-editor').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/${name}-editor.png` });
  await page.close();
}
writeFileSync(`${output}/visual-checks.json`, JSON.stringify({ fixture: 'Synthetic Atlas text/photos with real synthetic event note persistence', reports }, null, 2) + '\n');
console.log(JSON.stringify(reports));
await alice.context.close(); await ben.context.close(); await browser.close();
