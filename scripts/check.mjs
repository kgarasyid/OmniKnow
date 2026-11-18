import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = await readFile(new URL('index.html', root));
const built = await readFile(new URL('dist/index.html', root));
assert.ok(source.equals(built), 'Build differs from index.html. Run npm run build.');
const html = source.toString('utf8');
assert.match(html, /<title>OmniKnow/);
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
assert.ok(scripts.length > 0, 'Application script not found.');
scripts.forEach((match, index) => new Script(match[1], { filename: `inline-script-${index + 1}.js` }));
for (const file of ['survey-monitor.js', 'survey-feed-template.gs', 'dashboard-period.js', 'dashboard-insights.js', 'dashboard-downloads.js', 'dashboard-workspace.js', 'dashboard-workspace.css']) {
  const bytes = await readFile(new URL(file, root));
  assert.ok(bytes.equals(await readFile(new URL('dist/' + file, root))), `${file} build differs`);
  if (!file.endsWith('.css')) new Script(bytes.toString(), {filename:file});
}
console.log(`PASS: ${scripts.length} inline script(s) parse; build is byte-identical (${source.length} bytes).`);

if (process.argv.includes('--baseline')) {
  const baseline = await readFile(new URL('reference/deployed-index.html', root));
  const provenance = JSON.parse(await readFile(new URL('reference/deployment.json', root), 'utf8'));
  assert.equal(hash(baseline), provenance.sha256, 'Recovery baseline was modified.');
  assert.ok(source.equals(baseline), 'Source differs from recovered Rev X. This is expected after intentional edits.');
  console.log(`PASS: source and build match the recorded Rev X baseline (${hash(source)}).`);
}
if (process.argv.includes('--live')) {
  const provenance = JSON.parse(await readFile(new URL('reference/deployment.json', root), 'utf8'));
  const response = await fetch(provenance.publicUrl, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `Live response HTTP ${response.status}`);
  const live = Buffer.from(await response.arrayBuffer());
  assert.ok(live.equals(source), `Live deployment differs. Live SHA-256: ${hash(live)}; local: ${hash(source)}. Investigate without overwriting either copy.`);
  console.log(`PASS: current public deployment is byte-identical (${hash(live)}).`);
  for (const file of ['survey-monitor.js', 'survey-feed-template.gs', 'dashboard-period.js', 'dashboard-insights.js', 'dashboard-downloads.js', 'dashboard-workspace.js', 'dashboard-workspace.css']) {
    const res = await fetch(new URL(file, provenance.publicUrl), {cache:'no-store'});
    assert.equal(res.status, 200);
    assert.ok(Buffer.from(await res.arrayBuffer()).equals(await readFile(new URL(file, root))), `${file} live differs`);
  }
}
