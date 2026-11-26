import {readFile,writeFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const context=vm.createContext({structuredClone,Blob,TextEncoder,URLSearchParams,console,localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout,clearTimeout});
for(const file of ['survey-monitor.js','dashboard-workspace.js','dashboard-insights.js','dashboard-hard-skill.js','dashboard-downloads.js','dashboard-period.js'])vm.runInContext(await readFile(new URL(file,root),'utf8'),context);
const html=await readFile(new URL('index.html',root),'utf8');
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/initializePeriodFeatures\(\);/,'').replace(/render\(\);\s*$/,''),context);
const run=code=>JSON.parse(JSON.stringify(vm.runInContext(code,context)));
vm.runInContext('surveyState()',context);
const before=run('state');
assert.equal(run('state.agents.length'),60);
vm.runInContext('seedEcare()',context);
assert.equal(run('state.agents.length'),60);
assert.equal(run('vocRows().length'),180);
vm.runInContext("ctp='E-Care'",context);
assert.equal(run('filtered().length'),12);
assert.equal(run('vocRows().length'),36);
assert.ok(run('agentVocPanel(filtered())').includes('Agent VoC'));
assert.ok(run('ask()').includes('Participants by Area / Site'));
assert.ok(run('prePostEvaluation()').includes('Agent VoC'));
vm.runInContext("ctp='All CTPs'",context);
await mkdir(new URL('../artifacts/verification/',import.meta.url),{recursive:true});
const pdf=vm.runInContext("makeDashboardPdf('ASK verification',['Verified dummy report'],[{label:'Below 55',value:3,color:'#C8202E'}])",context);
await writeFile(new URL('../artifacts/verification/report.pdf',import.meta.url),Buffer.from(await pdf.arrayBuffer()));
const xlsx=vm.runInContext('makeDashboardWorkbook(dashboardWorkbookSheets())',context);
await writeFile(new URL('../artifacts/verification/report.xlsx',import.meta.url),Buffer.from(await xlsx.arrayBuffer()));
for(let tab=0;tab<6;tab++){
  vm.runInContext(`dashboardTab=${tab}`,context);
  const result=run('dashboardWorkspace()');
  assert.ok(result.includes('Dashboard categories'));
  assert.ok(!/NaN|undefined|Infinity/.test(result),'Tab '+tab+' invalid fragment: '+result.match(/.{0,60}(?:NaN|undefined|Infinity).{0,60}/)?.[0]);
}
assert.deepEqual(run('DASH_CHANNELS.map(channel=>channel.label)'),['Nasional','GraPARI','Call Center','E-Care']);
assert.equal((run('dashboardTabs()').match(/data-dash-channel=/g)||[]).length,4);
assert.doesNotMatch(run('dashboardTabs()'),/ASK Performance|Training Reguler|Test Evaluation|Raw Data/);
vm.runInContext("dashboardReportTab='training'",context);
const trainingTabMarkup = run('ctpExecutiveDashboard(filtered(),true)');
assert.match(trainingTabMarkup,/data-dashboard-executive-tab="ask" hidden/);
assert.doesNotMatch(trainingTabMarkup,/data-dashboard-executive-tab="training"/);
vm.runInContext("dashboardReportTab='ask'",context);
const ticketMarkup = `hardSkillBadTickets([{channel:'GraPARI',count:3,months:[{month:'2026-10',count:3}],
  prior:2,locations:[{label:'Area Fiktif',count:3}],regions:[{label:'Region Fiktif',count:3}],
  units:[{label:'Unit Fiktif',count:3}],categories:[{label:'Kategori fiktif',count:3}],
  agents:[{label:'Agen Fiktif',location:'Unit Fiktif',count:2}],agentsAfterTraining:false,
  agentCoverage:{withSiad:3,matched:2,afterTraining:0}}],
  'Oktober 2026',{current:'2026-10',previous:'2026-09',label:'Okt vs Sep 2026'})`;
