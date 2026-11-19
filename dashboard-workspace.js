// Dashboard presentation. Existing roster and survey calculations remain the source of truth.
const DASH_TABS=['Summary','ASK Performance','Training Hardskill & Soft skill','Training Reguler','Test Evaluation','Raw Data Table All'];
let dashboardTab=0,dashboardSub={2:'Hardskill',3:'ACS Booster',4:'Pre Test',5:'Agents'},dashboardGroup='Area',dashboardRawQuery='',dashboardRawPage=0;
const DASH_PROGRAMS=['Hardskill','Soft skill','ACS Booster','Bad Ticket','Reguler Try Out'];
function dashboardProgramRows(xs,program){
  const linked=state.activities.filter(a=>a.category===program);
  if(linked.length)return linked.flatMap(activity=>xs.filter(a=>activityAgentIds(activity).has(a.id)).map(a=>({agent_id:a.id,name:a.name,ctp:a.ctp,location:agentLocation(a),region:a.region,program,date:activity.date,status:activity.assessmentRecords?.some(r=>r.agentId===a.id&&r.type==='post')?'Completed':'Assigned',score:activity.assessmentRecords?.find(r=>r.agentId===a.id&&r.type==='post')?.score??'',source:'Saved activity',activity_id:activity.id})));
  // Isolated showcase fixtures: never written to the roster, survey feeds, or saved activities.
  const p=DASH_PROGRAMS.indexOf(program);
  return xs.filter(isShowcaseAgent).filter(a=>(Number(a.id.replace(/\D/g,''))+p)%4!==0).map(a=>{const i=Number(a.id.replace(/\D/g,''));const complete=(i+p)%7!==0;return {agent_id:a.id,name:a.name,ctp:a.ctp,location:agentLocation(a),region:a.region,program,date:'2026-10-'+String(8+p*3).padStart(2,'0'),status:complete?'Completed':'In Progress',score:complete?55+(i*7+p*11)%46:'',source:'Dummy program fixture',activity_id:'DEMO-PROGRAM-'+p}});
}
function dashMetric(label,value,note,target){return `<button class="dw-metric" data-dash-tab="${target}"><span>${label}</span><strong>${value}</strong><small>${note}</small><span class="dw-detail">View detail →</span></button>`}
function dashBars(rows,max=100){return `<div class="dw-bars">${rows.map(r=>`<div class="dw-bar" tabindex="0" data-chart-tip="${el(r.label+': '+r.value+' '+(r.unit||''))}"><div><span>${el(r.label)}</span><strong>${el(r.display??r.value)}${r.unit?' '+el(r.unit):''}</strong></div><div class="dw-track"><span style="width:${Math.max(0,Math.min(100,r.value/max*100))}%;background:${r.color||'#1B4F8A'}"></span></div></div>`).join('')||'<p class="dw-empty">No records match these filters.</p>'}</div>`}
function dashCard(title,subtitle,body,action=''){return `<article class="dw-card"><div class="dw-card-head"><div><h3>${title}</h3><p>${subtitle}</p></div>${action}</div><div class="dw-card-body">${body}</div></article>`}
function dashGroupControls(){return `<div class="cert-tabs" role="group" aria-label="Dashboard chart grouping">${['Nat','Area','Region'].map(g=>`<button class="cert-tab ${dashboardGroup===g?'active':''}" data-dash-group="${g}" aria-pressed="${dashboardGroup===g}">${g==='Nat'?'Nat.':g}</button>`).join('')}</div>`}
function dashGroups(xs){return !xs.length?[]:dashboardGroup==='Nat'?[{name:'National',rows:xs}]:assessmentGroups(xs,dashboardGroup)}
function dashSummary(xs){const paired=assessmentRows(xs),completed=xs.filter(a=>a.complete).length,cert=xs.filter(a=>a.certified).length;return `<div class="dw-metrics">${dashMetric('Agents in scope',xs.length,'Unique roster records',5)}${dashMetric('Training completed',xs.length?pct(completed,xs.length)+'%':'—',completed+' of '+xs.length+' agents',5)}${dashMetric('Average score gain',paired.length?(avg(paired.map(a=>a.post-a.pre))>=0?'+':'')+avg(paired.map(a=>a.post-a.pre)).toFixed(1)+' pp':'—',paired.length+' matched pre/post pairs',4)}${dashMetric('Certified agents',cert, xs.length?pct(cert,xs.length)+'% of filtered roster':'No matching agents',5)}</div><div class="dw-grid">${dashCard('Learning readiness','Roster completion and certification',dashBars([{label:'Training completed',value:completed,display:completed+' / '+xs.length},{label:'Certified',value:cert,display:cert+' / '+xs.length,color:'#374151'},{label:'Training unfinished',value:xs.length-completed,display:xs.length-completed,color:'#C8202E'}],Math.max(1,xs.length)),`<button class="dw-link" data-dash-tab="5">Training details →</button>`)}${dashCard('Where to focus','Counts update with the selected CTP and Area / Site',`<div class="dw-focus"><strong>${xs.length-completed}</strong><span>agents have unfinished training</span><strong>${paired.filter(a=>a.post<70).length}</strong><span>paired agents have post-test scores below 70</span><strong>${xs.filter(a=>a.attitude*.4+a.skill*.3+a.knowledge*.3<80).length}</strong><span>agents have weighted ASK scores below 80</span></div><p class="small">Showcase thresholds guide exploration; they are not official pass rules.</p>`,`<button class="dw-link" data-dash-tab="5">Inspect records →</button>`)}</div>${assessmentDistributions(xs)}${dashCard('Agent distribution','Counts by operational Area / Site or geographic Region',dashBars(dashGroups(xs).map(g=>({label:g.name,value:g.rows.length,unit:'agents'})),Math.max(1,...dashGroups(xs).map(g=>g.rows.length))),dashGroupControls())}`}
function dashASK(xs){return askDashboard(xs)}
function dashSubtabs(values){const current=dashboardSub[dashboardTab];return `<div class="dw-subtabs" role="group" aria-label="${el(DASH_TABS[dashboardTab])} sections">${values.map(v=>`<button data-dash-sub="${el(v)}" class="${current===v?'active':''}" aria-pressed="${current===v}">${el(v)}</button>`).join('')}</div>`}
function dashProgram(xs,program){const rows=dashboardProgramRows(xs,program),done=rows.filter(r=>r.status==='Completed'),scored=rows.filter(r=>r.score!==''&&Number.isFinite(Number(r.score)));const groups=[...new Set(rows.map(r=>r.location))];return `<p class="dw-source">${rows.some(r=>r.source==='Dummy program fixture')?'Dummy program showcase · Illustrative assignments and scores; separate from Pre-Post Evaluation.':'Saved activity records · Only explicitly linked attendees and assessments are included.'}</p><div class="dw-metrics">${dashMetric('Participants',new Set(rows.map(r=>r.agent_id)).size,program+' unique agents',5)}${dashMetric('Assignments',rows.length,'One row per agent and activity',5)}${dashMetric('Completed',done.length,rows.length?pct(done.length,rows.length)+'% of assignments':'No assignments',5)}${dashMetric('Average score',scored.length?avg(scored.map(r=>Number(r.score))).toFixed(1):'—',scored.length+' recorded scores / 100',5)}</div><div class="dw-grid">${dashCard('Completion status',program+' assignments',dashBars([{label:'Completed',value:done.length},{label:'Not completed',value:rows.length-done.length,color:'#C8202E'}],Math.max(1,rows.length)))}${dashCard('Participants by Area / Site','Assignment counts, not unique cross-program totals',dashBars(groups.map(g=>({label:g,value:rows.filter(r=>r.location===g).length})),Math.max(1,...groups.map(g=>rows.filter(r=>r.location===g).length))))}</div>${dashCard(program+' records','Inspect the records behind these charts',dashTable(rows,['agent_id','name','ctp','location','status','score','source']),`<button class="dw-link" data-dash-export="program">Export CSV</button>`)}`}
function dashTests(xs){const key=dashboardSub[4]==='Pre Test'?'pre':'post';if(dashboardSub[4]==='Reguler Try Out')return dashProgram(xs,'Reguler Try Out');const rows=assessmentRows(xs);return `<div class="dw-footer"><div><strong>${rows.length} matched pre/post pairs</strong><p class="small">${surveyState().enabled?'Connected survey snapshots':'Demo roster scores'} · Same paired records as Pre-Post Evaluation.</p></div><button class="btn" data-goto="8">Connect / manage survey links</button></div>${assessmentPie(rows,key,key==='pre'?'Pre-Test Distribution':'Post-Test Distribution')}${dashCard('Assessment records','Scores / 100; gain is post minus pre in percentage points',dashTable(rows.map(a=>({agent_id:a.id,name:a.name,ctp:a.ctp,location:agentLocation(a),pre:a.pre,post:a.post,gain:Number((a.post-a.pre).toFixed(1))})),['agent_id','name','ctp','location','pre','post','gain']))}`}
function dashRawRows(xs){if(dashboardSub[5]==='VoC')return vocRows(xs);if(dashboardSub[5]==='Programs')return DASH_PROGRAMS.flatMap(p=>dashboardProgramRows(xs,p));if(dashboardSub[5]==='Activities'){const ids=new Set(xs.map(a=>a.id));return state.activities.filter(a=>category==='All Categories'||a.category===category).filter(a=>ctp==='All CTPs'||a.ctp===ctp).filter(a=>(area==='All Areas'&&region==='All Regions'&&ctpScope==='All locations'&&!q)||[...activityAgentIds(a)].some(id=>ids.has(id))).map(a=>({activity_id:a.id,title:a.title,category:a.category,date:a.date,ctp:a.ctp,status:a.status,linked_agents:[...activityAgentIds(a)].filter(id=>ids.has(id)).length,source:'Saved activity'}))}const pairs=new Map(assessmentRows(xs).map(a=>[a.id,a]));return xs.map(a=>({agent_id:a.id,name:a.name,ctp:a.ctp,location:agentLocation(a),region:a.region,geographic_area:a.area,unit:a.unitName,csat:a.csat,fcr:meta(a).fcr,quiz:meta(a).quiz,attitude:a.attitude,skill:a.skill,knowledge:a.knowledge,weighted_ask:Number((a.attitude*.4+a.skill*.3+a.knowledge*.3).toFixed(1)),pre:pairs.get(a.id)?.pre??'',post:pairs.get(a.id)?.post??'',complete:a.complete,certified:a.certified,training_hours:a.trainingHours,source:surveyState().enabled?'Roster + connected paired scores':'Demo / locally imported roster'}))}
function dashFilteredRaw(xs){const query=dashboardRawQuery.toLowerCase();return dashRawRows(xs).filter(r=>Object.values(r).some(v=>String(v).toLowerCase().includes(query)))}
function dashTable(rows,keys){return `<div class="tablewrap dw-table" tabindex="0" aria-label="Scrollable data table"><table><thead><tr>${keys.map(k=>`<th scope="col">${el(k.replaceAll('_',' '))}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td>${el(r[k]===''||r[k]==null?'—':r[k])}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${keys.length}">No matching records. Reset filters or choose another category.</td></tr>`}</tbody></table></div>`}
function dashRaw(xs){const rows=dashFilteredRaw(xs),pages=Math.max(1,Math.ceil(rows.length/20));dashboardRawPage=Math.min(dashboardRawPage,pages-1);const keys=Object.keys(rows[0]||{agent_id:'',name:'',source:''});return `<div class="dw-footer"><form id="dashRawForm" class="dw-raw-search"><label class="field">Search this table<input id="dashRawSearch" placeholder="Search any column" value="${el(dashboardRawQuery)}"></label><button class="btn" type="submit">Apply search</button></form><span>${rows.length} matching records · All columns included in export</span><button class="btn" data-dash-export="raw">Export filtered CSV</button></div>${dashTable(rows.slice(dashboardRawPage*20,(dashboardRawPage+1)*20),keys)}<div class="dw-pagination"><button class="btn" data-dash-page="-1" ${dashboardRawPage===0?'disabled':''}>Previous</button><span>Page ${dashboardRawPage+1} of ${pages}</span><button class="btn" data-dash-page="1" ${dashboardRawPage>=pages-1?'disabled':''}>Next</button></div><p class="small">Agents, program assignments, saved activities, and VoC are separate tables to avoid double-counting. Download Excel includes all four datasets using the shared filters and applied table search. Unlinked activities appear only without location or agent restrictions.</p>`}
function dashboardWorkspace(){const xs=filtered();const descriptions=['Start with readiness, then explore assessment outcomes and locations.','Understand Attitude, Skill and Knowledge, then identify capability gaps.','Explore each training stream and the participants behind its results.','Review regular training programs independently.','Compare matched assessments or explore the separate Try Out showcase.','Inspect and export the source records behind the dashboard.'];return `<div class="dw-workspace"><section class="dw-filter"><div class="dw-filter-title"><strong>Dashboard filters</strong><span>Applies to all six categories</span><button class="dw-link" id="resetFilters">Reset filters</button></div><div class="dw-filter-grid"><label class="field">Channel / CTP<select id="ctp"><option>All CTPs</option>${CTPS.map(c=>`<option value="${c}" ${ctp===c?'selected':''}>${c==='Contact Center'?'Call Center':c}</option>`).join('')}</select></label><label class="field">Area / Site<select id="ctpScope"><option value="All locations">All Areas / Sites</option>${locationOptions().map(l=>`<option ${ctpScope===l?'selected':''}>${el(l)}</option>`).join('')}</select></label><label class="field">Region<select id="region"><option>All Regions</option>${(area==='All Areas'?ALL_REGIONS:REGIONS[area]||[]).map(r=>`<option ${region===r?'selected':''}>${el(r)}</option>`).join('')}</select></label><label class="field">Search agent / region<input id="search" value="${el(q)}" placeholder="Name, ID or region"></label><button class="btn" id="searchNow">Search</button></div><div class="dw-scope">${xs.length} agents · ${el(ctp==='Contact Center'?'Call Center':ctp)} · ${el(ctpScope)} · ${el(region)}${area!=='All Areas'?' · Geographic area: '+el(area):''}${category!=='All Categories'?' · Activity: '+el(category):''}<span>Demo reporting · October 2026</span></div></section><nav class="dw-tabs" aria-label="Dashboard categories">${DASH_TABS.map((t,i)=>`<button data-dash-tab="${i}" ${dashboardTab===i?'aria-current="page"':''}><small>0${i+1}</small>${t}</button>`).join('')}</nav><section aria-label="${DASH_TABS[dashboardTab]}" class="dw-panel"><div class="dw-section-title"><div><h2>${DASH_TABS[dashboardTab]}</h2><p>${descriptions[dashboardTab]}</p></div><div class="di-actions"><span class="dw-demo">SHOWCASE DATA</span>${dashboardTab===5?'<button class="btn" data-download-excel>Download Excel</button>':'<button class="btn" data-download-page>Download PDF</button>'}</div></div>${dashboardTab===2?dashSubtabs(['Hardskill','Soft skill']):dashboardTab===3?dashSubtabs(['ACS Booster','Bad Ticket']):dashboardTab===4?dashSubtabs(['Pre Test','Post Test','Reguler Try Out']):dashboardTab===5?dashSubtabs(['Agents','Programs','Activities','VoC']):''}${dashboardTab===0?participantOverview(xs)+executiveSummary(xs)+dashSummary(xs):dashboardTab===1?dashASK(xs):dashboardTab===2||dashboardTab===3?dashProgram(xs,dashboardSub[dashboardTab]):dashboardTab===4?dashTests(xs):dashRaw(xs)}${dashboardEnrichment(xs)}</section></div>`}
function bindDashboard(){document.getElementById('resetFilters')?.addEventListener('click',()=>{dashboardRawQuery='';dashboardRawPage=0;render()});document.querySelectorAll('[data-dash-tab]').forEach(b=>b.addEventListener('click',()=>{if(Number(b.dataset.dashTab)===5){dashboardSub[5]=(dashboardTab===2||dashboardTab===3||(dashboardTab===4&&dashboardSub[4]==='Reguler Try Out'))?'Programs':'Agents';dashboardRawQuery=(dashboardSub[5]==='Programs'?dashboardSub[dashboardTab]:'')}dashboardTab=Number(b.dataset.dashTab);dashboardRawPage=0;render();document.querySelector('.dw-tabs [aria-current]')?.focus({preventScroll:true})}));document.querySelectorAll('[data-dash-sub]').forEach(b=>b.addEventListener('click',()=>{dashboardSub[dashboardTab]=b.dataset.dashSub;dashboardRawQuery='';dashboardRawPage=0;render();document.querySelector('.dw-subtabs .active')?.focus({preventScroll:true})}));document.querySelectorAll('[data-dash-group]').forEach(b=>b.addEventListener('click',()=>{dashboardGroup=b.dataset.dashGroup;render()}));document.getElementById('dashRawForm')?.addEventListener('submit',e=>{e.preventDefault();dashboardRawQuery=document.getElementById('dashRawSearch').value;dashboardRawPage=0;render()});document.querySelectorAll('[data-dash-page]').forEach(b=>b.addEventListener('click',()=>{dashboardRawPage+=Number(b.dataset.dashPage);render()}));document.querySelectorAll('[data-dash-export]').forEach(b=>b.addEventListener('click',()=>{const rows=b.dataset.dashExport==='raw'?dashFilteredRaw(filtered()):dashboardProgramRows(filtered(),dashboardSub[dashboardTab]);if(!rows.length){notify('No records to export');return}csvDownload('omniknow-'+(b.dataset.dashExport==='raw'?dashboardSub[5]:dashboardSub[dashboardTab]),rows)}))}

// ASK uses final dimension scores. No personal workbook data is embedded in source.
let askSegmentFilter='All',askQuadrantFilter='All',askDetailQuery='',askDetailPage=0,askPerformanceWindow='MoM';
const ASK_QUADRANTS=[['HAHAKO (HA)','Pertahankan','High','High','High'],['HAHAKO (LA)','Tingkatkan Attitude','Low','High','High'],['HALOKO (HA)','Tingkatkan Knowledge','High','High','Low'],['HALOKO (LA)','Knowledge & Attitude','Low','High','Low'],['LOHAKO (HA)','Tingkatkan Skill','High','Low','High'],['LOHAKO (LA)','Skill & Attitude','Low','Low','High'],['LOLOKO (HA)','Skill & Knowledge','High','Low','Low'],['LOLOKO (LA)','Ketiga dimensi','Low','Low','Low']];
function askNumeric(v){return v==null||typeof v==='boolean'||String(v).trim()===''?NaN:Number(v)}
function askSegment(a){if(a.ctp==='E-Care')return 'E-Care';if(['Contact Center','Call Center'].includes(a.ctp))return 'Call Center';const model=a.businessModel||a.business_model||a.model;return ['MOMO','TOMO'].includes(model)?model:'GraPARI · model belum tersedia'}
function askPopulation(xs){const unique=[...new Map(xs.map(a=>[a.id,a])).values()];return {all:unique,excluded:unique.filter(a=>['Non Agent','CS SAR'].includes(a.askRole||a.job||a.JOB)),valid:unique.filter(a=>!['Non Agent','CS SAR'].includes(a.askRole||a.job||a.JOB)&&['attitude','skill','knowledge'].every(k=>Number.isFinite(askNumeric(a[k]))&&askNumeric(a[k])>=0&&askNumeric(a[k])<=100))}}
function askScope(xs){return xs.filter(a=>askSegmentFilter==='All'||askSegment(a)===askSegmentFilter)}
function askStats(xs){const p=askPopulation(xs),n=p.valid.length;return {...p,n,score:n?avg(p.valid.map(a=>askExcelLogic(a).score)):null,high:['attitude','skill','knowledge'].map(k=>({key:k,count:p.valid.filter(a=>askNumeric(a[k])>=80).length,rate:n?100*p.valid.filter(a=>askNumeric(a[k])>=80).length/n:null}))}}
function askDelta(now,previous,unit='pp',higherBetter=true){if(!Number.isFinite(now)||!Number.isFinite(previous))return '<span class="ak-delta neutral">— Belum ada pembanding</span>';const d=now-previous,flat=Math.abs(d)<.00001;return `<span class="ak-delta ${flat?'neutral':(d>0)===higherBetter?'positive':'negative'}">${flat?'→ Tetap':d>0?'↑ Naik':'↓ Turun'} ${Math.abs(d).toFixed(1)} ${unit}</span>`}
function askShiftDay(value,months){const [year,month,day]=value.split('-').map(Number),first=new Date(Date.UTC(year,month-1-months,1)),last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();return new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(day,last))).toISOString().slice(0,10)}
function askWindowMonths(){return {MoM:1,Quarter:3,Semester:6,YTD:12}[askPerformanceWindow]||1}
function withAskPreviousPeriod(fn){const from=reportFrom,to=reportTo;try{reportFrom=askShiftDay(from,askWindowMonths());reportTo=askShiftDay(to,askWindowMonths());return fn()}finally{reportFrom=from;reportTo=to}}
function askComparisonBounds(){return {from:askShiftDay(reportFrom,askWindowMonths()),to:askShiftDay(reportTo,askWindowMonths())}}
function askPrior(){return withAskPreviousPeriod(()=>askStats(askScope(filtered())))}
function askDetailRows(xs){return askStats(askScope(xs)).valid.filter(a=>(askQuadrantFilter==='All'||askExcelLogic(a).quadrant===askQuadrantFilter)&&(!askDetailQuery||[a.name,a.nik,a.id,a.region,a.unitName].join(' ').toLowerCase().includes(askDetailQuery.toLowerCase()))).sort((a,b)=>askExcelLogic(a).score-askExcelLogic(b).score||String(a.id).localeCompare(String(b.id)))}
let localAskReport;
let localAskMonth;
let localAskWindow = 'month';
let localAskChannel = '';
let localAskModel = '';
const localAskLocation = {area:'',region:'',unit:''};
const LOCAL_ASK_CHANNELS = {
 GraPARI: ['Walk In Mitra','Walk In TOMO'],
 'Call Center': ['Call In'],
 'E-Care': ['E-Care'],
};
let localAskQuadrantOrder = 'desc';
let localAskRequested = false;

