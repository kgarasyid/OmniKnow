import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const ctx=vm.createContext({structuredClone,Blob,TextEncoder,console,localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout,clearTimeout});
for(const name of ['survey-monitor.js','dashboard-workspace.js','dashboard-insights.js','dashboard-downloads.js','dashboard-period.js'])vm.runInContext(await readFile(new URL(name,root),'utf8'),ctx);
const html=await readFile(new URL('index.html',root),'utf8');
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/render\(\);\s*$/,''),ctx);
const run=s=>JSON.parse(JSON.stringify(vm.runInContext(s,ctx)));
// All eight independent combinations at the actual High boundary, including recommendations.
for(const [A,S,K,quadrant,recommendation] of [
 [80,80,80,'HAHAKO (HA)','Dipertahankan'],[79.99,80,80,'HAHAKO (LA)','++ Attitude'],
 [80,80,79.99,'HALOKO (HA)','++ Knowledge'],[79.99,80,79.99,'HALOKO (LA)','++ Knowledge, Attitude'],
 [80,79.99,80,'LOHAKO (HA)','++ Skill'],[79.99,79.99,80,'LOHAKO (LA)','++ Skill, Attitude'],
 [80,79.99,79.99,'LOLOKO (HA)','++ Skill, Knowledge'],[79.99,79.99,79.99,'LOLOKO (LA)','++ Skill, Knowledge, Attitude']]){
 const r=run(`askExcelLogic({attitude:${A},skill:${S},knowledge:${K}})`);
 assert.equal(r.quadrant,quadrant);assert.equal(r.recommendation,recommendation);
 assert.ok(Math.abs(r.score-(.4*A+.3*S+.3*K))<1e-10);
}
const fixture=[{id:'TEST-1',name:'Fictional One',ctp:'GraPARI',businessModel:'MOMO',attitude:80,skill:90,knowledge:100},
 {id:'TEST-2',name:'Fictional Two',ctp:'GraPARI',businessModel:'TOMO',attitude:70,skill:70,knowledge:70},
 {id:'TEST-3',ctp:'E-Care',askRole:'Non Agent',attitude:100,skill:100,knowledge:100},
 {id:'TEST-4',ctp:'GraPARI',job:'CS SAR',attitude:100,skill:100,knowledge:100},
 {id:'TEST-5',ctp:'Contact Center',attitude:'',skill:90,knowledge:90},
 {id:'TEST-6',ctp:'Contact Center',attitude:101,skill:90,knowledge:90}];
vm.runInContext(`var askFixture=${JSON.stringify(fixture)}`,ctx);
const stats=run('askStats(askFixture)');assert.equal(stats.n,2);assert.equal(stats.excluded.length,2);assert.equal(stats.high[0].rate,50);assert.equal(stats.score,79.5);
assert.equal(run("askExcelLogic(askFixture[3]).quadrant"),'Non Kuadran');
assert.equal(run("askSegment(askFixture[0])"),'MOMO');assert.equal(run("askSegment(askFixture[1])"),'TOMO');
assert.equal(run("askSegment({ctp:'GraPARI'})"),'GraPARI · model belum tersedia');
assert.equal(run('askStats([]).score'),null);assert.equal(run('askStats([]).high[0].rate'),null);
assert.ok(run("askDelta(0,null)").includes('Belum ada pembanding'));
assert.ok(run("askDelta(0,10)").includes('↓ Turun 10.0 pp'));
const before=run('state'),from=run('reportFrom');
assert.ok(!/NaN|undefined|Infinity/.test(run('askDashboard(filtered())')));
assert.deepEqual(run('state'),before);assert.equal(run('reportFrom'),from);
vm.runInContext("askQuadrantFilter='LOLOKO (LA)'",ctx);
assert.ok(run('askDetailRows(filtered())').every(a=>a.attitude<80&&a.skill<80&&a.knowledge<80));
vm.runInContext("askQuadrantFilter='All';askSegmentFilter='E-Care'",ctx);
assert.ok(run('askDetailRows(filtered())').every(a=>a.ctp==='E-Care'));
vm.runInContext("askDetailQuery='no-such-fictional-agent'",ctx);assert.equal(run('askDetailRows(filtered()).length'),0);
vm.runInContext("askDetailQuery='';askSegmentFilter='All';reportFrom='2027-01-01';reportTo='2027-01-31'",ctx);
assert.ok(!/NaN|undefined|Infinity/.test(run('askDashboard(filtered())')));assert.equal(run('askStats(filtered()).n'),0);
console.log('PASS: eight ASK quadrants and recommendations; thresholds; weighted scores; denominator exclusions; missing/range-invalid scores; segment and search drill-down; empty ranges; prior-period restoration; source preservation.');
// Charts use the same scope and preserve reporting state. Missing periods stay missing.
vm.runInContext("reportFrom='2026-10-01';reportTo='2026-10-31';askSegmentFilter='E-Care'",ctx);
const chartHistory=run('askHistory()');assert.equal(chartHistory.length,3);assert.ok(chartHistory.every(p=>p.n===12));assert.equal(run('reportTo'),'2026-10-31');
assert.deepEqual(chartHistory.map(p=>p.from),['2026-08-01','2026-09-01','2026-10-01']);
assert.ok(run('askCharts(askStats(askScope(filtered())))').includes('Low &lt;80'));
const quadrantHtml=run('askQuadrantGroups(askStats(askScope(filtered())),askPrior())');
assert.equal((quadrantHtml.match(/data-ask-quadrant=/g)||[]).length,8);
assert.equal((quadrantHtml.match(/ak-q-tone-3/g)||[]).length,1);
assert.equal((quadrantHtml.match(/ak-q-tone-2/g)||[]).length,3);
assert.equal((quadrantHtml.match(/ak-q-tone-1/g)||[]).length,3);
assert.equal((quadrantHtml.match(/ak-q-tone-0/g)||[]).length,1);
assert.ok(quadrantHtml.includes('High Quadrant'));assert.ok(quadrantHtml.includes('Low Quadrant'));
vm.runInContext("reportFrom='2026-08-01';reportTo='2026-08-31'",ctx);
assert.deepEqual(run('askHistory().map(p=>p.score==null)'),[true,true,false]);
assert.ok(!run('askCharts(askStats(askScope(filtered())))').includes('<path d='),'Do not connect missing history');
assert.ok(!/NaN|undefined|Infinity/.test(run('askCharts(askStats([]))')));
console.log('PASS: chart segment scope, date restoration, missing-history gaps, and eight reference-colored quadrant cards.');