const nationalTickets = run(`hardSkillNationalAnalytics({badTickets:DASH_CHANNELS.slice(1).map(({label:channel})=>({
  channel,months:[{month:'2026-10',count:3}],
  serviceTotals:[{name:'Fixed',count:3,prior:2,months:['2026-10']}],
  categoryDetails:[{month:'2026-10',service:'Fixed',category:'Kategori fiktif',count:3}],
}))},'Oktober 2026',{current:'2026-10',previous:'2026-09'})`);
assert.match(nationalTickets,/Performance Bad Ticket/);
assert.match(nationalTickets,/Bad Ticket Fixed[\s\S]*Jumlah tiket[\s\S]*<strong>3<\/strong>[\s\S]*aria-label="Naik 1 tiket">▲ 1/);
assert.match(nationalTickets,/Bad Ticket Mobile/);
assert.match(nationalTickets,/Lihat data Bad Ticket lengkap[\s\S]*Unduh Excel sesuai filter[\s\S]*Kategori fiktif/);
assert.match(nationalTickets,/Top 5 Bad Ticket Nasional[\s\S]*Kategori fiktif[\s\S]*<strong>9<\/strong>/);
assert.doesNotMatch(nationalTickets,/TNPS GraPARI per Area/);
assert.doesNotMatch(nationalTickets,/Top 5 Kategori|Top 5 Agen|Ringkasan Bad Ticket per CTP/);
for (const channel of ['GraPARI','Contact Center','E-Care']) {
  assert.ok(nationalTickets.includes(`data-hard-skill-channel="${channel}"`));
}
const ticketWorkbookSheets = run(`hardSkillNationalWorkbookSheets({badTickets:[{channel:'Call Center',
 categoryDetails:[{month:'2026-10',service:'Fixed',category:'Kategori fiktif',count:3}],
 serviceTotals:[{name:'Fixed',count:3,prior:2}]}]})`);
assert.equal(ticketWorkbookSheets[0].rows[0].Jumlah_tiket,3);
assert.equal(ticketWorkbookSheets[1].rows[0].Pembanding_bulan_sebelumnya,2);
const hardSkillSummary = run(`hardSkillKpis({
 totals:{attendance:12,participants:10,sessions:4},methods:{Offline:{sessions:2},Online:{sessions:2}},
 trainingBreakdowns:{bootcamp:{participants:7,sessions:2},refreshment:{programs:{participants:5}}},
 priorParticipation:{totals:{participants:8,sessions:3}},
 priorTrainingBreakdowns:{bootcamp:{participants:8},refreshment:{programs:{participants:4}}},
},true)`);
assert.match(hardSkillSummary,/aria-labelledby="hard-skill-kpi-title"/);
assert.match(hardSkillSummary,/class="dashboard-mom-value is-down" aria-label="Naik 2 peserta unik">▲ 2/);
assert.match(hardSkillSummary,/class="dashboard-mom-value is-up" aria-label="Turun 1 peserta unik">▼ 1/);
assert.equal(run(ticketMarkup),'');
vm.runInContext("ctp='GraPARI'",context);
const ticketDetail = run(ticketMarkup);
assert.match(ticketDetail,/Performance Bad Ticket Fixed GraPARI[\s\S]*Performance Bad Ticket Mobile GraPARI/);
assert.doesNotMatch(ticketDetail,/Temuan workbook Bad Ticket|hard-skill-ticket-channels/);
assert.doesNotMatch(ticketDetail,/data-hard-skill-channel=/);
vm.runInContext("ctp='Contact Center'",context);
const callCenterTickets = run(`hardSkillBadTickets([{channel:'Call Center',months:[{month:'2026-10',count:3}],
 tableComparison:{current:'2026-10',previous:'2026-09'},
 categoryMonths:[{label:'Kategori fiktif',count:3,months:[{month:'2026-10',count:3}],momPrior:5,momCurrent:3}],
 afterTrainingAgents:[{label:'Agen fiktif',location:'Site 1 fiktif',count:2,months:[{month:'2026-10',count:2}],momPrior:1,momCurrent:2}],
 performance:{services:[]}}],'Oktober 2026',null,{})`);
assert.match(callCenterTickets,/Call Center Bad Ticket Performance/);
assert.match(callCenterTickets,/Top 5 Bad Ticket per Category[\s\S]*Kategori fiktif[\s\S]*Top 5 Agent Most Bad Ticket After Training[\s\S]*Agen fiktif/);
assert.match(callCenterTickets,/Periode Input · Klasifikasi Unit Creator · Kategori Bad Tiket/);
assert.match(callCenterTickets,/<th scope="col">Sept<\/th>[\s\S]*<th scope="col">Okt<\/th>[\s\S]*<th scope="col">MoM<\/th>/);
assert.doesNotMatch(callCenterTickets,/<th scope="col">Total<\/th>/);
assert.match(callCenterTickets,/aria-label="Turun 2 tiket">▼ 2/);
assert.match(callCenterTickets,/aria-label="Naik 1 tiket">▲ 1/);
const rangedTickets = run(`hardSkillSitePerformance({channel:'Call Center',
 months:[{month:'2026-09'},{month:'2026-10'}],tableComparison:{current:'2026-10',previous:'2026-09'},
 categoryMonths:[{label:'Kategori rentang fiktif',count:8,months:[{count:5},{count:3}],momPrior:5,momCurrent:3}],
 afterTrainingAgents:[]},'Sept–Okt 2026',null)`);
