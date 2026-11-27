import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
if (process.env.VERCEL_ENV === 'production') {
  for (const name of ['ask','learning','grapari-units','grapari-locations']) {
    try { await readFile(new URL('deployment-data/'+name+'.json.gz',root)); }
    catch { throw new Error('Production requires authorized reporting snapshots. Run scripts/prepare-deployment-data.mjs and deploy the source plus deployment-data; do not publish an empty-data build.'); }
  }
}
await mkdir(output, { recursive: true });
await copyFile(new URL('index.html', root), new URL('index.html', output));
for (const file of ['grapari-map.html','training-results.html', 'help.html', 'help.js', 'survey-monitor.js', 'survey-feed-template.gs', 'dashboard-period.js', 'dashboard-insights.js', 'dashboard-hard-skill.js', 'dashboard-downloads.js', 'dashboard-workspace.js', 'dashboard-workspace.css', 'manrope.woff2', 'manrope-OFL.txt']) {
  await copyFile(new URL(file, root), new URL(file, output));
}
const bytes = await readFile(new URL('index.html', output));
console.log(`Built ${fileURLToPath(new URL('index.html', output))}`);
console.log(`${bytes.length} bytes; SHA-256 ${createHash('sha256').update(bytes).digest('hex')}`);
