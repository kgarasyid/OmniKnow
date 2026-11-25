import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),ctx=vm.createContext({structuredClone,Blob,TextEncoder,URLSearchParams,console,localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout,clearTimeout});
for(const name of ['survey-monitor.js','dashboard-workspace.js','dashboard-insights.js','dashboard-hard-skill.js','dashboard-downloads.js','dashboard-period.js'])vm.runInContext(await readFile(new URL(name,root),'utf8'),ctx);
const html=await readFile(new URL('index.html',root),'utf8');vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/render\(\);\s*$/,''),ctx);
const run=s=>JSON.parse(JSON.stringify(vm.runInContext(s,ctx)));
assert.equal(run('filtered().length'),60);assert.equal(run('vocRows().length'),180);
assert.deepEqual(run('surveyState().enabled=true; assessmentRows(filtered())'),[]);
run('surveyState().enabled=false');
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
 localAskReport['2026-09'].locations={[areaKey]:{'Walk In Mitra':demoAskGroup(2,[1,1,1],{},[70,70,70])}};
 localAskReport['2026-09'].groups['Walk In Mitra'].quadrants={'HAHAKO (HA)':4,'HAHAKO (LA)':4,'HALOKO (LA)':2};
 localAskReport['2026-10'].groups['Walk In Mitra'].quadrants={'HAHAKO (HA)':6,'HAHAKO (LA)':4};
 localAskReport['2026-10'].latestQuadrants={ytd:{'Walk In Mitra':{'HAHAKO (HA)':5,'HAHAKO (LA)':1,'BELUM TERSEDIA':1}}};
 localAskReport['2026-10'].latestTalentPool={'Walk In Mitra':{excellent:4,good:2,growth:1}};
 localAskReport['2026-09'].groups['Walk In Mitra'].talentPool={excellent:3,good:6,growth:1};
 localAskReport['2026-10'].groups['Walk In Mitra'].talentPool={excellent:5,good:3,core:1,growth:1};
 for (const name of ['Walk In TOMO','Call In','E-Care']) {
  const group=localAskReport['2026-10'].groups[name];
  group.talentPool={excellent:group.total/2,good:group.total/2};
 }
 localAskReport['2026-10'].locations[areaKey]['Walk In Mitra'].talentPool={excellent:2};
 localAskReport['2026-10'].locations[areaKey]['Walk In TOMO'].talentPool={growth:1};
 localAskReport['2026-10'].locations[unitKey]['Walk In TOMO'].talentPool={growth:1};
 const demoSources=(tappingCurrent,tappingPrior,rollup,other,unclassified)=>({tappingCurrent,tappingPrior,rollup,other,unclassified});
 for (const group of Object.values(localAskReport['2026-10'].groups)) group.sources=demoSources(group.total-4,1,1,1,1);
 localAskReport['2026-10'].locations[areaKey]['Walk In Mitra'].sources=demoSources(1,1,0,0,0);
 localAskReport['2026-10'].locations[areaKey]['Walk In TOMO'].sources=demoSources(0,0,1,0,0);
 const demoRegion=JSON.stringify(['GraPARI','Area 1','Region Fiktif']);
 localAskReport['2026-10'].locations[demoRegion]={'Walk In Mitra':demoAskGroup(2,[2,1,1])};
 localAskReport['2026-09'].locations[demoRegion]={'Walk In Mitra':demoAskGroup(2,[1,1,1])};
 localAskReport['2026-10'].locations[JSON.stringify(['Call Center',''])]={'Call In':demoAskGroup(2,[1,2,1])};
 localAskReport['2026-10'].locations[JSON.stringify(['Call Center','','Jabar'])]={'Call In':demoAskGroup(2,[1,2,1])};
 localAskReport['2026-10'].locations[JSON.stringify(['E-Care',''])]={'E-Care':demoAskGroup(3,[1,2,3])};
 localAskReport['2026-10'].tappingParameters={
  [areaKey]:{'etika pelayanan':{count:4,gapSum:1}},
  [unitKey]:{'etika pelayanan':{count:2,gapSum:1}},
  [JSON.stringify(['Call Center',''])]:{'etika pelayanan':{count:2,gapSum:1}},
 };
