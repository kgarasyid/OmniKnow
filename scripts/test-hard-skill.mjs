import assert from 'node:assert/strict';
import { hardSkillReport } from './hard-skill-report.mjs';
import { localAskDrilldown } from './local-ask-drilldown.mjs';
import { localLearningReport } from './local-learning.mjs';

function row(id, date, method, material, batch, extra = {}) {
  return {
    id, date, method, material, batch,
    title: material + ' Fiktif',
    channel: 'GraPARI',
    area: 'Area 1',
    site: '',
    region: 'Region Fiktif',
    unit: 'Unit Fiktif',
    function: 'CSR',
    session: [date, material, method, batch],
    ...extra,
  };
}

const data = {hardSkill: [
  row('NIK-FIKTIF-A', '2026-09-10', 'Offline', 'Bad Ticket', 'A'),
  row('NIK-FIKTIF-B', '2026-09-11', 'Online', 'Bad Ticket', 'B'),
  row('NIK-FIKTIF-A', '2026-10-01', 'Online', 'Bad Ticket', 'A', {
    channel: 'Call Center', area: '', site: 'Site 2', pre: 60, post: 80, surveySubmitted: true,
  }),
  row('NIK-FIKTIF-B', '2026-10-01', 'Online', 'Bad Ticket', 'A', {
    channel: 'E-Care', area: '', site: 'Site 2', pre: 80, post: 90, surveySubmitted: false,
  }),
  row('NIK-FIKTIF-A', '2026-10-03', 'Online', 'ACS iBooster', 'C', {
    area: 'Area 2', pre: 55, surveySubmitted: false,
  }),
],badTickets:[
  {channel:'Call Center', service:'Fixed', month:'2026-09', unit:'CC BANDUNG', site:'Site 1 · Bandung', region:'Jabar', category:'Kategori fiktif', count:4},
  {channel:'Call Center', service:'Fixed', month:'2026-10', unit:'CC BANDUNG', site:'Site 1 · Bandung', region:'Jabar', category:'Kategori fiktif', symptom:'KIP fiktif', count:2},
  {channel:'E-Care', service:'Fixed', month:'2026-10', unit:'ECARE SEMARANG', site:'Site 2 · Semarang', region:'Jateng-DIY', category:'Kategori fiktif', symptom:'KIP E-Care fiktif', count:3},
],badTicketAgents:[
  {channel:'Call Center',service:'Fixed',month:'2026-10',unit:'CC BANDUNG',site:'Site 1 · Bandung',region:'Jabar',
    agent:'99990001',name:'Agen Fiktif',after:true,count:2},
  {channel:'Call Center',service:'Fixed',month:'2026-10',unit:'CC BANDUNG',site:'Site 1 · Bandung',region:'Jabar',
    agent:'99990002',after:false,count:9},
  {channel:'Call Center',service:'Fixed',month:'2026-09',unit:'CC BANDUNG',site:'Site 1 · Bandung',region:'Jabar',
    agent:'99990003',matched:true,after:false,count:3},
  {channel:'E-Care',service:'Fixed',month:'2026-10',unit:'ECARE SEMARANG',site:'Site 2 · Semarang',region:'Jateng-DIY',
    agent:'99990001',name:'Agen E-Care Fiktif',after:true,count:3},
],hardSkillPerformance:{
  '2026-09':{fcrTotal:{Total:75,Fixed:60,Mobile:90},tnps:[40,50,60,70],badTicketFixed:[2,3,5,10]},
  '2026-10':{fcrTotal:{Total:80,Fixed:70,Mobile:90},tnps:[50,60,70,80],badTicketFixed:[5,5,10,20]},
},contactCenterTickets:{
  months:['2026-09','2026-10'],
  services:[
    {name:'Fixed',source:'Sumber fiktif',agents:13,topSymptom:'KIP fiktif',bandung:[5,8],semarang:[8,10]},
    {name:'Mobile',source:'Sumber fiktif',agents:3,topSymptom:'KIP fiktif',bandung:[2,0],semarang:[1,3]},
  ],
}};

