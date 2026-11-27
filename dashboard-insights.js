const DASHBOARD_CSR_ICON_PATH = 'M15 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m19 0v-2a4 4 0 0 0-3-4m-2-12a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z';
const DASHBOARD_ASK_DIMENSION_ICONS = {
 Attitude:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM8 14a5 5 0 0 0 8 0M9 9h.01M15 9h.01',
 Skill:'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8Z',
 Knowledge:'M12 6v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v14h-5a4 4 0 0 0-4 3 4 4 0 0 0-4-3H3V4Z',
};
const DASHBOARD_QUADRANT_SERIES = [
 {segment:'Call In',label:'Call Center',color:'call-center'},
 {segment:'E-Care',label:'E-Care',color:'ecare'},
 {segment:'Walk In TOMO',label:'GraPARI · TOMO',color:'tomo'},
 {segment:'Walk In Mitra',label:'GraPARI · Mitra',color:'mitra'},
];

function dashboardAskChannelIcon(channel) {
 return dashboardChannelIcon(DASH_CHANNELS.find(item=>item.label===channel)?.icon);
}

// Additive demo migration: existing assignments and connected survey rosters are retained.
function seedEcare(){
  if(state.ecareDemoVersion===1)return;
  for(let i=0;i<12;i++){
    const id='ECARE-DEMO-'+String(i+1).padStart(3,'0');
    if(state.agents.some(a=>a.id===id))continue;
    const a=AREAS[i%4],pre=50+i*2;
    state.agents.push({id,name:'E-Care Demo Agent '+String(i+1).padStart(2,'0'),ctp:'E-Care',area:a,region:REGIONS[a][Math.floor(i/4)],pre,post:Math.min(100,pre+10+i%5*3),attitude:66+i*2,skill:62+i*3,knowledge:65+i*3,complete:i%5!==0,certified:i%4!==0,csat:74+i*2,trainingHours:10+i,unitName:'E-Care Demo Team',branch:'E-Care Demo Team'});
  }
  state.ecareDemoVersion=1;
}
function isShowcaseAgent(a){return demoAgents.some(d=>d.id===a.id)||/^ECARE-DEMO-\d{3}$/.test(a.id)}
function vocRows(xs=filtered()){
  const topics=['Resolution clarity','Response speed','Agent empathy','Follow-up'];
  const sentiments=['Positive','Neutral','Negative'];
  return xs.filter(isShowcaseAgent).flatMap(a=>Array.from({length:3},(_,j)=>{const i=Number(a.id.replace(/\D/g,'')),v=(i*3+j*7)%10,sentiment=sentiments[v<6?0:v<8?1:2],topic=topics[(i+j)%4];return {feedback_id:'VOC-'+a.id+'-'+j,agent_id:a.id,name:a.name,ctp:a.ctp,location:agentLocation(a),region:a.region,date:'2026-10-'+String(10+(i+j)%19).padStart(2,'0'),sentiment,topic,comment:sentiment==='Positive'?'Clear and helpful support.':sentiment==='Neutral'?'Support was adequate; more detail would help.':'Resolution and follow-up need improvement.',source:'Dummy customer feedback'};}));
}
let vocSentiment='All',vocTopic='All';
function visibleVoc(xs){return vocRows(xs).filter(r=>(vocSentiment==='All'||r.sentiment===vocSentiment)&&(vocTopic==='All'||r.topic===vocTopic))}
function agentVocPanel(xs){const all=vocRows(xs),rows=visibleVoc(xs);return `<section class="dw-voc"><div class="dw-section-title"><div><h2>Agent VoC · Voice of Customer</h2><p>Dummy customer feedback linked to agents. ${all.length} responses · ${new Set(all.map(r=>r.agent_id)).size} agents.</p></div></div><div class="dw-grid">${dashCard('Customer sentiment','Click a bar to filter feedback; hover or focus for counts',insightBars(['Positive','Neutral','Negative'].map((s,i)=>({label:s,value:all.filter(r=>r.sentiment===s).length,color:['#1B4F8A','#6B7280','#C8202E'][i],action:'voc-sentiment',key:s})),Math.max(1,all.length)))}${dashCard('Customer feedback topics','Click a topic to inspect related feedback',insightBars(['Resolution clarity','Response speed','Agent empathy','Follow-up'].map(s=>({label:s,value:all.filter(r=>r.topic===s).length,action:'voc-topic',key:s})),Math.max(1,...['Resolution clarity','Response speed','Agent empathy','Follow-up'].map(s=>all.filter(r=>r.topic===s).length))))}</div><div class="dw-footer"><span>${rows.length} matching responses · ${el(vocSentiment)} sentiments · ${el(vocTopic)} topics</span><button class="btn" data-voc-reset>Reset VoC selection</button></div>${dashTable(rows,['name','ctp','location','sentiment','topic','comment','source'])}<p class="small">VoC selection filters this feedback table only. Shared CTP / Area / Site / Region filters apply to the entire page. No sentiment is inferred from test scores.</p></section>`}
function insightBars(rows,max=100){return `<div class="dw-bars">${rows.map(r=>`<button class="di-bar" ${r.action?`data-insight-action="${r.action}" data-insight-key="${el(r.key)}"`:''} data-chart-tip="${el(r.label+': '+r.value+(r.unit?' '+r.unit:''))}" type="button"><span><span>${el(r.label)}</span><strong>${r.value}${el(r.unit||'')}</strong></span><span class="dw-track"><span style="width:${Math.min(100,Math.max(0,r.value/max*100))}%;background:${r.color||'#1B4F8A'}"></span></span></button>`).join('')||'<p class="dw-empty">No matching records.</p>'}</div>`}
function rankDataset(xs=filtered(),tab=dashboardTab,sub=dashboardSub[tab]){
  if(tab===5&&sub==='VoC'){const feedback=dashFilteredRaw(xs);return {metric:'Positive VoC responses (%) per agent · dummy feedback',rows:xs.filter(a=>feedback.some(r=>r.agent_id===a.id)).map(a=>{const rs=feedback.filter(r=>r.agent_id===a.id);return {...a,score:rs.filter(r=>r.sentiment==='Positive').length/rs.length*100}})}}
  if(tab===5&&sub==='Agents'){const ids=new Set(dashFilteredRaw(xs).map(r=>r.agent_id));xs=xs.filter(a=>ids.has(a.id))}
  if(tab===5&&sub==='Activities'){const ids=new Set(dashFilteredRaw(xs).flatMap(r=>[...activityAgentIds(state.activities.find(a=>a.id===r.activity_id))]));xs=xs.filter(a=>ids.has(a.id))}
  if(tab===2||tab===3||(tab===4&&sub==='Reguler Try Out')||(tab===5&&sub==='Programs')){
    const rs=tab===5?dashFilteredRaw(xs):dashboardProgramRows(xs,sub),ids=[...new Set(rs.map(r=>r.agent_id))];
    return {metric:'Average recorded program score / 100',rows:ids.map(id=>{const scored=rs.filter(r=>r.agent_id===id&&validAssessmentScore(r.score));const a=xs.find(a=>a.id===id)||state.agents.find(a=>a.id===id);return {...a,score:scored.length?avg(scored.map(r=>Number(r.score))):null}}).filter(r=>r.id&&r.score!==null)};
  }
  if(tab===0||tab===4){const key=tab===4&&sub==='Pre Test'?'pre':'post';return {metric:(key==='pre'?'Pre-test':'Post-test')+' score / 100 · matched pairs',rows:assessmentRows(xs).map(a=>({...a,score:Number(a[key])}))}}
  return {metric:'Weighted ASK / 100 · 40% Attitude, 30% Skill, 30% Knowledge',rows:xs.map(a=>({...a,score:a.attitude*.4+a.skill*.3+a.knowledge*.3}))};
}
function rankingLists(data){const unique=[...new Map(data.rows.map(a=>[a.id,a])).values()].filter(a=>Number.isFinite(a.score));const top=[...unique].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,5),bottom=[...unique].sort((a,b)=>a.score-b.score||a.id.localeCompare(b.id)).slice(0,5);return {all:unique,top,bottom}}
function rankingPanel(data){const lists=rankingLists(data);const previous=new Map(withPreviousPeriod(()=>rankDataset(filtered(),page===3?1:page===8?4:dashboardTab,page===8?"Post Test":undefined).rows).map(a=>[a.id,a.score]));const renderList=(rows,ascending)=>rows.map(a=>`<button class="di-rank" data-agent="${el(a.id)}"><span class="di-rank-number">${1+lists.all.filter(x=>ascending?x.score<a.score:x.score>a.score).length}</span><span><strong>${el(a.name)}</strong><small>${el(a.ctp==='Contact Center'?'Call Center':a.ctp)} · ${el(agentLocation(a))} · ${el(a.id)}</small></span><span class="rank-result"><b>${a.score.toFixed(1)}</b>${momBadge(a.score,previous.get(a.id))}</span></button>`).join('')||'<p class="dw-empty">No scored agents in this scope.</p>';return `<section class="di-rankings"><div class="dw-section-title"><div><h2>Top & bottom agent rankings</h2><p>${el(data.metric)} · ${lists.all.length} scored agents. Click an agent for details.</p></div></div><div class="dw-grid">${dashCard('Top 5','Highest scores in the current scope',renderList(lists.top,false))}${dashCard('Bottom 5','Lowest scores in the current scope',renderList(lists.bottom,true))}</div><p class="small">Equal scores share a rank; agent ID orders ties. With fewer than 10 scored agents, the two lists may overlap. Showcase rankings are not employee performance decisions.</p></section>`}
function extraCharts(xs,tab=dashboardTab,sub=dashboardSub[tab]){
  const data=rankDataset(xs,tab,sub),rows=data.rows;
  const bands=SCORE_BANDS.map(b=>({label:b.label,value:rows.filter(a=>a.score>=b.min&&a.score<b.max).length,color:b.color}));
  const regionRows=[...new Set(rows.map(a=>a.region))].map(r=>({label:r,value:Number(avg(rows.filter(a=>a.region===r).map(a=>a.score)).toFixed(1)),action:'region',key:r}));
  return `<div class="dw-grid di-charts">${dashCard('Score distribution',data.metric+' · agent counts',insightBars(bands,Math.max(1,...bands.map(b=>b.value))))}${dashCard('Regional score comparison','Average score / 100 · click a region to filter this page',insightBars(regionRows))}</div>${tab===0||tab===4?pairedChangeChart(xs):''}`;
}
function pairedChangeChart(xs){const rows=assessmentRows(xs);return dashCard('Pre / post learning movement','Each dot is one matched agent. Horizontal: pre-test; vertical: post-test. Click a dot for agent details.',`<svg class="di-scatter" viewBox="0 0 560 290" role="group" aria-label="Pre and post score scatter plot"><path d="M40 20V250H530" fill="none" stroke="#6B7280"/><path d="M40 250L530 20" fill="none" stroke="#6B7280" stroke-dasharray="5 5"/>${[0,25,50,75,100].map(v=>`<text x="${40+4.9*v}" y="269" text-anchor="middle">${v}</text><text x="30" y="${254-2.3*v}" text-anchor="end">${v}</text>`).join('')}<text x="280" y="286" text-anchor="middle">Pre-test score / 100</text><text x="42" y="14">Post-test score / 100</text>${rows.map(a=>`<circle tabindex="0" role="button" data-agent="${el(a.id)}" aria-label="${el(a.name+' pre '+a.pre+', post '+a.post)}" data-chart-tip="${el(a.name+' · '+a.ctp+'\nPre '+a.pre+' · Post '+a.post+' · Gain '+(a.post-a.pre).toFixed(1)+' pp')}" cx="${40+Number(a.pre)*4.9}" cy="${250-Number(a.post)*2.3}" r="5" fill="${a.post<a.pre?'#C8202E':'#1B4F8A'}" stroke="white"/>`).join('')}</svg><p class="small">Dashed line: no score change. Blue: unchanged or improved; red: lower post-test. ${rows.length} valid pairs; overlapping dots can represent multiple agents.</p>`)}
function dashboardEnrichment(xs){if(dashboardTab===1)return '';return `${dashboardTab===0?'':participantOverview(xs)}${extraCharts(xs)}${rankingPanel(rankDataset(xs))}${dashboardTab===0||(dashboardTab===4&&dashboardSub[4]!=='Reguler Try Out')?agentVocPanel(xs):''}`}
function alignNumericTableCells(root=document) {
 root.querySelectorAll('table tbody td, table tbody th').forEach(cell=>{
  const value=cell.textContent.trim();
  if (/^[+−-]?\d[\d.,\s]*(?:%|pp|poin|CSR|\/\s*100)?$/i.test(value)) cell.classList.add('numeric-data-cell');
 });
}
function bindInsights(){alignNumericTableCells();document.querySelectorAll('[data-insight-action]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.insightKey;if(b.dataset.insightAction==='region'){if(region!==k)dashboardUnit='';region=k}if(b.dataset.insightAction==='voc-sentiment')vocSentiment=k;if(b.dataset.insightAction==='voc-topic')vocTopic=k;render()}));document.querySelectorAll('[data-voc-reset]').forEach(b=>b.addEventListener('click',()=>{vocSentiment='All';vocTopic='All';render()}));document.querySelectorAll('.di-scatter [data-agent]').forEach(b=>b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();modal={type:'agent',id:b.dataset.agent};render()}}));document.querySelectorAll('[data-download-page]').forEach(b=>b.addEventListener('click',()=>downloadPagePdf()));document.querySelectorAll('[data-download-excel]').forEach(b=>b.addEventListener('click',()=>downloadDashboardExcel()));}

function participantOverview(xs){
 const ids=new Set(xs.map(a=>a.id));
 const pairs=assessmentRows(xs).filter(a=>ids.has(a.id)),demo=xs.filter(isShowcaseAgent),weighted=a=>a.attitude*.4+a.skill*.3+a.knowledge*.3;
 const metric=(label,value,note)=>'<article class="dw-metric"><span>'+label+'</span><strong>'+value+'</strong><small>'+note+'</small></article>';
 const counts=key=>[...new Set(xs.map(key))].map(k=>({label:k,value:xs.filter(a=>key(a)===k).length}));
 const regions=counts(a=>a.region).map(r=>({...r,action:'region',key:r.label}));
 const monthKeys=[...new Set(xs.map(a=>(a.report_date||'2026-10-01').slice(0,7)))].sort();const months=monthKeys.map(label=>({label,value:xs.filter(a=>(a.report_date||'2026-10-01').startsWith(label)).length}));
 const mix=['Offline','Online'].map((label,i)=>({label,value:demo.filter(a=>Number(a.id.replace(/\D/g,''))%2===i).length,color:i?'#374151':'#1B4F8A'}));
 const scores=['attitude','skill','knowledge'].map((k,i)=>({label:k[0].toUpperCase()+k.slice(1),value:xs.length?Number(avg(xs.map(a=>a[k])).toFixed(1)):0,color:['#1B4F8A','#6B7280','#374151'][i]}));
 scores.push({label:'Weighted ASK',value:xs.length?Number(avg(xs.map(weighted)).toFixed(1)):0,color:'#C8202E'});
 return '<section class="di-overview"><h2>Participant & capability overview</h2><div class="dw-metrics">'+metric('Total participants',xs.length,'Agents in this overview')+metric('Unique agent IDs',new Set(xs.map(a=>a.id)).size,'Unique roster identities')+metric('Average post-test',pairs.length?avg(pairs.map(a=>a.post)).toFixed(1):'—',pairs.length+' valid pre/post pairs')+metric('Average total ASK',xs.length?avg(xs.map(weighted)).toFixed(1):'—','40% Attitude · 30% Skill · 30% Knowledge')+'</div><div class="dw-grid">'+dashCard('Participants by Month','Latest selected snapshot month per agent; dated dummy history',insightBars(months,Math.max(1,demo.length)))+dashCard('Participants by Region','All matching regions · click to filter',insightBars(regions,Math.max(1,...regions.map(r=>r.value))))+dashCard('Online vs Offline','Illustrative delivery mode for '+demo.length+' demo agents; other records excluded',askDonutChart(mix,demo.length,'learners'))+dashCard('ASK Score Averages','Dimension averages and weighted total / 100',xs.length?insightBars(scores):'<p>No matching agents.</p>')+'</div>'+dashCard('Participants by Area / Site','Operational locations; E-Care location is unassigned',insightBars(counts(agentLocation),Math.max(1,xs.length)))+'</section>';
}

function regularTrainingTestPairs(agents) {
 const ids = new Set(agents.map(agent=>agent.id));
 return state.activities.filter(activity=>['ACS Booster','Bad Ticket'].includes(activity.category) && inReport(activity.date))
  .flatMap(activity=>{
   const byAgent = new Map();
   for (const {agentId,type,score} of activity.assessmentRecords || []) {
    if (!ids.has(agentId) || !['pre','post'].includes(type)) continue;
    const pair = byAgent.get(agentId) || {agentId};
    pair[type] = score;
    byAgent.set(agentId,pair);
   }
   return [...byAgent.values()].filter(pair=>validAssessmentScore(pair.pre) && validAssessmentScore(pair.post));
  });
}

function emptyDashboardAskMetrics() {
 return {total:0,scoreSum:0,dimensionSums:[0,0,0],high:[0,0,0]};
}

function addDashboardAskMetrics(target, group) {
 if (!group?.total) return target;
 target.total += group.total;
 target.scoreSum = target.scoreSum!=null && Number.isFinite(group.scoreSum) ? target.scoreSum+group.scoreSum : null;
 for (let i=0;i<target.high.length;i++) {
  target.high[i] += group.high[i];
  const sum = group.dimensionSums?.[i];
  target.dimensionSums[i] = target.dimensionSums[i]!=null && Number.isFinite(sum) ? target.dimensionSums[i]+sum : null;
 }
 return target;
}

function dashboardAskTotals(groups) {
 return groups.reduce(addDashboardAskMetrics,emptyDashboardAskMetrics());
}

function dashboardAskAverage(metrics, sum=metrics?.scoreSum) {
 return metrics?.total && Number.isFinite(sum) ? sum/metrics.total : null;
}

function addDashboardAskParameters(target, source) {
 for (const [key,parameters] of Object.entries(source || {})) {
  const group = target[key] ||= {};
  for (const [name,{count,gapSum}] of Object.entries(parameters)) {
   const metric = group[name] ||= {count:0,gapSum:0};
   metric.count += count;
   metric.gapSum += gapSum;
  }
 }
}

function dashboardAskSiteLabel(region,unit) {
 const normalize = value=>String(value || '').toLowerCase().replace(/[^a-z0-9]/g,'');
 const unitKey = normalize(unit), regionKey = normalize(region);
 const site = DASHBOARD_SITES.find(({city})=>unitKey.endsWith(normalize(city))) ||
  DASHBOARD_SITES.find(({name,city,region,aliases})=>[name,city,region,...aliases].some(label=>normalize(label)===regionKey));
 return site ? `${site.name} · ${site.city}` : region && region!=='Region belum tersedia' ? region : 'Site belum tercatat';
}

function dashboardAskSnapshot(snapshot, ytd=false) {
 if (!snapshot) return null;
 const channel = ctp==='All CTPs' ? '' : dashboardChannelLabel();
 const localUnit = dashboardLocalUnit();
 const selectedUnit = !localUnit && dashboardUnit && state.agents.find(agent=>dashboardUnitKey(agent)===dashboardUnit);
 const unitName = localUnit?.[4] || (selectedUnit ? dashboardUnitName(selectedUnit) : '');
 const unitId = localUnit?.[3] || selectedUnit?.unitId;
 const unitChannel = localUnit?.[0] || (selectedUnit?.ctp==='Contact Center'?'Call Center':selectedUnit?.ctp);
 const selectedArea = ctpScope==='All locations' ? '' : ctpScope;
 const selectedRegion = region==='All Regions' ? '' : region;
 const geoRegions = area==='All Areas' ? null : REGIONS[area];
 const depth = unitName ? 5 : selectedRegion || geoRegions ? 3 : selectedArea || dashboardReportAreas!==null ? 2 : 0;
 const norm = value=>String(value ?? '').trim().toLowerCase();
 const matches = (parts,level)=>{
  const [name,areaName,regionName,id,unit] = parts;
  return parts.length===level && (!channel || name===channel) &&
   dashboardMatchesReportArea(name,areaName) &&
   (!unitChannel || name===unitChannel) &&
   (!localUnit?.[1] || norm(localUnit[1])===norm(areaName)) &&
   (!localUnit?.[2] || norm(localUnit[2])===norm(regionName)) &&
   (!selectedArea || norm(areaName)===norm(selectedArea)) &&
   (!selectedRegion || norm(regionName)===norm(selectedRegion)) &&
   (!geoRegions || geoRegions.some(value=>norm(value)===norm(regionName))) &&
   (!unitName || (unitId ? String(id)===String(unitId) : norm(unit)===norm(unitName)));
 };
 const matchingLocations = (entries,level)=>Object.entries(entries || {}).map(([key,data])=>[JSON.parse(key),data])
  .filter(([parts])=>matches(parts,level));
 const buckets = entries=>depth ? matchingLocations(entries,depth).map(([,data])=>data) : [];
 const allowed = key=>!channel || (LOCAL_ASK_CHANNELS[channel] || []).includes(key) ||
  (channel==='GraPARI' && key==='GraPARI model belum tercatat');
 const groups = {};
 const areas = Object.create(null);
 const passLocations = new Map();
 const locations = matchingLocations(snapshot.locations,depth || 2);
 const nationalGroups = depth ? locations.map(([,data])=>data) : [snapshot.groups];
 for (const entries of nationalGroups) {
  for (const [name, group] of Object.entries(entries || {})) {
   if (!allowed(name)) continue;
   addDashboardAskMetrics(groups[name] ||= emptyDashboardAskMetrics(),group);
  }
 }
 const passArea = (name,areaName)=>name==='GraPARI' ? areaName || 'Area belum tercatat' : '';
 const savePassMetrics = (parts,entries,sourceRegion)=>{
  const key = JSON.stringify(parts);
  if (!passLocations.has(key)) passLocations.set(key,emptyDashboardAskMetrics());
  const total = passLocations.get(key);
  if (sourceRegion) (total.regions ||= new Set()).add(sourceRegion);
  for (const [segment,group] of Object.entries(entries)) {
   if (!allowed(segment)) continue;
   addDashboardAskMetrics(total,group);
   const segments = total.segments ||= {};
   addDashboardAskMetrics(segments[segment] ||= emptyDashboardAskMetrics(),group);
  }
  return total;
 };
 for (const [[name,areaName],entries] of locations) {
  const metrics = savePassMetrics([name,passArea(name,areaName)],entries);
  if (name==='GraPARI') areas[areaName] = metrics;
 }
 const details = depth>=3 ? locations : matchingLocations(snapshot.locations,3);
 for (const [[name,areaName,regionName,,unit],entries] of details) {
  const place = name==='GraPARI' ? regionName || 'Region belum tercatat' : dashboardAskSiteLabel(regionName,unit);
  savePassMetrics([name,passArea(name,areaName),place],entries,regionName);
 }
 const csrCounts = {};
 const counts = depth ? buckets(snapshot.csrLocations) : snapshot.csrCounts ? [snapshot.csrCounts] : [];
 for (const entries of counts) {
  for (const [name,value] of Object.entries(entries)) if (allowed(name)) csrCounts[name]=(csrCounts[name] || 0)+value;
 }
 const csrSites = {};
 if (['Call Center','E-Care'].includes(channel)) {
  const siteLocations = matchingLocations(snapshot.csrLocations,5);
  const siteRows = siteLocations.length ? siteLocations : matchingLocations(snapshot.csrLocations,3);
  for (const [[,,regionName,,unit],entries] of siteRows) {
   const siteLabel = dashboardAskSiteLabel(regionName,unit);
   for (const [segment,value] of Object.entries(entries)) {
    if (allowed(segment)) csrSites[siteLabel] = (csrSites[siteLabel] || 0)+value;
   }
  }
 }
 const sumScopedCounts = (sources,select,bySegment)=>{
  const totals = {};
  for (const entries of sources) {
   for (const [name, group] of Object.entries(entries || {})) {
    if (!allowed(name)) continue;
    for (const [label,value] of Object.entries(select(group) || {})) {
     totals[label]=(totals[label] || 0)+value;
     if (bySegment) {
      const segment = bySegment[name] ||= {};
      segment[label] = (segment[label] || 0) + value;
     }
    }
   }
  }
  return totals;
 };
 const latestCounts = (locations,segments,bySegment)=>sumScopedCounts(depth ? buckets(locations) : [segments],group=>group,bySegment);
 const quadrantSegments = {};
 const quadrants = ytd
  ? latestCounts(snapshot.latestLocationQuadrants?.ytd,snapshot.latestQuadrants?.ytd,quadrantSegments)
  : sumScopedCounts(nationalGroups,group=>group.quadrants,quadrantSegments);
 const talentPool = ytd
  ? latestCounts(snapshot.latestLocationTalentPool,snapshot.latestTalentPool)
  : sumScopedCounts(nationalGroups,group=>group.talentPool);
 const tryout = latestCounts(snapshot.tryoutLocations,snapshot.tryoutScores);
 const parameters = {};
 for (const [[channel,areaName],metrics] of matchingLocations(snapshot.tappingParameters,depth || 2)) {
  const key = JSON.stringify([channel,passArea(channel,areaName)]);
  addDashboardAskParameters(parameters,{[key]:metrics});
 }
 return {groups,areas,passLocations,csrCounts:counts.length ? csrCounts : null,csrSites:Object.keys(csrSites).length ? csrSites : null,quadrants,quadrantSegments,talentPool,tryout,parameters};
}

function dashboardTryoutSessionRows(snapshots) {
 const sessions = new Map();
 for (const snapshot of snapshots) {
  for (const [session,group] of Object.entries(snapshot?.tryout || {})) {
   const total = sessions.get(session) || {count:0,sum:0};
   total.count += group.count || 0;
   total.sum += group.sum || 0;
   sessions.set(session,total);
  }
 }
 return ['TO 1','TO 2','TO 3','iFest'].flatMap(session=>{
  const result = sessions.get(session);
  return result?.count ? [{session,count:result.count,average:result.sum/result.count}] : [];
 });
}

const ASK_TALENT_BANDS = [
 ['excellent','Excellent Performance','≥80'],
 ['good','Good Performance','70 hingga <80'],
 ['core','Core Performance','60 hingga <70'],
 ['growth','Growth Potential','<60'],
 ['unclassified','Belum diklasifikasikan',''],
];

function dashboardAskDistribution(current, previous, {period, priorPeriod, ytd, missing}) {
 const number = new Intl.NumberFormat('id-ID');
 const percent = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const total = Object.values(current || {}).reduce((sum,count)=>sum+count,0);
 const priorTotal = Object.values(previous || {}).reduce((sum,count)=>sum+count,0);
 if (!total) return {subtitle:'Talent Pool · Workbook ASK lokal',body:`<p>${el(missing)}</p>`};

 const subtitle = `Talent Pool · ${number.format(total)} CSR dinilai · ${period}`;
 const rows = ASK_TALENT_BANDS.filter(([key])=>key!=='unclassified' || current[key] || previous?.[key]);
 const body = `<ul class="ask-distribution-list">${rows.map(([key,label,range])=>{
  const count = current[key] || 0;
  const share = 100*count/total;
  const delta = priorTotal ? 100*(count/total-(previous[key] || 0)/priorTotal) : 0;
  const flat = Math.abs(delta)<0.05;
  const direction = flat?'Tetap':delta>0?'Naik':'Turun';
  const symbol = flat?'→':delta>0?'↑':'↓';
  const change = percent.format(flat?0:Math.abs(delta));
  return `<li class="ask-band-${key}">
   <div class="ask-distribution-meta"><div><b>${label}</b>${range?` <small>${el(range)}</small>`:''}</div>
    <div class="ask-distribution-value"><strong>${percent.format(share)}%</strong> <span>(${number.format(count)})</span>
     ${priorTotal?`<small aria-label="${direction} ${change} poin persentase">${symbol} ${change} pp</small>`:''}
    </div></div>
   <span class="canvas-bar-track" aria-hidden="true"><i style="width:${share}%"></i></span>
  </li>`;
 }).join('')}</ul>
 ${!ytd?`<p class="ask-distribution-foot">${priorTotal?`${period} vs ${priorPeriod} · pp = poin persentase`:`Data ${priorPeriod} belum tersedia`}</p>`:''}`;
 return {subtitle,body};
}

function dashboardMoMChange(value,previous,{lowerIsBetter=false}={}) {
 if (!Number.isFinite(value) || !Number.isFinite(previous)) return null;
 const delta = value-previous;
 if (Math.abs(delta)<0.05) return {symbol:'→',tone:'',direction:'Tetap',amount:0};
 return delta>0
  ? {symbol:'▲',tone:lowerIsBetter?'is-down':'is-up',direction:'Naik',amount:delta}
  : {symbol:'▼',tone:lowerIsBetter?'is-up':'is-down',direction:'Turun',amount:-delta};
}

function dashboardAskPerformanceTable(rows,{period,priorPeriod,comparisonPeriod,ytd,range,detailScope}) {
 const format = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const multiMonth = ytd || range;
 const shortMonth = label=>{
  const month = String(label).split(' ')[0].slice(0,3);
  return month==='Sep'?'Sept':month;
 };
 const scoreCell = (value,overall=false,movement=null)=>{
  if (!Number.isFinite(value)) return '<td>—</td>';
  const band = value>=90 ? 'high' : value>=80 ? 'mid' : 'low';
  const score = format.format(value);
  const color = movement ? `dashboard-mom-value ${movement.tone}` : `ask-score-${band}`;
  return `<td class="${color}">${overall?`<strong>${score}</strong>`:score}</td>`;
 };
 const changeCell = movement=>{
  if (!movement) return '<td>—</td>';
  const points = format.format(movement.amount);
  return `<td><span class="canvas-ask-bar-delta dashboard-mom-value ${movement.tone}" aria-label="${movement.direction} ${points} poin">${movement.symbol} ${points}</span></td>`;
 };
 return `<article class="canvas-panel canvas-ask-performance" aria-labelledby="canvas-ask-performance-title">
  <div class="canvas-ask-section-heading">
  <h3 id="canvas-ask-performance-title" tabindex="-1">Performa A–S–K per Area &amp; Channel</h3>
  <p>${el(multiMonth?period:comparisonPeriod)} · Skor dari 100${multiMonth?'':' · Selisih ASK dalam poin'}</p>
  </div>
  ${rows.some(row=>row.total)?`<ul class="canvas-ask-performance-legend" aria-label="Ambang warna skor ASK dan A–S–K">
   <li class="ask-score-high">≥ 90</li><li class="ask-score-mid">80 hingga &lt; 90</li><li class="ask-score-low">&lt; 80</li>
  </ul>`:''}
  <div class="canvas-ask-performance-scroll" role="region" aria-label="Tabel skor ASK per area dan channel" tabindex="0">
   <table class="${multiMonth?'':'is-monthly'}">
    ${multiMonth?'':`<colgroup><col style="width:23%"><col style="width:12%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:12%"><col style="width:12%"><col style="width:14%"></colgroup>`}
    <thead><tr>
     <th scope="col">Area / Channel</th>
     ${multiMonth?'':`<th scope="col">ASK ${el(shortMonth(priorPeriod))}</th>`}
     <th scope="col">Attitude</th><th scope="col">Skill</th><th scope="col">Knowledge</th>
     <th scope="col">${ytd?'ASK YTD':range?'ASK periode':`ASK ${el(shortMonth(period))}`}</th>
     ${multiMonth?'':'<th scope="col">Selisih ASK</th>'}
     <th scope="col">${multiMonth?'Penilaian CSR':'CSR dinilai'}</th>
    </tr></thead>
    <tbody>${rows.map(row=>{
     const movement = multiMonth ? null : dashboardMoMChange(row.score,row.previous);
     return `<tr${row.subtotal?` class="is-total${row.label==='Nasional'?' is-national-total':''}"`:''}>
     <th scope="row">${el(row.label)}</th>
     ${multiMonth?'':scoreCell(row.previous)}
     ${row.metrics.dimensionSums.map(sum=>scoreCell(dashboardAskAverage(row.metrics,sum))).join('')}
     ${scoreCell(row.score,true,movement)}
     ${multiMonth?'':changeCell(movement)}<td>${row.total?format.format(row.total):'—'}</td>
    </tr>`;
    }).join('') || `<tr><td colspan="${multiMonth?6:8}">Belum ada data ASK untuk cakupan ini.</td></tr>`}</tbody>
   </table>
  </div>
  <section id="canvas-ask-quadrant-csr" class="canvas-ask-inline-list" aria-labelledby="canvas-ask-quadrant-csr-title" data-ask-scope="${el(detailScope)}" hidden>
   <header><div><h4 id="canvas-ask-quadrant-csr-title" tabindex="-1">Daftar CSR</h4><p data-ask-list-scope></p></div>
    <button type="button" class="btn" data-ask-clear-quadrant>Hapus pilihan</button></header>
   ${dashboardAskListControls()}
  </section>
 </article>`;
}

function dashboardAskListControls(roster=false) {
 return `<p class="canvas-ask-drill-breakdown" hidden></p>
  <form class="canvas-ask-drill-search"><label class="field">Nama CSR<input type="search" name="q" maxlength="100" autocomplete="off"></label>
   ${roster?`<label class="field">CTP<select name="channel"><option value="">${ctp==='All CTPs'?'Semua CTP':el(dashboardChannelLabel())}</option>${(ctp==='All CTPs'?['GraPARI','Call Center','E-Care']:[]).map(channel=>`<option value="${el(channel)}">${el(channel)}</option>`).join('')}</select></label>`:''}
   ${roster?'<label class="field">Area / Site<select name="listArea"><option value="">Semua area / site</option></select></label><label class="field">Unit<select name="listUnit"><option value="">Semua unit</option></select></label>':''}
   <label class="field">Urutkan<select name="sort"><option value="name-asc">Nama A–Z</option><option value="name-desc">Nama Z–A</option><option value="score-desc">Skor tertinggi</option><option value="score-asc">Skor terendah</option></select></label>
   <button type="submit" class="btn">Cari</button></form>
  <div class="canvas-ask-drill-rows" aria-live="polite"></div>
  <nav class="canvas-ask-drill-pager" aria-label="Halaman daftar CSR">
   <button class="btn" type="button" data-ask-page="previous" disabled>Sebelumnya</button><span role="status"></span>
   <button class="btn" type="button" data-ask-page="next" disabled>Berikutnya</button></nav>`;
}

// Referensi Improvement Needed — peta ke KLP, Agustus 2026.
const DASHBOARD_ASK_AUGUST_IMPROVEMENT = {
 'Area 1':['Etika Pelayanan 22% · Edukasi Layanan 12% · Penampilan 10%', 'Coaching etika dan grooming di Duri, Sungai Penuh, dan Betung.'],
 'Area 2':['Etika Pelayanan 20% · Edukasi Layanan 14% · Penampilan 11%', 'Coaching clinic di 5 GraPARI Jakarta Banten dan tambah sampel SQ.'],
 'Area 3':['Edukasi Layanan 43% · Etika Pelayanan 32% · Solusi & Konfirmasi 17%', 'Learning edukasi dan solusi, dengan prioritas Bali Nusra.'],
 'Area 4':['Edukasi Layanan 57% · Etika Pelayanan 23% · Gali Informasi 19%', 'Learning edukasi dan cross selling di Papua Maluku.'],
 'Call Center':['Etika Pelayanan 77% · Holding Time 77% · Edukasi Layanan 68%', 'Call-listening etika per TL dan training holding serta KIP.'],
 'E-Care':['Dokumentasi KIP 21% · Kejelasan Informasi 14% · Etika Pelayanan 14%', 'Training dokumentasi KIP dan template jawaban chat.'],
};
const DASHBOARD_ASK_INTERVENTIONS = [
 ['Coaching','Attitude','coaching','Etika Pelayanan','Coaching lewat review interaksi pelanggan.'],
 ['Training','Skill','training','Holding Time','Latihan prosedur hold dan konfirmasi ke pelanggan.'],
 ['Learning','Knowledge','learning','Edukasi Layanan','Latihan menjelaskan layanan kepada pelanggan.'],
];

function dashboardAskPriorityPanel(groups, totals, parameters, {period,scope,multiMonth,useAugustReference}) {
 const format = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const low = (metrics,index)=>Math.max(0,metrics.total-metrics.high[index]);
 const countLabel = multiMonth?'penilaian':'CSR';
 const needs = DASHBOARD_ASK_INTERVENTIONS.map(([label,dimension,tone],index)=>({
  label,dimension,tone,count:low(totals,index),
 }));
 const highest = needs.toSorted((a,b)=>b.count-a.count)[0];
 const distinctHighest = highest.count && needs.filter(row=>row.count===highest.count).length===1;
 const groupNeeds = groups.map(group=>low(group.metrics,needs.indexOf(highest)));
 const largestGroupIndex = groupNeeds.indexOf(Math.max(...groupNeeds));
 const largestGroup = groups[largestGroupIndex];
 let showsReference = false, showsGap = false;
 const rows = groups.map(({name,label,channel,metrics})=>{
  const location = JSON.stringify([channel,channel==='GraPARI'?name:'']);
  const stats = parameters?.[location];
  const reference = useAugustReference && DASHBOARD_ASK_AUGUST_IMPROVEMENT[name];
  const measured = DASHBOARD_ASK_INTERVENTIONS.flatMap(([,,,parameter,action])=>{
   const metric = stats?.[parameter.toLowerCase()];
   return metric?.count ? [{parameter,action,gap:100*metric.gapSum/metric.count}] : [];
  }).sort((a,b)=>b.gap-a.gap);
  let finding = 'Data tapping per parameter belum tersedia.';
  let action = '';
  let measure = '';
  if (reference) {
   showsReference = true;
   [finding,action] = reference;
   measure = channel==='GraPARI'?'Gap terhadap bobot':channel==='Call Center'?'% CSR dengan NC':'% interaksi NOK';
  } else if (measured.length) {
   showsGap = true;
   finding = measured.map(({parameter,gap})=>parameter+' '+format.format(gap)+'%').join(' · ');
   action = measured[0].gap>0 ? measured[0].action : '';
   measure = 'Gap terhadap bobot · parameter yang dipantau';
  }
  return `<tr><th scope="row">${el(name)}</th>${needs.map(({tone},index)=>`<td class="is-${tone}">${format.format(low(metrics,index))}</td>`).join('')}
   <td><details class="canvas-ask-priority-row"><summary aria-label="Lihat parameter dan fokus perbaikan ${el(label)}">Lihat fokus</summary>
    ${measure?`<small>${el(measure)}</small>`:''}<p>${el(finding)}</p>${action?`<p><strong>${reference?'Fokus report':'Usulan tindak lanjut'}</strong><br>${el(action)}</p>`:''}</details></td></tr>`;
 });
 return `<article class="canvas-panel canvas-ask-priority" aria-labelledby="canvas-ask-priority-title" hidden>
  <div class="canvas-ask-section-heading"><h3 id="canvas-ask-priority-title">Prioritas Perbaikan ASK</h3>
   <p>${el(period)}${scope==='Nasional'?'':` · ${el(scope)}`} · Skor komponen &lt;80</p></div>
  ${totals.total?`
   <div class="canvas-ask-interventions">${needs.map(({label,dimension,tone,count})=>{
    const content = `<span>${label}</span><strong>${format.format(count)}</strong><small>${countLabel} · ${dimension} &lt;80</small>`;
    return count?`<button type="button" class="canvas-ask-intervention is-${tone}" ${dashboardAskNamesAttributes(dimension,'low',label+' · '+dimension+' <80')}>${content}</button>`
     :`<div class="canvas-ask-intervention is-${tone}">${content}</div>`;
   }).join('')}</div>
   ${distinctHighest?`<p class="canvas-ask-priority-insight"><strong>${highest.label}</strong> paling banyak dibutuhkan (${format.format(highest.count)} ${countLabel}).${groups.length>1&&largestGroup?` ${el(largestGroup.label)} mencatat ${format.format(groupNeeds[largestGroupIndex])} atau ${format.format(100*groupNeeds[largestGroupIndex]/highest.count)}% dari kebutuhan ${highest.label}.`:''}</p>`:''}
   <details class="canvas-ask-priority-details"><summary>Rincian per area dan channel</summary>
    <div class="canvas-ask-priority-table" role="region" aria-label="Kebutuhan intervensi dan fokus perbaikan" tabindex="0"><table>
     <thead><tr><th scope="col">Area / Channel</th>${needs.map(({label})=>`<th scope="col">${label}</th>`).join('')}<th scope="col">Parameter &amp; fokus</th></tr></thead>
     <tbody>${rows.join('')}</tbody></table></div>
    ${showsReference?'<p>Jumlah intervensi dihitung dari workbook ASK yang aktif. Parameter terlemah dan fokus bersumber dari slide Improvement Needed — peta ke KLP, Agustus 2026.</p>':''}
    ${showsGap?'<p>Gap terhadap bobot memakai rata-rata selisih relatif per tapping yang valid.</p>':''}
   </details>
   <p>Satu CSR bisa masuk beberapa intervensi.${multiMonth?' Penilaian dari beberapa bulan dijumlahkan.':''}</p>`
   :'<p>Belum ada skor ASK untuk menghitung kebutuhan intervensi pada cakupan ini.</p>'}
 </article>`;
}

function dashboardAskOverviewDelta(value,prior,unit='pts',showPoints=false) {
 const change = dashboardMoMChange(value,prior);
 if (!change) return '';
 const points = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(change.amount);
 return `<small class="canvas-ask-overview-delta dashboard-mom-value ${change.tone}" aria-label="${change.direction} ${points} ${unit==='pp'?'poin persentase':unit}">${change.symbol} ${points}${unit==='pp'||showPoints?` ${unit}`:''}</small>`;
}

function dashboardAskNationalDelta(value,prior) {
 const change = dashboardMoMChange(value,prior);
 if (!change) return '';
 const points = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(change.amount);
 const icon = change.tone==='is-down'?'⚠':change.tone==='is-up'?'👍':'';
 return `<strong class="canvas-ask-national-delta dashboard-mom-value ${change.tone}" aria-label="${change.direction} ${points} poin persentase">${icon?`<span class="canvas-ask-national-delta-icon" aria-hidden="true">${icon}</span>`:''}<span>${change.symbol} ${points} pp</span></strong>`;
}

function dashboardAskQuadrantChart(rows,series,number) {
 const peak = Math.max(...rows.map(row=>row.value));
 const roughStep = peak/4;
 const magnitude = Math.max(1,10**Math.floor(Math.log10(roughStep)));
 const step = [1,2,5,10].find(unit=>unit*magnitude>=roughStep)*magnitude;
 const intervals = Math.ceil(peak/step);
 const scale = step*intervals;
 return `<figure class="canvas-quadrant-chart" aria-label="Jumlah CSR per kuadran dan channel">
  <figcaption><strong>Jumlah CSR</strong><ul class="canvas-quadrant-legend" aria-label="Channel CTP">
   ${series.map(({label,color})=>`<li><i class="canvas-quadrant-swatch" data-series="${color}" aria-hidden="true"></i>${el(label)}</li>`).join('')}
  </ul></figcaption>
  <div class="canvas-quadrant-plot">
   <div class="canvas-quadrant-gridlines" aria-hidden="true">${Array.from({length:intervals+1},(_,index)=>
    `<span style="bottom:${100*index/intervals}%"><small>${number.format(index*step)}</small></span>`).join('')}</div>
   <ol class="canvas-quadrant-columns" style="--quadrant-columns:${rows.length}">
    ${rows.map(({code,value,label,parts,breakdown,action,statuses})=>{
     const count = number.format(value);
     const segments = parts.filter(part=>part.value>0).map(part=>`<span class="canvas-quadrant-segment"
      data-series="${part.color}" style="--segment-size:${100*part.value/value}%">${part.value/scale>=.09?number.format(part.value):''}</span>`).join('');
     const description = statuses.map(({dimension,status})=>`${dimension} ${status}`).join(', ');
     const bar = `<span class="canvas-quadrant-column-label">
      <span class="canvas-quadrant-column-code">${el(code==='BELUM TERSEDIA'?'Belum tercatat':code)}</span>
      <span class="canvas-quadrant-column-statuses" aria-hidden="true">
       ${statuses.map(({dimension,tone,symbol})=>`<span>${el(dimension[0])}<b class="is-${tone}">${symbol}</b></span>`).join('')}
      </span></span>
      <span class="canvas-quadrant-column-track" aria-hidden="true">
       <span class="canvas-quadrant-column-stack" style="--stack-size:${100*value/scale}%">
        <strong class="canvas-quadrant-column-count">${count}</strong>${segments}
       </span>
      </span><strong class="canvas-quadrant-column-count-mobile">${count}</strong>`;
     const segmentValues = series.length>1 ? `<dl class="canvas-quadrant-segment-values" aria-label="Jumlah per channel ${el(code)}">
      ${parts.map(({label,color,value})=>`<div data-series="${color}" title="${el(label)}"${value?'':' data-zero'}>
       <dt class="ask-quadrant-sr">${el(label)}</dt><dd><i class="canvas-quadrant-swatch" aria-hidden="true"></i>${number.format(value)}</dd>
      </div>`).join('')}
     </dl>` : '';
     return `<li>${value?`<button type="button" class="canvas-quadrant-column" ${action}
      aria-label="Lihat daftar CSR ${el(code)}, ${count} CSR" aria-description="${el(description)}" title="${el(breakdown)}">${bar}
      <span class="canvas-quadrant-summary" hidden>${el(label)}</span></button>`
      :`<div class="canvas-quadrant-column" role="img" aria-label="${el(code)}, 0 CSR" aria-description="${el(description)}">${bar}</div>`}${segmentValues}</li>`;
    }).join('')}
   </ol>
  </div>
  <div class="canvas-quadrant-status-key">
   <span>A Attitude · S Skill · K Knowledge</span>
   <span><b class="is-passing" aria-hidden="true">✓</b> High</span>
   <span><b class="is-failing" aria-hidden="true">×</b> Low</span>
  </div>
 </figure>`;
}

function dashboardAskQuadrants(current,previous,{scope,comparisonPeriod,priorPeriod,priorShort,ytd,multiMonth,dimensions,bySegment}) {
 const total = Object.values(current || {}).reduce((sum,count)=>sum+count,0);
 const priorTotal = multiMonth ? 0 : Object.values(previous || {}).reduce((sum,count)=>sum+count,0);
 const number = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const listFormat = new Intl.ListFormat('id-ID',{type:'conjunction'});
 const counts = {...(priorTotal ? previous : {}),...current};
 const series = DASHBOARD_QUADRANT_SERIES.filter(({segment})=>Object.values(bySegment?.[segment] || {}).some(Boolean));
 const order = ASK_QUADRANTS.map(([code,,...levels])=>({code,levels,passed:levels.filter(level=>level==='High').length}))
  .sort((a,b)=>b.passed-a.passed);
 const unassigned = Object.keys(counts).filter(code=>!order.some(item=>item.code===code)).map(code=>({code}));
 const rows = [...order,...unassigned].map(({code,levels})=>{
  const low = dimensions.filter((_,index)=>levels?.[index]==='Low');
  const label = !levels ? 'Kuadran belum tercatat' : low.length ? listFormat.format(low)+' masuk kategori Low' : 'Semua dimensi High';
  const parts = series.map(({segment,label,color})=>({label,color,value:bySegment[segment][code] || 0}));
  const breakdown = parts.map(part=>part.label+' '+number.format(part.value)).join(' · ');
  const action = `data-ask-quadrant-code="${el(code)}" aria-controls="canvas-ask-quadrant-csr" aria-pressed="false" data-ask-quadrant-breakdown="${el(breakdown)}"`;
  const statuses = dimensions.map((dimension,index)=>{
   const level = levels?.[index];
   const [tone,symbol,status] = level==='High' ? ['passing','✓','High']
    : level==='Low' ? ['failing','×','Low'] : ['unavailable','—','Belum tercatat'];
   return {dimension,tone,symbol,status};
  });
  return {code,levels,label,parts,breakdown,action,statuses,value:current?.[code] || 0,isPass:levels && !low.length};
 });
 const mobileLabel = label=>`<span class="canvas-quadrant-mobile-label" aria-hidden="true">${el(label)}</span>`;
 const tableRows = rows.filter(({code})=>Object.hasOwn(counts,code)).sort((a,b)=>b.value-a.value).map(({code,label,statuses,value,isPass,action})=>{
  const share = total ? 100*value/total : 0;
  const priorShare = priorTotal ? 100*(previous[code] || 0)/priorTotal : null;
  const cells = statuses.map(({dimension,tone,symbol,status})=>`<td role="cell">${mobileLabel(dimension)}
    <span class="canvas-quadrant-badge is-${tone}" role="img" aria-label="${el(dimension)} ${el(status)}">
     <span aria-hidden="true">${symbol}</span> ${status}</span>
   </td>`).join('');
  const heading = `<b>${el(code)}</b><small class="canvas-quadrant-summary">${el(label)}</small>`;
  return `<tr role="row"${isPass?' class="is-pass"':''}>
   <th scope="row" role="rowheader">${value?`<button type="button" class="canvas-quadrant-select" ${action}>${heading}</button>`
    :`<span class="canvas-quadrant-select is-inactive">${heading}</span>`}</th>
   ${cells}
   <td role="cell">${mobileLabel('Jumlah CSR')}<strong>${number.format(value)}</strong></td>
   <td role="cell" class="canvas-quadrant-share">${mobileLabel('Porsi CSR')}<strong>${number.format(share)}%</strong>
    <span class="canvas-bar-track" aria-hidden="true"><i style="width:${share}%"></i></span></td>
   ${priorTotal?`<td role="cell" class="canvas-quadrant-mom">${mobileLabel(priorShort)}
    <span title="${number.format(priorShare)}% pada ${el(priorPeriod)}">${dashboardAskOverviewDelta(share,priorShare,'pp')}</span></td>`:''}
  </tr>`;
 });
 return `<article class="canvas-panel canvas-quadrant"><div class="canvas-ask-section-heading"><h3>Distribusi kuadran ASK</h3>
  <p>${el(scope)}${total?` · ${number.format(total)} CSR${ytd?' pada penilaian terakhir':''}`:''}</p>
  </div>
  ${total?`
   ${series.length?dashboardAskQuadrantChart(rows.filter(({levels,value})=>levels || value),series,number):''}
   <p>Pilih ${series.length?'batang':'kode kuadran'} untuk melihat daftar CSR di panel Performa ASK.</p>
   <details class="canvas-quadrant-details"${series.length?'':' open'}>
    <summary>Rincian kuadran</summary>
    <div class="canvas-quadrant-details-body">
     ${multiMonth?'':`<p>${priorTotal?`${el(comparisonPeriod)} · pp = poin persentase`:`Data ${el(priorPeriod)} belum tersedia`}</p>`}
     <div class="canvas-quadrant-table-wrap"><table class="canvas-quadrant-table" role="table" aria-label="Distribusi kuadran ASK">
      <thead role="rowgroup"><tr role="row">
       ${['Kuadran',...dimensions,'Jumlah CSR','Porsi CSR',...(priorTotal?[priorShort]:[])].map(label=>
        `<th scope="col" role="columnheader">${el(label)}</th>`).join('')}
      </tr></thead>
      <tbody role="rowgroup">${tableRows.join('')}</tbody>
     </table></div>
    </div>
   </details>`
   :'<p>Belum ada data kuadran untuk cakupan ini.</p>'}
 </article>`;
}

function dashboardAskOverviewDistribution(current,previous,{multiMonth,comparisonPeriod,priorShort,distributionPeriod,panelClass='canvas-panel canvas-distribution'}) {
 const number = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const total = Object.values(current || {}).reduce((sum,count)=>sum+count,0);
 const priorTotal = Object.values(previous || {}).reduce((sum,count)=>sum+count,0);
 const bands = ASK_TALENT_BANDS.filter(([key])=>key!=='unclassified' || current?.[key] || (!multiMonth && previous?.[key]));
 return `<article class="${panelClass}"><h4>Distribusi skor ASK</h4>
  ${total ? `<p>${number.format(total)} CSR dinilai${multiMonth?` · ${el(distributionPeriod)}`:''}</p>
   <ul class="canvas-ask-score-bands">${bands.map(([key,label,range])=>{
    const count = current?.[key] || 0;
    const share = 100*count/total;
    const priorShare = priorTotal ? 100*(previous?.[key] || 0)/priorTotal : null;
    return `<li class="tone-${key}">
     <div class="canvas-ask-band-values"><strong>${number.format(count)}</strong><b>${number.format(share)}%</b></div>
     <p>${el(label)}${range?` · ${el(range)}`:''}</p><span class="canvas-bar-track" aria-hidden="true"><i style="width:${share}%"></i></span>
     ${!multiMonth && priorShare!==null?`<div class="canvas-ask-period-delta">${dashboardAskOverviewDelta(share,priorShare,'pp')}<small>${el(priorShort)}</small></div>`:''}
    </li>`;
   }).join('')}</ul>
   ${!multiMonth?`<p>${priorTotal?`${el(comparisonPeriod)} · pp = poin persentase`:'Pembanding belum tersedia'}</p>`:''}`
   : '<p>Data distribusi skor belum tersedia untuk cakupan ini.</p>'}
 </article>`;
}

function dashboardAskNamesAttributes(dimension,level,label,filters={}) {
 return `data-ask-names="${el(JSON.stringify({dimension:dimension.toLowerCase(),level,...filters}))}" data-ask-names-label="${el(label)}" aria-haspopup="dialog"`;
}

function dashboardAskSegmentPass(groups,{dimensions,period,multiMonth,locations,national,previousGroups,priorPeriod,priorShort,comparisonPeriod}) {
 const standardSegments = [
  ['Walk In TOMO','GraPARI · TOMO','GraPARI'],
  ['Walk In Mitra','GraPARI · MOMO','GraPARI'],
  ['Call In','Call Center','Call Center'],
  ['E-Care','E-Care','E-Care'],
 ];
 const segments = standardSegments.filter(([segment])=>groups[segment]?.total);
 if (!segments.length) return '';
 const number = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const unit = multiMonth ? 'penilaian CSR' : 'CSR dinilai';
 const chartSegments = national ? standardSegments : segments;
 const charts = chartSegments.map(([segment,label,channel],segmentIndex)=>{
  const icon = dashboardAskChannelIcon(channel);
  const heading = `<div class="canvas-pass-segment-title">${icon}<h4>${el(label)}</h4></div>`;
  if (!groups[segment]?.total) return {
   metrics:dimensions.map(()=>({
    visual:`<div class="canvas-pass-compare-row"><div class="canvas-pass-compare-pair" aria-hidden="true"></div><strong>${el(label)}</strong></div>`,
    row:`<tr data-ask-pass-segment="${el(segment)}"><th scope="row">${el(label)}</th><td colspan="3">Belum ada penilaian</td></tr>`,
   })),
   card:'',details:'',
  };
  const {total,high} = groups[segment];
  const prior = previousGroups?.[segment];
  const places = [...locations].flatMap(([key,metrics])=>{
   const [,area,place] = JSON.parse(key);
   const scoped = metrics.segments?.[segment];
   return scoped?.total ? [{area,place,metrics:scoped,regions:[...(metrics.regions || [])]}] : [];
  });
  const detailedAreas = new Set(places.filter(row=>row.place).map(row=>row.area));
  const detailRows = places.filter(row=>row.place || !detailedAreas.has(row.area));
  const areaTotals = new Set(places.filter(row=>!row.place).map(row=>row.area));
  const passedRows = channel==='GraPARI' && new Set(places.map(row=>row.area)).size>1
   ? places.filter(row=>!row.place || !areaTotals.has(row.area)) : detailRows;
  const metrics = dimensions.map((dimension,index)=>{
    const passed = high[index], low = total-passed, lowRate = 100*low/total;
    const passRate = 100*passed/total;
    const priorRate = prior?.total ? 100*prior.high[index]/prior.total : null;
    const id = `ask-donut-locations-${segmentIndex}-${index}`;
    const resultButton = (isPassed,count,rate)=>{
     const status = isPassed?'High':'Low';
     const target = isPassed?`${id}-passed`:id;
     const amount = number.format(count);
     return `<button type="button"${isPassed?' class="canvas-pass-metric-passed"':''} data-ask-donut-location="${target}" aria-controls="${target}" aria-expanded="false"
      aria-label="${el(label)} · ${status} ${el(dimension)}, ${amount}. Lihat rincian lokasi.">${national?`<strong>${amount}</strong>`:`<strong>${number.format(rate)}%</strong><small>${status} · ${amount}</small>`}</button>`;
    };
    const passedButton = resultButton(true,passed,passRate);
    const lowButton = resultButton(false,low,lowRate);
    const mom = multiMonth?'':`<div class="canvas-pass-metric-mom">
      ${priorRate===null?'Data bulan lalu belum tersedia':`<span title="${el(priorPeriod)} · ${number.format(prior.total)} CSR dinilai">${el(priorShort)} <b>${number.format(priorRate)}%</b></span>${dashboardAskOverviewDelta(passRate,priorRate,'pp')}`}
     </div>`;
    if (national) return {
     visual:`<div class="canvas-pass-compare-row" data-ask-pass-segment="${el(segment)}">
     <div class="canvas-pass-compare-pair" aria-hidden="true">
      <span class="canvas-pass-compare-column is-passed" style="height:${passRate}%"><b>${number.format(passRate)}%</b></span>
      <span class="canvas-pass-compare-column is-below" style="height:${lowRate}%"><b>${number.format(lowRate)}%</b></span>
     </div>
     <div class="canvas-pass-compare-label">${icon}<div><strong>${el(label)}</strong><small>${number.format(total)} ${unit}</small></div></div>
    </div>`,
     row:`<tr data-ask-pass-segment="${el(segment)}">
      <th scope="row">${el(label)}</th>
      <td>${passedButton}</td><td>${lowButton}</td>
      <td><strong>${number.format(passRate)}%</strong>${mom}</td>
     </tr>`,
    };
    return {visual:`<div class="canvas-pass-metric">
     <h5>${el(dimension)}</h5>
     <div class="canvas-pass-donut-ring">
      <svg viewBox="0 0 120 120" aria-hidden="true">
       <circle class="canvas-pass-donut-high" cx="60" cy="60" r="49"/>
       ${low?`<circle class="canvas-pass-donut-low" cx="60" cy="60" r="49" pathLength="100"
        stroke-dasharray="${lowRate} ${100-lowRate}" transform="rotate(-90 60 60)" data-ask-donut-location="${id}"/>`:''}
      </svg>
      <div><strong>${number.format(total)}</strong><small>${unit}</small></div>
     </div>
     <div class="canvas-pass-metric-values">${passedButton}${lowButton}</div>${mom}
    </div>`};
   });
  const card = national?'':`<section class="canvas-pass-segment" data-ask-pass-segment="${el(segment)}" data-channel="${el(channel)}">
   ${heading}
   <div class="canvas-pass-metrics">${metrics.map(metric=>metric.visual).join('')}</div>
  </section>`;
  const details = dimensions.flatMap((dimension,index)=>[true,false].map(passed=>{
    const rows = passed ? passedRows : detailRows;
    const locationTotal = rows.reduce((sum,row)=>sum+row.metrics.total,0);
    const level = passed?'high':'low';
    const status = passed?'High':'Low';
    const ranked = rows.map(({area,place,metrics,regions})=>({
     label:[area,place].filter(Boolean).join(' · ') || label,
     count:passed ? metrics.high[index] : metrics.total-metrics.high[index],total:metrics.total,
     filters:{segment,locationArea:area,locationRegions:regions.length?JSON.stringify(regions):''},
    })).sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label,'id'));
    const maximum = ranked[0]?.count || 1;
    return `<section class="canvas-pass-donut-locations${passed?' is-passed':''}" id="ask-donut-locations-${segmentIndex}-${index}${passed?'-passed':''}" tabindex="-1" hidden>
     <h4>${el(label)} · ${el(dimension)} · ${status}</h4>
     <button type="button" class="canvas-link" ${dashboardAskNamesAttributes(dimension,level,`${label} · ${status} ${dimension}`,{segment})}>Lihat nama CSR</button>
     ${locationTotal && locationTotal<total?`<p>Rincian lokasi mencakup ${number.format(locationTotal)} dari ${number.format(total)} ${multiMonth?'penilaian':'CSR'}.</p>`:''}
     ${ranked.length?`<ul>${ranked.map(({label:location,count,total,filters})=>`<li><button type="button" class="canvas-link canvas-ask-location-names"
      ${dashboardAskNamesAttributes(dimension,level,`${label} · ${status} ${dimension} · ${location}`,filters)}>${el(location)}</button>
      <span class="canvas-pass-location-bar" aria-hidden="true"><i style="width:${100*count/maximum}%"></i></span>
      <strong>${number.format(count)} dari ${number.format(total)} (${number.format(100*count/total)}%)</strong>
     </li>`).join('')}</ul>`:'<p>Rincian lokasi belum tersedia untuk channel ini.</p>'}
    </section>`;
   })).join('');
  return {card,details,metrics};
 });
 return `<article class="canvas-panel canvas-ask-segment-pass" data-pass-view="${national?'national':'detail'}" aria-labelledby="canvas-ask-segment-pass-title">
  <div class="canvas-ask-section-heading">
   <h3 id="canvas-ask-segment-pass-title">High &amp; Low by Channel</h3>
   <p>${el(multiMonth?period:comparisonPeriod)} · High ≥80 · Low &lt;80${multiMonth?'':' · pp = poin persentase'}</p>
  </div>
  ${national?'<div class="canvas-pass-compare-legend"><span>High</span><span>Low</span></div>':''}
  ${national?`<div class="canvas-pass-compare-groups">${dimensions.map((dimension,index)=>`
   <section class="canvas-pass-compare-group" aria-labelledby="ask-pass-dimension-${index}">
    <h4 id="ask-pass-dimension-${index}">${el(dimension)}</h4>
    <div class="canvas-pass-compare-layout">
    <div class="canvas-pass-compare-scroll" tabindex="0" role="region" aria-labelledby="ask-pass-dimension-${index}">
     <div class="canvas-pass-compare-plot">
      <div class="canvas-pass-compare-scale" aria-hidden="true"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
      ${charts.map(chart=>chart.metrics[index].visual).join('')}
     </div>
    </div>
    <div class="canvas-pass-compare-table-wrap">
     <table class="canvas-pass-compare-table" aria-label="High dan Low ${el(dimension)} per channel">
      <thead><tr><th scope="col">Channel</th><th scope="col">High</th><th scope="col">Low</th><th scope="col">% High</th></tr></thead>
      <tbody>${charts.map(chart=>chart.metrics[index].row).join('')}</tbody>
     </table>
    </div>
    </div>
   </section>`).join('')}</div>`:`<div class="canvas-pass-segment-grid${charts.length===1?' is-single':''}" style="--pass-segment-columns:${Math.min(charts.length,4)}">
   ${charts.map(({card})=>card).join('')}
  </div>`}
  ${charts.map(({details})=>details).join('')}
 </article>`;
}

