import { chromium, devices, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { followShellLink, signOut } from '../../../tests/helpers/shell.ts';

const fixture = JSON.parse(await readFile('/tmp/mazi-acceptance-hosted-fixture.json', 'utf8'));
const output = new URL('./browser/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: false });
const results = [];
try {
  for (const screen of ['desktop', 'phone']) {
    const context = await browser.newContext({
      ...(screen === 'phone' ? devices['Pixel 7'] : { viewport: { width: 1440, height: 1024 } }),
      baseURL: 'http://127.0.0.1:8047',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.getByLabel('Your name').fill(screen === 'desktop' ? 'Alice' : 'Ben');
    await page.getByLabel('Shared code').fill(fixture.code);
    await page.getByRole('button', { name: 'Enter Mazi', exact: true }).click();
    const introduction = page.getByRole('button', { name: 'Open the Atlas', exact: true });
    await introduction.or(page.getByRole('link', { name: 'Home', exact: true })).first().waitFor();
    if (await introduction.isVisible()) await introduction.click();
    if (screen === 'desktop') {
      await followShellLink(page, 'My Imports');
      const archive = execFileSync('.venv/bin/python', ['-c', `
import io, sys, zipfile
from PIL import Image
photo = io.BytesIO()
Image.new('RGB', (120, 90), '#497c9e').save(photo, 'JPEG')
archive = io.BytesIO()
with zipfile.ZipFile(archive, 'w') as z:
    z.writestr('chat.txt', '01/01/2024, 12:00 - Alice: acceptance.jpg (file attached)\\nHosted browser acceptance')
    z.writestr('acceptance.jpg', photo.getvalue())
sys.stdout.buffer.write(archive.getvalue())
`]);
      await page.getByLabel('Source account label').fill('Hosted synthetic browser');
      await page.getByLabel('Export ZIP').setInputFiles({ name: 'hosted-synthetic.zip', mimeType: 'application/zip', buffer: archive });
      await page.getByRole('button', { name: 'Upload and inspect inventory' }).click();
      await expect(page.locator('#report-title')).toContainText(/inventoried|completed/, { timeout: 60000 });
      if ((await page.locator('#report-title').textContent()).includes('inventoried'))
        await page.getByRole('button', { name: 'Start importing to group' }).click();
      await expect(page.locator('#report-title')).toContainText('completed', { timeout: 60000 });
      await expect(page.locator('#gallery article')).toHaveCount(1);
      await expect.poll(() => page.locator('#gallery img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
      await page.screenshot({ path: new URL('hosted-import-desktop.png', output).pathname, fullPage: true });
    }
    await followShellLink(page, 'Search');
    await page.getByLabel('Search', { exact: true }).fill('acceptance');
    await page.getByRole('button', { name: 'Search archive', exact: true }).click();
    await expect(page.locator('#results article')).toHaveCount(1, { timeout: 60000 });
    await expect.poll(() => page.locator('#results img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    const searchAxe = await new AxeBuilder({ page }).analyze();
    expect(searchAxe.violations).toEqual([]);
    await page.screenshot({ path: new URL(`hosted-search-${screen}.png`, output).pathname, fullPage: true });
    await followShellLink(page, 'Archive review');
    await expect(page.locator('#timeline article')).toHaveCount(1, { timeout: 60000 });
    const downloading = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download archive', exact: true }).click();
    const download = await downloading;
    expect(await download.failure()).toBeNull();
    await download.saveAs(`/tmp/mazi-hosted-${screen}.zip`);
    execFileSync('.venv/bin/python', ['-c', `import zipfile; z=zipfile.ZipFile('/tmp/mazi-hosted-${screen}.zip'); assert z.testzip() is None; import io,json; from PIL import Image; originals=[n for n in z.namelist() if n.startswith('originals/')]; assert len(originals)==1; Image.open(io.BytesIO(z.read(originals[0]))).verify(); [json.loads(z.read(n)) for n in z.namelist() if n.endswith('.json')]; print(len(z.namelist()))`]);
    await followShellLink(page, 'Places & sources');
    await expect(page.getByRole('heading', { name: 'Your sources', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await signOut(page);
    await expect(page.getByLabel('Shared code')).toBeVisible();
    expect(errors).toEqual([]);
    results.push({ screen, import: screen === 'desktop', search: true, previewDecoded: true, exportZipValid: true, sources: true, signOut: true, searchAxeViolations: searchAxe.violations.length, pageErrors: errors });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(new URL('hosted-browser.json', output), JSON.stringify(results, null, 2));
}
console.log(JSON.stringify(results, null, 2));