`);
const distribution = html=>html.match(/<article class="canvas-panel canvas-distribution">[\s\S]+?<\/article>/)[0];
const performanceTable = html=>html.match(/<article class="canvas-panel canvas-ask-performance"[\s\S]+?<\/article>/)[0];
const csrPanel = html=>html.match(/<article class="canvas-panel canvas-ctp">[\s\S]+?<\/article>/)[0];
const segmentPass = html=>html.match(/<article class="canvas-panel canvas-ask-segment-pass"[\s\S]+?<\/article>/)[0];
const monthTrial=run('ctpExecutiveDashboard(filtered(),true)');
assert.match(monthTrial,/role="tablist" aria-label="Laporan Training Dashboard"/);
assert.match(monthTrial,/id="canvas-report-tab-ask"[^>]*aria-selected="true" tabindex="0"/);
assert.match(monthTrial,/id="canvas-report-panel-training"[^>]* hidden>/);
run("dashboardReportTab='training';setDashboardTrialPeriod('month','2026-09');true");
const trainingTab = run('ctpExecutiveDashboard(filtered(),true)');
assert.match(trainingTab,/id="canvas-report-tab-training"[^>]*aria-selected="true" tabindex="0"/);
assert.match(trainingTab,/id="canvas-report-panel-ask"[^>]* hidden>/);
assert.match(trainingTab,/id="canvas-report-panel-training"[^>]*aria-labelledby="canvas-report-tab-training">/);
assert.equal((trainingTab.match(/class="canvas-kpi" data-kpi=/g) || []).length,5);
run("dashboardReportTab='ask';setDashboardTrialPeriod('month','2026-10');true");
assert.doesNotMatch(monthTrial,/Perbandingan ASK bulanan|canvas-ask-bars is-delta/);
assert.equal((monthTrial.match(/<details class="canvas-kpi"/g)||[]).length,5);
const [coreKpis, trainingKpis] = [...monthTrial.matchAll(/<div class="canvas-kpi-group is-(?:core|learning)"[\s\S]*?<\/div>\s*<\/div>/g)]
 .map(([group])=>[...group.matchAll(/data-kpi="([^"]+)"/g)].map(([,key])=>key));
assert.deepEqual(coreKpis,['csr','ask']);
assert.deepEqual(trainingKpis,['skills','tryout','tests']);
assert.doesNotMatch(monthTrial,/Nilai Training Reguler/);
assert.match(monthTrial,/Rata-rata ASK<\/span>[\s\S]*?>82\s*<small>\/ ?100/);
assert.match(monthTrial,/▲ 2 CSR/);
assert.match(monthTrial,/id="canvas-kpi-summary-csr"[\s\S]*?▲ 2 CSR<\/b><span>vs Sep 2026<\/span>/);
assert.match(monthTrial,/id="canvas-kpi-summary-ask"[\s\S]*?▼ 0,8 poin<\/b><span>vs Sep 2026<\/span>/);
assert.match(monthTrial,/canvas-kpi-test-gain[^>]*>▲ 18 poin<\/strong><span>Selisih pre–post<\/span>/);
assert.match(monthTrial,/<article class="canvas-panel canvas-ctp">[\s\S]*?<svg class="canvas-csr-pie"[^>]*Call Center 39,2% \(20 CSR\)/);
assert.match(monthTrial,/<dialog class="canvas-dialog" id="canvas-ctp-detail"[\s\S]*?<svg class="canvas-csr-pie"/);
assert.match(run("dashboardCsrPie([{label:'GraPARI · Model belum tercatat',value:1},{label:'GraPARI · TOMO',value:1500}])"),/<text class="canvas-pie-value"[^>]*>&lt;0,1% \(1\)<\/text>/);
assert.match(monthTrial,/50 CSR dinilai · High ≥80/);
assert.match(monthTrial,/aria-label="High Attitude 50%, 25 CSR"/);
assert.match(monthTrial,/class="canvas-ask-summary-low"[^>]*data-ask-names-label="Low (?:Attitude|Skill|Knowledge)"[^>]*>Low <strong>30%<\/strong><span>15 CSR/);
assert.match(monthTrial,/data-ask-names-label="High Attitude" aria-haspopup="dialog"/);
assert.match(monthTrial,/<select name="sort"><option value="name-asc">Nama A–Z<\/option>[\s\S]*?Skor terendah<\/option>/);
assert.match(monthTrial,/class="canvas-ask-overview-cards"[\s\S]*?CSR per CTP<\/h3>[\s\S]*?data-cohort-family="grapari"[\s\S]*?data-cohort-family="contact"[\s\S]*?id="canvas-ask-comparison"[\s\S]*?High dan Low ASK Nasional<\/h3>[\s\S]*?Distribusi skor ASK<\/h4>[\s\S]*?High &amp; Low by Channel<\/h3>[\s\S]*?Rincian High dan Low berdasarkan lokasi/);
assert.equal((monthTrial.match(/<h3>High dan Low ASK Nasional<\/h3>/g) || []).length,1);
const attitudeBars = segmentPass(monthTrial).split('id="ask-pass-dimension-0"')[1].split('</section>')[0];
const segmentAttitude = [...attitudeBars.matchAll(/<th scope="row">([^<]+)<\/th>\s*<td><button[^>]*><strong>([^<]+)<\/strong><\/button><\/td><td><button[^>]*><strong>([^<]+)<\/strong><\/button><\/td>\s*<td><strong>([^<]+)<\/strong>/g)]
 .map(match=>match.slice(1));
assert.deepEqual(segmentAttitude,[
 ['GraPARI · TOMO','6','4','60%'],
 ['GraPARI · MOMO','8','2','80%'],
 ['Call Center','8','12','40%'],
 ['E-Care','3','7','30%'],
]);
const monthlyRegionPass = monthTrial.match(/<figcaption><strong>Region Fiktif<\/strong>[\s\S]*?<\/figure>/)[0];
assert.equal((monthlyRegionPass.match(/class="canvas-ask-pass-bar"/g) || []).length,6);
assert.match(monthlyRegionPass,/aria-label="Naik 50 poin persentase"[\s\S]*?title="September 2026">Sep<\/small>[\s\S]*?>High<\/span>\s*<strong>50%<\/strong>[^>]*<span class="canvas-ask-pass-count">\(1 CSR\)[\s\S]*?>Low<\/span>\s*<strong>50%<\/strong>[\s\S]*?title="Oktober 2026">Okt<\/small>[\s\S]*?>High<\/span>\s*<strong>100%<\/strong>[^>]*<span class="canvas-ask-pass-count">\(2 CSR\)[\s\S]*?>Low<\/span>\s*<strong>0%<\/strong>[^>]*<span class="canvas-ask-pass-count">\(0 CSR\)/);
assert.match(monthTrial,/<figcaption><strong>Site 1 · Bandung<\/strong><small>2 CSR dinilai<\/small>[\s\S]*?title="September 2026">Sep<\/small><span>Belum ada data<\/span>/);
const eCarePass = monthTrial.split('data-ask-pass-group="E-Care"')[1].split('</details>')[0];
assert.match(eCarePass,/>High<\/span>\s*<strong>33,3%<\/strong>[\s\S]*?>Low<\/span>\s*<strong>66,7%<\/strong>/);
for (const channel of ['GraPARI','Call Center','E-Care']) {
 const groupHeader = monthTrial.match(new RegExp(`class="canvas-ask-pass-group"[^>]*data-channel="${channel}"[^>]*>\\s*<summary>(.*?)</summary>`))?.[1];
 assert.match(groupHeader || '',/<svg class="dw-channel-icon"[^>]*aria-hidden="true"/,channel+' heading');
}
for (const dimension of ['Attitude','Skill','Knowledge']) {
 assert.match(monthTrial,new RegExp(`<h4><span class="canvas-ask-dimension-icon"><svg[^>]*>.*?</svg></span>${dimension}</h4><p>rata-rata nasional</p>`));
}
const nationalPass = segmentPass(monthTrial);
assert.match(nationalPass,/data-pass-view="national"/);
assert.equal((nationalPass.match(/class="canvas-pass-compare-group"/g) || []).length,3);
assert.equal((nationalPass.match(/class="canvas-pass-compare-pair"/g) || []).length,12);
assert.equal((nationalPass.match(/class="canvas-pass-compare-column is-passed"/g) || []).length,12);
assert.equal((nationalPass.match(/class="canvas-pass-compare-column is-below"/g) || []).length,12);
assert.equal((nationalPass.match(/<table class="canvas-pass-compare-table"/g) || []).length,3);
assert.match(attitudeBars,/<th scope="col">Segmen<\/th><th scope="col">High<\/th><th scope="col">Low<\/th><th scope="col">% High<\/th>/);
assert.doesNotMatch(nationalPass,/canvas-pass-donut-ring|canvas-pass-national-marker|data-ask-donut-select|Lihat tabel kelulusan/);
assert.match(nationalPass,/Oktober 2026 vs September 2026 · High ≥80 · Low &lt;80/);
const nationalOverview = monthTrial.match(/<article class="canvas-panel canvas-ask is-national">[\s\S]*?<\/article>/)[0];
assert.equal((nationalOverview.match(/class="canvas-ask-summary-metric"/g) || []).length,3);
assert.match(nationalOverview,/<h4>High Attitude<\/h4>[\s\S]*?<h4>High Skill<\/h4>[\s\S]*?<h4>High Knowledge<\/h4>/);
assert.equal((nationalOverview.match(/class="canvas-pass-national-marker"/g) || []).length,3);
assert.match(nationalOverview,/Garis putih menandai persentase High September 2026/);
assert.match(nationalOverview,/High ≥80/);
const nationalCallBar = attitudeBars.split('data-ask-pass-segment="Call In"')[1].split('data-ask-pass-segment=')[0];
assert.match(nationalCallBar,/<strong>Call Center<\/strong><small>20 CSR dinilai<\/small>/);
assert.match(nationalCallBar,/class="canvas-pass-compare-column is-passed" style="height:40%"><b>40%<\/b>/);
assert.match(nationalCallBar,/class="canvas-pass-compare-column is-below" style="height:60%"><b>60%<\/b>/);
const nationalCallRow = attitudeBars.match(/<tr data-ask-pass-segment="Call In">[\s\S]*?<\/tr>/)[0];
assert.match(nationalCallRow,/class="canvas-pass-metric-passed"[^>]*aria-controls="ask-donut-locations-2-0-passed"[^>]*aria-label="Call Center · High Attitude, 8/);
assert.match(nationalCallRow,/Call Center · Low Attitude, 12/);
assert.match(nationalCallRow,/canvas-pass-metric-mom[\s\S]*?title="September 2026 · 20 CSR dinilai">vs Sep 2026 <b>40%<\/b>[\s\S]*?Tetap 0 poin persentase/);
assert.match(nationalPass,/Call Center · Attitude · Low[\s\S]*Site 1 · Bandung[\s\S]*1 dari 2 \(50%\)/);
assert.match(nationalPass,/Call Center · Attitude · High[\s\S]*Site 1 · Bandung[\s\S]*1 dari 2 \(50%\)/);
const callDonuts = run(`dashboardAskSegmentPass({'Call In':demoAskGroup(20,[8,12,16])},{
 dimensions:['Attitude','Skill','Knowledge'],period:'Oktober 2026',multiMonth:false,locations:new Map()
})`);
assert.match(callDonuts,/data-pass-view="detail"/);
assert.match(callDonuts,/<h3 id="canvas-ask-segment-pass-title">High &amp; Low by Channel<\/h3>/);
assert.equal((callDonuts.match(/class="canvas-pass-donut-ring"/g) || []).length,3);
assert.match(callDonuts,/<strong>20<\/strong><small>CSR dinilai<\/small>/);
assert.match(callDonuts,/Data bulan lalu belum tersedia/);
assert.doesNotMatch(callDonuts,/canvas-pass-national-marker/);
assert.doesNotMatch(monthTrial,/ask-high-chart/);
const monthlyDistribution = distribution(monthTrial);
assert.match(monthlyDistribution,/50 CSR dinilai/);
assert.match(monthlyDistribution,/<strong>25<\/strong><b>50%<\/b>/);
assert.match(monthlyDistribution,/Excellent Performance · ≥80[\s\S]*?Good Performance · 70 hingga &lt;80[\s\S]*?Core Performance · 60 hingga &lt;70[\s\S]*?Growth Potential · &lt;60/);
assert.match(monthlyDistribution,/▲ 4 pp<\/small><small>vs Sep 2026/);
assert.match(monthlyDistribution,/Oktober 2026 vs September 2026/);
assert.match(monthTrial,/<details class="canvas-ask-report" open>/);
assert.match(monthTrial,/id="canvas-ask-report-title">Performance ASK – All CTP<\/h2>\s*<small class="canvas-ask-report-period">Oktober 2026 vs September 2026<\/small>[\s\S]*?canvas-ask-overview-total"><strong><svg[\s\S]*?<\/summary>/);
assert.match(monthTrial,/Executive Summary<\/h3>/);
assert.match(monthTrial,/Turun 0,8 poin dibanding September 2026/);
assert.match(monthTrial,/Dimensi terendah <strong>Attitude<\/strong> \(70\/100\)/);
assert.match(monthTrial,/Kelompok terendah <strong>GraPARI · Area 1<\/strong>/);
assert.match(monthTrial,/CSR dengan ASK di bawah 80<\/dt><dd><strong>25 CSR<\/strong> \(50% dari 50 CSR dengan skor akhir valid\)/);
assert.doesNotMatch(monthTrial,/canvas-ask-overview-title|ASK - All CTP/);
assert.match(monthTrial,/data-cohort-family="grapari"[\s\S]*data-cohort-family="contact"/);
assert.match(monthTrial,/<h5><svg[^>]*>[\s\S]*?<\/svg>Area 1<\/h5>\s*<div class="canvas-ask-overview-score"><strong class="dashboard-mom-value is-up">78,7 <small>\/100<\/small><\/strong>\s*<div class="canvas-ask-period-delta"><small[^>]+class="[^"]*is-up"[^>]*>[^<]+ poin<\/small><small title="September 2026">vs Sep 2026/);
assert.doesNotMatch(monthTrial.match(/data-cohort-family="grapari">[\s\S]*?<\/section>/)[0],/\b(?:TOMO|MOMO)\b/);
assert.match(monthTrial,/canvas-ask-overview-total"><strong><svg/);
assert.match(monthTrial,/class="canvas-ask-overview-panels"/);
assert.match(monthTrial,/Top 10 ASK &amp; Bottom 10 per Area<\/h3>[\s\S]*?Nasional · Oktober 2026/);
assert.doesNotMatch(monthTrial,/canvas-ask-tab|Analisis ASK<\/h3>/);
assert.match(monthTrial,/Executive Summary<\/h3>[\s\S]*?Performa A–S–K per Area &amp; Channel<\/h3>[\s\S]*?Distribusi kuadran ASK<\/h3>[\s\S]*?Bottom 10 per Area<\/h3>[\s\S]*?data-ask-ranking-bottom="area" data-ask-ranking-prior="September 2026"/);
const monthlyPerformance = performanceTable(monthTrial);
assert.match(monthlyPerformance,/Performa A–S–K per Area &amp; Channel/);
assert.deepEqual([...monthlyPerformance.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(([,label])=>label),
 ['Area / Channel','ASK September 2026','Attitude','Skill','Knowledge','ASK Oktober 2026','Selisih ASK','CSR dinilai']);
assert.match(monthlyPerformance,/Oktober 2026 vs September 2026 · Skor dari 100 · Selisih ASK dalam poin/);
assert.match(monthlyPerformance,/<th scope="col">Selisih ASK<\/th>/);
assert.doesNotMatch(monthlyPerformance,/Tapping|Rollup TL\/SPV|Lainnya \/ kosong/);
assert.match(monthlyPerformance,/<th scope="row">Nasional \(Semua CTP\)<\/th>\s*<td class="canvas-ask-performance-prior">82,8<\/td>\s*<td class="ask-score-low">70<\/td>/);
assert.match(monthlyPerformance,/<td class="ask-score-low">70<\/td>/);
assert.match(monthlyPerformance,/<td class="ask-score-mid">86,7<\/td>/);
assert.match(monthlyPerformance,/<td class="ask-score-high">90<\/td>/);
assert.match(monthlyPerformance,/<td class="dashboard-mom-value is-down"><strong>82<\/strong><\/td>\s*<td><span class="[^"]*is-down" aria-label="Turun 0,8 poin">▼ 0,8<\/span><\/td><td>50<\/td>/);
const quadrants = html=>html.match(/<article class="canvas-panel canvas-quadrant">[\s\S]+?<\/article>/)[0];
const monthlyQuadrants = quadrants(monthTrial);
const quadrantChart = html=>html.match(/<figure class="canvas-quadrant-chart"[\s\S]*?<\/figure>/)[0];
const monthChart = quadrantChart(monthlyQuadrants);
assert.equal((monthChart.match(/class="canvas-quadrant-column-code"/g)||[]).length,8);
assert.match(monthChart,/data-ask-quadrant-breakdown="GraPARI · Mitra 6"\s+aria-label="Lihat daftar CSR HAHAKO \(HA\), 6 CSR"/);
assert.match(monthChart,/HAHAKO \(HA\), 6 CSR" aria-description="Attitude High, Skill High, Knowledge High"/);
assert.match(monthChart,/HALOKO \(HA\), 0 CSR" aria-description="Attitude High, Skill High, Knowledge Low"/);
assert.doesNotMatch(monthChart,/data-series="call-center"/);
assert.doesNotMatch(monthChart,/canvas-quadrant-segment-values/);
const labeledChart = quadrantChart(run(`(()=>{
 const snapshot = structuredClone(localAskReport['2026-10']);
 snapshot.groups['Call In'].quadrants = {'HAHAKO (HA)':1,'HALOKO (HA)':19};
 const {quadrants,quadrantSegments} = dashboardAskSnapshot(snapshot);
 return dashboardAskQuadrants(quadrants,{},{
  scope:'Nasional',dimensions:['Attitude','Skill','Knowledge'],multiMonth:true,bySegment:quadrantSegments,
 });
})()`));
const segmentNumbers = code=>[...labeledChart.split(`aria-label="Jumlah per segmen ${code}"`)[1]
 .split('</dl>')[0].matchAll(/<dt class="ask-quadrant-sr">([^<]+)<\/dt><dd><i class="canvas-quadrant-swatch" aria-hidden="true"><\/i>(\d+)<\/dd>/g)]
 .map(([,segment,count])=>[segment,Number(count)]);
assert.deepEqual(segmentNumbers('HAHAKO (HA)'),[['Call Center',1],['GraPARI · Mitra',6]]);
assert.deepEqual(segmentNumbers('HALOKO (HA)'),[['Call Center',19],['GraPARI · Mitra',0]]);
assert.match(monthlyQuadrants,/<details class="canvas-quadrant-details">\s*<summary>Rincian kuadran<\/summary>/);
assert.match(monthlyQuadrants,/Oktober 2026 vs September 2026 · pp = poin persentase/);
assert.deepEqual([...monthlyQuadrants.matchAll(/<th scope="col" role="columnheader">([^<]+)<\/th>/g)].map(([,label])=>label),
 ['Kuadran','Attitude','Skill','Knowledge','Jumlah CSR','Porsi CSR','vs Sep 2026']);
assert.match(monthlyQuadrants,/aria-label="Naik 20 poin persentase">▲ 20 pp/);
assert.match(monthlyQuadrants,/aria-label="Tetap 0 poin persentase">→ 0 pp/);
assert.match(monthlyQuadrants,/canvas-quadrant-select is-inactive"><b>HALOKO \(LA\)<\/b>[\s\S]+?aria-label="Turun 20 poin persentase">▼ 20 pp/);
assert.doesNotMatch(monthlyQuadrants,/data-ask-quadrant-code="HALOKO \(LA\)"/);
run("ctp='E-Care';true");
const eCareCsr = csrPanel(run('ctpExecutiveDashboard(filtered(),true)'));
assert.match(eCareCsr,/Jumlah CSR · E-Care/);
assert.match(eCareCsr,/<dt>Oktober 2026<\/dt><dd>10 <small>CSR<\/small><\/dd>/);
assert.match(eCareCsr,/<dt>September 2026<\/dt><dd>9 <small>CSR<\/small><\/dd>/);
assert.match(eCareCsr,/↑ 1 CSR<\/b> vs Sep 2026/);
assert.doesNotMatch(eCareCsr,/canvas-csr-pie/);
run("ctp='Contact Center';true");
assert.match(csrPanel(run('ctpExecutiveDashboard(filtered(),true)')),/Jumlah CSR · Call Center[\s\S]*?→ 0 CSR<\/b> vs Sep 2026/);
run(`
 ctp='All CTPs';
 localAskReport['2025-12']={groups:{'Call In':demoAskGroup(1,[1,1,1],{},[90,90,90])}};
 setDashboardTrialPeriod('month','2026-01');
 true;