function loadLocalAskReport() {
 if (localAskRequested || !['localhost','127.0.0.1'].includes(location.hostname)) return;
 localAskRequested = true;
 fetch('/api/local-ask-summary').then(async response => {
  if (response.status === 404) return;
  localAskReport = response.ok ? await response.json() : {};
  if (document.querySelector('.ak-dashboard')) render();
 }).catch(() => {
  localAskReport = {};
  if (document.querySelector('.ak-dashboard')) render();
 });
}

function localAskSlideTwo() {
 const months = Object.keys(localAskReport).sort();
 if (!months.length) return '<section class="ak-dashboard ak-panel"><h2>Report ASK · Slide 2</h2><p>Sumber ASK lokal belum bisa dibaca. Periksa workbook dan jalankan ulang server.</p></section>';
 const anchor = localAskMonth || months.at(-1);
 const years = [...new Set(months.map(key=>key.slice(0,4)))];
 const latestInYear = year => months.findLast(key=>key.startsWith(year+'-'));
 const month = localAskWindow==='ytd' ? latestInYear(anchor.slice(0,4))
  : localAskWindow==='month' && !months.includes(anchor) ? latestInYear(anchor.slice(0,4)) : anchor;
 const [year,number] = month.split('-').map(Number);
 const monthKey = offset => new Date(Date.UTC(year,number-1+offset,1)).toISOString().slice(0,7);
 const size = {month:1,quarter:3,semester:6,ytd:number}[localAskWindow];
 const first = localAskWindow==='ytd' ? 1-number : -((number-1)%size);
 const priorFirst = first-(localAskWindow==='ytd'?12:size);
 const range = start => Array.from({length:size},(_,index)=>monthKey(start+index));
 const expected = range(first), priorExpected = range(priorFirst);
 const available = expected.filter(key=>localAskReport[key]);
 const priorAvailable = priorExpected.filter(key=>localAskReport[key]);
 const comparable = available.length===size && priorAvailable.length===size;
 const allSegments = Object.values(LOCAL_ASK_CHANNELS).flat();
 const channelSegments = localAskChannel ? LOCAL_ASK_CHANNELS[localAskChannel] : allSegments;
 const segments = localAskChannel==='GraPARI' && localAskModel ? [localAskModel] : channelSegments;
 const scopedName = localAskModel==='Walk In Mitra'?'GraPARI · MOMO':localAskModel==='Walk In TOMO'?'GraPARI · TOMO':localAskChannel || 'Nasional';
 const currentLocationKeys = new Set(available.flatMap(key=>Object.keys(localAskReport[key].locations || {})));
 const locationOptions = [...currentLocationKeys].map(JSON.parse).filter(parts=>parts[0]===localAskChannel);
 const hasSelectedModel = parts => !localAskModel || available.some(key=>localAskReport[key].locations?.[JSON.stringify(parts)]?.[localAskModel]);
 const areas = localAskChannel==='GraPARI' ? locationOptions.filter(parts=>parts.length===2 && hasSelectedModel(parts)).map(parts=>parts[1]) : [];
 const area = areas.includes(localAskLocation.area) ? localAskLocation.area : '';
 const regions = locationOptions.filter(parts=>parts.length===3 && parts[1]===area && hasSelectedModel(parts)).map(parts=>parts[2]);
 const region = regions.includes(localAskLocation.region) ? localAskLocation.region : '';
 const units = locationOptions.filter(parts=>parts.length===5 && parts[1]===area && parts[2]===region && hasSelectedModel(parts));
 const unitParts = units.find(parts=>JSON.stringify(parts)===localAskLocation.unit);
 const locationKey = unitParts ? JSON.stringify(unitParts) : region ? JSON.stringify([localAskChannel,area,region]) : area ? JSON.stringify([localAskChannel,area]) : '';
 const scope = [scopedName,area,region,unitParts?.[4]].filter(Boolean).map(el).join(' · ');
 const quadrantMonth = available.at(-1);
 const rollup = keys => {
  const result = {groups:Object.fromEntries(segments.map(name=>[name,{total:0,high:[0,0,0]}])),excluded:0,incomplete:0,unassigned:0};
  for(const key of keys){
   const row=localAskReport[key];
   for(const field of ['excluded','incomplete','unassigned']) result[field]+=row[field];
   for(const name of segments){
    const group = locationKey ? row.locations?.[locationKey]?.[name] : row.groups[name];
    if (!group) continue;
    result.groups[name].total+=group.total;
    group.high.forEach((count,index)=>{result.groups[name].high[index]+=count});
   }
  }
  return result;
 };
 const current = rollup(available);
 const previous = comparable ? rollup(priorAvailable) : null;
 const snapshot = quadrantMonth && localAskReport[quadrantMonth];
 const quadrantGroups = !snapshot ? null : localAskWindow==='month'
  ? Object.fromEntries(segments.map(name=>[name,(locationKey ? snapshot.locations?.[locationKey]?.[name] : snapshot.groups[name])?.quadrants || {}]))
  : locationKey ? snapshot.latestLocationQuadrants?.[localAskWindow]?.[locationKey] || {}
   : snapshot.latestQuadrants?.[localAskWindow];
 const availableQuadrants = Object.fromEntries(segments.map(name=>[name,quadrantGroups?.[name] || {}]));
 const unit = size===1 ? 'CSR' : 'penilaian';
 const segmentNames = {'Walk In Mitra':'Walk In (Mitra)','Walk In TOMO':'Walk In (TOMO)','Call In':'Call In','E-Care':'E-Care'};
 const segmentSymbols = {'Walk In Mitra':'▦','Walk In TOMO':'▥','Call In':'☎','E-Care':'✉'};
 const num = value => value.toLocaleString('id-ID');
 const pct = (count,total) => total ? (100*count/total).toLocaleString('id-ID',{maximumFractionDigits:1})+'%' : '—';
 const rate = (count,total) => total ? 100*count/total : null;
 const total = segments.reduce((sum,name)=>sum+current.groups[name].total,0);
 const dimensions = ['Attitude','Skill','Knowledge'];
 const monthLabel = value => new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'-01T00:00:00Z'));
 const rangeLabel = keys => keys.length===1 ? monthLabel(keys[0]) : `${monthLabel(keys[0])} – ${monthLabel(keys.at(-1))}`;
 const coverage = keys => keys.length ? keys.map(monthLabel).join(', ') : 'Belum ada data';
 const previousTotal = previous ? segments.reduce((sum,name)=>sum+previous.groups[name].total,0) : 0;
 const periods = {
  month: months.map(key=>[key,monthLabel(key)]),
  quarter: years.flatMap(y=>['01','04','07','10'].map((m,i)=>[`${y}-${m}`,`Q${i+1} ${y}`])),
  semester: years.flatMap(y=>['01','07'].map((m,i)=>[`${y}-${m}`,`S${i+1} ${y}`])),
  ytd: years.map(y=>[latestInYear(y),y]),
 };
 const periodLabels = {month:'Bulan laporan',quarter:'Triwulan laporan',semester:'Semester laporan',ytd:'Tahun laporan'};
 const selectedPeriod = localAskWindow==='quarter'||localAskWindow==='semester' ? expected[0] : month;
 const countComparison = (count,before) => {
  if (before===undefined) return '<small>Pembanding belum tersedia</small>';
  const change = count-before;
  const direction = change>0 ? '↑ Naik' : change<0 ? '↓ Turun' : '→ Tetap';
  const style = change>0 ? 'positive' : change<0 ? 'negative' : 'neutral';
  return `<small>Sebelumnya ${num(before)} ${unit}</small> <span class="ak-delta ${style}">${direction}${change?` ${num(Math.abs(change))} ${unit}`:''}</span>`;
 };
 const resultLabel = (count,denominator) => `${num(count)} (${pct(count,denominator)})`;
 const failureLabel = (pass,denominator) => `${num(denominator-pass)} dari ${num(denominator)} ${unit} (${pct(denominator-pass,denominator)})`;
 const channelCards = Object.entries(LOCAL_ASK_CHANNELS).filter(([name])=>!localAskChannel||localAskChannel===name).map(([name,children])=>{
  const visible = children.filter(child=>segments.includes(child));
  const count = visible.reduce((sum,child)=>sum+current.groups[child].total,0);
  const before = previous ? visible.reduce((sum,child)=>sum+previous.groups[child].total,0) : undefined;
  return `<article class="ak-kpi ask-report-stat ask-report-csr"><span class="ask-report-icon" aria-hidden="true">${segmentSymbols[children[0]]}</span><span>${name}</span><strong>${num(count)} <small>${unit}</small></strong>${countComparison(count,before)}${name==='GraPARI'?`<ul class="ask-channel-children">${visible.map(child=>`<li><span>${segmentNames[child]}</span><b>${num(current.groups[child].total)}</b></li><li class="ask-child-comparison">${countComparison(current.groups[child].total,previous?.groups[child].total)}</li>`).join('')}</ul>`:''}</article>`;
 }).join('');
 const summary = dimensions.map((label,index)=>{
  const high = segments.reduce((sum,name)=>sum+current.groups[name].high[index],0);
  const before = previous ? segments.reduce((sum,name)=>sum+previous.groups[name].high[index],0) : 0;
  return `<article class="ak-kpi ask-report-stat"><span class="ask-report-icon" aria-hidden="true">✓</span><span>${label} lulus</span><strong>${resultLabel(high,total)}</strong><small>Lulus dari ${num(total)} ${unit}</small>${previous?`<small>Sebelumnya ${resultLabel(before,previousTotal)} dari ${num(previousTotal)} ${unit}</small>`: ''}${previous?askDelta(rate(high,total),rate(before,previousTotal)):''}<dl class="ask-report-fail"><dt>Tidak lulus</dt><dd><span>${rangeLabel(expected)}</span><b>${failureLabel(high,total)}</b></dd><dd><span>${rangeLabel(priorExpected)}</span><b>${previous?failureLabel(before,previousTotal):'Belum tersedia'}</b></dd></dl></article>`;
 }).join('');
 const cards = segments.map(name => {
  const now = current.groups[name], before = previous?.groups[name];
  return `<article class="ak-panel ask-report-card"><header><h4><span class="ask-report-icon" aria-hidden="true">${segmentSymbols[name]}</span> ${el(segmentNames[name])}</h4><span>${num(now.total)} ${unit}</span></header>
  ${now.high.map((count,index)=>{
   const last = before ? rate(before.high[index],before.total) : null;
   return `<div class="ask-report-metric"><div><span>${dimensions[index]}</span><strong>${resultLabel(count,now.total)}</strong></div>
   <div class="ask-report-bar" aria-hidden="true"><i style="width:${rate(count,now.total) ?? 0}%"></i>${last===null?'':`<b style="left:${last}%"></b>`}</div>
   <div class="ask-report-detail"><small>High dari ${num(now.total)} ${unit}</small><small>Low ${resultLabel(now.total-count,now.total)}</small></div>
   ${before ? `<div class="ask-report-detail"><small>Sebelumnya · High ${resultLabel(before.high[index],before.total)} · Low ${resultLabel(before.total-before.high[index],before.total)} dari ${num(before.total)} ${unit}</small>${askDelta(rate(count,now.total),last)}</div>` : ''}</div>`;
  }).join('')}</article>`;
 }).join('');
 const quadrants = ['HAHAKO (HA)','HAHAKO (LA)','HALOKO (HA)','LOHAKO (HA)','HALOKO (LA)','LOHAKO (LA)','LOLOKO (HA)','LOLOKO (LA)'];
 if (segments.some(name => availableQuadrants[name]['BELUM TERSEDIA'])) quadrants.push('BELUM TERSEDIA');
 const quadrantCounts = quadrants.map(label=>({
  label, count: segments.reduce((sum,name)=>sum+(availableQuadrants[name][label] || 0),0)
 })).sort((a,b)=>localAskQuadrantOrder==='asc'?a.count-b.count:b.count-a.count);
 const scale = Math.max(1,...quadrantCounts.map(row=>row.count));
 const quadrantColors = Object.fromEntries(allSegments.map((name,i)=>[name,['#203b6b','#487fb6','#78b9df','#bcdcf0'][i]]));
 const quadrantChart = quadrantCounts.map(({label,count})=>{
  const levels = ASK_QUADRANTS.find(([code])=>code===label)?.slice(2);
  const explanation = levels ? dimensions.map((name,i)=>`<span class="${levels[i]==='High'?'ask-level-high':'ask-level-low'}">${name} ${levels[i]==='High'?'lulus':'belum lulus'}</span>`).join('') : '<span>Kuadran belum tercatat</span>';
  const parts = segments.map(name=>{
   const value = availableQuadrants[name][label] || 0;
   return value ? `<span style="width:${100*value/scale}%;background:${quadrantColors[name]}" title="${el(segmentNames[name])} · ${num(value)} CSR"></span>` : '';
  }).join('');
  const counts = segments.map(name=>{
   const value = availableQuadrants[name][label] || 0;
   return `<span title="${el(segmentNames[name])}"><i style="background:${quadrantColors[name]}" aria-hidden="true"></i><span class="ask-quadrant-sr">${el(segmentNames[name])} </span>${num(value)}</span>`;
  }).join('');
  const detailQuery = unitParts && count ? new URLSearchParams({
   unit: locationKey, quadrant: label, from: expected[0], to: expected.at(-1), segment: localAskModel,
  }) : null;
  const detail = detailQuery
   ? `<div class="ask-csr-detail" data-ask-unit-query="${el(detailQuery.toString())}" aria-live="polite"></div>`
   : `<p>${unitParts?'Tidak ada CSR di kuadran ini untuk unit terpilih.':'Pilih Unit Name untuk melihat detail CSR.'}</p>`;
  return `<details class="ask-quadrant-drill"><summary class="ask-quadrant-row" aria-label="Lihat rincian ${label}"><div class="ask-quadrant-label"><b>${label}</b><div class="ask-quadrant-levels">${explanation}</div></div><div><div class="ask-quadrant-track" aria-hidden="true">${parts}</div><div class="ask-quadrant-counts" aria-label="Jumlah CSR per segmen">${counts}</div></div><strong>${num(count)} <span aria-hidden="true">⌄</span></strong></summary>
  <div class="ask-quadrant-drill-body"><ul>${segments.map(name=>`<li>${el(segmentNames[name])} <b>${num(availableQuadrants[name][label] || 0)} CSR</b></li>`).join('')}</ul>${detail}</div></details>`;
 }).join('');
 const locationSelect = (id,label,options,selected) => options.length ? `<label>${label}<select id="${id}"><option value="">Semua</option>${options.sort((a,b)=>a[1].localeCompare(b[1],'id')).map(([value,text])=>`<option value="${el(value)}" ${value===selected?'selected':''}>${el(text)}</option>`).join('')}</select></label>` : '';
 const unitOptions = units.map(parts=>[JSON.stringify(parts),units.some(other=>other!==parts && other[4]===parts[4]) ? `${parts[4]} (${parts[3] || 'tanpa ID'})` : parts[4]]);
 const locationFilters = locationSelect('localAskArea','Area',areas.map(value=>[value,value]),area)
  + locationSelect('localAskRegion','Region',regions.map(value=>[value,value]),region)
  + locationSelect('localAskUnit','Unit Name',unitOptions,unitParts?localAskLocation.unit:'');
 return `<section class="ak-dashboard ask-report" aria-label="Report ASK Slide 2">
 <header class="ak-hero"><div><h2>Profil ASK per segmen</h2><p>Ringkasan slide 2 dari workbook ASK</p></div></header>
 <div class="ak-panel ask-report-filters"><div class="ak-toolbar ask-filter-row"><label>Periode kinerja<select id="localAskWindow">${Object.entries({month:'Bulanan',quarter:'Triwulan',semester:'Semester',ytd:'YTD'}).map(([value,label])=>`<option value="${value}" ${value===localAskWindow?'selected':''}>${label}</option>`).join('')}</select></label><label>${periodLabels[localAskWindow]}<select id="localAskMonth">${periods[localAskWindow].map(([value,label])=>`<option value="${el(value)}" ${value===selectedPeriod?'selected':''}>${el(label)}</option>`).join('')}</select></label>
 <label>CTP / Channel<select id="localAskChannel"><option value="">Nasional · Semua CTP</option>${Object.keys(LOCAL_ASK_CHANNELS).map(name=>`<option ${name===localAskChannel?'selected':''}>${name}</option>`).join('')}</select></label>
 </div>
 ${localAskChannel?`<div class="ask-filter-location"><h3>Lokasi</h3><div class="ak-toolbar ask-filter-row">${localAskChannel==='GraPARI'?`<label>Business Model<select id="localAskModel"><option value="">Semua model</option>${LOCAL_ASK_CHANNELS.GraPARI.map((name,i)=>`<option value="${name}" ${name===localAskModel?'selected':''}>${['MOMO','TOMO'][i]} · ${segmentNames[name]}</option>`).join('')}</select></label>`:''}${locationFilters}</div></div>`: ''}</div>
 <div class="ak-panel"><strong>${rangeLabel(expected)}</strong><p>Data tersedia (${available.length}/${size} bulan) · ${coverage(available)}</p><strong>Pembanding · ${rangeLabel(priorExpected)}</strong><p>Data tersedia (${priorAvailable.length}/${size} bulan) · ${coverage(priorAvailable)}</p>${comparable?'':'<p>Perubahan belum ditampilkan karena cakupan kedua periode belum lengkap.</p>'}</div>
 ${!available.length?'<div class="ak-panel"><h3>Belum ada data untuk periode ini</h3><p>Pilih periode lain untuk melihat hasil ASK.</p></div>':`<section><h3>Cakupan · ${scope}</h3><p><strong>${num(total)} ${unit}</strong> ${countComparison(total,previous?previousTotal:undefined)}${size===1?'':' Satu CSR dapat menyumbang satu penilaian setiap bulan.'}</p><div class="ask-report-grid">${channelCards}</div></section>
 <section><h3>Kelulusan · ${scope}</h3><p>Jumlah tidak lulus dihitung per dimensi.</p><div class="ask-report-national">${summary}</div></section>
 <section><h3>Kelulusan per segmen</h3><p>High = skor ≥80. Low = skor di bawah 80. ${previous?'Garis pada batang menandai persentase bulan sebelumnya.':''}</p><div class="ask-report-segments">${cards}</div></section>
 <section class="ak-panel ask-report-extra"><div class="ask-quadrant-heading"><div><h3>Distribusi kuadran ASK</h3><p>Posisi terakhir setiap CSR dalam periode. Setiap kuadran menunjukkan kombinasi kelulusan Attitude, Skill, dan Knowledge. Nilai 80 ke atas dinyatakan lulus.</p></div>
 <label>Urutkan berdasarkan total CSR <select id="localAskQuadrantOrder"><option value="desc" ${localAskQuadrantOrder==='desc'?'selected':''}>Terbanyak ke tersedikit</option><option value="asc" ${localAskQuadrantOrder==='asc'?'selected':''}>Tersedikit ke terbanyak</option></select></label></div>
 <ul class="ask-quadrant-legend">${segments.map(name=>`<li><i style="background:${quadrantColors[name]}" aria-hidden="true"></i>${el(segmentNames[name])}</li>`).join('')}</ul>
 <div class="ask-quadrant-chart">${quadrantGroups?quadrantChart:'<p>Data kuadran periode ini belum tersedia. Jalankan ulang server lokal.</p>'}</div>
 <details class="ask-report-extra"><summary>Lihat jumlah per segmen</summary><div class="tablewrap" style="overflow:auto"><table><thead><tr><th scope="col">Kuadran</th>${segments.map(name=>`<th scope="col">${el(segmentNames[name])}</th>`).join('')}</tr></thead><tbody>${quadrantCounts.map(({label})=>`<tr><th scope="row">${label}</th>${segments.map(name=>`<td>${num(availableQuadrants[name][label] || 0)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details></section>
 <details class="ak-panel ask-report-extra"><summary>Detail cakupan data nasional</summary><p>${num(current.excluded)} Non Kuadran · ${num(current.incomplete)} skor belum valid · ${num(current.unassigned)} belum terpetakan ke segmen. Perubahan persentase ditampilkan dalam poin persentase (pp).</p></details>`}</section>`;
}

function askDashboard(xs){
 if (localAskReport) return localAskSlideTwo();
 const scoped=askScope(xs),s=askStats(scoped),prev=askPrior(),segments=[...new Set([...xs.map(askSegment),...(askSegmentFilter==='All'?[]:[askSegmentFilter])])],fmt=v=>v==null?'—':v.toFixed(1),invalid=s.all.length-s.excluded.length-s.n;
 const metric=(label,value,note,delta,color,comparison)=>`<article class="ak-kpi" style="--ak-accent:${color}"><div class="ak-kpi-head"><span>${label}</span><span class="ak-metric-icon">${askMetricIcon(label)}</span></div><strong>${value}</strong><p>${note}</p>${delta}${comparison||''}</article>`;
 const groups=key=>[...new Set(s.valid.map(key))].map(label=>({label,rows:s.valid.filter(a=>key(a)===label),prior:prev.valid.filter(a=>key(a)===label)}));
 const compare=items=>`<div class="ak-compare">${items.map(g=>{const cur=askStats(g.rows),old=askStats(g.prior);return `<div class="ak-group"><div class="ak-group-title"><strong>${el(g.label)}</strong><span>${cur.n} orang · ASK ${fmt(cur.score)}</span></div>${cur.high.map((h,i)=>`<div class="ak-bar-row"><span>${['Attitude','Skill','Knowledge'][i]}</span><div class="ak-track"><i style="width:${h.rate||0}%;background:${['#ed1639','#f18b25','#7059d9'][i]}"></i></div><b>${fmt(h.rate)}%</b></div>`).join('')}${askDelta(cur.score,old.score,'poin')}</div>`}).join('')||'<p class="ak-empty">Belum ada data pada cakupan ini.</p>'}</div>`;
 const rows=askDetailRows(xs),pages=Math.max(1,Math.ceil(rows.length/15)),currentPage=Math.min(askDetailPage,pages-1),detail=rows.slice(currentPage*15,(currentPage+1)*15);
 return `<section class="ak-dashboard" aria-label="ASK capability dashboard"><header class="ak-hero"><div><span class="ak-eyebrow">PEOPLE CAPABILITY / ASK</span><h2>Kenali potensi.<br>Fokuskan pengembangan.</h2><p>Attitude, Skill & Knowledge · High ≥80 · Skor akhir 40 / 30 / 30</p></div><div class="ak-hero-side"><span>PERIODE LAPORAN</span><strong>${el(reportFrom)} — ${el(reportTo)}</strong><small>${s.all.some(isShowcaseAgent)?'DATA DEMO · riwayat sintetis':'Data lokal · sesuai periode terpilih'}</small><button class="btn" data-ask-pdf>↓ Download ASK PDF</button></div></header>
 ${askContextFilters()}<div class="ak-toolbar"><label>Segmen<select id="askSegment"><option value="All">Semua segmen</option>${segments.map(g=>`<option ${askSegmentFilter===g?'selected':''}>${el(g)}</option>`).join('')}</select></label><p>${askPerformanceWindow}: ${askComparisonBounds().from} – ${askComparisonBounds().to}<br><small>Selisih tingkat High dalam percentage point (pp); skor dalam poin.</small></p></div>
 <section class="ak-coverage" aria-label="Cakupan penilaian ASK"><span class="ak-coverage-icon">${askMetricIcon('Orang dinilai')}</span><div><span>CAKUPAN PENILAIAN</span><h3><strong>${s.n.toLocaleString('id-ID')}</strong> orang dinilai</h3><p>${s.all.length} dalam cakupan · ${s.excluded.length} Non Kuadran · ${invalid} belum lengkap</p></div>${askDelta(s.n,prev.all.length?prev.n:null,'orang')}</section>
 <div class="ak-kpis">${s.high.map((h,i)=>metric('High '+['Attitude','Skill','Knowledge'][i],fmt(h.rate)+'%',`${h.count} dari ${s.n} orang mencapai ≥80`,askDelta(h.rate,prev.high[i].rate),['#ed1639','#f18b25','#7059d9'][i],askComparisonDetails(s,prev,i))).join('')}</div>
 <div class="ak-reading"><strong>Skor ASK rata-rata <b>${fmt(s.score)}</b> / 100</strong>${askDelta(s.score,prev.score,'poin')}<span>Persentase High menghitung orang yang mencapai 80, bukan rata-rata nilai.</span></div>
 ${askCharts(s)}
 <div class="ak-section-head"><div><span class="ak-eyebrow">01 / DISTRIBUSI KAPABILITAS</span><h3>Delapan kuadran, arah perbaikan yang jelas</h3><p>High Quadrant: minimal dua dimensi High. Low Quadrant: minimal dua dimensi Low. Klik kartu untuk detail agen.</p></div><button class="ak-link" data-ask-reset>Reset pilihan</button></div>
 ${askQuadrantGroups(s,prev)}
 <div class="ak-two"><article class="ak-panel"><div class="ak-section-head"><div><span class="ak-eyebrow">02 / SEGMEN</span><h3>Di kanal mana gap terbesar?</h3><p>Persentase High per dimensi · skala tetap 0–100%.</p></div></div>${compare(groups(askSegment))}</article><article class="ak-panel"><div class="ak-section-head"><div><span class="ak-eyebrow">03 / AREA & SITE</span><h3>Prioritas pengembangan wilayah</h3><p>Participants by Area / Site · mengikuti filter bersama.</p></div></div>${compare(groups(a=>a.ctp==='E-Care'?'E-Care · '+agentLocation(a):agentLocation(a)))}</article></div>
 <article class="ak-panel" id="askAgentDetail" tabindex="-1"><div class="ak-section-head"><div><span class="ak-eyebrow">04 / DETAIL AGEN</span><h3>${askQuadrantFilter==='All'?'Daftar prioritas pengembangan':el(askQuadrantFilter)}</h3><p>${rows.length} orang · skor terendah lebih dulu · klik nama untuk profil.</p></div><button class="btn" data-ask-export>↓ Export CSV</button></div><form id="askSearchForm" class="ak-search"><label>Cari nama, NIK, unit atau region<input name="search" value="${el(askDetailQuery)}" placeholder="Cari agen…"></label><button class="btn" type="submit">Cari</button></form><div class="tablewrap"><table><thead><tr><th>Agen / NIK</th><th>Segmen / Lokasi</th><th>Attitude</th><th>Skill</th><th>Knowledge</th><th>ASK / 100</th><th>Kuadran</th><th>Fokus pengembangan</th><th>Talent Pool</th></tr></thead><tbody>${detail.map(a=>{const r=askExcelLogic(a);return `<tr><td><button class="ak-link" data-agent="${el(a.id)}">${el(a.name)}</button><small class="ak-cell-sub">${el(a.nik||a.id)}</small></td><td>${el(askSegment(a))}<small class="ak-cell-sub">${el(agentLocation(a))} · ${el(a.region)}</small></td>${['attitude','skill','knowledge'].map(k=>`<td><span class="ak-score ${a[k]>=80?'high':'low'}">${Number(a[k]).toFixed(1)}</span></td>`).join('')}<td><b>${r.score.toFixed(1)}</b></td><td>${r.quadrant}</td><td>${el(r.recommendation)}</td><td>${r.talent}</td></tr>`}).join('')||'<tr><td colspan="9" class="ak-empty">Tidak ada agen yang sesuai. Reset pilihan atau ubah periode.</td></tr>'}</tbody></table></div><div class="ak-pagination"><button class="btn" data-ask-page="${currentPage-1}" ${currentPage===0?'disabled':''}>← Sebelumnya</button><span>${currentPage+1} / ${pages}</span><button class="btn" data-ask-page="${currentPage+1}" ${currentPage>=pages-1?'disabled':''}>Berikutnya →</button></div></article>
 <details class="ak-method"><summary>Cara membaca metrik & sumber data</summary><p>High ≥80; Low &lt;80. Kuadran dihitung dari tiga dimensi secara terpisah. Skor akhir = 40% Attitude + 30% Skill + 30% Knowledge. Talent Pool: ≥80 Excellent, ≥70 Good, ≥60 Core, &lt;60 Growth Potential.</p><p>Non Agent dan CS SAR tidak masuk pembagi High/Low atau kuadran. Nilai kosong, tidak numerik, atau di luar 0–100 dikeluarkan sebagai belum lengkap. Model MOMO/TOMO hanya ditampilkan jika tercatat; model yang belum ada tidak ditebak.</p><p>File Excel pribadi belum diimpor. Data demo tetap berlabel dan perbandingan memakai snapshot demo bertanggal. Untuk data aktual, dibutuhkan riwayat bertanggal dan model bisnis yang sesuai. Periode beberapa bulan memakai snapshot terbaru per agen, bukan penjumlahan orang per bulan.</p></details></section>`;
}
function bindLocalAskDetails(){
 document.querySelectorAll('.ask-quadrant-drill').forEach(drill=>{
  const target = drill.querySelector('[data-ask-unit-query]');
  if (!target) return;
  drill.addEventListener('toggle',async ()=>{
   if (!drill.open || target.dataset.loaded) return;
   target.dataset.loaded = 'true';
   target.textContent = 'Memuat detail CSR…';
   try {
    const response = await fetch('/api/local-ask-unit-details?'+target.dataset.askUnitQuery);
    if (response.status===404) {
     target.textContent = 'Detail CSR perlu diaktifkan di server lokal.';
     return;
    }
    if (!response.ok) throw new Error('ASK details unavailable');
    const rows = await response.json();
    const score = value => `${value.toLocaleString('id-ID')} · ${value>=80?'Lulus':'Belum lulus'}`;
    target.innerHTML = rows.length
     ? `<h4>Detail CSR · ${rows.length} orang</h4><div class="tablewrap"><table><thead><tr>${['Nama CSR','Attitude','Skill','Knowledge','Bulan penilaian'].map(label=>`<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${el(row.name || 'Nama belum tersedia')}</th>${row.scores.map(value=>`<td>${score(value)}</td>`).join('')}<td>${el(row.month)}</td></tr>`).join('')}</tbody></table></div>`
     : '<p>Tidak ada CSR pada pilihan ini.</p>';
   } catch {
    delete target.dataset.loaded;
    target.textContent = 'Detail CSR gagal dimuat. Tutup dan buka kembali kuadran untuk mencoba lagi.';
   }
  });
 });
}

function bindAskDashboard(){bindLocalAskDetails();for(const [field,id] of [['area','localAskArea'],['region','localAskRegion'],['unit','localAskUnit']]){document.getElementById(id)?.addEventListener('change',event=>{localAskLocation[field]=event.target.value;if(field==='area')localAskLocation.region='';if(field!=='unit')localAskLocation.unit='';render();document.getElementById(id)?.focus({preventScroll:true})})}document.getElementById('localAskChannel')?.addEventListener('change',e=>{localAskChannel=e.target.value;localAskModel='';Object.assign(localAskLocation,{area:'',region:'',unit:''});render();document.getElementById('localAskChannel')?.focus({preventScroll:true})});document.getElementById('localAskModel')?.addEventListener('change',e=>{localAskModel=e.target.value;Object.assign(localAskLocation,{area:'',region:'',unit:''});render();document.getElementById('localAskModel')?.focus({preventScroll:true})});document.getElementById('localAskWindow')?.addEventListener('change',e=>{localAskWindow=e.target.value;render();document.getElementById('localAskWindow')?.focus({preventScroll:true})});document.getElementById('localAskQuadrantOrder')?.addEventListener('change',e=>{localAskQuadrantOrder=e.target.value;render();document.getElementById('localAskQuadrantOrder')?.focus({preventScroll:true})});if(document.querySelector('.ak-dashboard'))loadLocalAskReport();document.getElementById('localAskMonth')?.addEventListener('change',e=>{localAskMonth=e.target.value;render()});document.querySelectorAll('[data-ask-pdf]').forEach(b=>b.onclick=askDownloadSummary);document.getElementById('askActivityCategory')?.addEventListener('change',e=>{category=e.target.value;askDetailPage=0;render()});document.getElementById('askPerformanceWindow')?.addEventListener('change',e=>{askPerformanceWindow=e.target.value;if(askPerformanceWindow==='YTD')reportFrom=reportTo.slice(0,4)+'-01-01';askDetailPage=0;render()});document.getElementById('askSegment')?.addEventListener('change',e=>{askSegmentFilter=e.target.value;askDetailPage=0;render()});document.querySelectorAll('[data-ask-quadrant]').forEach(b=>b.onclick=()=>{askQuadrantFilter=b.dataset.askQuadrant;askDetailPage=0;render();document.getElementById('askAgentDetail')?.focus({preventScroll:true});document.getElementById('askAgentDetail')?.scrollIntoView({behavior:'smooth',block:'start'})});document.querySelectorAll('[data-ask-reset]').forEach(b=>b.onclick=()=>{askQuadrantFilter='All';askSegmentFilter='All';askDetailQuery='';askDetailPage=0;render()});document.getElementById('askSearchForm')?.addEventListener('submit',e=>{e.preventDefault();askDetailQuery=e.target.elements.search.value.trim();askDetailPage=0;render()});document.querySelectorAll('[data-ask-page]').forEach(b=>b.onclick=()=>{askDetailPage=Number(b.dataset.askPage);render()});document.querySelectorAll('[data-ask-export]').forEach(b=>b.onclick=()=>{const rows=askDetailRows(filtered());if(!rows.length){notify('Tidak ada data untuk diekspor');return}csvDownload('OmniKnow-ASK-'+reportFrom+'-'+reportTo,rows.map(a=>{const e=askExcelLogic(a);return {agent_id:a.id,name:a.name,segment:askSegment(a),location:agentLocation(a),region:a.region,attitude:a.attitude,skill:a.skill,knowledge:a.knowledge,weighted_ask:e.score,quadrant:e.quadrant,recommendation:e.recommendation,talent:e.talent,from:reportFrom,to:reportTo,comparison_window:askPerformanceWindow,comparison_from:askComparisonBounds().from,comparison_to:askComparisonBounds().to,source:isShowcaseAgent(a)?'Synthetic demo':'Local record'}}))})}

function askFilters(){return `<section class="ak-topfilters" aria-label="Filter ASK"><label>Channel / CTP<select id="ctp"><option>All CTPs</option>${CTPS.map(c=>`<option value="${c}" ${ctp===c?'selected':''}>${c==='Contact Center'?'Call Center':c}</option>`).join('')}</select></label><label>Area / Site<select id="ctpScope"><option value="All locations">All Areas / Sites</option>${locationOptions().map(l=>`<option ${ctpScope===l?'selected':''}>${el(l)}</option>`).join('')}</select></label><label>Region<select id="region"><option>All Regions</option>${(area==='All Areas'?ALL_REGIONS:REGIONS[area]||[]).map(r=>`<option ${region===r?'selected':''}>${el(r)}</option>`).join('')}</select></label><label>Cari agen / region<input id="search" value="${el(q)}" placeholder="Nama atau ID agen"></label><button class="btn" id="searchNow">Cari</button><button class="ak-link" id="resetFilters">Reset filter</button>${area!=='All Areas'||category!=='All Categories'?`<p class="ak-inherited">Filter lintas halaman: ${el(area)} · ${el(category)}. Reset filter untuk menghapus.</p>`:''}</section>`}

// Chart history follows the selected reporting boundaries, including custom ranges.
function askHistory(){
 const point=()=>{const stats=askStats(askScope(filtered()));return {from:reportFrom,to:reportTo,n:stats.n,score:stats.score}};
 return [...withAskPreviousPeriod(()=>[withAskPreviousPeriod(point),point()]),point()];
}
function askCharts(s){
 const history=askHistory(),last=history[2],previous=history[1];
 const x=i=>55+i*160,y=v=>190-v*1.5;
 const segments=[];for(let i=1;i<history.length;i++)if(history[i-1].score!=null&&history[i].score!=null)segments.push(`<path d="M ${x(i-1)} ${y(history[i-1].score)} L ${x(i)} ${y(history[i].score)}"/>`);
 const summary=history.map(p=>`${p.from} sampai ${p.to}: ${p.n} orang, skor ${p.score==null?'belum tersedia':p.score.toFixed(1)}`).join('; ');
 return `<div class="ak-chart-grid"><article class="ak-panel ak-highlow"><div class="ak-section-head"><div><span class="ak-eyebrow">KOMPOSISI DIMENSI</span><h3>Seberapa besar gap kapabilitas?</h3><p>Persentase orang dengan nilai High dan Low pada setiap dimensi.</p></div></div><div class="ak-chart-legend"><span><i style="background:#009c58"></i>High ≥80</span><span><i style="background:#ed1639"></i>Low &lt;80</span></div>${s.n?s.high.map((h,i)=>`<div class="ak-composition"><div><strong>${['Attitude','Skill','Knowledge'][i]}</strong><span><b>${h.rate.toFixed(1)}%</b> High</span></div><div class="ak-stack" role="img" aria-label="${['Attitude','Skill','Knowledge'][i]}: ${h.count} High (${h.rate.toFixed(1)}%), ${s.n-h.count} Low (${(100-h.rate).toFixed(1)}%)"><span style="width:${h.rate}%;background:#009c58" title="High: ${h.count} orang"></span><span style="width:${100-h.rate}%;background:#ed1639" title="Low: ${s.n-h.count} orang"></span></div><div class="ak-composition-foot"><span>${h.count} orang High</span><span>${s.n-h.count} orang Low · ${(100-h.rate).toFixed(1)}%</span></div></div>`).join(''):'<p class="ak-empty">Belum ada skor valid pada periode ini.</p>'}<p class="ak-chart-note">Pembagi sama untuk ketiga dimensi: ${s.n} orang dengan skor A/S/K lengkap. Jumlah per dimensi tidak dijumlahkan menjadi total orang.</p></article>
 <article class="ak-panel ak-trend"><div class="ak-section-head"><div><span class="ak-eyebrow">PERGERAKAN SKOR</span><h3>Bagaimana arah perkembangan ASK?</h3><p>Rata-rata skor ASK / 100 · garis putus-putus menunjukkan acuan 80.</p></div></div><div class="ak-trend-summary"><strong>${last.score==null?'—':last.score.toFixed(1)}<small> / 100</small></strong>${askDelta(last.score,previous.score,'poin')}</div><svg class="ak-trend-svg" viewBox="0 0 430 235" role="img" aria-label="${el(summary)}"><title>${el(summary)}</title>${[0,50,80,100].map(v=>`<line x1="40" x2="405" y1="${y(v)}" y2="${y(v)}" stroke="${v===80?'#c5a15a':'#e9eaf0'}" ${v===80?'stroke-dasharray="5 4"':''}/><text x="30" y="${y(v)+4}" text-anchor="end">${v}</text>`).join('')}<g fill="none" stroke="#ed1639" stroke-width="3.5" stroke-linecap="round">${segments.join('')}</g>${history.map((p,i)=>`${p.score==null?'':`<circle cx="${x(i)}" cy="${y(p.score)}" r="5" fill="#ed1639" stroke="white" stroke-width="2"><title>${p.from} – ${p.to}: ${p.score.toFixed(1)} / 100 · ${p.n} orang</title></circle><text x="${x(i)}" y="${y(p.score)-13}" text-anchor="middle" class="ak-point-value">${p.score.toFixed(1)}</text>`}<text x="${x(i)}" y="215" text-anchor="middle">${p.from.slice(0,7)}</text>`).join('')}</svg><div class="ak-trend-periods">${history.map(p=>`<div><strong>${el(p.from)}<br>${el(p.to)}</strong><span>${p.n} orang${p.score==null?' · belum ada data':''}</span></div>`).join('')}</div><p class="ak-chart-note">Rentang pembanding ${askPerformanceWindow}: bergeser ${askWindowMonths()} bulan dengan filter yang sama. Populasi dapat berubah; grafik ini bukan bukti perpindahan individu. Titik kosong tidak disambungkan. Riwayat demo bersifat sintetis.</p></article></div>`;
}
function askQuadrantGroups(s,prev){
 const highCount=q=>q.slice(2).filter(level=>level==='High').length;
 const card=([label,action,A,S,K])=>{const count=s.valid.filter(a=>askExcelLogic(a).quadrant===label).length,old=prev.valid.filter(a=>askExcelLogic(a).quadrant===label).length,high=[A,S,K].filter(v=>v==='High').length;
 return `<button class="ak-quadrant ak-q-tone-${high} ${askQuadrantFilter===label?'selected':''}" data-ask-quadrant="${label}" aria-pressed="${askQuadrantFilter===label}"><span class="ak-q-title">${label}</span><strong>${count}<small>${s.n?(count/s.n*100).toFixed(1):'—'}% dari total</small></strong><div class="ak-dimensions">${[A,S,K].map((v,j)=>`<span class="${v==='High'?'high':'low'}" aria-label="${['Attitude','Skill','Knowledge'][j]} ${v}">${['Attitude','Skill','Knowledge'][j]} ${v==='High'?'↑':'↓'}</span>`).join('')}</div><div class="ak-q-note"><p>${action}</p><small class="ak-q-change">${prev.n?`${count-old>0?'↑ +':count-old<0?'↓ −':'→ '}${Math.abs(count-old)} orang vs sebelumnya`:'Belum ada pembanding'}</small></div></button>`};
 return `<div class="ak-quadrant-groups">${[true,false].map(isHigh=>{const qs=ASK_QUADRANTS.filter(q=>(highCount(q)>=2)===isHigh),labels=new Set(qs.map(q=>q[0])),count=s.valid.filter(a=>labels.has(askExcelLogic(a).quadrant)).length;
 return `<section class="ak-quadrant-group ${isHigh?'ak-high-group':'ak-low-group'}" aria-label="${isHigh?'High':'Low'} Quadrant"><header><div><span class="ak-group-marker"></span><h4>${isHigh?'High':'Low'} Quadrant</h4></div><strong>${count} orang <small>· ${s.n?(count/s.n*100).toFixed(1):'—'}%</small></strong><p>${isHigh?'Dua atau tiga dimensi mencapai ≥80.':'Dua atau tiga dimensi berada di bawah 80.'}</p></header><div class="ak-quadrants">${qs.map(card).join('')}</div></section>`}).join('')}</div><p class="ak-quadrant-key">Warna merangkum jumlah dimensi High/Low. Panah pada kartu menunjukkan level dimensi; perubahan bulanan ditampilkan terpisah di bagian bawah kartu.</p>`;
}

// Decorative icons belong only to ASK metric cards; labels remain the accessible names.
function askMetricIcon(label){
 const shapes=label==='Orang dinilai'?'<circle cx="12" cy="7" r="3"/><path d="M6.5 21v-3a5.5 5.5 0 0 1 11 0v3M3 21v-2a4 4 0 0 1 2-3.5M21 21v-2a4 4 0 0 0-2-3.5"/><path d="M5.5 5a2.5 2.5 0 1 0 0 5M18.5 5a2.5 2.5 0 1 1 0 5"/>':label==='High Attitude'?'<path d="M20.8 4.6a5 5 0 0 0-7.1 0L12 6.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 20.5l8.8-8.8a5 5 0 0 0 0-7.1Z"/><path d="m8.5 12 2.3 2.3 4.7-4.7"/>':label==='High Skill'?'<path d="M14 6a4.5 4.5 0 0 0-5.6 5.6L3 17a2.1 2.1 0 0 0 3 3l5.4-5.4A4.5 4.5 0 0 0 17 9l-3 1-2-2 2-2Z"/><path d="m17 3 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z"/>':'<path d="M12 6v15M3 4.5c3-1 6-.5 9 1.5 3-2 6-2.5 9-1.5v14c-3-1-6-.5-9 1.5-3-2-6-2.5-9-1.5v-14Z"/><path d="M6 8h2M6 11h2M16 8h2M16 11h2"/>';
 return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes}</svg>`;
}

function askContextFilters(){return `<section class="ak-context-filters" aria-label="Kategori dan pembanding ASK"><label>Activity Category<select id="askActivityCategory">${['All Categories',...categories()].map(c=>`<option ${category===c?'selected':''}>${el(c)}</option>`).join('')}</select></label><label>Performance Window<select id="askPerformanceWindow">${['MoM','Quarter','Semester','YTD'].map(w=>`<option ${askPerformanceWindow===w?'selected':''}>${w}</option>`).join('')}</select></label><p>MoM: pembanding 1 bulan sebelumnya · Quarter: 3 bulan · Semester: 6 bulan · YTD: 1 Januari sampai To date, dibandingkan tahun lalu. Tidak ada data pembanding ditampilkan sebagai belum tersedia.</p></section>`}
function askComparisonDetails(current,previous,index){const c=current.high[index],p=previous.high[index],bounds=askComparisonBounds(),name=['Attitude','Skill','Knowledge'][index],valid=c.rate!=null&&p.rate!=null,delta=valid?c.rate-p.rate:null,relative=valid&&p.rate!==0?(delta/p.rate*100):null;
 return `<details class="ak-comparison-details"><summary>Comparison details</summary><div><p>${reportFrom}–${reportTo}<br>vs ${bounds.from}–${bounds.to} · ${askPerformanceWindow}</p><strong>HIGH ${name.toUpperCase()}</strong>${askDelta(c.rate,p.rate)}<p class="ak-comparison-values">${p.rate==null?'—':p.rate.toFixed(1)+'%'} → ${c.rate==null?'—':c.rate.toFixed(1)+'%'}<br>${p.count} / ${previous.n} orang → ${c.count} / ${current.n} orang</p><p>${!valid?'Belum ada data pembanding yang lengkap.':relative==null?(c.rate===0?'Perubahan relatif: 0%.':'Perubahan relatif belum terdefinisi karena nilai sebelumnya 0%.'):'Perubahan relatif: '+(relative>0?'+':'')+relative.toFixed(1)+'%. Selisih utama memakai percentage point (pp).'}</p></div></details>`}

function askDownloadSummary(){const current=askStats(askScope(filtered())),prior=askPrior(),bounds=askComparisonBounds(),scope=exportScope().split(' | MoM:')[0];const lines=[scope,'ASK comparison: '+askPerformanceWindow+' | '+bounds.from+' to '+bounds.to,'Segment: '+askSegmentFilter,'Source: '+(current.all.some(isShowcaseAgent)?'Synthetic demo history':'Local dated records'),'Assessed: '+current.n+' | Non quadrant: '+current.excluded.length,'Weighted ASK: '+(current.score==null?'No data':current.score.toFixed(2))+' / 100',...current.high.map((h,i)=>['Attitude','Skill','Knowledge'][i]+' High: '+h.count+' / '+current.n+' ('+(h.rate==null?'No data':h.rate.toFixed(1)+'%')+') | Previous: '+(prior.high[i].rate==null?'No data':prior.high[i].rate.toFixed(1)+'%')+' | Change: '+(h.rate==null||prior.high[i].rate==null?'No previous data':(h.rate-prior.high[i].rate).toFixed(1)+' pp')),...ASK_QUADRANTS.map(([q])=>q+': '+current.valid.filter(a=>askExcelLogic(a).quadrant===q).length),'High >=80. Final ASK = 40% Attitude + 30% Skill + 30% Knowledge.'];savePdfBlob(makeDashboardPdf('ASK Capability Summary',lines,current.high.filter(h=>h.rate!=null).map((h,i)=>({label:['High Attitude','High Skill','High Knowledge'][i],value:h.rate,color:['#ed1639','#f18b25','#7059d9'][i]}))),'OmniKnow-ASK-'+reportFrom+'.pdf');notify('ASK PDF download requested')}