function params(filters, reportAreas = []) {
  const query = new URLSearchParams({from:'2026-09-01', to:'2026-10-31', ...filters});
  for (const area of reportAreas) query.append('reportArea',area);
  return query;
}
const query = (filters, reportAreas) => hardSkillReport(data, params(filters,reportAreas));

const report = query();
assert.deepEqual(report.totals, {attendance: 5, participants: 2, sessions: 4, online: 4, offline: 1});
assert.deepEqual(report.methods, {
  Offline:{attendance:1,participants:1,sessions:1}, Online:{attendance:4,participants:2,sessions:3},
});
const {bootcamp,refreshment,contactCenter,callCenter,eCare} = report.trainingBreakdowns;
assert.deepEqual(bootcamp.locations.map(({label,participants,sessions})=>[label,participants,sessions]), [['Area 1',1,1]]);
assert.deepEqual(bootcamp.roles, [{label:'CSR',participants:1}]);
assert.deepEqual(refreshment.materials.map(({label,sessions})=>[label,sessions]), [['Bad Ticket',2],['ACS iBooster',1]]);
assert.deepEqual(contactCenter.locations.map(({label,attendance,sessions})=>[label,attendance,sessions]), [['Site 2',2,1]]);
assert.deepEqual(contactCenter.dates,{from:'2026-10-01',to:'2026-10-01'});
assert.equal(refreshment.programs.participants,2);
assert.equal(callCenter.attendance,1);
assert.equal(eCare.attendance,1);
assert.equal(report.priorParticipation,null);
assert.equal(report.priorTrainingBreakdowns,null);
assert.deepEqual(report.timeline.months.map(({attendance}) => attendance), [2,3]);
assert.deepEqual(report.timeline.months[1].bySeries, {offlineBadTicket: 0, onlineBadTicket: 2, onlineAcsIBooster: 1, other: 0});
assert.equal(report.comparisons['2026-10'].previous.attendance, 2);
assert.equal(report.comparisons['2026-09'].previous, null);
assert.deepEqual(report.dates, {from: '2026-09-10', to: '2026-10-03'});
assert.deepEqual(report.evaluation, {pairs: 2, pre: 70, post: 85, surveySubmitted: 1, surveyRecorded: true});
assert.equal(report.details.reduce((sum, row) => sum + row.attendance, 0), report.totals.attendance);
assert.doesNotMatch(JSON.stringify(report), /NIK-FIKTIF/);
const bandung = query({from:'2026-10-01', channel:'Call Center', area:'Site 1', unit:'Call Center Bandung'}).badTickets;
assert.deepEqual(bandung.map(({channel,count,prior})=>[channel,count,prior]), [['Call Center',2,4]]);
assert.deepEqual(bandung[0].categories, [{label:'Kategori fiktif',count:2}]);
assert.deepEqual(bandung[0].symptoms, [{label:'KIP fiktif',count:2}]);
assert.deepEqual(bandung[0].agents, [{label:'Agen Fiktif',location:'Site 1 · Bandung',count:2}]);
assert.equal(bandung[0].agentsAfterTraining,true);
assert.deepEqual(bandung[0].agentCoverage,{withSiad:11,matched:2,afterTraining:2});
assert.equal(query({channel:'Call Center',region:'Jateng'}).badTickets[0].agents.length,0);
const septemberTickets = query({channel:'Call Center',to:'2026-09-30'}).badTickets[0];
assert.equal(septemberTickets.agentsAfterTraining,false);
assert.equal(septemberTickets.agents[0].label,'SIAD ••••0003');
assert.deepEqual(septemberTickets.agentCoverage,{withSiad:3,matched:3,afterTraining:0});
assert.ok(report.badTickets.every(row=>row.agents===undefined && row.agentCoverage===undefined));
assert.equal(query({channel:'E-Care'}).badTickets[0].count,3);
assert.equal(query({channel:'E-Care'}).badTickets[0].months[0].count,null);
assert.deepEqual(report.badTickets.slice(1).map(row=>row.serviceTotals.map(({name,count})=>[name,count])),
  [[['Fixed',6],['Mobile',null]],[['Fixed',3],['Mobile',null]]]);
