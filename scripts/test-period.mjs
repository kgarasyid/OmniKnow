import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),ctx=vm.createContext({structuredClone,Blob,TextEncoder,URLSearchParams,console,localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout,clearTimeout});
for(const name of ['survey-monitor.js','dashboard-workspace.js','dashboard-insights.js','dashboard-hard-skill.js','dashboard-downloads.js','dashboard-period.js'])vm.runInContext(await readFile(new URL(name,root),'utf8'),ctx);
const html=await readFile(new URL('index.html',root),'utf8');vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/render\(\);\s*$/,''),ctx);
const run=s=>JSON.parse(JSON.stringify(vm.runInContext(s,ctx)));
assert.equal(run('filtered().length'),60);assert.equal(run('vocRows().length'),180);
assert.ok(run('executiveSummary(filtered())').includes('Summary on each CTP'));
assert.ok(run('executiveSummary(filtered())').includes('E-Care'));
assert.equal(run("(executiveSummary(filtered()).match(/Suggested measure:/g)||[]).length"),3);
assert.ok(!/NaN|undefined/.test(run('executiveSummary(filtered())')));
assert.equal(run("previousMonthDay('2026-03-31')"),'2026-02-28');assert.equal(run("previousMonthDay('2024-03-31')"),'2024-02-29');
assert.equal(run("previousMonthDay('2026-01-01')"),'2025-12-01');
const current=run('filtered()'),previous=run('withPreviousPeriod(()=>filtered())');assert.equal(previous.length,60);assert.notDeepEqual(current,previous);assert.equal(run('reportFrom'),'2026-10-01');
run("reportFrom='2026-10-12';reportTo='2026-10-12'");assert.ok(run('filtered()').every(a=>a.report_date==='2026-10-12'));assert.ok(run('vocRows()').every(a=>a.date==='2026-10-12'));assert.equal(run("dashboardProgramRows(filtered(),'Hardskill').length"),0);
run("reportFrom='2027-01-01';reportTo='2027-01-31'");assert.equal(run('filtered().length'),0);assert.equal(run('vocRows().length'),0);assert.equal(run("dashboardProgramRows(filtered(),'Hardskill').length"),0);
run("reportFrom='2026-09-01';reportTo='2026-10-31'");assert.equal(run('filtered().length'),60);assert.equal(run('vocRows().length'),360);assert.equal(run("dashboardProgramRows(filtered(),'Hardskill').length"),90);
run("reportFrom='2026-10-01';reportTo='2026-10-31';ctp='E-Care';vocGroup='CTP';vocRank='Top 5'");assert.equal(run('vocRows().length'),36);assert.ok(run('rankedVocRows(filtered())').every(a=>a.ctp==='E-Care'));assert.equal(run('new Set(rankedVocRows(filtered()).map(a=>a.agent_id)).size'),5);
run("vocSearch='unresolved';vocRank='All'");assert.ok(run('rankedVocRows(filtered())').every(a=>a.feedback.toLowerCase().includes('unresolved')));
assert.ok(run('exportScope()').includes('2026-10-01'));run("vocDetail=true");assert.ok(run('agentVocPanel(filtered())').includes('NIK'));
run(`
 ctp='All CTPs';
 const demoAskGroup=(total,high,talentPool={excellent:total},means=[70,90,90])=>({
  total,high,scoreSum:total*(.4*means[0]+.3*means[1]+.3*means[2]),dimensionSums:means.map(mean=>mean*total),talentPool,
 });
 localAskReport={
  '2026-09':{csrCounts:{'Walk In Mitra':10,'Walk In TOMO':10,'Call In':20,'E-Care':9}},
  '2026-10':{csrCounts:{'Walk In Mitra':11,'Walk In TOMO':10,'Call In':20,'E-Care':10},groups:{
  'Walk In Mitra':demoAskGroup(10,[8,7,6],{excellent:6,good:2,core:1,growth:1}),
  'Walk In TOMO':demoAskGroup(10,[6,7,8]),
  'Call In':demoAskGroup(20,[8,12,16]),
  'E-Care':demoAskGroup(10,[3,4,5]),
 }}};
`);
const ctpSummary = run('ctpExecutiveDashboard(filtered())');
assert.match(ctpSummary,/Total CSR Nasional/);
assert.match(ctpSummary,/>51 <small>CSR/);
assert.match(ctpSummary,/aria-label="Naik">↑<\/span> 2 CSR/);
assert.match(ctpSummary,/September 2026: 49 CSR/);
assert.match(ctpSummary,/Total CSR per CTP/);
assert.match(ctpSummary,/<svg class="canvas-csr-pie"/);
assert.match(ctpSummary,/Workbook ASK lokal · 50 CSR dinilai/);
assert.match(ctpSummary,/GraPARI · MOMO · 10 CSR/);
assert.match(ctpSummary,/GraPARI · TOMO · 10 CSR/);
assert.match(ctpSummary,/Belum ada pasangan tes reguler/);
assert.match(ctpSummary,/Data program demo/);
run(`
 state.activities.push({id:'FICTIONAL-REGULAR',date:'2026-10-15',category:'ACS Booster',
  assessmentRecords:[{agentId:'SYN-0001',type:'pre',score:61},{agentId:'SYN-0001',type:'post',score:79},
   {agentId:'SYN-0002',type:'post',score:93}]});
`);
assert.deepEqual(run('regularTrainingTestPairs(filtered())'),[{agentId:'SYN-0001',pre:61,post:79}]);
assert.match(run('ctpExecutiveDashboard(filtered())'),/1 pasangan tes dalam aktivitas yang sama/);
assert.equal(run('reportFrom'),'2026-10-01');
assert.equal(run('reportTo'),'2026-10-31');
run(`
 localAskReport['2026-09'].groups={
  ...localAskReport['2026-10'].groups,
  'Walk In Mitra':demoAskGroup(10,[8,7,6],{excellent:4,good:6},[80,90,90]),
 };
 const areaKey=JSON.stringify(['GraPARI','Area 1']);
 const unitKey=JSON.stringify(['GraPARI','Area 1','Region Fiktif','TEST-UNIT','Unit Fiktif']);
 localAskReport['2026-10'].locations={
  [areaKey]:{'Walk In Mitra':demoAskGroup(2,[1,1,1]),'Walk In TOMO':demoAskGroup(1,[1,1,1],{good:1},[60,80,80])},
  [unitKey]:{'Walk In TOMO':demoAskGroup(1,[1,1,1],{good:1},[60,80,80])},
 };
 localAskReport['2026-10'].csrLocations={[areaKey]:{'Walk In Mitra':4}};
 localAskReport['2026-10'].latestQuadrants={ytd:{'Walk In Mitra':{'HAHAKO (HA)':5,'HAHAKO (LA)':1,'BELUM TERSEDIA':1}}};
 localAskReport['2026-10'].latestTalentPool={'Walk In Mitra':{excellent:4,good:2,growth:1}};
 localAskReport['2026-10'].latestScoreBands={'Walk In Mitra':{high:2,mid:4,low:1}};
 localAskReport['2026-09'].groups['Walk In Mitra'].scoreBands={high:3,mid:6,low:1};
 localAskReport['2026-10'].groups['Walk In Mitra'].scoreBands={high:5,mid:3,low:2};
 for (const name of ['Walk In TOMO','Call In','E-Care']) {
  const group=localAskReport['2026-10'].groups[name];
  group.scoreBands={high:group.total/2,mid:group.total/2};
 }
 localAskReport['2026-10'].locations[areaKey]['Walk In Mitra'].scoreBands={mid:2};
 localAskReport['2026-10'].locations[areaKey]['Walk In TOMO'].scoreBands={low:1};
 localAskReport['2026-10'].locations[unitKey]['Walk In TOMO'].scoreBands={low:1};
 const demoSources=(tappingCurrent,tappingPrior,rollup,other,unclassified)=>({tappingCurrent,tappingPrior,rollup,other,unclassified});
 for (const group of Object.values(localAskReport['2026-10'].groups)) group.sources=demoSources(group.total-4,1,1,1,1);
 localAskReport['2026-10'].locations[areaKey]['Walk In Mitra'].sources=demoSources(1,1,0,0,0);
 localAskReport['2026-10'].locations[areaKey]['Walk In TOMO'].sources=demoSources(0,0,1,0,0);
`);
const distribution = html=>html.match(/<article class="canvas-panel canvas-distribution">[\s\S]+?<\/article>/)[0];
const performanceTable = html=>html.match(/<article class="canvas-panel canvas-ask-performance"[\s\S]+?<\/article>/)[0];
const monthTrial=run('ctpExecutiveDashboard(filtered(),true)');
assert.match(monthTrial,/Perbandingan ASK bulanan/);
assert.equal((monthTrial.match(/<details class="canvas-kpi"/g)||[]).length,6);
const [coreKpis, trainingKpis] = [...monthTrial.matchAll(/<div class="canvas-kpi-group is-(?:core|learning)"[\s\S]*?<\/div>\s*<\/div>/g)]
 .map(([group])=>[...group.matchAll(/data-kpi="([^"]+)"/g)].map(([,key])=>key));
assert.deepEqual(coreKpis,['csr','ask']);
assert.deepEqual(trainingKpis,['skills','tryout','regular','tests']);
assert.match(monthTrial,/Rata-rata ASK<\/span>[\s\S]*?>82\s*<small>\/ ?100/);
assert.match(monthTrial,/▲ 2 CSR/);
assert.match(monthTrial,/<article class="canvas-panel canvas-ctp">[\s\S]*?<svg class="canvas-csr-pie"[^>]*Call Center 39,2% \(20 CSR\)/);
assert.match(monthTrial,/<dialog class="canvas-dialog" id="canvas-ctp-detail"[\s\S]*?<svg class="canvas-csr-pie"/);
assert.match(run("dashboardCsrPie([{label:'GraPARI · Model belum tercatat',value:1},{label:'GraPARI · TOMO',value:1500}])"),/<text class="canvas-pie-value"[^>]*>&lt;0,1% \(1\)<\/text>/);
assert.match(monthTrial,/50 CSR dinilai · Lulus ≥80/);
assert.match(monthTrial,/aria-label="Lulus 50%, 25 CSR"/);
assert.match(monthTrial,/aria-label="Belum lulus 30%, 15 CSR"/);
assert.doesNotMatch(monthTrial,/canvas-pass-donut/);
assert.doesNotMatch(monthTrial,/ask-high-chart/);
const monthlyDistribution = distribution(monthTrial);
assert.match(monthlyDistribution,/50 CSR dinilai/);
assert.match(monthlyDistribution,/<strong>25<\/strong><b>50%<\/b>/);
assert.match(monthlyDistribution,/▲ 4 pp/);
assert.match(monthlyDistribution,/vs September 2026/);
assert.match(monthTrial,/<details class="canvas-ask-report" open>/);
assert.match(monthTrial,/id="canvas-ask-report-title">Distribusi ASK/);
assert.match(monthTrial,/Executive Summary<\/h3>/);
assert.match(monthTrial,/Turun 0,8 poin dibanding September 2026/);
assert.match(monthTrial,/Attitude adalah dimensi dengan rata-rata terendah \(70\/100\)/);
assert.match(monthTrial,/GraPARI · Area 1 mencatat skor terendah/);
assert.match(monthTrial,/Ringkasan ASK — All CTP/);
assert.match(monthTrial,/<h4>Area 1<\/h4>[\s\S]*?<strong class="tone-low">78,7<\/strong>/);
assert.match(monthTrial,/aria-label="September 2026 50%"/);
assert.match(monthTrial,/class="canvas-ask-overview-panels"/);
assert.match(monthTrial,/Top 5 &amp; Bottom 5 ASK<\/h3>[\s\S]*?Nasional · Oktober 2026/);
assert.match(monthTrial,/class="canvas-ask-bars is-delta"/);
const monthlyPerformance = performanceTable(monthTrial);
assert.match(monthlyPerformance,/Performa A–S–K per Area &amp; Channel/);
assert.match(monthlyPerformance,/MoM \(poin\)/);
assert.match(monthlyPerformance,/Tapping bulan ini/);
assert.match(monthlyPerformance,/Rollup TL\/SPV/);
assert.match(monthlyPerformance,/<th scope="row">Nasional \(Semua CTP\)<\/th>[\s\S]*?<td class="canvas-ask-performance-prior">82,8<\/td>/);
assert.match(monthlyPerformance,/<td class="ask-score-low">70<\/td>/);
assert.match(monthlyPerformance,/<td class="ask-score-mid">86,7<\/td>/);
assert.match(monthlyPerformance,/<td class="ask-score-high">90<\/td>/);
assert.match(monthlyPerformance,/aria-label="Turun 0,8 poin">↓ 0,8<\/span><\/td><td>50<\/td>\s*<td>34<\/td><td>4<\/td><td>4<\/td><td>8<\/td>/);
assert.doesNotMatch(monthTrial,/canvas-ask-areas|canvas-ask-dimensions/);
run('dashboardAskReportOpen=false;true');
assert.match(run('ctpExecutiveDashboard(filtered(),true)'),/<details class="canvas-ask-report">/);
run('dashboardAskReportOpen=true;true');
run("setDashboardTrialPeriod('ytd','2026-10');true");
const ytdTrial=run('ctpExecutiveDashboard(filtered(),true)');
assert.match(ytdTrial,/ask-high-chart/);
assert.match(ytdTrial,/Tren ASK per Channel/);
assert.match(ytdTrial,/<path class="ask-score-grapari"/);
assert.match(ytdTrial,/<path class="ask-score-call-center"/);
assert.match(ytdTrial,/<path class="ask-score-ecare"/);
assert.match(ytdTrial,/100<\/strong>\s*<small>penilaian CSR · ASK nasional 82,4<\/small>\s*<small>Data 2\/10 bulan<\/small>/);
assert.match(ytdTrial,/HAHAKO \(HA\)/);
assert.match(ytdTrial,/data-ask-quadrant-code="HAHAKO \(HA\)" aria-haspopup="dialog"/);
const quadrantStatuses = code=>{
 const badgeMarkup = ytdTrial.split(`data-ask-quadrant-code="${code}"`)[1].split('</button>')[0];
 return [...badgeMarkup.matchAll(/canvas-quadrant-badge is-([^"]+)" role="img" aria-label="([^"]+)"/g)]
  .map(([,tone,status])=>[tone,status]);
};
assert.deepEqual(quadrantStatuses('HAHAKO (LA)'),[
 ['failing','Attitude belum lulus'],['passing','Skill lulus'],['passing','Knowledge lulus'],
]);
assert.deepEqual(quadrantStatuses('BELUM TERSEDIA').map(([tone])=>tone),['unavailable','unavailable','unavailable']);
assert.match(ytdTrial,/class="canvas-dialog canvas-ask-drill-dialog"/);
assert.match(ytdTrial,/Nama CSR<input type="search" name="q"/);
assert.match(distribution(ytdTrial),/7 CSR dinilai · Penilaian terakhir per CSR/);
assert.match(distribution(ytdTrial),/<strong>2<\/strong><b>28,6%<\/b>/);
assert.doesNotMatch(distribution(ytdTrial),/MoM/);
assert.match(performanceTable(ytdTrial),/ASK YTD/);
assert.match(performanceTable(ytdTrial),/Penilaian CSR/);
assert.doesNotMatch(performanceTable(ytdTrial),/MoM|ASK sebelumnya|Tapping bulan ini/);
assert.equal(run('reportFrom'),'2026-01-01');
run("ctp='GraPARI';ctpScope='Area 1';setDashboardTrialPeriod('month','2026-10');true");
const scopedTrial=run('ctpExecutiveDashboard(filtered(),true)');
assert.match(scopedTrial,/>4\s*<small>CSR/);
assert.match(scopedTrial,/3 CSR dinilai · Lulus ≥80/);
assert.doesNotMatch(scopedTrial,/>Call Center<\/h4>/);
assert.match(scopedTrial,/Attitude adalah dimensi dengan rata-rata terendah \(66,7\/100\)/);
assert.match(scopedTrial,/Ringkasan ASK — GraPARI/);
assert.match(distribution(scopedTrial),/<strong>2<\/strong><b>66,7%<\/b>/);
assert.match(performanceTable(scopedTrial),/Total cakupan/);
assert.match(performanceTable(scopedTrial),/<td>3<\/td>\s*<td>1<\/td><td>1<\/td><td>1<\/td><td>0<\/td>/);
assert.doesNotMatch(performanceTable(scopedTrial),/Call Center|E-Care|Nasional \(Semua CTP\)/);
run("dashboardUnit=unitKey;true");
assert.match(distribution(run('ctpExecutiveDashboard(filtered(),true)')),/<strong>1<\/strong><b>100%<\/b>/);
assert.match(run('ctpExecutiveDashboard(filtered(),true)'),/Attitude adalah dimensi dengan rata-rata terendah \(60\/100\)/);
run("setDashboardTrialPeriod('month','2026-11');true");
assert.match(distribution(run('ctpExecutiveDashboard(filtered(),true)')),/Data distribusi skor belum tersedia untuk cakupan ini/);
run(`
 globalThis.location={hostname:'127.0.0.1'};
 ctp='All CTPs';ctpScope='All locations';dashboardUnit='';setDashboardTrialPeriod('month','2026-10');
 dashboardOpenKpis.add('tests');
 localLearningReports.set(localLearningQuery(),{
  training:{attendance:22,sessions:5,hard:14,hardAttendance:17,hardSessions:4,regular:12,post:81.1,pairPre:72.24,pairPost:79.26,pairs:10},
  priorTraining:{hard:16,post:82,pairPre:85,pairPost:92},tryout:{},
  groups:[{label:'GraPARI · MOMO',training:{attendance:22,hard:14,hardAttendance:17,hardSessions:4,
   regular:12,acs:10,bad:3,post:81.1,pairPre:72.24,pairPost:79.26,pairs:10},tryout:{}}],
 });
`);
const liveTrial = run('dashboardWorkspace()');
assert.match(liveTrial,/<h1>Kinerja CSR &amp; Training Nasional<\/h1>/);
assert.match(liveTrial,/<time class="wall-period" datetime="2026-10">Oktober 2026<\/time>/);
assert.match(liveTrial,/<details[^>]+data-kpi="tests"[^>]+open/);
assert.match(liveTrial,/22 kehadiran · 5 sesi/);
assert.match(liveTrial,/<dt>Hard Skill<\/dt><dd>14<\/dd>[\s\S]*?<dt>Training Reguler<\/dt><dd>12<\/dd>/);
assert.match(liveTrial,/81,1 <small>\/ ?100<\/small>/);
assert.match(liveTrial,/▲ 7,1 poin/);
assert.match(liveTrial,/10 pasangan tes/);
assert.match(liveTrial,/Data belum tersedia[\s\S]*?Belum ada hasil Tryout lokal dalam cakupan ini/);
assert.match(liveTrial,/data-kpi="skills"[\s\S]*?Training Hard Skill<\/span>[\s\S]*?>14 <small>CSR/);
assert.doesNotMatch(liveTrial,/Soft Skill/);
const learningPanels = html=>html.match(/<section class="canvas-learning-reports"[\s\S]*?<\/section>/)[0];
assert.ok(liveTrial.indexOf('class="canvas-ask-report"') < liveTrial.indexOf('class="canvas-learning-reports"'));
assert.deepEqual([...learningPanels(liveTrial).matchAll(/class="canvas-learning-report" data-learning-disclosure="([^"]+)"/g)].map(([,id])=>id),
 ['hard','tryout','regular','tests']);
assert.match(learningPanels(liveTrial),/id="canvas-learning-hard-title">Distribusi Hard Skill[\s\S]*?data-hard-skill-mount/);
assert.equal(run("dashboardTrialCurrentMonth(new Date('2026-10-31T17:05:00Z'))"),'2026-11');
run("setDashboardTrialPeriod('range','2026-10','2026-08');true");
assert.deepEqual(run('hardSkillPeriod()'),['2026-08','2026-10']);
assert.equal(run("new URLSearchParams(localLearningQuery()).get('from')"),'2026-08-01');
assert.match(liveTrial,/aria-label="Filter dashboard"/);
assert.doesNotMatch(liveTrial,/data-hard-skill-filters/);
assert.match(run(`setDashboardTrialPeriod('current');
 hardSkillResults.set(localLearningQuery(),{report:{totals:{attendance:0}}});
 dashboardHardSkillBody()`),/Data bulan ini belum tersedia/);
run("resetDashboardTrialPeriod();hardSkillResults.clear();true");
assert.match(learningPanels(liveTrial),/<dt>ACS Booster<\/dt><dd>10 CSR<\/dd>/);
assert.match(learningPanels(liveTrial),/▲ 7,1 poin[\s\S]*?>72,2<\/b>[\s\S]*?>79,3<\/b>[\s\S]*?<dt>Pasangan tes<\/dt><dd>10<\/dd>/);
run(`
 const bandFixture=(count,sum,high,mid,low)=>({count,sum,high,mid,low});
 localAskReport['2026-10'].tryoutScores={'Walk In Mitra':bandFixture(8,705,5,2,1),
  'Call In':bandFixture(2,147,0,1,1)};
 localAskReport['2026-10'].tryoutLocations={[areaKey]:{'Walk In Mitra':bandFixture(4,356,2,2,0)}};
 dashboardLearningOpen.add('tryout');dashboardLearningOpen.add('tryout:90–100');true;
`);
const nationalTryout = learningPanels(run('dashboardWorkspace()'));
assert.match(nationalTryout,/data-learning-disclosure="tryout" open/);
assert.match(nationalTryout,/data-learning-disclosure="tryout:90–100" open/);
assert.match(nationalTryout,/>50% \(5\)/);
run("ctp='GraPARI';ctpScope='Area 1';true");
const areaTryout = learningPanels(run('dashboardWorkspace()'));
assert.match(areaTryout,/Area 1 · Oktober 2026 · 4 nilai TO/);
assert.match(areaTryout,/>50% \(2\)/);
assert.doesNotMatch(areaTryout,/14 CSR unik/);
run(`
 selectDashboardChannel('Contact Center');
 const cityUnit=JSON.stringify(['Call Center','','Region Fiktif','CC-001','CC Fiktif']);
 const otherCityUnit=JSON.stringify(['Call Center','','Region Fiktif','CC-002','CC Fiktif']);
 localAskReport['2026-10'].csrLocations[cityUnit]={'Call In':3};
 localAskReport['2026-10'].csrLocations[otherCityUnit]={'Call In':11};
 localAskReport['2026-10'].csrLocations[unitKey]={'Walk In TOMO':1};
 localAskReport['2026-10'].locations[cityUnit]={'Call In':{...demoAskGroup(2,[2,2,2]),scoreBands:{mid:2}}};
 localAskReport['2026-10'].locations[otherCityUnit]={'Call In':{...demoAskGroup(11,[11,11,11]),scoreBands:{high:11}}};
 applyDashboardMapScope({mapRegion:'Region Fiktif',unit:'CC Fiktif',unitId:'CC-001'});true;
`);
assert.equal(run('dashboardUnit'),run('cityUnit'));
const mapDistribution=run('ctpExecutiveDashboard(filtered(),true)').split('<section class="ctp-executive')[0];
assert.match(mapDistribution,/Distribusi ASK · CC Fiktif/);
assert.match(mapDistribution,/<dt>Total CSR<\/dt><dd>3<\/dd>/);
assert.match(mapDistribution,/<dt>CSR dinilai<\/dt><dd>2<\/dd>/);
assert.match(mapDistribution,/<strong>2<\/strong><b>100%<\/b>/);
run("selectDashboardChannel('GraPARI');true");
assert.equal(run('region'),'Region Fiktif');
assert.equal(run('dashboardUnit'),'');
assert.equal(run('reportTo'),'2026-10-31');
run(`
 applyDashboardMapScope({mapArea:'Area 1',mapRegion:'Region Fiktif',unit:'Unit Fiktif',unitId:'TEST-UNIT'});true;
`);
assert.equal(run('dashboardUnit'),run('unitKey'));
assert.match(run('ctpExecutiveDashboard(filtered(),true)'),/Distribusi ASK · Unit Fiktif/);
run("selectDashboardChannel('All CTPs');true");
assert.equal(run('dashboardUnit'),run('unitKey'));
assert.equal(run('region'),'Region Fiktif');
run('applyDashboardMapScope({});true');
assert.doesNotMatch(run('ctpExecutiveDashboard(filtered(),true)'),/dashboard-map-distribution-title/);
console.log('PASS: inclusive and empty date ranges, latest snapshots, calendar-month boundaries, multi-month event counts, E-Care VoC ranking, feedback search and export scope.');
console.log('PASS: integrated ASK overview, weighted score bands, MoM deltas, distinct YTD coverage and location scopes.');
console.log('PASS: grouped KPI disclosures, CSR pie, stacked ASK, and paired evaluation.');
console.log('PASS: interactive learning distributions, scored Tryout bands, and filtered coverage.');
