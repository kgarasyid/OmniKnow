import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),ctx=vm.createContext({structuredClone,Blob,TextEncoder,URLSearchParams,console,localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout,clearTimeout});
for(const name of ['survey-monitor.js','dashboard-workspace.js','dashboard-insights.js','dashboard-hard-skill.js','dashboard-downloads.js','dashboard-period.js'])vm.runInContext(await readFile(new URL(name,root),'utf8'),ctx);
const html=await readFile(new URL('index.html',root),'utf8');vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/render\(\);\s*$/,''),ctx);
const run=s=>JSON.parse(JSON.stringify(vm.runInContext(s,ctx)));
run(`
 reportFrom='2026-10-01';reportTo='2026-10-31';dashboardTrialWindow='month';
 ctpScope='All locations';area='All Areas';region='All Regions';dashboardUnit='';
 const fictionalGroup=(total,high)=>({total,high,scoreSum:80*total,dimensionSums:[80*total,80*total,80*total]});
 localAskReport={
 '2026-09':{groups:{'Walk In Mitra':fictionalGroup(10,[5,6,7]),'Walk In TOMO':fictionalGroup(10,[6,7,8]),'Call In':fictionalGroup(20,[12,13,14]),'E-Care':fictionalGroup(10,[7,8,9])}},
 '2026-10':{groups:{'Walk In Mitra':fictionalGroup(10,[6,6,7]),'Walk In TOMO':fictionalGroup(10,[7,7,8]),'Call In':fictionalGroup(20,[11,14,14]),'E-Care':fictionalGroup(10,[8,7,9])}}
 };
`);
// Each channel uses the same summary with its own prior-period denominator.
for (const channel of ['GraPARI','Contact Center','E-Care']) {
 run(`ctp=${JSON.stringify(channel)}`);
 const scoped = run('ctpExecutiveDashboard(filtered(),true)');
 const overview = scoped.match(/<article class="canvas-panel canvas-ask">[\s\S]*?<\/article>/)[0];
 const previousRates = run('dashboardAskTotals(Object.values(dashboardAskSnapshot(localAskReport["2026-09"]).groups))');
 assert.equal((overview.match(/class="canvas-ask-summary-metric"/g)||[]).length,3);
 assert.equal((overview.match(/class="canvas-pass-national-marker"/g)||[]).length,3);
 assert.equal((overview.match(/class="canvas-ask-national-mom"/g)||[]).length,3);
 assert.match(overview,/Garis putih menandai persentase High September 2026/);
 previousRates.high.forEach(high=>assert.ok(overview.includes(`left:clamp(2px,${100*high/previousRates.total}%,calc(100% - 2px))`),channel));
 assert.match(overview,/data-ask-names-label="High Attitude"/);
 assert.match(overview,/data-ask-names-label="Low Knowledge"/);
}
run("ctp='All CTPs'");

run("ctp='E-Care';delete localAskReport['2026-09']");
const missing=run('ctpExecutiveDashboard(filtered(),true)').match(/<article class="canvas-panel canvas-ask">[\s\S]*?<\/article>/)[0];
assert.match(missing,/Pembanding belum tersedia/);
assert.doesNotMatch(missing,/class="canvas-pass-national-marker"|class="canvas-ask-national-delta/);
run("setDashboardTrialPeriod('ytd','2026-10');true");
const ytd=run('ctpExecutiveDashboard(filtered(),true)').match(/<article class="canvas-panel canvas-ask">[\s\S]*?<\/article>/)[0];
assert.doesNotMatch(ytd,/canvas-pass-national-marker|canvas-ask-national-mom/);
console.log('PASS: channel ASK summaries share three cards, scoped prior markers, MoM, and drill-down controls; missing comparisons and YTD remain accurate.');
