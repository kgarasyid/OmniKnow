import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const context = vm.createContext({
 structuredClone, Blob, TextEncoder, URLSearchParams, console,
 localStorage: {getItem:()=>null, setItem:()=>{}}, setTimeout, clearTimeout,
});
for (const name of ['survey-monitor.js','dashboard-workspace.js','dashboard-insights.js',
 'dashboard-hard-skill.js','dashboard-downloads.js','dashboard-period.js']) {
 vm.runInContext(await readFile(new URL(name, root), 'utf8'), context);
}
const html = await readFile(new URL('index.html', root), 'utf8');
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/render\(\);\s*$/, ''), context);
vm.runInContext(`localAskReport={
 '2026-09':{csrCounts:{'Walk In Mitra':10,'Walk In TOMO':10,'Call In':20,'E-Care':9}},
 '2026-10':{csrCounts:{'Walk In Mitra':11,'Walk In TOMO':10,'Call In':20,'E-Care':10,
  'GraPARI model belum tercatat':1}}
};`, context);

const dashboard = vm.runInContext('ctpExecutiveDashboard(filtered(),true)', context);
const csrPanel = dashboard.match(/<article class="canvas-panel canvas-ctp">[\s\S]+?<\/article>/)?.[0];
assert.ok(csrPanel, 'CSR panel must be present');
assert.match(dashboard, />51 <small>CSR/);
assert.match(dashboard, /49 CSR/);
assert.doesNotMatch(csrPanel, /Model belum tercatat/);
assert.match(csrPanel, /<svg class="canvas-csr-pie"/);
console.log('PASS: unclassified GraPARI model excluded from displayed CSR total and pie');