`);
const januaryPerformance = performanceTable(run('ctpExecutiveDashboard(filtered(),true)'));
assert.match(januaryPerformance,/<th scope="col">ASK Desember 2025<\/th>[\s\S]*?<th scope="col">ASK Januari 2026<\/th>/);
assert.match(januaryPerformance,/Januari 2026 vs Desember 2025/);
assert.match(januaryPerformance,/<th scope="row">Call Center<\/th>[\s\S]*?<td class="canvas-ask-performance-prior">90<\/td>/);
run("delete localAskReport['2025-12'];setDashboardTrialPeriod('month','2026-10');true");
assert.doesNotMatch(monthTrial,/canvas-ask-areas|canvas-ask-dimensions/);
run('dashboardNationalAskReportOpen=false;true');
assert.match(run('ctpExecutiveDashboard(filtered(),true)'),/<details class="canvas-ask-report">/);
run('dashboardNationalAskReportOpen=true;true');
run("setDashboardTrialPeriod('ytd','2026-10');true");
const ytdTrial=run('ctpExecutiveDashboard(filtered(),true)');
assert.doesNotMatch(segmentPass(ytdTrial),/canvas-pass-metric-mom|canvas-pass-national-marker/);
assert.doesNotMatch(ytdTrial,/class="canvas-pass-national-marker"/);
assert.match(ytdTrial,/ask-high-chart/);
assert.match(ytdTrial,/Tren ASK per Channel/);
assert.match(ytdTrial,/<path class="ask-score-grapari"/);
assert.match(ytdTrial,/<path class="ask-score-call-center"/);
assert.match(ytdTrial,/<path class="ask-score-ecare"/);
assert.match(ytdTrial,/100<\/strong>\s*<small>penilaian CSR · ASK nasional 82,4<\/small>\s*<small>Data 2\/10 bulan<\/small>/);
assert.match(ytdTrial,/HAHAKO \(HA\)/);
assert.match(ytdTrial,/data-ask-quadrant-code="HAHAKO \(HA\)" aria-controls="canvas-ask-quadrant-csr" aria-pressed="false"/);
assert.match(monthTrial,/class="canvas-ask-report-panels">\s*<div class="canvas-ask-performance-column">\s*<article class="canvas-panel canvas-ask-performance"[\s\S]*?id="canvas-ask-quadrant-csr"[\s\S]*?Prioritas Perbaikan ASK<\/h3>[\s\S]*?<article class="canvas-panel canvas-quadrant">/);
const priorityPanel = html=>html.match(/<article class="canvas-panel canvas-ask-priority"[\s\S]+?<\/article>/)[0];
assert.match(priorityPanel(monthTrial),/^<article[^>]*\shidden>/);
assert.match(priorityPanel(monthTrial),/data-ask-names-label="Coaching · Attitude &lt;80"[^>]*><span>Coaching<\/span><strong>25<\/strong>/);
assert.match(priorityPanel(monthTrial),/Rincian per area dan channel[\s\S]*?Lihat parameter dan fokus perbaikan Call Center[\s\S]*?Etika Pelayanan 50%/);
assert.match(priorityPanel(monthTrial),/E-Care[\s\S]*?Data tapping per parameter belum tersedia/);
const augustPriority = run(`dashboardAskPriorityPanel(
 [{name:'Call Center',label:'Call Center',channel:'Call Center',metrics:demoAskGroup(10,[2,7,6])}],
 demoAskGroup(10,[2,7,6]),{}, {period:'Agustus 2026',scope:'Nasional',useAugustReference:true}
)`);
assert.match(augustPriority,/% CSR dengan NC[\s\S]*?Etika Pelayanan 77%[\s\S]*?Fokus report/);
assert.match(augustPriority,/Jumlah intervensi dihitung dari workbook ASK yang aktif/);
const quadrantStatuses = code=>{
 const badgeMarkup = quadrants(ytdTrial).split('<tbody role="rowgroup">')[1].split(`data-ask-quadrant-code="${code}"`)[1].split('</tr>')[0];
 return [...badgeMarkup.matchAll(/canvas-quadrant-badge is-([^"]+)" role="img" aria-label="([^"]+)"/g)]
  .map(([,tone,status])=>[tone,status]);
};
assert.deepEqual(quadrantStatuses('HAHAKO (LA)'),[
 ['failing','Attitude Low'],['passing','Skill High'],['passing','Knowledge High'],
]);
assert.deepEqual(quadrantStatuses('BELUM TERSEDIA').map(([tone])=>tone),['unavailable','unavailable','unavailable']);
assert.match(quadrantChart(ytdTrial),/data-ask-quadrant-breakdown="GraPARI · Mitra 5"\s+aria-label="Lihat daftar CSR HAHAKO \(HA\), 5 CSR"/);
assert.match(ytdTrial,/class="canvas-dialog canvas-ask-drill-dialog"/);
assert.match(ytdTrial,/Nama CSR<input type="search" name="q"/);
assert.match(distribution(ytdTrial),/7 CSR dinilai · Penilaian terakhir per CSR/);
assert.match(distribution(ytdTrial),/<strong>4<\/strong><b>57,1%<\/b>/);
assert.doesNotMatch(distribution(ytdTrial),/MoM/);
assert.match(performanceTable(ytdTrial),/ASK YTD/);
assert.match(performanceTable(ytdTrial),/Penilaian CSR/);
assert.doesNotMatch(performanceTable(ytdTrial),/Selisih ASK|ASK September 2026|Tapping bulan ini/);
assert.doesNotMatch(quadrants(ytdTrial),/pp = poin persentase|poin persentase">/);
const ytdPass = ytdTrial.split('data-ask-pass-group="all"')[1].split('class="canvas-ask-executive"')[0];
assert.doesNotMatch(ytdTrial,/data-ask-ranking-prior/);
assert.match(ytdPass,/<figcaption><strong>Region Fiktif<\/strong><small>4 penilaian<\/small>/);
assert.doesNotMatch(ytdPass,/MoM|poin persentase/);
assert.doesNotMatch(quadrants(ytdTrial),/role="columnheader">vs /);
run("ctp='E-Care';setDashboardTrialPeriod('ytd','2026-11');true");
const ytdEcareCsr = csrPanel(run('ctpExecutiveDashboard(filtered(),true)'));
assert.match(ytdEcareCsr,/Posisi Oktober 2026[\s\S]*?<dd>10 <small>CSR<\/small>/);
assert.doesNotMatch(ytdEcareCsr,/MoM|canvas-csr-pie/);
assert.equal(run('reportFrom'),'2026-01-01');
run("ctp='GraPARI';ctpScope='Area 1';setDashboardTrialPeriod('month','2026-10');true");
const scopedTrial=run('ctpExecutiveDashboard(filtered(),true)');
assert.match(priorityPanel(scopedTrial),/Etika Pelayanan 25%/);
assert.doesNotMatch(priorityPanel(scopedTrial),/Call Center/);
assert.match(scopedTrial,/>4\s*<small>CSR/);
assert.match(scopedTrial,/3 CSR dinilai · High ≥80/);
assert.doesNotMatch(scopedTrial,/>Call Center<\/h4>/);
assert.match(scopedTrial,/Dimensi terendah <strong>Attitude<\/strong> \(66,7\/100\)/);
assert.match(scopedTrial,/Performance ASK – GraPARI/);
assert.match(distribution(scopedTrial),/<strong>2<\/strong><b>66,7%<\/b>/);
assert.match(performanceTable(scopedTrial),/Total cakupan/);
assert.match(performanceTable(scopedTrial),/<td>3<\/td>\s*<\/tr>/);
assert.doesNotMatch(performanceTable(scopedTrial),/Call Center|E-Care|Nasional \(Semua CTP\)/);
assert.doesNotMatch(scopedTrial,/data-ask-pass-group="Call Center"/);
run("dashboardUnit=unitKey;true");
assert.match(priorityPanel(run('ctpExecutiveDashboard(filtered(),true)')),/Etika Pelayanan 50%/);
assert.match(distribution(run('ctpExecutiveDashboard(filtered(),true)')),/<strong>1<\/strong><b>100%<\/b>/);
assert.match(run('ctpExecutiveDashboard(filtered(),true)'),/Dimensi terendah <strong>Attitude<\/strong> \(60\/100\)/);
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
assert.doesNotMatch(liveTrial,/Sorotan periode|Perbandingan per kanal/);
assert.match(liveTrial,/Rincian Nasional[\s\S]*aria-label="KPI dashboard"/);
assert.match(liveTrial,/<details[^>]+data-kpi="tests"[^>]+open/);
assert.match(liveTrial,/22 kehadiran · 5 sesi/);
assert.match(liveTrial,/<dt>Hard Skill<\/dt><dd>14<\/dd>[\s\S]*?<dt>Training Reguler<\/dt><dd>12<\/dd>/);
assert.match(liveTrial,/▲ 7,1 poin/);
assert.match(liveTrial,/10 pasangan tes/);
assert.match(liveTrial,/Data belum tersedia[\s\S]*?Belum ada hasil Tryout lokal dalam cakupan ini/);
assert.match(liveTrial,/data-kpi="skills"[\s\S]*?Training Hard Skill<\/span>[\s\S]*?>14 <small>CSR/);
assert.match(liveTrial,/<b class="dashboard-mom-value is-up" aria-label="Turun 2 CSR">▼ 2 CSR<\/b>/);
assert.doesNotMatch(liveTrial,/Soft Skill/);
const learningPanels = html=>html.match(/<section class="canvas-learning-reports"[\s\S]*?<\/section>/)[0];
assert.ok(liveTrial.indexOf('class="canvas-ask-report"') < liveTrial.indexOf('class="canvas-learning-reports"'));
assert.deepEqual([...learningPanels(liveTrial).matchAll(/class="canvas-learning-report" data-learning-disclosure="([^"]+)"/g)].map(([,id])=>id),
 ['hard']);
assert.match(learningPanels(liveTrial),/id="canvas-learning-hard-title">Training Hard Skill Nasional<small>Periode: Oktober 2026 vs September 2026<\/small>[\s\S]*?data-hard-skill-mount/);
assert.equal(run("dashboardTrialCurrentMonth(new Date('2026-10-31T17:05:00Z'))"),'2026-11');
const dateSelector = run('dashboardTrialPeriodControls()');
assert.equal((dateSelector.match(/<select/g)||[]).length,1);
assert.deepEqual([...dateSelector.matchAll(/<option value="2026-([^"]+)"/g)].map(([,choice])=>choice),
 ['01','02','03','04','05','06','07','08','09','10','11','12','q1','q2','q3','q4','ytd']);
run("setDashboardTrialSelection('2026-q4');true");
assert.deepEqual(run('[reportFrom,reportTo,dashboardTrialPeriodLabel()]'),['2026-10-01','2026-12-31','Q4 2026']);
assert.doesNotMatch(run("dashboardHardSkillSection('Nasional')"),/ vs /);
assert.match(run('dashboardTrialPeriodControls()'),/value="2026-q4" selected/);
run("localLearningMonths=['2024-01','2024-05','2024-08'];setDashboardTrialSelection('2024-ytd');true");
assert.deepEqual(run('[reportFrom,reportTo]'),['2024-01-01','2024-08-31']);
run("localLearningMonths=[];setDashboardTrialSelection('2026-01');true");
assert.deepEqual(run('[reportFrom,reportTo]'),['2026-01-01','2026-01-31']);
run("setDashboardTrialPeriod('range','2026-10','2026-08');true");
assert.deepEqual(run('hardSkillPeriod()'),['2026-08','2026-10']);
assert.equal(run("new URLSearchParams(localLearningQuery()).get('from')"),'2026-08-01');
assert.match(liveTrial,/aria-label="Filter dashboard"/);
assert.doesNotMatch(liveTrial,/data-hard-skill-filters/);
assert.match(run(`setDashboardTrialPeriod('current');
 hardSkillResults.set(localLearningQuery(),{report:{totals:{attendance:0}}});
 dashboardHardSkillBody()`),/Data bulan ini belum tersedia/);
run("resetDashboardTrialPeriod();hardSkillResults.clear();true");
assert.match(run(`hardSkillEvaluation({
 pairs:10,pre:72.2,post:79.3,surveyRecorded:false
},'Oktober 2026')`),/Pre-test &amp; Post-test[\s\S]*10 pasangan tes[\s\S]*▲ 7,1 poin[\s\S]*72,2 \/100[\s\S]*79,3 \/100/);
assert.match(run(`hardSkillInsights({comparisons:{'2026-10':{
 current:{key:'2026-10',attendance:280,offline:152},
 previous:{key:'2026-09',attendance:359,offline:106},
}}},'2026-10')`),/Oktober 2026 vs September 2026[\s\S]*▼ 79 kehadiran[\s\S]*▲ 24,8 pp/);
assert.match(run(`hardSkillBreakdownButton('fictitious',{label:'Site 1',participants:12,attendance:15,sessions:2},{},
 {previous:{participants:10,attendance:18}})`),/dashboard-mom-value is-down">15 kehadiran[\s\S]*aria-label="Turun 3 kehadiran">▼ 3/);
run(`
 selectDashboardChannel('Contact Center');
 const cityUnit=JSON.stringify(['Call Center','','Region Fiktif','CC-001','CC Fiktif']);
 const otherCityUnit=JSON.stringify(['Call Center','','Region Fiktif','CC-002','CC Fiktif']);
 localAskReport['2026-10'].csrLocations[cityUnit]={'Call In':3};
 localAskReport['2026-10'].csrLocations[otherCityUnit]={'Call In':11};
 localAskReport['2026-10'].csrLocations[unitKey]={'Walk In TOMO':1};
 localAskReport['2026-10'].locations[cityUnit]={'Call In':{...demoAskGroup(2,[2,2,2]),talentPool:{good:2}}};
 localAskReport['2026-10'].locations[otherCityUnit]={'Call In':{...demoAskGroup(11,[11,11,11]),talentPool:{excellent:11}}};
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
const unitAsk = run('ctpExecutiveDashboard(filtered(),true)');
assert.match(unitAsk,/Distribusi ASK · Unit Fiktif/);
assert.match(segmentPass(unitAsk),/GraPARI · TOMO<\/h4>[\s\S]*?<strong>1<\/strong><small>CSR dinilai<\/small>/);
assert.doesNotMatch(segmentPass(unitAsk),/GraPARI · MOMO|Call Center|E-Care/);
run("selectDashboardChannel('All CTPs');true");
assert.equal(run('dashboardUnit'),run('unitKey'));
assert.equal(run('region'),'Region Fiktif');
run('applyDashboardMapScope({});true');
assert.doesNotMatch(run('ctpExecutiveDashboard(filtered(),true)'),/dashboard-map-distribution-title/);
run(`
 const callAreaKey = JSON.stringify(['Call Center','']);
 const careAreaKey = JSON.stringify(['E-Care','']);
 localAskReport['2026-10'].csrLocations[callAreaKey]={'Call In':20};
 localAskReport['2026-10'].csrLocations[careAreaKey]={'E-Care':11};
 setDashboardReportAreas(['Area 1','E-Care']);true;
`);
assert.deepEqual(run("dashboardAskSnapshot(localAskReport['2026-10']).csrCounts"),{'Walk In Mitra':4,'E-Care':11});
run('setDashboardReportAreas(DASHBOARD_AREAS);true');
run(`
 selectDashboardChannel('E-Care');
 const ecareUnit = JSON.stringify(['E-Care','','Jateng','EC-001','ECARE SEMARANG']);
 localAskReport['2026-10'].csrLocations[ecareUnit]={'E-Care':5};
 localAskReport['2026-10'].locations[ecareUnit]={'E-Care':{...demoAskGroup(4,[4,4,4]),talentPool:{excellent:4}}};
 applyDashboardMapScope({mapRegion:'Jateng',unit:'ECARE SEMARANG',unitId:'EC-001'});true;
`);
assert.equal(run('dashboardUnit'),run('ecareUnit'));
assert.match(run('dashboardWorkspace()'),/local-grapari-map\?view=e-care&amp;month=2026-10[^"]*" title="Peta persebaran E-Care 3D"/);
assert.match(run('ctpExecutiveDashboard(filtered(),true)'),/Distribusi ASK · ECARE SEMARANG/);
const ecareFilters = run('dashboardLocationControls(true)');
assert.match(ecareFilters,/id="dashboardArea" disabled><option>E-Care<\/option>/);
assert.match(ecareFilters,/value="Site 2" selected>Site 2<\/option>/);
assert.match(ecareFilters,/selected>E-Care Semarang<\/option>/);
assert.doesNotMatch(ecareFilters,/dashboardRegion|CC Semarang|E-Care Bandung/);
assert.deepEqual(run("new URLSearchParams(localLearningQuery()).getAll('reportArea')"),['E-Care']);
run("selectDashboardChannel('All CTPs');setDashboardReportAreas(['Area 1']);selectDashboardChannel('Contact Center');true");
const ccFilters = run('dashboardLocationControls(true)');
assert.match(ccFilters,/id="dashboardArea" disabled><option>Call Center<\/option>/);
assert.match(ccFilters,/id="dashboardSite"[\s\S]*CC Bandung[\s\S]*CC Semarang/);
assert.doesNotMatch(ccFilters,/dashboardRegion|E-Care/);
assert.deepEqual(run("new URLSearchParams(localLearningQuery()).getAll('reportArea')"),['Call Center']);
run("selectDashboardChannel('All CTPs');true");
assert.deepEqual(run("new URLSearchParams(localLearningQuery()).getAll('reportArea')"),['Area 1']);
run(`
 setDashboardReportAreas(['Call Center']);
 localAskReport['2026-10'].groups['Call In'].quadrants={'HALOKO (LA)':20};
 localAskReport['2026-10'].groups['E-Care'].quadrants={'LOLOKO (LA)':10};
 selectDashboardChannel('GraPARI');true;
`);
assert.deepEqual(run("new URLSearchParams(localLearningQuery()).getAll('reportArea')"),[]);
assert.doesNotMatch(run('dashboardLocationControls(true)'),/data-dashboard-area="(?:Call Center|E-Care)"/);
for (const [channel,label,count,quadrant] of [
 ['GraPARI','GraPARI',20,'HAHAKO (HA)'],
 ['Contact Center','Call Center',20,'HALOKO (LA)'],
 ['E-Care','E-Care',10,'LOLOKO (LA)'],
]) {
 const report = run(`selectDashboardChannel(${JSON.stringify(channel)});ctpExecutiveDashboard(filtered(),true)`);
 assert.ok(report.includes(`Performance ASK – ${label}`));
 assert.ok(performanceTable(report).includes(`<td>${count}</td>`));
 for (const other of ['GraPARI','Call Center','E-Care'].filter(value=>value!==label)) {
  assert.ok(!performanceTable(report).includes(other));
 }
 assert.ok(quadrants(report).includes(`data-ask-quadrant-code="${quadrant}"`));
 assert.deepEqual(run("[reportFrom,reportTo,new URLSearchParams(localLearningQuery()).get('channel')]"),
  ['2026-10-01','2026-10-31',label]);
}
run("selectDashboardChannel('All CTPs');true");
assert.deepEqual(run("new URLSearchParams(localLearningQuery()).getAll('reportArea')"),['Call Center']);
run("setDashboardReportAreas(DASHBOARD_AREAS);setDashboardTrialPeriod('range','2026-10','2026-09');true");
const nationalMapReport = run('ctpExecutiveDashboard(filtered(),true)');
assert.match(nationalMapReport,/^<section class="canvas-national-map canvas-learning-report"[^>]*>[\s\S]*?src="\/local-grapari-map\?view=national&amp;month=2026-10"[\s\S]*?<section class="canvas-kpis"[\s\S]*?<details class="canvas-ask-report"/);
assert.doesNotMatch(nationalMapReport.split('</section>')[0],/<summary|Sembunyikan/);
assert.equal(run("applyDashboardNationalMapTarget('GraPARI','Area 3')"),true);
assert.deepEqual(run('[ctp,dashboardReportAreas,reportFrom,reportTo]'),['GraPARI',['Area 3'],'2026-09-01','2026-10-31']);
assert.doesNotMatch(run('ctpExecutiveDashboard(filtered(),true)'),/class="canvas-national-map /);
assert.equal(run("selectDashboardChannel('All CTPs');applyDashboardNationalMapTarget('E-Care','Site 2')"),true);
assert.equal(run('dashboardUnit'),run('ecareUnit'));
assert.deepEqual(run('[reportFrom,reportTo]'),['2026-09-01','2026-10-31']);
assert.equal(run("applyDashboardNationalMapTarget('Call Center','Site 7')"),false);
console.log('PASS: inclusive and empty date ranges, latest snapshots, calendar-month boundaries, multi-month event counts, E-Care VoC ranking, feedback search and export scope.');
console.log('PASS: integrated ASK overview, Talent Pool bands, MoM deltas, distinct YTD coverage and location scopes.');
console.log('PASS: grouped KPI disclosures, CSR pie, stacked ASK, and paired evaluation.');
console.log('PASS: two distribution panels, nested paired evaluation, and filtered coverage.');