const performance = query({channel:'Call Center'}).badTickets[0].performance;
assert.deepEqual(performance.services.map(({name,count,sites})=>[name,count,sites.map(site=>site.label)]),
  [['Fixed',6,['Site 1 · Bandung']]]);
assert.equal(performance.services[0].agentCount,3);
assert.deepEqual(bandung[0].performance.services.map(({count,prior,sites})=>[count,prior,sites[0].key]),
  [[2,4,'bandung']]);
assert.equal(query({channel:'Call Center',region:'Jateng'}).badTickets[0].performance.services[0].count,0);
assert.deepEqual(query({channel:'Call Center',from:'2026-11-01',to:'2026-11-30'}).badTickets[0].performance.services,[]);
assert.deepEqual(query({channel:'E-Care'}).badTickets[0].performance.services.map(({name,count,months,sites})=>
  [name,count,months,sites.map(site=>site.key)]),[['Fixed',3,['2026-10'],['semarang']]]);
const ecarePerformance = query({channel:'E-Care'}).badTickets[0];
assert.deepEqual(ecarePerformance.tierSites,['Site 2 · Semarang']);
assert.deepEqual(ecarePerformance.tiers.map(row=>[row[0],row[3]]),[['Tier 3',0],['Tier 2',1],['Tier 1',0]]);
assert.equal(ecarePerformance.performance.services[0].agentCount,1);
assert.deepEqual(ecarePerformance.performance.services[0].symptoms,[{label:'KIP E-Care fiktif',count:3}]);
assert.deepEqual(ecarePerformance.afterTrainingAgents.map(({label,count})=>[label,count]),[['Agen E-Care Fiktif',3]]);
assert.ok(report.badTickets.every(ticket=>ticket.tiers===undefined && ticket.afterTrainingAgents===undefined));
assert.deepEqual(bandung[0].categoryMonths[0].months,[{month:'2026-10',count:2}]);
assert.deepEqual(bandung[0].afterTrainingAgents[0].months,[{month:'2026-10',count:2}]);

const deepDiveFixture = {
  badTickets:[{channel:'GraPARI',service:'Fixed',month:'2026-10',area:'Area 1',region:'Region Fiktif',
    unit:'Unit Fiktif',category:'Kategori Fiktif',symptom:'KIP Fiktif',count:7}],
  badTicketAgents:[{channel:'GraPARI',service:'Fixed',month:'2026-10',area:'Area 1',region:'Region Fiktif',
    unit:'Unit Fiktif',agent:'99990010',name:'Agen Fiktif',count:4}],
  badTicketSlides:{months:['2026-09','2026-10'],fixed:{regions:[['Area 1','Region Fiktif',3,99]]},
    mobile:{regions:[['Area 1','Region Fiktif',9,12]],suspectCount:5}},
};
const serviceReport = filters => hardSkillReport(deepDiveFixture,params({channel:'GraPARI',from:'2026-10-01',...filters})).badTickets[0].services;
const [grapariFixed,grapariMobile] = serviceReport();
assert.deepEqual([grapariFixed.count,grapariFixed.prior,grapariMobile.count,grapariMobile.prior],[7,3,12,9]);
assert.deepEqual(grapariFixed.localMonths,['2026-10']);
const [{units:fixedRegionUnits,...fixedRegionCounts}] = grapariFixed.regions;
assert.deepEqual(fixedRegionCounts,{label:'Region Fiktif',count:7,months:[{month:'2026-10',count:7}],prior:3});
assert.deepEqual(fixedRegionUnits,[{label:'Unit Fiktif',count:7,months:[{month:'2026-10',count:7}],prior:null,
  categories:[{label:'Kategori Fiktif',count:7,months:[{month:'2026-10',count:7}],prior:null}]}]);
assert.deepEqual(grapariMobile.regions[0].units,[]);
assert.equal(grapariFixed.unitsByArea[0].rows[0].category,'Kategori Fiktif');
assert.equal(grapariFixed.suspects[0].count,4);
assert.deepEqual(grapariMobile.pptMonths,['2026-10']);
assert.equal(serviceReport({area:'Area 1'})[1].reference,undefined);
assert.equal(serviceReport({unit:'Unit Fiktif'})[1].months[0].count,null);