function dashboardAskPassDetails(rows,previous,{dimensions,scope,period,priorPeriod,multiMonth,currentMonth,priorMonth}) {
 const groups = new Map();
 for (const [key,metrics] of rows) {
  if (!metrics.total) continue;
  const [channel,area,place] = JSON.parse(key);
  const groupKey = JSON.stringify([channel,area]);
  if (!groups.has(groupKey)) groups.set(groupKey,{channel,label:[channel,area].filter(Boolean).join(' · '),places:[]});
  if (place) groups.get(groupKey).places.push({key,label:place,metrics});
  else Object.assign(groups.get(groupKey),{key,metrics});
 }
 const sort = (a,b)=>a.label.localeCompare(b.label,'id',{numeric:true});
 const number = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const rate = (value,total)=>100*value/total;
 const count = total=>number.format(total);
 const monthName = key=>dashboardShortMonth(key);
 const comparisonLabel = multiMonth ? null : dashboardCompareMonths(currentMonth,priorMonth);
 const measure = (label,percent,amount)=>`<span><span class="canvas-ask-pass-status">${label}</span>
  <strong>${number.format(percent)}%</strong> <span class="canvas-ask-pass-count">(${count(amount)} CSR)</span></span>`;
 const passBar = (metrics,index,label,fullLabel)=>{
  const dateLabel = `<small class="canvas-ask-pass-month" title="${el(fullLabel)}">${el(label)}</small>`;
  if (!metrics?.total) return `<div class="canvas-ask-pass-bar is-empty">${dateLabel}<span>Belum ada data</span></div>`;
  const passed = metrics.high[index];
  const percent = rate(passed,metrics.total);
  const shownPercent = Math.round(percent*10)/10;
  return `<div class="canvas-ask-pass-bar">
   ${dateLabel}
   <div><span class="canvas-ask-stacked-track" aria-hidden="true"><i style="width:${percent}%"></i></span>
    <div class="canvas-ask-pass-counts">${measure('High',shownPercent,passed)}${measure('Low',100-shownPercent,metrics.total-passed)}</div>
   </div>
  </div>`;
 };
 const locationChart = ({key,label,metrics})=>{
  const prior = previous?.get(key);
  return `<figure class="canvas-ask-pass-chart"${multiMonth?' data-period-total':''}>
   <figcaption><strong>${el(label)}</strong><small>${count(metrics.total)} ${multiMonth?'penilaian':'CSR dinilai'}</small></figcaption>
   ${dimensions.map((dimension,index)=>{
    const comparison = !multiMonth && prior?.total
     ? dashboardAskOverviewDelta(rate(metrics.high[index],metrics.total),rate(prior.high[index],prior.total),'pp') : '';
    return `<div class="canvas-ask-pass-dimension">
     <h5>${el(dimension)} ${comparison}</h5>
     ${multiMonth?'':passBar(prior,index,monthName(priorMonth),priorPeriod)}
     ${passBar(metrics,index,multiMonth?period:monthName(currentMonth),period)}
    </div>`;
   }).join('')}
  </figure>`;
 };
 if (!groups.size) return '';
 const channelOrder = Object.keys(LOCAL_ASK_CHANNELS);
 const groupRows = [...groups.values()].sort((a,b)=>channelOrder.indexOf(a.channel)-channelOrder.indexOf(b.channel) || sort(a,b));
 return `<details class="canvas-ask-pass-details" data-ask-pass-group="all"${dashboardAskPassDisclosures.get('all')?' open':''}>
  <summary>Rincian High dan Low berdasarkan lokasi</summary>
  <div class="canvas-ask-pass-body">
   <p>${el(scope)} · ${el(comparisonLabel || period)} · Persentase High (skor ≥80) per dimensi${comparisonLabel?' · pp = poin persentase':''}</p>
   ${multiMonth?'<p>Total penilaian dijumlahkan dari bulan-bulan yang tersedia. Satu CSR bisa tercatat di beberapa bulan.</p>':''}
   <div class="canvas-pass-legend"><span>High</span><span>Low</span></div>
   ${groupRows.map(({key,channel,label,metrics,places})=>`<details class="canvas-ask-pass-group" data-ask-pass-group="${el(label)}" data-channel="${el(channel)}"${(dashboardAskPassDisclosures.get(label) ?? groupRows.length===1)?' open':''}>
    <summary><strong>${dashboardAskChannelIcon(channel)}${el(label)}</strong><span>${metrics?`${count(metrics.total)} ${multiMonth?'penilaian':'CSR dinilai'}`:''}</span></summary>
    <div class="canvas-ask-pass-charts">
     ${metrics?locationChart({key,label:'Total cakupan',metrics}):''}${places.sort(sort).map(locationChart).join('')}
    </div>
   </details>`).join('')}
  </div>
 </details>`;
}