// ASK-only presentation and selected comparison windows.
vm.runInContext("reportFrom='2026-10-01';reportTo='2026-10-31';askSegmentFilter='All';askPerformanceWindow='MoM'",ctx);
const askPage=run('askDashboard(filtered())');
assert.equal((askPage.match(/class="ak-kpi"/g)||[]).length,3);
assert.equal((askPage.match(/<details class="ak-comparison-details">/g)||[]).length,3);
assert.ok(askPage.includes('Cakupan penilaian ASK'));assert.ok(askPage.includes('Activity Category'));assert.ok(askPage.includes('Performance Window'));
for(const [window,from,to] of [['MoM','2026-09-01','2026-09-30'],['Quarter','2026-07-01','2026-07-31'],['Semester','2026-04-01','2026-04-30']]){
 vm.runInContext(`askPerformanceWindow=${JSON.stringify(window)}`,ctx);assert.deepEqual(run('askComparisonBounds()'),{from,to});
 run('askPrior()');assert.equal(run('reportFrom'),'2026-10-01');assert.equal(run('reportTo'),'2026-10-31');
}
vm.runInContext("askPerformanceWindow='YTD';reportFrom='2026-01-01'",ctx);assert.deepEqual(run('askComparisonBounds()'),{from:'2025-01-01',to:'2025-10-31'});
assert.equal(run("askShiftDay('2024-02-29',12)"),'2023-02-28');
assert.ok(run('askComparisonDetails(askStats([]),askStats([]),0)').includes('Belum ada pembanding'));
console.log('PASS: three High cards; separate coverage; collapsed comparison details; restored category/window filters; month-end and YTD comparison bounds.');

vm.runInContext(`
 const fictionalAskMonth = (callIn, eCare) => ({
  groups: {
   'Call In': {total: callIn, high: [0, callIn, callIn], quadrants: {}},
   'E-Care': {total: eCare, high: [eCare, eCare, eCare], quadrants: {}},
  },
  locations: {}, excluded: 0, incomplete: 0, unassigned: 0,
 });
 localAskReport = {
  '2025-12': fictionalAskMonth(1, 1),
  '2026-01': fictionalAskMonth(2, 2),
  '2026-02': fictionalAskMonth(2, 0),
  '2026-04': fictionalAskMonth(2, 2),
  '2026-05': fictionalAskMonth(2, 2),
 };
 localAskMonth = '2026-04';
`,ctx);
const readHighChart = ()=>run('localAskSlideTwo()').match(/<svg class="ask-high-chart"[\s\S]*?<\/svg>/)?.[0];
assert.equal(readHighChart(),undefined);
const missingComparison = run('localAskSlideTwo()');
assert.match(missingComparison,/Pembanding belum tersedia/);
vm.runInContext("localAskMonth='2026-02'",ctx);
const monthlyComparison = run('localAskSlideTwo()');
assert.match(monthlyComparison,/Attitude lulus<\/span><strong>0 \(0%\)<\/strong>/);
assert.match(monthlyComparison,/Sebelumnya 2 \(50%\) dari 4 CSR/);
assert.match(monthlyComparison,/Turun 50.0 pp/);
vm.runInContext("localAskWindow='ytd'",ctx);
const chart = readHighChart();
assert.match(chart, /is-missing"[^>]+>Mar<\/text>/);
assert.match(chart, /Attitude 0%/);
assert.match(chart, /class="ask-high-attitude" d="M[^ML]+L[^ML]+M[^ML]+L[^ML]+"/);
vm.runInContext("localAskChannel='E-Care'",ctx);
const scopedChart = readHighChart();
assert.match(scopedChart, /Tren High bulanan, Januari 2026 sampai Mei 2026/);
assert.match(scopedChart, /is-missing"[^>]+>Feb<\/text>/);
assert.match(scopedChart, /class="ask-high-attitude" d="M[^ML]+M[^ML]+L[^ML]+"/);
vm.runInContext("localAskWindow='quarter'",ctx);
assert.equal(readHighChart(),undefined);
vm.runInContext("localAskWindow='semester'",ctx);
assert.equal(readHighChart(),undefined);
console.log('PASS: local ASK shows concise month-over-month comparisons and limits illustrated High trends to YTD, preserving scoped calendar gaps.');