const mobileWorkbookFixture = {
  ...deepDiveFixture,
  contactCenterTickets:data.contactCenterTickets,
  mobileTicketDates:{'2026-10':'2026-10-31','2026-11':'2026-11-18'},
  badTickets:[
    ...deepDiveFixture.badTickets,
    {channel:'GraPARI',service:'Mobile',month:'2026-10',area:'Area 1',region:'Region Fiktif',count:20},
    {channel:'GraPARI',service:'Mobile',month:'2026-11',area:'Area 2',region:'West Jakarta',unit:'Gerai Fiktif',category:'Kategori Mobile',count:7},
    {channel:'GraPARI',service:'Mobile',month:'2026-11',area:'Area lain',region:'Region Lain Fiktif',count:1},
    {channel:'Call Center',service:'Mobile',month:'2026-11',site:'Site 2 · Semarang',unit:'CC Semarang',count:3},
    {channel:'E-Care',service:'Mobile',month:'2026-11',site:'Site 1 · Bandung',unit:'ECARE BANDUNG',count:4},
  ],
};
const novemberQuery = filters => hardSkillReport(mobileWorkbookFixture,params({from:'2026-11-01',to:'2026-11-30',...filters}));
const novemberNational = novemberQuery();
assert.equal(novemberNational.mobileTicketThrough,'2026-11-18');
const novemberMobile = novemberNational.performanceAnalytics.badTicketMobile;
assert.equal(novemberMobile.find(row=>row.label==='Area 2').values[0].rate,87.5);
assert.deepEqual(novemberMobile.at(-1).values,[{count:1,rate:12.5}]);
assert.equal(novemberNational.badTickets[0].priorScopeDiffers,true);
assert.equal(novemberNational.badTickets[0].prior,null);
assert.equal(novemberQuery({channel:'GraPARI',region:'Jakarta Banten'}).badTickets[0].services[1].count,7);
assert.equal(novemberQuery({channel:'GraPARI'}).badTickets[0].services[1].prior,20);
const novemberRegions = novemberQuery({channel:'GraPARI'}).badTickets[0].services[1].regions;
assert.deepEqual(novemberRegions.map(({units,...row})=>row).find(row=>row.label==='Jakarta Banten'),
  {label:'Jakarta Banten',count:7,months:[{month:'2026-11',count:7}],prior:0});
assert.deepEqual(novemberRegions.map(({units,...row})=>row).find(row=>row.label==='Region Fiktif'),
  {label:'Region Fiktif',count:0,months:[{month:'2026-11',count:0}],prior:20});
assert.equal(novemberRegions.reduce((sum,row)=>sum+row.count,0),8);
assert.deepEqual(novemberQuery({channel:'GraPARI',region:'West Jakarta'}).badTickets[0].services[1].regions.map(({label})=>label),
  ['West Jakarta']);
const novemberCallCenter = novemberQuery({channel:'Call Center'}).badTickets[0];
assert.equal(novemberCallCenter.count,3);
assert.deepEqual(novemberCallCenter.performance.services.map(({name,count,months})=>[name,count,months]),
  [['Mobile',3,['2026-11']]]);
assert.equal(novemberQuery({channel:'Call Center',unit:'CC Semarang'}).badTickets[0].performance.services[0].count,3);
const novemberEcare = novemberQuery({channel:'E-Care'}).badTickets[0];
assert.equal(novemberEcare.count,4);
assert.deepEqual(novemberEcare.performance.services.map(({name,count,sites})=>[name,count,sites.map(site=>site.key)]),
  [['Mobile',4,['bandung']]]);
assert.equal(novemberQuery({channel:'E-Care',unit:'CC Semarang'}).badTickets[0].performance.services[0].count,0);