function dashboardAskReport({scope,channel,period,priorPeriod,priorShort,comparisonPeriod,ytd,range,detailMonth,detailScope,coverage,current,previous,dimensions,talentPool,distributionPeriod,csrOverview,highLowOverview,segmentDetails,channelTrend,quadrants,ranking,useAugustReference}) {
 const format = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const scoreFormat = new Intl.NumberFormat('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1});
 const multiMonth = ytd || range;
 const countLabel = multiMonth ? 'penilaian CSR' : 'CSR dinilai';
 const currentTotals = dashboardAskTotals(Object.values(current.groups));
 const previousTotals = dashboardAskTotals(Object.values(previous?.groups || {}));
 const average = dashboardAskAverage(currentTotals);
 const priorAverage = dashboardAskAverage(previousTotals);
 const number = value=>value==null?'—':format.format(value);
 const score = value=>value==null?'—':scoreFormat.format(value);
 const asScore = value=>value==null?'—':number(value)+'/100';
 const indicator = (value,prior)=>multiMonth?'':dashboardAskOverviewDelta(value,prior,'pts',true);
 const scoreColor = (value,prior,fallback='')=>{
  const movement = multiMonth ? null : dashboardMoMChange(value,prior);
  return movement ? `dashboard-mom-value ${movement.tone}` : fallback;
 };
 const areas = Object.keys(multiMonth?current.areas:{...previous?.areas,...current.areas})
  .sort((a,b)=>a.localeCompare(b,'id',{numeric:true}));
 const cohort = (label,channel,now,older,name=label)=>({
  label,channel,name,total:now.total,priorTotal:older?.total,
  score:dashboardAskAverage(now),previous:dashboardAskAverage(older),metrics:now,
 });
 const comparisonGroups = Object.entries(LOCAL_ASK_CHANNELS).flatMap(([channel,segments])=>{
  if (channel==='GraPARI' && areas.length) return areas.map(area=>
   cohort('GraPARI · '+area,channel,current.areas[area] || emptyDashboardAskMetrics(),previous?.areas[area],area));
  return cohort(channel,channel,dashboardAskTotals(segments.map(segment=>current.groups[segment])),
   dashboardAskTotals(segments.map(segment=>previous?.groups[segment])));
 });
 const groups = comparisonGroups.filter(group=>group.total);
 const performanceRows = comparisonGroups.filter(group=>group.total || (!multiMonth && group.priorTotal));
 const lastGraPARI = performanceRows.findLastIndex(group=>group.channel==='GraPARI');
 if (lastGraPARI>0) {
  const segments = LOCAL_ASK_CHANNELS.GraPARI;
  const total = cohort('All GraPARI','GraPARI',dashboardAskTotals(segments.map(segment=>current.groups[segment])),
   dashboardAskTotals(segments.map(segment=>previous?.groups[segment])));
  performanceRows.splice(lastGraPARI+1,0,{...total,subtotal:true});
 }
 if (channel==='All CTP' && scope==='Nasional') {
  const siteMetrics = (snapshot,channel,city)=>dashboardAskTotals([...snapshot?.passLocations || []]
   .filter(([key])=>{const parts=JSON.parse(key);return parts.length===3 && parts[0]===channel && parts[2].endsWith(city)})
   .map(([,metrics])=>metrics));
  for (const [siteChannel,label] of [['Call Center','Call Center'],['E-Care','E-Care']]) {
   const index=performanceRows.findIndex(row=>row.channel===siteChannel);
   if (index<0) continue;
   const sites=['Semarang','Bandung'].map(city=>cohort(`${label} · ${city}`,siteChannel,
    siteMetrics(current,siteChannel,city),siteMetrics(previous,siteChannel,city)))
    .filter(row=>row.total || (!multiMonth && row.priorTotal));
   performanceRows.splice(index,0,...sites);
   performanceRows[index+sites.length]={...performanceRows[index+sites.length],label:`All ${label}`,subtotal:true};
  }
 }
 const allChannels = channel==='All CTP';
 const csrIcon = dashboardChannelIcon(DASHBOARD_CSR_ICON_PATH);
 const areaIcon = dashboardChannelIcon('M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z');
 const cohortGroups = [
  {id:'grapari',label:'GraPARI',icon:'GraPARI',rows:groups.filter(row=>row.channel==='GraPARI')},
  {id:'contact',label:'Contact Center',icon:'Call Center',rows:groups.filter(row=>row.channel!=='GraPARI')},
 ].filter(group=>group.rows.length);
 if (allChannels && (currentTotals.total || (!multiMonth && previousTotals.total))) {
  const total = cohort(scope==='Nasional'?'Nasional':'Total cakupan','',currentTotals,previousTotals);
  performanceRows.push({...total,subtotal:true});
 }
 const dimensionRows = dimensions.map((label,index)=>({
  label,score:dashboardAskAverage(currentTotals,currentTotals.dimensionSums[index]),
  previous:dashboardAskAverage(previousTotals,previousTotals.dimensionSums[index]),
 }));
 const lowest = rows=>{
  const ranked = rows.filter(row=>Number.isFinite(row.score)).sort((a,b)=>a.score-b.score);
  return ranked.length>1 && format.format(ranked[0].score)!==format.format(ranked[1].score) ? ranked[0] : null;
 };
 const lowestDimension = lowest(dimensionRows);
 const lowestGroup = lowest(groups);
 const lowCount = ['good','core','growth'].reduce((total,key)=>total+(talentPool?.[key] || 0),0);
 const bandTotal = (talentPool?.excellent || 0)+lowCount;
 const delta = average-priorAverage;
 const movement = priorAverage==null ? `Pembanding ${priorPeriod} belum tersedia.`
  : Math.abs(delta)<0.05 ? `Relatif stabil dibanding ${priorPeriod}.`
   : `${delta>0?'Naik':'Turun'} ${number(Math.abs(delta))} poin dibanding ${priorPeriod}.`;
 const highestGroup = [...groups].filter(row=>Number.isFinite(row.score)).sort((a,b)=>b.score-a.score)[0];
 const execIcons = {
  summary:'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
  pain:'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  action:'M4 12h15m-6-6 6 6-6 6',
 };
 const execCard = (title,tone,items)=>`<section class="canvas-ask-exec-card is-${tone}">
  <h4><span class="canvas-ask-exec-icon">${dashboardChannelIcon(execIcons[tone])}</span>${title}</h4>
  <ul>${items.filter(Boolean).map(item=>`<li><span class="canvas-ask-exec-bullet">${dashboardChannelIcon(execIcons[tone])}</span><span>${item}</span></li>`).join('')}</ul></section>`;
 const summary = average==null ? '<p>Belum ada skor ASK yang bisa dirangkum untuk periode dan lokasi ini.</p>'
  : `<div class="canvas-ask-exec-grid">
    ${execCard('Summary','summary',[
     `Capaian ASK rata-rata <strong>${asScore(average)}</strong> dari <strong>${number(currentTotals.total)}</strong> ${multiMonth?'penilaian CSR':'CSR'}. ${multiMonth?'':movement}`,
     bandTotal?`<strong>${number(bandTotal-lowCount)} CSR</strong> (${number(100*(bandTotal-lowCount)/bandTotal)}%) masuk kategori Excellent (≥80).`:'',
     highestGroup?`Kelompok tertinggi: <strong>${el(highestGroup.label)}</strong> (${asScore(highestGroup.score)}).`:'',
    ])}
    ${execCard('Pain Points','pain',[
     bandTotal&&lowCount?`<strong>${number(lowCount)} CSR</strong> (${number(100*lowCount/bandTotal)}%) memiliki skor ASK di bawah 80.${multiMonth&&distributionPeriod?' ('+el(distributionPeriod)+')':''}`:'Tidak ada CSR dengan skor ASK di bawah 80 pada cakupan ini.',
     lowestDimension?`Dimensi terendah: <strong>${el(lowestDimension.label)}</strong> (${asScore(lowestDimension.score)}).`:'',
     lowestGroup?`Kelompok terendah: <strong>${el(lowestGroup.label)}</strong> (${asScore(lowestGroup.score)}).`:'',
    ])}
    ${execCard('Action Plan / Recommendation','action',[
     `Prioritaskan pembinaan pada dimensi <strong>${el(lowestDimension?.label || 'Attitude')}</strong> melalui coaching dan review interaksi.`,
     lowestGroup?`Fokuskan pendampingan di <strong>${el(lowestGroup.label)}</strong> serta tinjau daftar CSR di peringkat terbawah.`:'Tinjau daftar CSR pada peringkat terbawah untuk tindak lanjut.',
     'Pantau pergerakan skor CSR kategori Core &amp; Growth Potential pada periode berikutnya.',
    ])}
   </div>`;
 const chartOptions = {period,priorPeriod,comparisonPeriod,ytd,range,detailScope};
 const singleContactChannel = ['Call Center','E-Care'].includes(channel);
 const open = ctp==='All CTPs' ? dashboardNationalAskReportOpen : dashboardAskReportOpen;
 const executive = `<details class="canvas-ask-executive canvas-executive-disclosure" data-executive-channel="${el(ctp)}"${dashboardExecutiveDisclosures.get(ctp)!==false?' open':''}>
  <summary><h2>Executive Summary</h2><span class="canvas-executive-control"><span class="canvas-executive-hide">Sembunyikan</span><span class="canvas-executive-show">Tampilkan</span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg></span></summary>
  <div class="canvas-executive-body">${summary}</div>
 </details>`;
 return {executive,report:`<details class="canvas-ask-report"${open?' open':''}${detailMonth?` data-ask-detail-month="${el(detailMonth)}"`:''}>
  <summary class="canvas-ask-report-toggle">
   <div class="canvas-ask-report-heading">
    <h2 id="canvas-ask-report-title">Performance ASK – ${el(channel)}</h2>
    <small class="canvas-ask-report-period">${el(multiMonth?period:comparisonPeriod)}${scope==='Nasional'?'':` · ${el(scope)}`}</small>
   </div>
    <div class="canvas-ask-overview-total"><strong>${csrIcon}${number(currentTotals.total || null)}</strong>
     <small>${countLabel} · ASK ${scope==='Nasional'&&allChannels?'nasional':'rata-rata'} ${multiMonth?score(average):
      `<b class="${scoreColor(average,priorAverage)}">${score(average)}</b>${singleContactChannel&&average!=null?'/100':''} ${indicator(average,priorAverage)}${singleContactChannel&&priorAverage!=null?` <span>${el(priorShort)}</span>`:''}`}</small>
     ${multiMonth?`<small>${coverage}</small>`:''}
    </div>
   <span class="canvas-ask-toggle-open" aria-hidden="true">Sembunyikan</span><span class="canvas-ask-toggle-closed" aria-hidden="true">Tampilkan</span>
  </summary>
  <div class="canvas-ask-report-content" role="region" aria-labelledby="canvas-ask-report-title">
  ${singleContactChannel?'':`<div class="canvas-ask-overview-cards">
  <section class="canvas-ask-overview" aria-label="Ringkasan skor ASK per CTP">
   ${cohortGroups.length?`<div class="canvas-ask-cohort-groups">${cohortGroups.map(group=>
    `<section class="canvas-ask-cohort-set" data-cohort-family="${group.id}">
     <header><h4>${dashboardAskChannelIcon(group.icon)}${group.label}</h4></header>
     <ul class="canvas-ask-overview-cohorts" aria-label="Skor ASK ${group.label}">${group.rows.map(row=>{
      const tone = row.score==null?'neutral':row.score>=90?'high':row.score>=80?'mid':'low';
      return `<li data-channel="${el(row.channel)}">
       <h5>${row.channel==='GraPARI' && row.name!==row.channel?areaIcon:dashboardAskChannelIcon(row.channel)}${el(row.name)}</h5>
       <div class="canvas-ask-overview-score"><strong class="${scoreColor(row.score,row.previous,'tone-'+tone)}">${score(row.score)}${row.score!=null?' <small>/100</small>':''}</strong>
        ${!multiMonth && row.previous!==null?`<div class="canvas-ask-period-delta">${indicator(row.score,row.previous)}<small title="${el(priorPeriod)}">${el(priorShort)}</small></div>`:''}
       </div>
       <p class="canvas-ask-cohort-count">${csrIcon}${number(row.total)} ${countLabel}</p>
      </li>`;
     }).join('')}</ul>
    </section>`).join('')}</div>`:'<p>Belum ada penilaian ASK untuk cakupan ini.</p>'}
  </section>
  </div>`}
   <section class="canvas-ask-overview canvas-ask-analysis" id="canvas-ask-comparison" tabindex="-1" aria-label="Perbandingan dimensi dan distribusi ASK">
   <div class="canvas-ask-overview-panels">
    <div class="canvas-ask-analysis-left">
    ${csrOverview}
    <div class="canvas-ask-components" role="group" aria-label="Komponen ASK">${dimensionRows.map(row=>`<article class="canvas-ask-component" data-dimension="${row.label.toLowerCase()}">
     <div><h4><span class="canvas-ask-dimension-icon">${dashboardChannelIcon(DASHBOARD_ASK_DIMENSION_ICONS[row.label])}</span>${el(row.label)}</h4><p>${ytd?'rata-rata YTD':range?'rata-rata periode':scope==='Nasional'&&allChannels?'rata-rata nasional':'rata-rata cakupan'}</p>
      ${!multiMonth&&Number.isFinite(row.previous)?`<p><abbr title="${el(priorPeriod)}">${el(priorShort)}</abbr> ${score(row.previous)}</p>`:''}</div>
     <div class="canvas-ask-component-value"><strong class="${scoreColor(row.score,row.previous)}">${score(row.score)}</strong>${indicator(row.score,row.previous)}</div>
    </article>`).join('')}</div>
    </div>
    ${highLowOverview}
    ${dashboardAskOverviewDistribution(talentPool,previous?.talentPool,{multiMonth,comparisonPeriod,priorShort,distributionPeriod})}
   </div>
   ${channelTrend?`<article class="canvas-panel canvas-focus">${channelTrend}</article>`:''}
   </section>
   ${segmentDetails}
   <div class="canvas-ask-report-panels">
    <div class="canvas-ask-performance-column">
     ${dashboardAskPerformanceTable(performanceRows,chartOptions)}
     ${dashboardAskPriorityPanel(groups,currentTotals,current.parameters,{period,scope,multiMonth,useAugustReference})}
    </div>
    ${quadrants}
   </div>
   ${ranking}
  <p class="canvas-ask-report-source">Data bersumber dari workbook ASK lokal. Skor ASK berbobot 40% Attitude, 30% Skill, dan 30% Knowledge.
   Warna A–S–K di tabel mengikuti ambang ≥90, 80 hingga &lt;90, dan &lt;80.${!multiMonth?' Warna skor ASK dan panah mengikuti perubahan terhadap bulan sebelumnya.':''}
   ${ytd?'Rata-rata YTD memakai semua penilaian yang tersedia. Distribusi skor memakai penilaian valid terakhir tiap CSR.':range?'Rata-rata periode memakai semua penilaian yang tersedia dalam rentang. Distribusi dan peringkat memakai bulan terbaru yang memiliki penilaian dalam rentang.':''}</p>
  </div>
 </details>`};
}

function dashboardCsrPie(groups) {
 const rows = groups.filter(({value})=>Number.isFinite(value) && value>0);
 if (!rows.length) return '<p>Data jumlah CSR lokal belum tersedia untuk periode ini.</p>';
 const colors = {
  'GraPARI · MOMO':'#9f1239','GraPARI · TOMO':'#e6002b','Call Center':'var(--canvas-contact-center-green)',
  'E-Care':'var(--canvas-ecare-blue)','CTP belum terpetakan':'#7a657a',
 };
 const total = rows.reduce((sum,row)=>sum+row.value,0);
 const counts = new Intl.NumberFormat('id-ID');
 const shares = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const center = {x:180,y:102,radius:63};
 const point = (angle,radius)=>({x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius});
 let start = -Math.PI/2;
 const slices = rows.map(row=>{
  const share = row.value/total;
  const end = start+share*2*Math.PI;
  const begin = point(start,center.radius), finish = point(end,center.radius);
  const middle = (start+end)/2;
  const anchor = point(middle,center.radius-2);
  const bend = point(middle,center.radius+10);
  const color = row.color || colors[row.label] || '#64748b';
  const shape = share===1 ? `<circle cx="${center.x}" cy="${center.y}" r="${center.radius}" fill="${color}"/>` :
   `<path d="M${center.x},${center.y} L${begin.x},${begin.y} A${center.radius},${center.radius} 0 ${share>0.5?1:0} 1 ${finish.x},${finish.y} Z" fill="${color}"/>`;
  start = end;
  return {...row,shape,anchor,bend,color,percentage:share<0.001?'<0,1%':shares.format(share*100)+'%'};
 });
 const summary = slices.map(({label,percentage,value})=>`${label} ${percentage} (${counts.format(value)} CSR)`).join(', ');
 const labels = [false,true].flatMap(right=>{
  const side = slices.filter(slice=>(slice.anchor.x>=center.x)===right).sort((a,b)=>a.bend.y-b.bend.y);
  const edge = right?250:110;
  const labelX = right?254:106;
  let lastY = -10;
  return side.map((slice,index)=>{
   const {anchor,bend,percentage,value,label,color} = slice;
   const y = Math.max(17,lastY+27,Math.min(bend.y,181-(side.length-1-index)*27));
   lastY = y;
   return `<g class="canvas-pie-callout">
    <polyline points="${anchor.x},${anchor.y} ${bend.x},${bend.y} ${edge},${y}"/>
    <circle cx="${anchor.x}" cy="${anchor.y}" r="2.2" fill="${color}"/>
    <text x="${labelX}" y="${y-1}" text-anchor="${right?'start':'end'}">${el(label)}</text>
    <text class="canvas-pie-value" x="${labelX}" y="${y+12}" text-anchor="${right?'start':'end'}">${el(percentage)} (${counts.format(value)})</text>
   </g>`;
  });
 }).join('');
 return `<svg class="canvas-csr-pie" viewBox="0 0 360 200" role="img" aria-label="${el(summary)}">
  <g class="canvas-pie-slices">${slices.map(slice=>slice.shape).join('')}</g>${labels}
 </svg>`;
}

function dashboardLearningDisclosure(id,title,scope,body) {
 const heading = `canvas-learning-${id}-title`;
 const open = dashboardLearningOpen.has(id) || (id==='hard' && title==='Training Hard Skill Nasional' && !dashboardLearningClosed.has(id));
 return `<details class="canvas-learning-report" data-learning-disclosure="${id}"${open?' open':''}>
  <summary class="canvas-learning-toggle"><h2 class="canvas-learning-title" id="${heading}">${el(title)}<small>${el(scope)}</small></h2>
   <span class="canvas-learning-action" aria-hidden="true"><span class="canvas-learning-show">Tampilkan</span><span class="canvas-learning-hide">Sembunyikan</span></span>
  </summary>
  <div class="canvas-learning-body" role="region" aria-labelledby="${heading}">${body}</div>
 </details>`;
}

function dashboardNationalShortcuts() {
 const topics = [['ask','ASK'],['training','Training'],['bad-ticket','Bad Ticket']];
 return `<section class="canvas-national-details" aria-labelledby="canvas-national-details-title">
   <h2 id="canvas-national-details-title">Rincian Nasional</h2>
   <nav aria-label="Pintasan rincian Nasional">${topics.map(([key,label])=>
    `<button type="button" id="canvas-national-detail-${key}" class="canvas-link" data-dashboard-jump="${key}">${label}</button>`).join('')}</nav>
  </section>`;
}

function ctpExecutiveDashboard(agents, trial=false) {
 const dimensions = ['Attitude','Skill','Knowledge'];
 const number = new Intl.NumberFormat('id-ID');
 const score = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const fmt = (value,unit='')=>value==null ? 'Belum ada data' : score.format(value)+(unit==='%'?'%':unit?' '+unit:'');
 const count = ids=>new Set(ids).size;
 const reportMonth = (trial ? reportTo : reportFrom).slice(0,7);
 const [year,month] = reportMonth.split('-').map(Number);
 const iso = (year,month,day)=>new Date(Date.UTC(year,month,day)).toISOString().slice(0,10);
 const fullMonth = reportFrom.endsWith('-01') && reportTo===iso(year,month,0);
 const priorMonth = iso(year,month-2,1);
 const ytd = trial && dashboardTrialWindow==='ytd';
 const range = trial && !ytd && reportFrom.slice(0,7)!==reportMonth;
 const multiMonth = ytd || range;
 const lastAsk = trial || fullMonth ? dashboardAskSnapshot(localAskReport?.[reportMonth]) : null;
 const tryoutSessionRows = dashboardTryoutSessionRows([lastAsk]);
 const previousAsk = trial || fullMonth ? dashboardAskSnapshot(localAskReport?.[priorMonth.slice(0,7)]) : null;
 const priorLabel = new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'})
  .format(new Date(priorMonth+'T00:00:00Z'));
 const comparisonPeriod = dashboardCompareMonths(reportMonth,priorMonth.slice(0,7));
 const priorShort = dashboardShortComparison(priorMonth.slice(0,7));
 const monthLabel = key=>new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'})
  .format(new Date(key+'-01T00:00:00Z'));
 const [hard,soft,acs,bad,tryout] = DASH_PROGRAMS;
 const learning = dashboardLearningReport();
 const trainingLocal = Boolean(learning?.training || learning?.status);
 const tryoutLocal = Boolean(learning?.tryout || learning?.status);
 const training = learning?.training || {};
 const practice = learning?.tryout || {};
 const loadingMessage = learning?.status==='loading' ? 'Memuat rekap lokal…' :
  learning?.status==='error' ? 'Rekap lokal tidak dapat dibaca.' : '';
 const programs = Object.fromEntries(DASH_PROGRAMS.map(program=>[program,dashboardProgramRows(agents,program)]));
 const programIds = new Set(Object.values(programs).flat().map(row=>row.agent_id));
 const programRoster = state.agents.filter(agent=>programIds.has(agent.id));
 const regularPairs = regularTrainingTestPairs(programRoster);
 const source = rows=>{
  const hasDemo = rows.some(row=>row.source==='Dummy program fixture');
  const hasSaved = rows.some(row=>row.source==='Saved activity');
  return hasDemo && hasSaved ? 'Aktivitas tersimpan dan program demo' : hasDemo ? 'Data program demo' : hasSaved ? 'Aktivitas tersimpan' : 'Belum ada catatan program';
 };
 const programCount = (keys, ids)=> {
  if (!ids && trainingLocal && keys[0]!==tryout) {
   const name = keys.length>1 ? 'regular' : {[hard]:'hard',[soft]:'soft',[acs]:'acs',[bad]:'bad'}[keys[0]];
   return training[name];
  }
  if (!ids && tryoutLocal && keys[0]===tryout) return practice.attempts || null;
  const rows = keys.flatMap(key=>programs[key]);
  return rows.length ? count(rows.filter(row=>!ids || ids.has(row.agent_id)).map(row=>row.agent_id)) : null;
 };
 const average = (pairs,key)=>pairs.length ? avg(pairs.map(pair=>Number(pair[key]))) : null;
 const pairAverage = (key)=>trainingLocal ? training[key==='pre'?'pairPre':'pairPost'] : average(regularPairs,key);
 const pairCount = trainingLocal ? training.pairs : regularPairs.length;
 const trainingNote = trainingLocal ? loadingMessage || (training.attendance
  ? `Rekap Training lokal · ${number.format(training.attendance)} kehadiran · ${number.format(training.sessions)} sesi`
  : 'Belum ada kehadiran Training dalam cakupan ini.') : source([...programs[hard],...programs[soft],...programs[acs],...programs[bad]]);
 const pairNote = loadingMessage || (pairCount
  ? `${number.format(pairCount)} pasangan tes dalam aktivitas yang sama`
  : 'Belum ada pasangan tes reguler dalam cakupan ini.');
 const askRates = (high,total)=>high.map(value=>total ? 100*value/total : null);
 const locationLabel = dashboardLocationLabel();
 const [firstYear,firstMonth] = (ytd ? `${year}-01` : range ? reportFrom.slice(0,7) : reportMonth).split('-').map(Number);
 const trialMonths = trial ? Array.from({length:(year-firstYear)*12+month-firstMonth+1},(_,index)=>{
  const key = iso(firstYear,firstMonth-1+index,1).slice(0,7);
  return {key,data:key===reportMonth && !ytd ? lastAsk : dashboardAskSnapshot(localAskReport?.[key],ytd)};
 }) : [];
 const csrSnapshot = multiMonth ? trialMonths.findLast(({data})=>data?.csrCounts!=null)
  : {key:reportMonth,data:lastAsk};
 const csrMonth = csrSnapshot?.key || '';
 const csrSnapshotLabel = csrMonth ? monthLabel(csrMonth) : '';
 const localCsr = csrSnapshot?.data?.csrCounts;
 const priorCsr = previousAsk?.csrCounts;
 const totalCsr = counts=>counts ? Object.entries(counts).reduce((sum,[name,value])=>
  sum+(name==='GraPARI model belum tercatat'?0:value),0) : null;
 const total = totalCsr(localCsr), prior = totalCsr(priorCsr);
 const difference = prior==null || total==null ? null : total-prior;
 const [direction, symbol, tone] = difference > 0 ? ['Naik','↑','positive']
  : difference < 0 ? ['Turun','↓','negative'] : ['Tetap','→','neutral'];
 const csrMonthComparison = difference==null ? '<p>Data pembanding belum tersedia</p>'
  : `<p class="ctp-csr-mom"><b class="ak-delta ${tone}"><span role="img" aria-label="${direction}">${symbol}</span> ${fmt(Math.abs(difference),'CSR')}</b>
     <span>${priorLabel}: ${fmt(prior,'CSR')}</span></p>`;
 const csrNote = multiMonth
  ? `CSR unik${csrSnapshotLabel?' · Posisi '+csrSnapshotLabel:''}`
  : `CSR unik · ${monthLabel(reportMonth)}`;
 const latestDistribution = multiMonth ? trialMonths.findLast(({data})=>
  data && (ytd || Object.values(data.groups).some(group=>group.total))) : null;
 const distribution = trial ? null : dashboardAskDistribution(
  lastAsk?.talentPool,
  previousAsk?.talentPool,
  {
   period:monthLabel(reportMonth),
   priorPeriod:priorLabel,
   ytd:false,
   missing:!fullMonth ? 'Pilih satu bulan kalender penuh untuk melihat distribusi skor ASK.'
    : `Data Talent Pool belum tersedia untuk cakupan ${monthLabel(reportMonth)}.`,
  },
 );
 const workbook = trial ? {groups:{},areas:Object.create(null),passLocations:new Map(),parameters:{}} : fullMonth && locationLabel==='Nasional' &&
  category==='All Categories' && !q ? localAskReport?.[reportMonth] : null;
 if (trial) {
  for (const {data} of trialMonths) {
   addDashboardAskParameters(workbook.parameters,data?.parameters);
   for (const [key,group] of Object.entries(data?.groups || {})) {
    addDashboardAskMetrics(workbook.groups[key] ||= emptyDashboardAskMetrics(),group);
   }
   for (const [name,metrics] of Object.entries(data?.areas || {})) {
    addDashboardAskMetrics(workbook.areas[name] ||= emptyDashboardAskMetrics(),metrics);
   }
   for (const [key,metrics] of data?.passLocations || []) {
    if (!workbook.passLocations.has(key)) workbook.passLocations.set(key,emptyDashboardAskMetrics());
    const total = workbook.passLocations.get(key);
    addDashboardAskMetrics(total,metrics);
    for (const name of metrics.regions || []) (total.regions ||= new Set()).add(name);
    const segments = total.segments ||= {};
    for (const [segment,group] of Object.entries(metrics.segments || {})) {
     addDashboardAskMetrics(segments[segment] ||= emptyDashboardAskMetrics(),group);
    }
   }
  }
 }
 const workbookTotals = workbook ? dashboardAskTotals(Object.values(workbook.groups)) : null;
 const rosterAsk = workbook ? null : askStats(agents);
 const covered = workbookTotals ? workbookTotals.total : rosterAsk.n;
 const dashboardHigh = workbookTotals ? workbookTotals.high : rosterAsk.high.map(metric=>metric.count);
 const dashboardAsk = askRates(dashboardHigh,covered);
 const rosterSource = agents.some(isShowcaseAgent) ? 'Roster training · mencakup data demo' : 'Roster training';
 const askSource = workbook ? 'Workbook ASK lokal' : rosterSource;
 const monthsAvailable = trialMonths.filter(({data})=>Object.values(data?.groups || {}).some(group=>group.total)).length;
 const monthCoverage = `Data ${monthsAvailable}/${trialMonths.length} bulan`;
 const askCoverage = `${number.format(covered)} ${multiMonth?'penilaian CSR':'CSR dinilai'}${multiMonth?' · '+monthCoverage:''}`;
 const scoredTryout = programs[tryout].filter(row=>validAssessmentScore(row.score));
 const askTryout = (multiMonth ? trialMonths.map(({data})=>data) : [lastAsk]).reduce((total,snapshot)=>{
  for (const key of Object.keys(total)) total[key] += snapshot?.tryout?.[key] || 0;
  return total;
 },{count:0,sum:0,high:0,mid:0,low:0});
 const useAskTryout = askTryout.count>0;
 const tryoutAverage = useAskTryout ? askTryout.sum/askTryout.count
  : tryoutLocal ? practice.score : average(scoredTryout,'score');
 const tryoutCoverage = (practice.coverage || []).map(coverage=>{
  const [month,week] = coverage.split(' ');
  return `${week} ${monthLabel(month)}`;
 }).join(', ');
 const tryoutNote = tryoutLocal ? loadingMessage || (practice.attempts
  ? `${tryoutCoverage} · Susulan · ${number.format(practice.attempts)} percobaan terisi`
  : 'Belum ada hasil Tryout lokal dalam cakupan ini.') : source(programs[tryout]);
 const askTryoutNote = `Workbook ASK · ${number.format(askTryout.count)} nilai TO`;
 const card = (title,body,foot='')=>`<article class="dw-card ctp-kpi"><h3>${title}</h3>${body}${foot?'<p>'+foot+'</p>':''}</article>`;
 const values = items=>`<dl class="ctp-kpi-values">${items.map(([label,value,unit])=>
  `<div><dt>${label}</dt><dd>${fmt(value,unit)}</dd></div>`).join('')}</dl>`;
 const programDetail = (label,tab,sub)=>`<button type="button" class="dw-link" data-dash-tab="${tab}"${sub?` data-dash-open-sub="${sub}"`:''}>${label}</button>`;
 const cards = [
  card(trial && (locationLabel!=='Nasional' || ctp!=='All CTPs') ? 'Total CSR' : 'Total CSR Nasional',total==null
   ? `<p><b>${trial?'Data CSR lokal belum tersedia untuk cakupan ini.':fullMonth?'Data CSR lokal belum tersedia untuk bulan ini.':'Pilih satu bulan kalender penuh untuk melihat total CSR.'}</b></p>`
   : `<strong class="ctp-kpi-number">${number.format(total)} <small>CSR</small></strong>
      ${csrMonthComparison}`,
   trial ? `Workbook ASK lokal · ${csrNote}` : 'Workbook ASK lokal · Semua CTP · CSR unik, termasuk skor yang belum lengkap'),
  card(locationLabel==='Nasional' && ctp==='All CTPs' ? 'High ASK Nasional' : 'High ASK',values(dimensions.map((label,i)=>[label,dashboardAsk[i],'%'])),
   `${askSource} · ${askCoverage} · High = skor minimal 80`),
  card('Training Hard Skill',values([['Peserta unik',programCount([hard]),'CSR']])+
   (trainingLocal?'':programDetail('Rincian training',2)),trainingLocal?trainingNote:source(programs[hard])),
  card('Tryout',values([[useAskTryout?'Nilai TO terisi':tryoutLocal?'Percobaan terisi':'Peserta',
   useAskTryout?askTryout.count:programCount([tryout]),useAskTryout||tryoutLocal?'':'peserta'],
   [tryoutLocal&&!useAskTryout?'Rata-rata akurasi':'Rata-rata nilai',tryoutAverage,'/ 100']])+
   (useAskTryout||tryoutLocal?'':programDetail('Rincian Tryout',4,tryout)),useAskTryout?askTryoutNote:tryoutNote),
  card('Training Reguler',values([['Peserta unik',programCount([acs,bad]),'peserta'],['ACS Booster',programCount([acs]),'peserta'],['Bad Ticket',programCount([bad]),'peserta']])+
   (trainingLocal?'':programDetail('Rincian training reguler',3)),trainingLocal?trainingNote:source([...programs[acs],...programs[bad]])),
  card('Pre-test & Post-test Reguler',values([['Pre-test',pairAverage('pre'),'/ 100'],['Post-test',pairAverage('post'),'/ 100']]),pairNote),
 ];
 const cohortDefinitions = [
  ['GraPARI · MOMO','Walk In Mitra',agent=>agent.ctp==='GraPARI' && askSegment(agent)==='MOMO'],
  ['GraPARI · TOMO','Walk In TOMO',agent=>agent.ctp==='GraPARI' && askSegment(agent)==='TOMO'],
  ['Call Center','Call In',agent=>agent.ctp==='Contact Center'],
  ['E-Care','E-Care',agent=>agent.ctp==='E-Care'],
 ];
 if (trial && ctp!=='All CTPs') {
  const allowed = LOCAL_ASK_CHANNELS[dashboardChannelLabel()] || [];
  cohortDefinitions.splice(0,cohortDefinitions.length,...cohortDefinitions.filter(([,key])=>allowed.includes(key)));
 }
 const cohorts = cohortDefinitions.map(([label,key,matches])=>{
  const rows = agents.filter(matches);
  const programAgentIds = new Set(programRoster.filter(matches).map(agent=>agent.id));
  const group = workbook?.groups[key];
  const scopedAsk = workbook ? null : askStats(rows);
  return {
   label,
   programAgentIds,
   ask: workbook ? (group ? askRates(group.high,group.total) : null) : scopedAsk.high.map(metric=>metric.rate),
   askTotal: workbook ? group?.total : scopedAsk.n,
   pairs: regularPairs.filter(pair=>programAgentIds.has(pair.agentId)),
  };
 });
 const compare = (title,note,groups,metrics,unit,max)=>dashCard(title,note,`<div class="ctp-bars">${groups.map(group=>{
  const rows = metrics.map(([label,read],index)=>{
   const value = read(group);
   return value==null ? '' : `<div class="ctp-bar-row"><span>${label}</span><span class="ctp-bar-track" aria-hidden="true">
    <i class="ctp-bar-fill tone-${index}" style="width:${100*value/max}%"></i>
   </span><b>${fmt(value,unit)}</b></div>`;
  }).join('');
  return `<div class="ctp-bar-group"><h4>${el(group.label)}</h4>${rows || '<p>Belum ada data untuk kelompok ini.</p>'}</div>`;
 }).join('')}</div>`);
 const csrGroups = cohortDefinitions.filter(([,key])=>key)
  .map(([label,key])=>({label,value:localCsr?.[key]}));
 if (localCsr?.['CTP belum terpetakan']) csrGroups.push({
  label:'CTP belum terpetakan',value:localCsr['CTP belum terpetakan'],
 });
 const singleCsrChannel = trial && ['Contact Center','E-Care'].includes(ctp);
 const csrTitle = singleCsrChannel ? 'Jumlah CSR · '+dashboardChannelLabel() : 'CSR per CTP';
 const csrAmount = value=>Number.isFinite(value)?`${number.format(value)} <small>CSR</small>`:'<small>Data belum tersedia</small>';
 const siteEntries = singleCsrChannel ? Object.entries(csrSnapshot?.data?.csrSites || {})
  .sort(([a],[b])=>a.localeCompare(b,'id',{numeric:true})) : [];
 const siteColors = ctp==='E-Care'
  ? ['var(--canvas-ecare-blue)','#60a5fa']
  : ['var(--canvas-contact-center-green)','#52b788'];
 const csrMom = !multiMonth && Number.isFinite(difference)
  ? `<p class="canvas-csr-pie-mom"><b class="ak-delta ${tone}" aria-label="${direction} ${fmt(Math.abs(difference),'CSR')}">${symbol} ${fmt(Math.abs(difference),'CSR')}</b> ${el(priorShort)}</p>` : '';
 const csrBreakdown = singleCsrChannel ? (siteEntries.length
  ? `${dashboardCsrPie(siteEntries.map(([label,value],index)=>({label,value,color:siteColors[index % siteColors.length]})))}${csrMom}`
  : `<div class="canvas-csr-count">
  <dl>
   <div><dt>${multiMonth?'Posisi terakhir':el(monthLabel(reportMonth))}</dt><dd>${csrAmount(total)}</dd></div>
   ${multiMonth?'':`<div><dt>${el(priorLabel)}</dt><dd>${csrAmount(prior)}</dd></div>`}
  </dl>
  ${csrMom}
 </div>`) : dashboardCsrPie(csrGroups);
 const csrChart = dashCard(singleCsrChannel?el(csrTitle):'Total CSR per CTP',
  trial?`${csrNote} · termasuk CSR dengan skor ASK belum lengkap.`:'Cakupan nasional, termasuk CSR dengan skor ASK belum lengkap.',
  csrBreakdown);
 const askChart = compare('High ASK per CTP',`${askSource} · Persentase CSR dengan skor minimal 80.`,
  cohorts.filter(group=>!workbook || group.ask).map(group=>({
   ...group,label:group.askTotal ? `${group.label} · ${number.format(group.askTotal)} CSR` : group.label,
  })),
  dimensions.map((label,i)=>[label,group=>group.ask?.[i]]),'%',100);
 const programMetrics = [['Hard Skill',[hard]],['Tryout',[tryout]],['Training Reguler',[acs,bad]]];
 const localMetrics = [['Hard Skill','hard'],['Training Reguler','regular']];
 const learningGroups = learning?.groups || [];
 const trainingChart = trainingLocal
  ? compare('Peserta training per CTP','CSR unik per kategori. Satu sesi dapat masuk kategori Hard Skill dan Training Reguler.',
    learningGroups.filter(group=>group.training.attendance),localMetrics.map(([label,key])=>[label,group=>group.training[key]]),
    'CSR',Math.max(1,...learningGroups.flatMap(group=>localMetrics.map(([,key])=>group.training[key] || 0))))
  : compare('Peserta training dan Tryout per CTP',`Peserta unik per program · ${source(Object.values(programs).flat())}.`,
  cohorts,programMetrics.map(([label,keys])=>[label,group=>group.programAgentIds.size?programCount(keys,group.programAgentIds):null]),
  'peserta',Math.max(1,...cohorts.map(group=>group.programAgentIds.size)));
 const testTitle = 'Nilai pre-test dan post-test reguler per CTP';
 const testChart = pairCount
  ? compare(testTitle,'Rata-rata nilai dari pasangan tes di aktivitas reguler yang sama.',trainingLocal
     ? learningGroups.filter(group=>group.training.pairs) : cohorts,[['Pre-test',group=>trainingLocal
      ? group.training.pairPre : average(group.pairs,'pre')],['Post-test',group=>trainingLocal
      ? group.training.pairPost : average(group.pairs,'post')]],'/ 100',100)
  : dashCard(testTitle,'Rata-rata nilai dari pasangan tes di aktivitas reguler yang sama.',`<p>${pairNote}</p>`);
 const tryoutDetail = practice.attempts ? dashCard('Tryout per level',
  `${tryoutNote} · Nilai dari kolom Accuracy.`,dashTable(practice.levels.map(level=>({
   Level:level.level,'Percobaan terisi':number.format(level.attempts),'Rata-rata akurasi':fmt(level.score,'/ 100'),
  })),['Level','Percobaan terisi','Rata-rata akurasi'])+(practice.unmapped
   ? `<p>${number.format(practice.unmapped)} percobaan belum terpetakan ke CTP.</p>` : ''))+
  compare('Rata-rata akurasi Tryout per CTP','Percobaan terisi per CTP.',
   learningGroups.filter(group=>group.tryout.attempts).map(group=>({
    ...group,label:`${group.label} · ${number.format(group.tryout.attempts)} percobaan`,
   })),[['Akurasi',group=>group.tryout.score]],'/ 100',100) : '';
 if (trial) {
  const trendChannels = Object.entries(LOCAL_ASK_CHANNELS).filter(([label])=>ctp==='All CTPs'||label===dashboardChannelLabel());
  const trendRows = trialMonths.map(({key,data})=>({
   label:monthLabel(key),
   total:dashboardAskTotals(Object.values(data?.groups || {})).total,
   values:trendChannels.map(([,segments])=>dashboardAskAverage(dashboardAskTotals(segments.map(segment=>data?.groups[segment])))),
  }));
  const latest = multiMonth ? latestDistribution?.data : lastAsk;
  const hasQuadrants = Object.values(latest?.quadrants || {}).some(count=>count>0);
  const previous = dashboardAskTotals(Object.values(previousAsk?.groups || {}));
  const detailsButton = (id,label)=>`<button type="button" class="canvas-link" data-canvas-dialog="${id}" aria-haspopup="dialog">${label}</button>`;
  const averageAsk = dashboardAskAverage(workbookTotals);
  const priorAsk = dashboardAskAverage(previous);
  const priorTraining = multiMonth ? null : withPreviousPeriod(()=>{
   reportFrom = priorMonth;
   reportTo = iso(year,month-1,0);
   const priorAgents = filtered();
   const priorPrograms = Object.fromEntries(DASH_PROGRAMS.map(key=>[key,dashboardProgramRows(priorAgents,key)]));
   const ids = new Set(Object.values(priorPrograms).flat().map(row=>row.agent_id));
   return {programs:priorPrograms,pairs:regularTrainingTestPairs(state.agents.filter(agent=>ids.has(agent.id)))};
  });
  const mom = (value,previous,unit='',options)=>{
   if (multiMonth || !Number.isFinite(value)) return '';
   const movement = dashboardMoMChange(value,previous,options);
   if (!movement) return '<span class="canvas-kpi-mom">Pembanding belum tersedia</span>';
   const change = fmt(movement.amount,unit);
   return `<span class="canvas-kpi-mom" title="${el(priorLabel)} · ${fmt(previous)}"><b class="dashboard-mom-value ${movement.tone}" aria-label="${movement.direction} ${change}">${movement.symbol} ${change}</b><span>${el(priorShort)}</span></span>`;
  };
  const datedComparison = (current,previous,unit='')=>!multiMonth && Number.isFinite(current) && Number.isFinite(previous)
   ? `<p>Pembanding ${priorLabel} · ${fmt(previous,unit)}</p>` : '';
  const momColor = (value,prior,options)=>{
   const movement = multiMonth ? null : dashboardMoMChange(value,prior,options);
   return movement?.tone ? ` dashboard-mom-value ${movement.tone}` : '';
  };
  const headline = (value,unit='',prior,options)=>Number.isFinite(value)
   ? `<strong class="canvas-kpi-value${momColor(value,prior,options)}">${score.format(value)}${unit?` <small>${unit}</small>`:''}</strong>`
   : '<strong class="canvas-kpi-value is-unavailable">Data belum tersedia</strong>';
  const priorAskTryout = previousAsk?.tryout;
  const priorTryoutAverage = useAskTryout ? (priorAskTryout?.count ? priorAskTryout.sum/priorAskTryout.count : null)
   : tryoutLocal ? learning?.priorTryout?.score
   : average((priorTraining?.programs[tryout] || []).filter(row=>validAssessmentScore(row.score)),'score');
  const pairedPre = pairAverage('pre') ?? null;
  const pairedPost = pairAverage('post') ?? null;
  // Match the difference between the two one-decimal scores shown on the dashboard.
  const testGain = (pre,post)=> (Math.round(post*10)-Math.round(pre*10))/10;
  const pairedGain = Number.isFinite(pairedPre) && Number.isFinite(pairedPost) ? testGain(pairedPre,pairedPost) : null;
  const pairedCountNote = pairCount ? `${number.format(pairCount)} pasangan tes` : '';
  const pairedComparisons = multiMonth || pairedGain==null ? '' : `<p>Pembanding ${priorLabel}</p><dl class="canvas-kpi-test-comparisons">${[
   ['Pre-test','pre','pairPre'],['Post-test','post','pairPost'],
  ].map(([label,key,summaryKey])=>{
   const previous = trainingLocal ? learning?.priorTraining?.[summaryKey] : average(priorTraining?.pairs || [],key);
   return `<div><dt>${label}</dt><dd>${Number.isFinite(previous)?score.format(previous):'Data belum tersedia'}</dd></div>`;
  }).join('')}</dl>`;
  const [gainSymbol,gainTone,gainDirection] = pairedGain>0 ? ['▲',' is-up','Naik'] : pairedGain<0 ? ['▼',' is-down','Turun'] : ['→','','Tetap'];
  const pairedKpi = pairedGain==null ? headline(null) : `<span class="canvas-kpi-score-flow" aria-label="Pre-test ${score.format(pairedPre)}, post-test ${score.format(pairedPost)}">
   ${headline(pairedPre)}<span aria-hidden="true">→</span>${headline(pairedPost,'/100')}</span>
   <span class="canvas-kpi-mom"><strong class="canvas-kpi-test-gain${gainTone}" aria-label="${gainDirection} ${fmt(Math.abs(pairedGain),'pts')}">${gainSymbol} ${fmt(Math.abs(pairedGain),'pts')}</strong><span>Selisih pre–post</span></span>`;
  const icon = path=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
  const chevron = `<svg class="canvas-kpi-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4"/></svg>`;
  const kpi = (id,title,symbol,body,note,detail)=>`<details class="canvas-kpi" data-kpi="${id}"${dashboardOpenKpis.has(id)?' open':''}>
   <summary class="canvas-kpi-summary" id="canvas-kpi-summary-${id}"><span class="canvas-kpi-head"><span class="canvas-kpi-icon">${symbol}</span>
    <span class="canvas-kpi-title">${title}</span>${chevron}</span>
    <span class="canvas-kpi-body">${body}</span>${note?`<span class="canvas-kpi-note">${note}</span>`:''}
   </summary><div class="canvas-kpi-details">${detail}</div>
  </details>`;
  const hardTotal = programCount([hard]);
  const regularTotal = programCount([acs,bad]);
  const priorHardRows = priorTraining?.programs[hard];
  const priorHard = trainingLocal ? learning?.priorTraining?.hard : priorHardRows?.length ? count(priorHardRows.map(row=>row.agent_id)) : null;
  const hardCoverage = training.hardAttendance ? `${number.format(training.hardAttendance)} kehadiran · ${number.format(training.hardSessions)} sesi Hard Skill` : '';
  const hardSkillParticipantTone = {lowerIsBetter:true};
  const kpis = [
   kpi('csr',locationLabel==='Nasional'&&ctp==='All CTPs'?'Total CSR Nasional':'Total CSR',
    icon(DASHBOARD_CSR_ICON_PATH),
    headline(total,'CSR')+mom(total,prior,'CSR'),'',
    `<p>Workbook ASK lokal · ${el(csrNote)}</p><p>${total!=null&&covered!=null&&total>covered?`${number.format(total-covered)} CSR belum memiliki skor ASK valid dalam cakupan ini; Rata-rata ASK memakai ${number.format(covered)} CSR dinilai.`:'Total CSR menghitung identitas unik; Rata-rata ASK hanya menghitung CSR dengan skor valid.'}</p>${datedComparison(total,prior,'CSR')}`),
   kpi('ask','Rata-rata ASK',icon('M3 4v16h18M6 15l4-4 4 2 5-6m-4 0h4v4'),
    headline(averageAsk,'/100',priorAsk)+mom(averageAsk,priorAsk,'poin'),`Skor berbobot · ${askCoverage}`,
    `<p>Workbook ASK lokal · Attitude 40%, Skill 30%, Knowledge 30%</p>${datedComparison(averageAsk,priorAsk,'/100')}`),
   kpi('skills','Training Hard Skill',icon('M14 6a4 4 0 0 0-5 5.5l-5.5 5.6a2.4 2.4 0 0 0 3.4 3.4l5.6-5.5A4 4 0 0 0 18 10l-2 2-3-3 2-2Z'),
    headline(hardTotal,'CSR',priorHard,hardSkillParticipantTone)+mom(hardTotal,priorHard,'CSR',hardSkillParticipantTone),'Peserta unik',
    `<p>${trainingLocal?loadingMessage || 'Workbook Training lokal':source(programs[hard])}${hardCoverage?' · '+hardCoverage:''}</p>${datedComparison(hardTotal,priorHard,'CSR')}`),
   kpi('tryout','Rata-rata Tryout',icon('M9 4H5v17h14V4h-4m-6-1h6v4H9zM8 14l2.5 2.5L16 11'),
    headline(tryoutAverage,'/100',priorTryoutAverage)+mom(tryoutAverage,priorTryoutAverage,'poin'),useAskTryout?askTryoutNote:'',
    `<p>${useAskTryout?'Rata-rata nilai TO terisi pada skala 0–100.':tryoutNote}</p>${datedComparison(tryoutAverage,priorTryoutAverage,'/100')}`),
   kpi('tests','Pre-test &amp; Post-test Reguler',icon('M3 7h17m-4-4 4 4-4 4m5 6H4m4-4-4 4 4 4'),
    pairedKpi,pairedCountNote,`<p>${pairNote}</p>${pairedComparisons}`),
  ];
  const channelTrend = ytd ? askMonthlyTrend(trendRows,`Jan–${monthLabel(reportMonth)}`,trendChannels.map(([label])=>label),{
     heading:'Tren ASK per Channel',
     description:'Rata-rata skor ASK berbobot dari 100 per bulan.',
     score:true,
    }) : '';
  const talentPool = latest?.talentPool;
  const distributionPeriod = latestDistribution ? (ytd?'Penilaian terakhir per CSR · s.d. ':'Bulan terakhir dengan penilaian · ')+monthLabel(latestDistribution.key) : '';
  const askPeriod = dashboardTrialPeriodLabel();
  const scopeParts = [ctp==='All CTPs'?'':dashboardChannelLabel(),locationLabel].filter(Boolean);
  const askScopeLabel = [...scopeParts,askPeriod].join(' · ');
  const detailScope = range&&latestDistribution ? [...scopeParts,monthLabel(latestDistribution.key)].join(' · ') : askScopeLabel;
  const rankingLimit = 5;
  const rankBottomByCtp = !dashboardUnit;
  const rankingLevel = dashboardUnit ? 'Unit' : 'CTP';
  const shortUnitRanking = Boolean(dashboardUnit && covered<=rankingLimit);
  const hasMap = DASH_CHANNELS.some(channel=>channel.value===ctp && channel.mapView) && dashboardHasLocalMap();
  const selectedMapUnit = hasMap ? dashboardLocalUnit() : null;
  const mapDistribution = selectedMapUnit ? `<section class="canvas-map-distribution canvas-ask-overview" aria-labelledby="dashboard-map-distribution-title">
   <header class="canvas-map-distribution-head">
    <h2 id="dashboard-map-distribution-title" tabindex="-1">Distribusi ASK · ${el(selectedMapUnit[4])}</h2>
    <p>${[...selectedMapUnit.slice(0,3),multiMonth?askPeriod:comparisonPeriod].filter(Boolean).map(el).join(' · ')}</p>
   </header>
   <div class="canvas-map-distribution-body">
    <dl class="canvas-map-metrics">
     <div><dt>Total CSR${multiMonth && csrSnapshotLabel?' · '+el(csrSnapshotLabel):''}</dt><dd>${total==null?'—':number.format(total)}</dd>
      ${mom(total,prior,'CSR')}</div>
     <div><dt>Rata-rata ASK</dt><dd class="${momColor(averageAsk,priorAsk).trim()}">${averageAsk==null?'—':`${score.format(averageAsk)} <small>/100</small>`}</dd>
      ${mom(averageAsk,priorAsk,'pts')}</div>
     <div><dt>${multiMonth?'Penilaian CSR':'CSR dinilai'}</dt><dd>${number.format(covered)}</dd></div>
    </dl>
    ${dashboardAskOverviewDistribution(talentPool,previousAsk?.talentPool,{multiMonth,comparisonPeriod,priorShort,distributionPeriod,panelClass:'canvas-map-score-distribution'})}
   </div>
  </section>`:'';
  const analysisScale = (suffix='')=>`<div class="canvas-analysis-scale" aria-hidden="true"><span>0${suffix}</span><span>50${suffix}</span><span>100${suffix}</span></div>`;
  const nationalAsk = ctp==='All CTPs' && locationLabel==='Nasional';
  const priorSummaryAsk = !multiMonth
   ? dashboardAskTotals(Object.values(previousAsk?.groups || {})) : null;
  const csrOverview = `<article class="canvas-panel canvas-ctp"><header><h3>${el(csrTitle)}</h3>${detailsButton('canvas-ctp-detail',singleCsrChannel?'Rincian CSR':'Rincian CTP')}</header>
    <p>${el(singleCsrChannel&&!multiMonth?'CSR unik · Perbandingan bulanan':csrNote)}</p>
    ${csrBreakdown}
   </article>`;
  const highLowOverview = `<article class="canvas-panel canvas-ask${nationalAsk?' is-national':''}"><header><h3>High dan Low ASK${nationalAsk?' Nasional':''}</h3><button type="button" class="canvas-link" data-dashboard-ask-detail>Laporan ASK</button></header>
    <p>${askCoverage} · High ≥80 · Low &lt;80</p>
    ${covered?`<p>Pilih angka High atau Low untuk melihat nama CSR.</p>
    ${priorSummaryAsk?.total?`<p class="canvas-pass-marker-key"><i aria-hidden="true"></i> Garis putih menandai persentase High ${el(priorLabel)}.</p>`:''}
    <ul class="canvas-ask-summary-grid">${dimensions.map((label,i)=>{
     const rate = dashboardAsk[i];
     const low = 100-rate;
     const highCount = dashboardHigh[i];
     const countUnit = multiMonth?'penilaian':'CSR';
     const priorRate = priorSummaryAsk?.total ? 100*priorSummaryAsk.high[i]/priorSummaryAsk.total : null;
     return `<li class="canvas-ask-summary-metric">
      <h4>High ${el(label)}</h4>
      <button type="button" class="canvas-ask-summary-value" ${dashboardAskNamesAttributes(label,'high',`High ${label}`)}
       aria-label="High ${el(label)} ${fmt(rate,'%')}, ${number.format(highCount)} ${countUnit}">
       <strong>${fmt(rate,'%')}</strong><span>${number.format(highCount)} ${countUnit}</span>
      </button>
      <span class="canvas-ask-stacked-track" aria-hidden="true"><i style="width:${rate}%"></i>${priorRate===null?'':`<b class="canvas-pass-national-marker" style="left:clamp(2px,${priorRate}%,calc(100% - 2px))"></b>`}</span>
      <button type="button" class="canvas-ask-summary-low" ${dashboardAskNamesAttributes(label,'low',`Low ${label}`)}>Low <strong>${fmt(low,'%')}</strong><span>${number.format(covered-highCount)} ${countUnit}</span></button>
      ${priorSummaryAsk?`<div class="canvas-ask-national-mom">${priorRate===null?'Pembanding belum tersedia':`<span title="${el(priorLabel)}">${el(priorShort)} <b>${fmt(priorRate,'%')}</b></span>${dashboardAskNationalDelta(rate,priorRate)}`}</div>`:''}
     </li>`;
    }).join('')}</ul>`:'<p>Data belum tersedia</p>'}
   </article>`;
  const segmentDetails = `${dashboardAskSegmentPass(workbook.groups,{
   dimensions,period:askPeriod,multiMonth,locations:workbook.passLocations,national:nationalAsk,
   previousGroups:previousAsk?.groups,priorPeriod:priorLabel,priorShort,comparisonPeriod,
  })}
  ${dashboardAskPassDetails(workbook.passLocations,previousAsk?.passLocations,{
   dimensions,scope:locationLabel,period:askPeriod,priorPeriod:priorLabel,multiMonth,currentMonth:reportMonth,priorMonth:priorMonth.slice(0,7),
  })}`;
  const {report:askReport,executive:executiveSummaryPanel} = dashboardAskReport({
   scope:locationLabel,
   channel:ctp==='All CTPs' ? 'All CTP' : dashboardChannelLabel(),
   period:askPeriod,
   priorPeriod:priorLabel,
   priorShort,
   comparisonPeriod,
   ytd,
   range,
   detailMonth:range ? latestDistribution?.key : '',
   detailScope,
   useAugustReference:!multiMonth && reportMonth==='2026-08' && !dashboardUnit &&
    region==='All Regions' && area==='All Areas',
   coverage:monthCoverage,
   current:workbook,
   previous:previousAsk,
   dimensions,
   talentPool,
   distributionPeriod,
   csrOverview,
   highLowOverview,
   segmentDetails,
   channelTrend,
   quadrants:dashboardAskQuadrants(latest?.quadrants,previousAsk?.quadrants,{
    scope:detailScope,comparisonPeriod,priorPeriod:priorLabel,priorShort,ytd,multiMonth,dimensions,bySegment:latest?.quadrantSegments,
   }),
   ranking:`<section class="canvas-panel canvas-ask-rankings" aria-labelledby="canvas-ask-ranking-title">
    <div class="canvas-ask-section-heading"><h3 id="canvas-ask-ranking-title" tabindex="-1">${shortUnitRanking?'Peringkat ASK per Unit':`Top &amp; Bottom ${rankingLimit} ASK per ${rankingLevel}`}</h3>
     <p>${el(detailScope)} · ${number.format(covered)} CSR dinilai · ${ytd?'Skor valid terakhir tiap CSR':'Skor ASK berbobot /100'}</p></div>
    <div class="canvas-ask-rank-result"${covered?` data-ask-ranking="${rankingLimit}"`:''}${rankBottomByCtp?' data-ask-ranking-bottom="ctp"':''}${shortUnitRanking?' data-ask-ranking-small="true"':''}${!multiMonth?` data-ask-ranking-prior="${el(priorLabel)}" data-ask-ranking-prior-short="${el(priorShort)}"`:''} aria-live="polite"><p>${covered?'Memuat peringkat ASK…':'Belum ada skor ASK untuk cakupan ini.'}</p></div>
    <details class="canvas-ask-inline-list canvas-ask-roster" data-ask-roster aria-label="Daftar semua CSR">
     <summary>Daftar Semua CSR <span>Buka / tutup daftar</span></summary>
     <p>Semua CSR dengan skor ASK valid dalam cakupan filter.</p>
     ${dashboardAskListControls(true)}
    </details>
   </section>`,
  });
  const trainingTotals = [['Hard Skill',hardTotal],['Training Reguler',regularTotal]];
  const trainingSubtitle = loadingMessage || (trainingLocal && training.attendance
   ? `${number.format(training.attendance)} kehadiran · ${number.format(training.sessions)} sesi` : trainingNote);
  const shortcuts = ctp==='All CTPs' ? dashboardNationalShortcuts() : '';
  const nationalMap = ctp==='All CTPs' && dashboardHasLocalMap() ? dashboardNationalMapPanel(csrMonth || reportMonth,askPeriod) : '';
  return `${nationalMap}<div data-dashboard-executive-tab="ask"${dashboardReportTab==='ask'?'':' hidden'}>${executiveSummaryPanel}</div>
   ${mapDistribution}${shortcuts}<section class="ctp-executive ctp-trial" aria-label="Ringkasan CTP">
   <section class="canvas-kpis" aria-label="KPI dashboard">
    ${multiMonth?'':`<p class="canvas-kpi-period">${el(comparisonPeriod)}</p>`}
    <div class="canvas-kpi-group is-core" role="group" aria-labelledby="canvas-kpi-core-title">
     <h2 class="canvas-kpi-group-title" id="canvas-kpi-core-title">CSR &amp; ASK</h2>
     <div class="canvas-kpi-group-cards">${kpis.slice(0,2).join('')}</div>
    </div>
    <div class="canvas-kpi-group is-learning" role="group" aria-labelledby="canvas-kpi-learning-title">
     <h2 class="canvas-kpi-group-title" id="canvas-kpi-learning-title">Training &amp; Evaluasi</h2>
     <div class="canvas-kpi-group-cards">${kpis.slice(2).join('')}</div>
    </div>
   </section>
   <div class="canvas-report-tabs">
   <div class="canvas-report-tablist" role="tablist" aria-label="Laporan Training Dashboard">
    ${[['ask','Detail ASK'],['training','Detail Training']].map(([key,label])=>`
     <button type="button" id="canvas-report-tab-${key}" role="tab" data-dashboard-report-tab="${key}"
      aria-controls="canvas-report-panel-${key}" aria-selected="${dashboardReportTab===key}" tabindex="${dashboardReportTab===key?0:-1}">${label}</button>`).join('')}
   </div>
   <div id="canvas-report-panel-ask" role="tabpanel" aria-labelledby="canvas-report-tab-ask"${dashboardReportTab==='ask'?'':' hidden'}>
    ${askReport}
   </div>
   <div id="canvas-report-panel-training" role="tabpanel" aria-labelledby="canvas-report-tab-training"${dashboardReportTab==='training'?'':' hidden'}>
   <section class="canvas-learning-reports" aria-label="Distribusi Training">
   <article class="canvas-panel canvas-training"><header><h2 id="canvas-training-summary-title" tabindex="-1">Training &amp; Evaluasi</h2>${detailsButton('canvas-training-detail','Rincian training')}</header>
    <div class="canvas-training-grid"><div>
    <p>${trainingSubtitle}</p>
    <dl class="canvas-training-totals">${trainingTotals.map(([label,value])=>`<div><dt>${label}</dt><dd>${value==null?'Data belum tersedia':number.format(value)}</dd></div>`).join('')}</dl>
    </div>
    <div class="canvas-test-comparison">
     <header><div><h4>Tes reguler</h4>${pairedCountNote?`<p>${pairedCountNote}</p>`:''}</div>
      ${pairedGain==null?'':`<b class="canvas-test-gain${pairedGain<0?' is-down':pairedGain>0?' is-up':''}" aria-label="${pairedGain<0?'Turun':pairedGain>0?'Naik':'Tetap'} ${fmt(Math.abs(pairedGain),'pts')}">${pairedGain<0?'▼':pairedGain>0?'▲':'→'} ${fmt(Math.abs(pairedGain),'pts')}</b>`}
     </header>
     ${pairedGain==null?'<p>Data belum tersedia</p>':`<div class="canvas-test-score-list">${[
       ['Pre-test',pairedPre],['Post-test',pairedPost],
      ].map(([label,value])=>`<div><span>${label}</span><span class="canvas-bar-track" aria-hidden="true"><i style="width:${value}%"></i></span><b>${fmt(value)}</b></div>`).join('')}
      </div>${analysisScale()}`}
    </div>
    </div>
    ${tryoutSessionRows.length?`<section class="canvas-training-tryout" aria-labelledby="canvas-training-tryout-title"><header><h3 id="canvas-training-tryout-title">Nilai Tryout &amp; iFest</h3><p>Rata-rata peserta dengan nilai · Data ASK ${el(askPeriod)}</p></header><div class="canvas-training-tryout-table-wrap"><table class="canvas-training-tryout-table"><thead><tr><th>Sesi</th><th>Rata-rata nilai</th><th>Peserta bernilai</th><th>Periode nilai</th></tr></thead><tbody>${tryoutSessionRows.map(row=>`<tr><th scope="row">${el(row.session)}</th><td><span class="canvas-training-tryout-score"><span class="canvas-training-tryout-track"><i style="width:${Math.max(0,Math.min(100,row.average))}%"></i></span><b>${fmt(row.average)}</b></span></td><td>${number.format(row.count)}</td><td>${row.session==='iFest'?'Periode iFest pada sumber ASK':'Data ASK '+el(askPeriod)}</td></tr>`).join('')}</tbody></table></div><p class="canvas-training-tryout-note">TO 4 belum tersedia pada workbook ASK yang dicek. iFest ditampilkan sesuai periode pada sumber.</p></section>`:''}
   </article>
   ${dashboardHardSkillSection([ctp==='All CTPs'?'':dashboardChannelLabel(),locationLabel].filter(Boolean).join(' · '))}
   </section>
   </div>
   </div>
   ${hasQuadrants || covered?`<dialog class="canvas-dialog canvas-ask-drill-dialog" id="canvas-ask-drill" aria-labelledby="canvas-ask-drill-title">
    <header class="canvas-dialog-top"><div><h3 id="canvas-ask-drill-title">Daftar CSR</h3><p>${el(askScopeLabel)}</p></div>
     <form method="dialog"><button type="submit" class="btn">Tutup</button></form></header>
    ${dashboardAskListControls()}
   </dialog>`:''}
   <dialog class="canvas-dialog" id="canvas-ctp-detail" aria-labelledby="canvas-ctp-title">
    <div class="canvas-dialog-top"><h3 id="canvas-ctp-title">${singleCsrChannel?'Rincian '+el(dashboardChannelLabel()):'Perbandingan CTP'}</h3><form method="dialog"><button class="btn">Tutup</button></form></div>
    <div class="dw-grid">${csrChart}${askChart}</div>
   </dialog>
   <dialog class="canvas-dialog" id="canvas-training-detail" aria-labelledby="canvas-training-title">
    <div class="canvas-dialog-top"><h3 id="canvas-training-title">Training &amp; Evaluasi</h3><form method="dialog"><button class="btn">Tutup</button></form></div>
    <div class="ctp-kpis">${cards.slice(2).join('')}</div>
    <div class="dw-grid">${trainingChart}${testChart}${tryoutDetail}</div>
   </dialog>
  </section>`;
 }
 return `<section class="ctp-executive" aria-label="Ringkasan CTP">
  <div class="dw-section-title"><h3>Ringkasan · ${el(locationLabel)}</h3></div>
  <div class="ctp-kpis">${cards.join('')}</div>
  <section class="ctp-comparisons" aria-label="Perbandingan antar CTP"><h3>Perbandingan antar CTP</h3>
   <div class="dw-grid">${csrChart}${askChart}${localAskReport ? dashCard('Distribusi skor ASK',distribution.subtitle,distribution.body) : ''}
    ${trainingChart}${testChart}${tryoutDetail}</div>
  </section>
 </section>`;
}

function executiveSummary(xs){
 const pairs=assessmentRows(xs),feedback=vocRows(xs),weighted=a=>a.attitude*.4+a.skill*.3+a.knowledge*.3;
 const channels=ctp==='All CTPs'?CTPS:[ctp];
 const summary=channels.map(ctp=>{const agents=xs.filter(a=>a.ctp===ctp),tests=pairs.filter(a=>a.ctp===ctp),voc=feedback.filter(r=>r.ctp===ctp);return {CTP:ctp==='Contact Center'?'Call Center':ctp,Agents:agents.length,'Training complete':agents.length?agents.filter(a=>a.complete).length+' / '+agents.length:'—','ASK / 100':agents.length?avg(agents.map(weighted)).toFixed(1):'—','Post-test / 100':tests.length?avg(tests.map(a=>a.post)).toFixed(1):'—','VoC overall / 5':voc.some(r=>Number.isFinite(r.overall))?avg(voc.filter(r=>Number.isFinite(r.overall)).map(r=>r.overall)).toFixed(2):'—','VoC responses':voc.length}});
 const askLow=xs.filter(a=>weighted(a)<80),testLow=pairs.filter(a=>a.post<80),unfinished=xs.filter(a=>!a.complete),negative=feedback.filter(r=>r.sentiment==='Negative');
 const topicCounts=[...new Set(negative.map(r=>r.topic))].map(topic=>({topic,count:negative.filter(r=>r.topic===topic).length})).sort((a,b)=>b.count-a.count||a.topic.localeCompare(b.topic));
 const pain=[{count:askLow.length,text:`${askLow.length} of ${xs.length} agents have weighted ASK below the showcase target of 80.`},{count:testLow.length,text:`${testLow.length} of ${pairs.length} paired agents have post-test scores below 80.`},{count:unfinished.length,text:`${unfinished.length} of ${xs.length} agents have unfinished training.`},{count:negative.length,text:`${negative.length} of ${feedback.length} customer responses are negative.${topicCounts[0]?' Most frequent negative-feedback topic: '+topicCounts[0].topic+' ('+topicCounts[0].count+' responses).':''}`}].filter(p=>p.count>0);
 const plans=[{title:'1. Target capability gaps',body:askLow.length?`Review the ${askLow.length} agents below ASK 80, identify their lowest dimension, and assign focused coaching.`:'Maintain capability checks; use the ASK breakdown to identify emerging gaps.',measure:'Suggested measure: next-period ASK average and number below 80.',tab:1},{title:'2. Close training and assessment gaps',body:`Review ${unfinished.length} unfinished training records and ${testLow.length} below-target post-tests. Confirm attendance, assign refresher learning where needed, and schedule reassessment. These groups may overlap.`,measure:'Suggested measure: completion rate and post-test improvement.',tab:4},{title:'3. Act on customer feedback',body:negative.length?`Read the ${negative.length} negative responses in full${topicCounts[0]?', starting with '+topicCounts[0].topic:''}. Check the context with the agent and agree a follow-up action.`:'Review the full feedback table and preserve practices associated with positive feedback.',measure:'Suggested measure: negative-response share and average overall rating.',tab:null}];
 return `<section class="executive-summary" aria-label="Executive Summary"><div class="dw-section-title"><div><h2>Executive Summary</h2><p>Selected period and filters · Dated showcase data · Recommendations are proposed actions, not completed work.</p></div></div><h3>${ctp==='All CTPs'?'Summary on each CTP':'Summary for '+el(dashboardChannelLabel())}</h3>${dashTable(summary,['CTP','Agents','Training complete','ASK / 100','Post-test / 100','VoC overall / 5','VoC responses'])}<p class="small">Agent metrics use selected roster snapshots; tests use valid paired assessments; VoC uses dated feedback events. Their populations may differ.</p><div class="dw-card"><div class="dw-card-head"><h3>Pain Point</h3></div><div class="dw-card-body">${pain.length?'<ul>'+pain.map(p=>'<li>'+el(p.text)+'</li>').join('')+'</ul>':'<p>'+(!xs.length&&!feedback.length?'No dated data in this scope. Select another period to identify pain points.':'No gaps against these showcase thresholds in this scope.')+'</p>'}</div></div><h3>3 Recommendation Plan</h3><div class="executive-plans">${plans.map(p=>`<article class="dw-card"><div class="dw-card-head"><h3>${p.title}</h3></div><div class="dw-card-body"><p>${!xs.length&&!feedback.length?'Collect or select dated records before assigning actions.':el(p.body)}</p><p class="small">${p.measure}</p><button class="btn" ${p.tab===null?'data-voc-detail':`data-dash-tab="${p.tab}"`}>${p.tab===null?'Review feedback →':'Open supporting data →'}</button></div></article>`).join('')}</div></section>`;
}