assert.equal((rangedTickets.match(/<th scope="col">Sept<\/th>/g)||[]).length,1);
assert.equal((callCenterTickets.match(/class="hard-skill-slide-card"/g)||[]).length,2);
assert.match(callCenterTickets,/Bad Ticket Fixed[\s\S]*Bad Ticket Mobile[\s\S]*Top 5 Bad Ticket per Category/);
assert.doesNotMatch(callCenterTickets,/Top 5 KIP Symptom|Tier Volume Agen/);
assert.doesNotMatch(callCenterTickets,/Call Center Training Hardskill BadTicket|Documentation Aug/);
vm.runInContext("ctp='E-Care'",context);
const eCareTickets = run(`hardSkillBadTickets([{channel:'E-Care',months:[{month:'2026-10',count:1}],
 categoryMonths:[{label:'Kategori E-Care fiktif',count:1,months:[{month:'2026-10',count:1}]}],
 afterTrainingAgents:[]}],'Oktober 2026',null,{})`);
assert.match(eCareTickets,/E-Care Bad Ticket Performance[\s\S]*Kategori E-Care fiktif/);
assert.match(eCareTickets,/Bad Ticket Fixed[\s\S]*Bad Ticket Mobile[\s\S]*Top 5 Bad Ticket per Category/);
assert.doesNotMatch(eCareTickets,/Top 5 KIP Symptom|Tier Volume Agen/);
assert.doesNotMatch(await readFile(new URL('dashboard-hard-skill.js',root),'utf8'),/Apa yang Berubah\?/);
vm.runInContext("ctp='GraPARI'",context);
const grapariTrainingNotes = run(`hardSkillGrapariNotes({totals:{sessions:2,participants:3},
 trainingBreakdowns:{bootcamp:{participants:2,locations:[{label:'Area fiktif',participants:2}]},
 refreshment:{programs:{participants:1}}},priorTrainingBreakdowns:{bootcamp:{participants:4}}})`);