const octoberReport = query({from:'2026-10-01'});
assert.deepEqual(octoberReport.performanceAnalytics.tnps[0],{label:'Area 1',values:[50],prior:40});
assert.deepEqual(report.performanceAnalytics.tnps[0],{label:'Area 1',values:[40,50],prior:null});
assert.doesNotMatch(JSON.stringify(octoberReport.performanceAnalytics),/"fcr/i);
const areaOnly = query({from:'2026-10-01'},['Area 1']).performanceAnalytics;
assert.deepEqual(areaOnly.badTicketFixed,[{label:'Area 1',values:[{count:5,rate:12.5}],prior:{count:2,rate:10}}]);
assert.deepEqual(query({region:'Region Fiktif'}).performanceAnalytics.tnps,[]);
assert.equal(query({channel:'Call Center'}).performanceAnalytics,undefined);
assert.equal(octoberReport.priorParticipation.totals.attendance,2);
assert.deepEqual(octoberReport.priorTrainingBreakdowns.bootcamp.locations.map(({label,attendance})=>[label,attendance]),[['Area 1',1]]);
assert.equal(query({from:'2026-10-01',channel:'Call Center'}).priorTrainingBreakdowns.bootcamp.attendance,0);

const site = query({place:'cc:site-2'});
assert.deepEqual(site.totals, {attendance: 2, participants: 2, sessions: 1, online: 2, offline: 0});
assert.deepEqual(site.groups, [{key:'cc:site-2', label:'Site 2', channel:'Contact Center', attendance:2}]);
assert.deepEqual(site.details.map(({channel})=>channel), ['Call Center','E-Care']);
assert.equal(site.comparisons['2026-10'].previous.attendance, 0);
assert.equal(query({place:'cc:site-2', channel:'E-Care'}).totals.attendance, 1);
assert.equal(query({method:'Online', material:'ACS iBooster', area:'AREA-2', region:'region fiktif'}).totals.attendance, 1);
assert.equal(query({unit:'unit fiktif', unitId:'CROSS-SOURCE-ID'}).totals.attendance, 5);

const missingMonth = query({from:'2026-11-01', to:'2026-11-30'});
assert.deepEqual(missingMonth.timeline.days, []);
assert.equal(missingMonth.comparisons['2026-11'].current, null);
assert.equal(missingMonth.totals.attendance, 0);
assert.equal(query({from:'2026-02-30'}), null);
console.log('PASS: Hard Skill counts, monthly comparison, filters, paired evaluation, and aggregate-only drilldown.');

const mixedAreas = ['Area-1','Contact Center'];
const scoped = query({},mixedAreas);
assert.equal(scoped.totals.attendance,3);
assert.deepEqual(scoped.badTickets.map(({channel})=>channel),['GraPARI','Call Center']);
assert.equal(scoped.badTickets.find(({channel})=>channel==='Call Center').serviceTotals[0].count,6);
assert.equal(query({region:'Jabar'},mixedAreas).badTickets[1].serviceTotals[0].count,6);
assert.equal(query({channel:'E-Care'},mixedAreas).totals.attendance,0);
assert.equal(query({},['']).totals.attendance,0);
assert.deepEqual(query({},['']).badTickets,[]);

const learning = {
  hasTraining:true, hasTryout:true,
  training:data.hardSkill.map(record=>({...record,type:'Hard Skill'})),
  tryout:data.hardSkill.map(record=>({...record,level:'Basic',score:80,week:1,session:[record.date.slice(0,7),1,'Basic',0]})),
};
const october = params({from:'2026-10-01'},mixedAreas);
const learningReport = localLearningReport(learning,october);
assert.equal(learningReport.training.attendance,1);
assert.equal(learningReport.priorTraining.attendance,2);
assert.equal(learningReport.tryout.attempts,1);
assert.equal(learningReport.priorTryout.attempts,2);
assert.equal(localLearningReport(learning,params({},[''])).training.attendance,0);

const scopedEcare = params({from:'2026-10-01',channel:'E-Care',area:'Site 2'},['E-Care']);
const canonicalLearning = {...learning,hardSkill:data.hardSkill,training:[
  ...learning.training,
  {...learning.training.find(record=>record.channel==='E-Care'),id:'NIK-FIKTIF-EXTRA'},
]};
const summaryEcare = localLearningReport(canonicalLearning,scopedEcare);
const detailEcare = hardSkillReport(canonicalLearning,scopedEcare);
assert.equal(summaryEcare.training.attendance,2);
assert.deepEqual([summaryEcare.training.hard,summaryEcare.training.hardAttendance,summaryEcare.training.hardSessions],
  [detailEcare.totals.participants,detailEcare.totals.attendance,detailEcare.totals.sessions]);
assert.equal(summaryEcare.groups[0].training.hard,1);
assert.equal(summaryEcare.priorTraining.hard,detailEcare.priorParticipation.totals.participants);

const ask = {placements:{'2026-10':Object.fromEntries(data.hardSkill.filter(row=>row.date.startsWith('2026-10')).map((row,index)=>[
  `FIKTIF-${index}`,
  ['Segmen fiktif','HAHAKO (HA)',[row.channel,row.area,row.region,`U${index}`,row.unit],`CSR Fiktif ${index}`,[80,80,80]],
]))}};
const ranked = localAskDrilldown(ask,params({view:'ranking'},mixedAreas));
assert.equal(ranked.total,1);
assert.deepEqual(ranked.top.map(({channel})=>channel),['Call Center']);
assert.equal(localAskDrilldown(ask,params({view:'ranking'},[''])).total,0);
const askRoster = {placements:{'2026-10':Object.fromEntries(Array.from({length:25},(_,index)=>[
  `CSR-FIKTIF-${index}`,
  ['Walk In Mitra','HAHAKO (HA)',['GraPARI','Area 1','Region Fiktif','U1','Unit Fiktif'],
    `CSR Fiktif ${index}`,[index+65,90,80]],
]))}};
const nationalRanks = localAskDrilldown(askRoster,params({view:'ranking'}));
assert.deepEqual(nationalRanks.top.map(row=>row.attitude),[89,88,87,86,85,84,83,82,81,80]);
assert.deepEqual(nationalRanks.bottom.map(row=>row.attitude),[65,66,67,68,69,70,71,72,73,74]);
assert.deepEqual(nationalRanks.top[0],{name:'CSR Fiktif 24',score:86.6,channel:'GraPARI',area:'Area 1',
  region:'Region Fiktif',unit:'Unit Fiktif',attitude:89,skill:90,knowledge:80});
assert.equal(localAskDrilldown(askRoster,params({view:'ranking',channel:'GraPARI'})).top.length,5);
const octoberRoster = askRoster.placements['2026-10'];
const priorRoster = Object.fromEntries(Object.entries(octoberRoster)
  .filter(([id])=>id!=='CSR-FIKTIF-23')
  .map(([id,placement])=>[id,id==='CSR-FIKTIF-24' ? [...placement.slice(0,3),'Nama Lama Fiktif',[65,90,80]] : placement]));
const compareQuery = params({from:'2026-10-01',view:'ranking',compare:'previous'});
const noPriorRanks = localAskDrilldown(askRoster,compareQuery);
assert.deepEqual(noPriorRanks.comparison,{month:'2026-09',available:false});
const ranksWithPrior = localAskDrilldown({
  placements:{'2026-10':octoberRoster,'2026-09':priorRoster},
},compareQuery);
assert.deepEqual(ranksWithPrior.comparison,{month:'2026-09',available:true});
assert.deepEqual(ranksWithPrior.top.slice(0,3).map(row=>row.previousRank),[24,null,1]);
assert.deepEqual(ranksWithPrior.bottom.slice(0,3).map(row=>row.previousRank),[1,3,4]);
assert.ok(!Object.hasOwn(ranksWithPrior.top[0],'id'));
const areaRoster = {placements:{
 '2026-10':{...octoberRoster,
  a2:['Walk In Mitra','LOLOKO (LA)',['GraPARI','Area 2','Region Fiktif','U2','Unit Dua'],'CSR Area Dua',[35,45,55]],
  a3:['Walk In Mitra','LOLOKO (LA)',['GraPARI','Area 3','Region Fiktif','U3','Unit Tiga'],'CSR Area Tiga',[55,65,75]],
  cc:['Call In','LOLOKO (LA)',['Call Center','','Region Fiktif','CC','Unit Call Center'],'CSR Call Center',[20,30,40]],
 },
 '2026-09':{...priorRoster,a2:['Walk In Mitra','LOLOKO (LA)',['GraPARI','Area 1','Region Fiktif','U1','Unit Fiktif'],'CSR Area Dua',[25,35,45]]},
}};
const areaFilters = {from:'2026-10-01',view:'ranking',compare:'previous',bottomBy:'area'};
const areaRanks = localAskDrilldown(areaRoster,params(areaFilters));
assert.deepEqual(areaRanks.bottomByArea.map(group=>[group.area,group.rows[0].name]),[
 ['Area 1','CSR Fiktif 0'],['Area 2','CSR Area Dua'],['Area 3','CSR Area Tiga'],
]);
assert.equal(areaRanks.bottomByArea[0].rows.length,10);
assert.equal(areaRanks.bottomByArea[0].rows[0].previousRank,2);
assert.equal(areaRanks.bottomByArea[1].comparison.available,false);
assert.equal(areaRanks.bottomByArea[1].rows[0].previousRank,null);
assert.ok(!Object.hasOwn(areaRanks,'bottom'));
assert.deepEqual(localAskDrilldown(areaRoster,params(areaFilters,['Area 2'])).bottomByArea.map(group=>group.area),['Area 2']);
const regionRoster = {placements:{'2026-10':{
 r1a:['Walk In Mitra','HAHAKO (HA)',['GraPARI','Area 1','Region A','U1','Unit Satu'],'CSR Region A Tinggi',[100,90,90]],
 r1b:['Walk In Mitra','HAHAKO (HA)',['GraPARI','Area 1','Region A','U2','Unit Dua'],'CSR Region A Rendah',[80,80,80]],
 r2a:['Call In','HAHAKO (HA)',['Call Center','','Region B','CC','CC BANDUNG'],'CSR Region B Tinggi',[90,100,100]],
 r2b:['Call In','HAHAKO (HA)',['Call Center','','Region B','CC','CC BANDUNG'],'CSR Region B Rendah',[70,70,70]],
 r3a:['E-Care','HAHAKO (HA)',['E-Care','','Region C','EC','ECARE SEMARANG'],'CSR Region C Tinggi',[95,95,95]],
}}};
const locationRanks = localAskDrilldown(regionRoster,params({from:'2026-10-01',view:'ranking',bottomBy:'location'}));
assert.deepEqual(locationRanks.rankingsByLocation.map(group=>[group.location,group.bottom[0].name]),[
 ['Area 1','CSR Region A Rendah'],['CC Bandung','CSR Region B Rendah'],['E-Care Semarang','CSR Region C Tinggi'],
]);
assert.equal(locationRanks.top[0].name,'CSR Region B Tinggi');
assert.equal(locationRanks.rankingsByLocation[0].top.length,2);
const dimensionQuery = params({
 view:'dimension',dimension:'attitude',level:'high',segment:'Walk In Mitra',sort:'score-desc',
 locationArea:'Area 1',locationRegions:JSON.stringify(['Region Fiktif']),
});
const highNames = localAskDrilldown(askRoster,dimensionQuery);
assert.equal(highNames.total,10);
assert.deepEqual(highNames.rows.map(row=>row.dimensionScore),[89,88,87,86,85,84,83,82,81,80]);
assert.ok(highNames.rows.every(row=>!Object.hasOwn(row,'id')));
dimensionQuery.set('level','low');
dimensionQuery.set('sort','name-asc');
assert.equal(localAskDrilldown(askRoster,dimensionQuery).rows[0].name,'CSR Fiktif 0');
dimensionQuery.set('locationRegions',JSON.stringify(['Region lain']));
assert.equal(localAskDrilldown(askRoster,dimensionQuery).total,0);
dimensionQuery.delete('locationRegions');
dimensionQuery.set('level','high');
dimensionQuery.set('from','2026-09-01');
const assessments = localAskDrilldown({placements:{'2026-10':octoberRoster,'2026-09':priorRoster}},dimensionQuery);
assert.equal(assessments.total,18);
assert.deepEqual([...new Set(assessments.rows.map(row=>row.month))],['2026-09','2026-10']);
console.log('PASS: multiple dashboard areas scope ASK drilldown, local learning and Bad Ticket consistently.');