assert.match(grapariTrainingNotes,/Executive Training · GraPARI[\s\S]*Jangkauan Training[\s\S]*Bootcamp Offline[\s\S]*Refreshment Online/);
assert.match(grapariTrainingNotes,/Peserta Bootcamp turun 2 orang/);
assert.doesNotMatch(grapariTrainingNotes,/Fixed|Mobile|Referensi PPT/);
assert.equal((grapariTrainingNotes.match(/class="hard-skill-panel is-/g)||[]).length,3);
vm.runInContext("selectDashboardChannel('GraPARI');ctpScope='Area 1';dashboardUnit=dashboardUnitKey(filtered()[0]);selectDashboardChannel('Contact Center')",context);
assert.equal(run('ctpScope'),'All locations');
assert.equal(run('dashboardUnit'),'');
assert.ok(run("filtered().every(a=>a.ctp==='Contact Center')"));
assert.match(run('dashboardTabs()'),/data-dash-channel="Contact Center" aria-current="page"/);
assert.match(run('dashboardWorkspace()'),/Summary for Call Center/);
vm.runInContext("selectDashboardChannel('E-Care')",context);
assert.equal(run('filtered().length'),12);
vm.runInContext("selectDashboardChannel('All CTPs')",context);
assert.equal(run('filtered().length'),60);
assert.match(run('dashboardTabs()'),/>Nasional<\/button>/);
const filters = run('dashboardWorkspace()');
assert.match(filters,/id="dashboardResetFilters">Nasional/);
for(const label of ['Region','Unit Name']) assert.ok(filters.includes(label+'<select'));
assert.deepEqual([...filters.matchAll(/data-dashboard-area="([^"]+)"/g)].map(([,value])=>value),
 ['all','Area 1','Area 2','Area 3','Area 4','Call Center','E-Care']);
vm.runInContext("setDashboardReportAreas(['Area 1','Call Center'])",context);
assert.ok(run("filtered().some(a=>a.ctp==='Contact Center') && filtered().some(a=>a.ctp==='GraPARI')"));
assert.ok(run("filtered().every(a=>a.ctp==='Contact Center' || a.ctp==='GraPARI' && agentLocation(a)==='Area 1')"));
assert.deepEqual(run("new URLSearchParams(localLearningQuery()).getAll('reportArea')"),['Area 1','Call Center']);
vm.runInContext("setDashboardReportAreas([])",context);
assert.equal(run('filtered().length'),0);
assert.deepEqual(run("new URLSearchParams(localLearningQuery()).getAll('reportArea')"),['']);
vm.runInContext('setDashboardReportAreas(DASHBOARD_AREAS)',context);
assert.equal(run('filtered().length'),60);
assert.doesNotMatch(filters,/name="ctp"|id="chartCtp"|id="ctp"/);
vm.runInContext(`
  selectDashboardChannel('GraPARI');
  ctpScope='Area 1';
  const targetUnit=filtered()[0];
  region=targetUnit.region;
  dashboardUnit=dashboardUnitKey(targetUnit);
`,context);
assert.ok(run("filtered().length>0 && filtered().every(a=>dashboardUnitKey(a)===dashboardUnit)"));
assert.ok(run('dashboardLocationLabel().includes(dashboardUnitName(targetUnit))'));
assert.ok(run('exportScope().includes(dashboardUnitName(targetUnit))'));
assert.ok(run("dashRawRows(filtered()).every(row=>row.unit===dashboardUnitName(targetUnit))"));
vm.runInContext("selectDashboardChannel('All CTPs')",context);
for(const program of run('DASH_PROGRAMS')){
  const rows=run(`dashboardProgramRows(filtered(),${JSON.stringify(program)})`);
  assert.equal(rows.length,45);
  assert.equal(new Set(rows.map(r=>r.agent_id)).size,45);
  assert.ok(rows.every(r=>r.source==='Dummy program fixture'));
  assert.ok(rows.every(r=>r.score===''||(r.score>=0&&r.score<=100)));
}
assert.deepEqual(run('state'),before,'Rendering must not mutate source data');
for(const channel of ['GraPARI','Contact Center']){
  vm.runInContext(`ctp=${JSON.stringify(channel)};ctpScope='All locations'`,context);
  for(const location of channel==='GraPARI'?['Area 1','Area 2','Area 3','Area 4']:['Site 1','Site 2']){
    vm.runInContext(`ctpScope=${JSON.stringify(location)}`,context);
    for(const p of run('DASH_PROGRAMS'))assert.ok(run(`dashboardProgramRows(filtered(),${JSON.stringify(p)})`).every(r=>r.ctp===channel&&r.location===location));
    vm.runInContext("dashboardSub[5]='Agents'",context);
    assert.equal(run('dashRawRows(filtered()).length'),run('filtered().length'));
    assert.equal(run('dashGroups(filtered()).reduce((s,g)=>s+g.rows.length,0)'),run('filtered().length'));
  }
}
vm.runInContext("ctp='All CTPs';ctpScope='All locations';dashboardSub[5]='Programs'",context);
assert.equal(run('dashRawRows(filtered()).length'),225);
vm.runInContext("dashboardRawQuery='Bad Ticket'",context);
assert.equal(run('dashFilteredRaw(filtered()).length'),45);
vm.runInContext("dashboardRawQuery='';dashboardSub[5]='Agents';q='no-such-agent'",context);
assert.equal(run('dashRawRows(filtered()).length'),0);
vm.runInContext('dashboardTab=5',context);
assert.ok(run('dashboardWorkspace()').includes('No matching records'));
vm.runInContext("q='';state.activities.push({id:'ACT-TEST',category:'Bad Ticket',date:'2026-11-18',attendeeIds:['SYN-0001'],assessmentRecords:[{agentId:'SYN-0001',type:'post',score:93}]})",context);
const saved=run("dashboardProgramRows(filtered(),'Bad Ticket')");
assert.equal(saved.length,1);assert.equal(saved[0].source,'Saved activity');assert.equal(saved[0].score,93);
console.log('PASS: four CTP tabs; existing detail views; source preservation; cohort scope; raw search; empty state; saved activity precedence.');
