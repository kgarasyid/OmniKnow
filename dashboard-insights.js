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
function bindInsights(){document.querySelectorAll('[data-insight-action]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.insightKey;if(b.dataset.insightAction==='region'){if(region!==k)dashboardUnit='';region=k}if(b.dataset.insightAction==='voc-sentiment')vocSentiment=k;if(b.dataset.insightAction==='voc-topic')vocTopic=k;render()}));document.querySelectorAll('[data-voc-reset]').forEach(b=>b.addEventListener('click',()=>{vocSentiment='All';vocTopic='All';render()}));document.querySelectorAll('.di-scatter [data-agent]').forEach(b=>b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();modal={type:'agent',id:b.dataset.agent};render()}}));document.querySelectorAll('[data-download-page]').forEach(b=>b.addEventListener('click',()=>downloadPagePdf()));document.querySelectorAll('[data-download-excel]').forEach(b=>b.addEventListener('click',()=>downloadDashboardExcel()));}

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
 if (!target.total && group.sources) target.sources = {...group.sources};
 else if (target.sources && group.sources) {
  for (const key of Object.keys(target.sources)) target.sources[key] += group.sources[key];
 } else target.sources = null;
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
 const depth = unitName ? 5 : selectedRegion || geoRegions ? 3 : selectedArea ? 2 : 0;
 const norm = value=>String(value ?? '').trim().toLowerCase();
 const matches = (parts,level)=>{
  const [name,areaName,regionName,id,unit] = parts;
  return parts.length===level && (!channel || name===channel) &&
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
 const locations = matchingLocations(snapshot.locations,depth || 2);
 const nationalGroups = depth ? locations.map(([,data])=>data) : [snapshot.groups];
 for (const entries of nationalGroups) {
  for (const [name, group] of Object.entries(entries || {})) {
   if (!allowed(name)) continue;
   addDashboardAskMetrics(groups[name] ||= emptyDashboardAskMetrics(),group);
  }
 }
 for (const [[name,areaName],entries] of locations) {
  if (name!=='GraPARI') continue;
  const metrics = areas[areaName] ||= emptyDashboardAskMetrics();
  for (const [segment,group] of Object.entries(entries)) {
   if (allowed(segment)) addDashboardAskMetrics(metrics,group);
  }
 }
 const csrCounts = {};
 const counts = depth ? buckets(snapshot.csrLocations) : snapshot.csrCounts ? [snapshot.csrCounts] : [];
 for (const entries of counts) {
  for (const [name,value] of Object.entries(entries)) if (allowed(name)) csrCounts[name]=(csrCounts[name] || 0)+value;
 }
 const sumScopedCounts = (sources, select)=>{
  const totals = {};
  for (const entries of sources) {
   for (const [name, group] of Object.entries(entries || {})) {
    if (!allowed(name)) continue;
    for (const [label,value] of Object.entries(select(group) || {})) totals[label]=(totals[label] || 0)+value;
   }
  }
  return totals;
 };
 const latestCounts = (locations, segments)=>sumScopedCounts(depth ? buckets(locations) : [segments],group=>group);
 const quadrants = ytd
  ? latestCounts(snapshot.latestLocationQuadrants?.ytd,snapshot.latestQuadrants?.ytd)
  : sumScopedCounts(nationalGroups,group=>group.quadrants);
 const talentPool = ytd
  ? latestCounts(snapshot.latestLocationTalentPool,snapshot.latestTalentPool)
  : sumScopedCounts(nationalGroups,group=>group.talentPool);
 const scoreBands = ytd
  ? latestCounts(snapshot.latestLocationScoreBands,snapshot.latestScoreBands)
  : sumScopedCounts(nationalGroups,group=>group.scoreBands);
 const tryout = latestCounts(snapshot.tryoutLocations,snapshot.tryoutScores);
 return {groups,areas,csrCounts:counts.length ? csrCounts : null,quadrants,talentPool,scoreBands,tryout};
}

const ASK_TALENT_BANDS = [
 ['excellent','Excellent','≥80'],
 ['good','Good','70–<80'],
 ['core','Core','60–<70'],
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
 ${!ytd?`<p class="ask-distribution-foot">${priorTotal?`MoM vs ${priorPeriod} · pp = poin persentase`:`MoM belum tersedia · ${priorPeriod}`}</p>`:''}`;
 return {subtitle,body};
}

function dashboardAskMonthlyComparison(rows,{period,priorPeriod}) {
 const number = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const extent = Math.max(5,...rows.map(({change})=>5*Math.ceil(Math.abs(change)/5)));
 const valueLabel = (value,label)=>`<b aria-label="${el(label)} ${number.format(value)}%">${number.format(value)}%</b>`;
 return `<div class="canvas-ask-bars is-delta">
  <p class="canvas-ask-plot-caption">${el(priorPeriod)} → ${el(period)} · Selisih dalam poin persentase</p>
  <div class="canvas-ask-axis" aria-hidden="true"><span>−${extent}</span><span>0</span><span>+${extent}</span></div>
  <ul class="canvas-ask-bar-list">${rows.map(({name,current,prior,change})=>{
   const distance = 50*change/extent;
   const flat = Math.abs(change)<0.05;
   const direction = flat?'Tetap':change>0?'Naik':'Turun';
   const difference = number.format(flat?0:Math.abs(change));
   return `<li class="canvas-ask-bar-row">
    <div class="canvas-ask-bar-label"><strong>${el(name)}</strong></div>
    <div class="canvas-ask-bar-series"><div class="canvas-ask-bar-measure">
     <span class="canvas-ask-delta-track" aria-hidden="true"><i class="${distance<0?'is-down':'is-up'}"
      style="left:${50+Math.min(0,distance)}%;width:${Math.abs(distance)}%"></i></span>
     <span class="canvas-ask-pair-values">${valueLabel(prior,priorPeriod)}<span aria-hidden="true">→</span>${valueLabel(current,period)}</span>
    </div></div>
    <small class="canvas-ask-bar-delta ${flat?'':change>0?'is-up':'is-down'}"
     aria-label="${direction} ${difference} poin persentase">${flat?'→':change>0?'↑':'↓'} ${difference} pp</small>
   </li>`;
  }).join('')}</ul>
 </div>`;
}

function dashboardAskPerformanceTable(rows,{period,priorPeriod,ytd,range}) {
 const format = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const multiMonth = ytd || range;
 const showSources = !multiMonth && rows.some(row=>row.metrics.sources);
 const sourceHeaders = ['Tapping bulan ini','Tapping bulan lalu','Rollup TL/SPV','Lainnya / kosong'];
 const sourceCells = sources=>{
  const values = sources ? [sources.tappingCurrent,sources.tappingPrior,sources.rollup,sources.other+sources.unclassified] : [];
  return sourceHeaders.map((_,i)=>`<td>${Number.isFinite(values[i])?format.format(values[i]):'—'}</td>`).join('');
 };
 const scoreCell = (value,overall=false)=>{
  if (!Number.isFinite(value)) return '<td>—</td>';
  const band = value>=90 ? 'high' : value>=80 ? 'mid' : 'low';
  const score = format.format(value);
  return `<td class="ask-score-${band}">${overall?`<strong>${score}</strong>`:score}</td>`;
 };
 const changeCell = ({score,previous})=>{
  if (!Number.isFinite(score) || !Number.isFinite(previous)) return '<td>—</td>';
  const change = score-previous;
  const flat = Math.abs(change)<0.05;
  const direction = flat?'Tetap':change>0?'Naik':'Turun';
  const points = format.format(flat?0:Math.abs(change));
  return `<td><span class="canvas-ask-bar-delta${flat?'':change>0?' is-up':' is-down'}" aria-label="${direction} ${points} poin">${flat?'→':change>0?'↑':'↓'} ${points}</span></td>`;
 };
 return `<article class="canvas-panel canvas-ask-performance" aria-labelledby="canvas-ask-performance-title">
  <h3 id="canvas-ask-performance-title">Performa A–S–K per Area &amp; Channel</h3>
  <p>Rata-rata dari 100 · ${el(period)}${multiMonth?'':` vs ${el(priorPeriod)}`}</p>
  ${rows.length?`<ul class="canvas-ask-performance-legend" aria-label="Kategori warna skor rata-rata">
   <li class="ask-score-high">≥ 90</li><li class="ask-score-mid">80 hingga &lt; 90</li><li class="ask-score-low">&lt; 80</li>
  </ul>
  <div class="canvas-ask-performance-scroll" role="region" aria-label="Tabel skor ASK per area dan channel" tabindex="0">
   <table${showSources?' class="has-sources"':''}>
    <thead><tr>
     <th scope="col">Area / Channel</th>
     ${multiMonth?'':`<th scope="col">ASK sebelumnya</th>`}
     <th scope="col">Attitude</th><th scope="col">Skill</th><th scope="col">Knowledge</th>
     <th scope="col">${ytd?'ASK YTD':range?'ASK periode':'ASK bulan ini'}</th>
     ${multiMonth?'':'<th scope="col">MoM (poin)</th>'}
     <th scope="col">${multiMonth?'Penilaian CSR':'CSR dinilai'}</th>
     ${showSources?sourceHeaders.map(label=>`<th scope="col">${label}</th>`).join(''):''}
    </tr></thead>
    <tbody>${rows.map(row=>`<tr${row.subtotal?' class="is-total"':''}>
     <th scope="row">${el(row.label)}</th>
     ${multiMonth?'':`<td class="canvas-ask-performance-prior">${Number.isFinite(row.previous)?format.format(row.previous):'—'}</td>`}
     ${row.metrics.dimensionSums.map(sum=>scoreCell(dashboardAskAverage(row.metrics,sum))).join('')}
     ${scoreCell(row.score,true)}
     ${multiMonth?'':changeCell(row)}<td>${format.format(row.total)}</td>
     ${showSources?sourceCells(row.metrics.sources):''}
    </tr>`).join('')}</tbody>
   </table>
  </div>
  ${showSources?'<p>Tapping dan Rollup TL/SPV dihitung dari label sumber di workbook. Kolom Lainnya / kosong mencakup label sumber lain dan penilaian tanpa label yang bisa dipetakan.</p>':''}`:'<p>Belum ada data ASK untuk cakupan ini.</p>'}
 </article>`;
}

function dashboardAskOverviewDelta(value,prior,unit='poin') {
 if (!Number.isFinite(value) || !Number.isFinite(prior)) return '';
 const delta = value-prior;
 const flat = Math.abs(delta)<0.05;
 const direction = flat?'Tetap':delta>0?'Naik':'Turun';
 const points = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(flat?0:Math.abs(delta));
 return `<small class="canvas-ask-overview-delta${flat?'':delta>0?' is-up':' is-down'}" aria-label="${direction} ${points} ${unit==='pp'?'poin persentase':unit}">${flat?'→':delta>0?'▲':'▼'} ${points}${unit==='pp'?' pp':''}</small>`;
}

function dashboardAskOverviewDistribution(current,previous,{multiMonth,priorPeriod,distributionPeriod,panelClass='canvas-panel canvas-distribution'}) {
 const number = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const total = Object.values(current || {}).reduce((sum,count)=>sum+count,0);
 const priorTotal = Object.values(previous || {}).reduce((sum,count)=>sum+count,0);
 const bands = [['high','≥ 90 · Excellent'],['mid','80 hingga < 90 · Good'],['low','< 80 · Perlu perbaikan']];
 return `<article class="${panelClass}"><h4>Distribusi skor ASK</h4>
  ${total ? `<p>${number.format(total)} CSR dinilai${multiMonth?` · ${el(distributionPeriod)}`:''}</p>
   <ul class="canvas-ask-score-bands">${bands.map(([key,label])=>{
    const count = current[key] || 0;
    const share = 100*count/total;
    const priorShare = priorTotal ? 100*(previous[key] || 0)/priorTotal : null;
    return `<li class="tone-${key}">
     <div class="canvas-ask-band-values"><strong>${number.format(count)}</strong><b>${number.format(share)}%</b></div>
     <p>${el(label)}</p><span class="canvas-bar-track" aria-hidden="true"><i style="width:${share}%"></i></span>
     ${multiMonth?'':dashboardAskOverviewDelta(share,priorShare,'pp')}
    </li>`;
   }).join('')}</ul>
   ${!multiMonth?`<p>${priorTotal?`vs ${el(priorPeriod)} · pp = poin persentase`:'MoM belum tersedia'}</p>`:''}`
   : '<p>Data distribusi skor belum tersedia untuk cakupan ini.</p>'}
 </article>`;
}

function dashboardAskReport({scope,channel,period,priorPeriod,ytd,range,detailMonth,coverage,current,previous,dimensions,scoreBands,distributionPeriod,comparison,quadrants,ranking}) {
 const format = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
 const scoreFormat = new Intl.NumberFormat('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1});
 const multiMonth = ytd || range;
 const countLabel = multiMonth ? 'penilaian CSR' : 'CSR dinilai';
 const currentTotals = dashboardAskTotals(Object.values(current.groups));
 const previousTotals = dashboardAskTotals(Object.values(previous?.groups || {}));
 const average = dashboardAskAverage(currentTotals);
 const priorAverage = dashboardAskAverage(previousTotals);
 const priorMonth = priorPeriod.slice(0,3);
 const number = value=>value==null?'—':format.format(value);
 const score = value=>value==null?'—':scoreFormat.format(value);
 const asScore = value=>value==null?'—':number(value)+'/100';
 const indicator = (value,prior)=>multiMonth?'':dashboardAskOverviewDelta(value,prior);
 const areas = Object.entries(current.areas).sort((a,b)=>a[0].localeCompare(b[0],'id',{numeric:true}));
 const cohort = (label,channel,now,older,name=label)=>({
  label,channel,name,total:now.total,
  score:dashboardAskAverage(now),previous:dashboardAskAverage(older),metrics:now,
 });
 const groups = Object.entries(LOCAL_ASK_CHANNELS).flatMap(([channel,segments])=>{
  if (channel==='GraPARI' && areas.length) return areas.map(([area,metrics])=>
   cohort('GraPARI · '+area,channel,metrics,previous?.areas[area],area));
  return cohort(channel,channel,dashboardAskTotals(segments.map(segment=>current.groups[segment])),
   dashboardAskTotals(segments.map(segment=>previous?.groups[segment])));
 }).filter(group=>group.total);
 const performanceRows = [...groups];
 const lastGraPARI = groups.findLastIndex(group=>group.channel==='GraPARI');
 if (lastGraPARI>0) {
  const segments = LOCAL_ASK_CHANNELS.GraPARI;
  const total = cohort('Total GraPARI','GraPARI',dashboardAskTotals(segments.map(segment=>current.groups[segment])),
   dashboardAskTotals(segments.map(segment=>previous?.groups[segment])));
  performanceRows.splice(lastGraPARI+1,0,{...total,subtotal:true});
 }
 const allChannels = channel==='All CTP';
 const subtitleChannels = allChannels
  ? [...new Set(groups.map(row=>row.channel))].join(' · ') || 'GraPARI · Call Center · E-Care'
  : channel;
 if (currentTotals.total) {
  const total = cohort(allChannels && scope==='Nasional'?'Nasional (Semua CTP)':'Total cakupan','',currentTotals,previousTotals);
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
 const lowestParts = [
  lowestDimension && `${el(lowestDimension.label)} adalah dimensi dengan rata-rata terendah (${asScore(lowestDimension.score)}).`,
  lowestGroup && `${el(lowestGroup.label)} mencatat skor terendah di antara kelompok yang ditampilkan (${asScore(lowestGroup.score)}).`,
 ].filter(Boolean);
 const bandTotal = Object.values(scoreBands || {}).reduce((total,count)=>total+count,0);
 const lowCount = scoreBands?.low || 0;
 const delta = average-priorAverage;
 const movement = priorAverage==null ? `Pembanding ${priorPeriod} belum tersedia.`
  : Math.abs(delta)<0.05 ? `Relatif stabil dibanding ${priorPeriod}.`
   : `${delta>0?'Naik':'Turun'} ${number(Math.abs(delta))} poin dibanding ${priorPeriod}.`;
 const summary = average==null ? '<p>Belum ada skor ASK yang bisa dirangkum untuk periode dan lokasi ini.</p>'
  : `<dl class="canvas-ask-findings">
    <div><dt>Skor keseluruhan</dt><dd><strong>${asScore(average)}</strong> dari ${number(currentTotals.total)} ${multiMonth?'penilaian CSR':'CSR'}. ${multiMonth?'':movement}</dd></div>
    ${lowestParts.length?`<div><dt>Prioritas perhatian</dt><dd>${lowestParts.join(' ')}</dd></div>`:''}
    ${bandTotal?`<div><dt>Capaian CSR${ytd?' pada penilaian terakhir':range?` · ${el(distributionPeriod)}`:''}</dt><dd><strong>${number(100*lowCount/bandTotal)}%</strong>
     (${number(lowCount)} CSR) memperoleh skor ASK di bawah 80.</dd></div>`:''}
   </dl>`;
 const chartOptions = {period,priorPeriod,ytd,range};
 return `<details class="canvas-ask-report"${dashboardAskReportOpen?' open':''}${detailMonth?` data-ask-detail-month="${el(detailMonth)}"`:''}>
  <summary class="canvas-ask-report-toggle"><h2 id="canvas-ask-report-title">Distribusi ASK
   <span class="canvas-ask-toggle-open" aria-hidden="true">Sembunyikan</span><span class="canvas-ask-toggle-closed" aria-hidden="true">Tampilkan</span>
  </h2></summary>
  <div class="canvas-ask-report-content" role="region" aria-labelledby="canvas-ask-report-title">
  <section class="canvas-ask-overview" aria-labelledby="canvas-ask-overview-title">
   <header class="canvas-ask-overview-head">
    <div><h3 id="canvas-ask-overview-title">Ringkasan ASK — ${el(channel)}</h3>
     <p>${el(subtitleChannels)}${scope==='Nasional'?'':` · ${el(scope)}`} | ${el(period)}${!multiMonth && priorAverage!=null?` vs ${el(priorPeriod)}`:''}</p>
    </div>
    <div class="canvas-ask-overview-total"><strong>${number(currentTotals.total || null)}</strong>
     <small>${countLabel} · ASK ${scope==='Nasional'&&allChannels?'nasional':'rata-rata'} ${score(average)}</small>
     ${multiMonth?`<small>${coverage}</small>`:indicator(average,priorAverage)}
    </div>
   </header>
   ${groups.length?`<ul class="canvas-ask-overview-cohorts" aria-label="Skor ASK per Area dan CTP">${groups.map(row=>{
    const tone = row.score==null?'neutral':row.score>=90?'high':row.score>=80?'mid':'low';
    return `<li data-channel="${el(row.channel)}"><p class="canvas-ask-cohort-group">${row.channel==='GraPARI'?'GraPARI':'Contact Center'}</p>
     <h4>${el(row.name)}</h4>
     <div class="canvas-ask-overview-score"><strong class="tone-${tone}">${score(row.score)}</strong>${indicator(row.score,row.previous)}</div>
     <p>${number(row.total)} ${countLabel}</p>
    </li>`;
   }).join('')}</ul>`:'<p>Belum ada penilaian ASK untuk cakupan ini.</p>'}
   <div class="canvas-ask-overview-panels">
    <div class="canvas-ask-components" role="group" aria-label="Komponen ASK">${dimensionRows.map(row=>`<article class="canvas-ask-component" data-dimension="${row.label.toLowerCase()}">
     <div><h4>${el(row.label)}</h4><p>${ytd?'rata-rata YTD':range?'rata-rata periode':scope==='Nasional'&&allChannels?'rata-rata nasional':'rata-rata cakupan'}</p>
      ${!multiMonth?`<p><abbr title="${el(priorPeriod)}">${el(priorMonth)}</abbr> ${score(row.previous)} ${indicator(row.score,row.previous)}</p>`:''}</div>
     <strong>${score(row.score)}</strong>
    </article>`).join('')}</div>
    <article class="canvas-panel canvas-focus">${comparison}</article>
    ${dashboardAskOverviewDistribution(scoreBands,previous?.scoreBands,{multiMonth,priorPeriod,distributionPeriod})}
   </div>
  </section>
  <article class="canvas-ask-executive" aria-labelledby="canvas-ask-executive-title">
   <h3 id="canvas-ask-executive-title">Executive Summary</h3>${summary}
  </article>
  ${dashboardAskPerformanceTable(performanceRows,chartOptions)}
  <div class="canvas-ask-report-panels">${quadrants}</div>
  ${ranking}
  <p class="canvas-ask-report-source">Data bersumber dari workbook ASK lokal. Skor ASK berbobot 40% Attitude, 30% Skill, dan 30% Knowledge.
   Warna skor mengikuti ambang ≥90, 80 hingga &lt;90, dan &lt;80.${!multiMonth?' ▲/▼ menunjukkan perubahan terhadap bulan sebelumnya.':''}
   ${ytd?'Rata-rata YTD memakai semua penilaian yang tersedia. Distribusi skor memakai penilaian valid terakhir tiap CSR.':range?'Rata-rata periode memakai semua penilaian yang tersedia dalam rentang. Distribusi dan peringkat memakai bulan terbaru yang memiliki penilaian dalam rentang.':''}</p>
  </div>
 </details>`;
}

function dashboardCsrPie(groups) {
 const rows = groups.filter(({value})=>Number.isFinite(value) && value>0);
 if (!rows.length) return '<p>Data jumlah CSR lokal belum tersedia untuk periode ini.</p>';
 const colors = {
  'GraPARI · MOMO':'#005a9c','GraPARI · TOMO':'#60c1e5','Call Center':'#c91436',
  'E-Care':'#536aa7','GraPARI · Model belum tercatat':'#a0e0ef','CTP belum terpetakan':'#7a657a',
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
  const color = colors[row.label];
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
   const shortLabel = label==='GraPARI · Model belum tercatat' ? 'Model belum tercatat' : label;
   return `<g class="canvas-pie-callout">
    <polyline points="${anchor.x},${anchor.y} ${bend.x},${bend.y} ${edge},${y}"/>
    <circle cx="${anchor.x}" cy="${anchor.y}" r="2.2" fill="${color}"/>
    <text x="${labelX}" y="${y-1}" text-anchor="${right?'start':'end'}">${el(shortLabel)}</text>
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
 return `<details class="canvas-learning-report" data-learning-disclosure="${id}"${dashboardLearningOpen.has(id)?' open':''}>
  <summary class="canvas-learning-toggle"><h2 class="canvas-learning-title" id="${heading}">${el(title)}<small>${el(scope)}</small></h2>
   <span class="canvas-learning-action" aria-hidden="true"><span class="canvas-learning-show">Tampilkan</span><span class="canvas-learning-hide">Sembunyikan</span></span>
  </summary>
  <div class="canvas-learning-body" role="region" aria-labelledby="${heading}">${body}</div>
 </details>`;
}

function dashboardLearningSection(id,title,scope,description,rows,empty='Data belum tersedia untuk cakupan ini.') {
 return dashboardLearningDisclosure(id,title,scope,`<p class="canvas-learning-description">${el(description)}</p>
   ${rows.length ? `<div class="canvas-learning-rows">${rows.map(({label,value,bars,facts,tone=''})=>{
    const key = `${id}:${label}`;
    return `<details class="canvas-learning-row" data-learning-disclosure="${el(key)}"${dashboardLearningOpen.has(key)?' open':''}>
     <summary class="canvas-learning-row-toggle"><span class="canvas-learning-row-label">${el(label)}</span>
      <strong class="canvas-learning-row-value${tone?' '+tone:''}">${el(value)}</strong>
      <span class="canvas-learning-bars">${bars.map(([width,caption,score,post])=>{
       const track = `<span class="canvas-learning-bar${post?' is-post':''}" aria-hidden="true"><span style="--value:${width}%"></span></span>`;
       return caption ? `<span class="canvas-learning-bar-line"><span class="canvas-learning-bar-label">${caption}</span>${track}<b class="canvas-learning-bar-value">${el(score)}</b></span>` : track;
      }).join('')}</span>
     </summary>
     <dl class="canvas-learning-row-detail">${facts.map(([name,amount])=>`<div><dt>${el(name)}</dt><dd>${el(amount)}</dd></div>`).join('')}</dl>
    </details>`;
   }).join('')}</div>` : `<p class="canvas-learning-empty">${el(empty)}</p>`}`);
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
 const range = trial && dashboardTrialWindow==='range' && reportFrom.slice(0,7)!==reportMonth;
 const multiMonth = ytd || range;
 const lastAsk = trial || fullMonth ? dashboardAskSnapshot(localAskReport?.[reportMonth]) : null;
 const previousAsk = trial || fullMonth ? dashboardAskSnapshot(localAskReport?.[priorMonth.slice(0,7)]) : null;
 const localCsr = trial ? lastAsk?.csrCounts : fullMonth ? localAskReport?.[reportMonth]?.csrCounts : null;
 const priorCsr = trial ? previousAsk?.csrCounts : fullMonth ? localAskReport?.[priorMonth.slice(0,7)]?.csrCounts : null;
 const totalCsr = counts=>counts ? Object.values(counts).reduce((sum,value)=>sum+value,0) : null;
 const total = totalCsr(localCsr), prior = totalCsr(priorCsr);
 const priorLabel = new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'})
  .format(new Date(priorMonth+'T00:00:00Z'));
 const monthLabel = key=>new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'})
  .format(new Date(key+'-01T00:00:00Z'));
 const difference = prior==null || total==null ? null : total-prior;
 const [direction, symbol, tone] = difference > 0 ? ['Naik','↑','positive']
  : difference < 0 ? ['Turun','↓','negative'] : ['Tetap','→','neutral'];
 const csrMonthComparison = difference==null ? '<p>Data pembanding belum tersedia</p>'
  : `<p class="ctp-csr-mom"><b class="ak-delta ${tone}"><span role="img" aria-label="${direction}">${symbol}</span> ${fmt(Math.abs(difference),'CSR')}</b>
     <span>${priorLabel}: ${fmt(prior,'CSR')}</span></p>`;
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
  return {key,data:dashboardAskSnapshot(localAskReport?.[key],ytd)};
 }) : [];
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
 const workbook = trial ? {groups:{},areas:Object.create(null)} : fullMonth && locationLabel==='Nasional' &&
  category==='All Categories' && !q ? localAskReport?.[reportMonth] : null;
 if (trial) {
  for (const {data} of trialMonths) {
   for (const [key,group] of Object.entries(data?.groups || {})) {
    addDashboardAskMetrics(workbook.groups[key] ||= emptyDashboardAskMetrics(),group);
   }
   for (const [name,metrics] of Object.entries(data?.areas || {})) {
    addDashboardAskMetrics(workbook.areas[name] ||= emptyDashboardAskMetrics(),metrics);
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
   trial ? `Workbook ASK lokal · ${monthLabel(reportMonth)} · CSR unik` : 'Workbook ASK lokal · Semua CTP · CSR unik, termasuk skor yang belum lengkap'),
  card(locationLabel==='Nasional' && ctp==='All CTPs' ? 'ASK Nasional' : 'Kelulusan ASK',values(dimensions.map((label,i)=>[label,dashboardAsk[i],'%'])),
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
 const unclassified = agent=>agent.ctp==='GraPARI' && !['MOMO','TOMO'].includes(askSegment(agent));
 if (agents.some(unclassified) || programRoster.some(unclassified)) cohortDefinitions.splice(2,0,['GraPARI · Model belum tercatat',null,unclassified]);
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
 if (localCsr?.['GraPARI model belum tercatat']) csrGroups.splice(2,0,{
  label:'GraPARI · Model belum tercatat',value:localCsr['GraPARI model belum tercatat'],
 });
 if (localCsr?.['CTP belum terpetakan']) csrGroups.push({
  label:'CTP belum terpetakan',value:localCsr['CTP belum terpetakan'],
 });
 const csrBreakdown = dashboardCsrPie(csrGroups);
 const csrChart = dashCard('Total CSR per CTP',
  trial?`Snapshot ${monthLabel(reportMonth)} · termasuk CSR dengan skor ASK belum lengkap.`:'Cakupan nasional, termasuk CSR dengan skor ASK belum lengkap.',
  csrBreakdown);
 const askChart = compare('Kelulusan ASK per CTP',`${askSource} · Persentase CSR dengan skor minimal 80.`,
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
  const listFormat = new Intl.ListFormat('id-ID',{type:'conjunction'});
  const quadrantRows = Object.entries(latest?.quadrants || {}).sort((a,b)=>b[1]-a[1])
   .map(([code,value])=>{
    const levels = ASK_QUADRANTS.find(([label])=>label===code)?.slice(2);
    const low = levels ? dimensions.filter((_,i)=>levels[i]==='Low') : [];
    const label = !levels ? 'Kuadran belum tercatat' : low.length ? listFormat.format(low)+' belum lulus' : 'Semua dimensi lulus';
    return {label,value,code,levels,allPass:Boolean(levels && !low.length)};
   });
  const quadrantBadges = levels=>dimensions.map((dimension,index)=>{
   const level = levels?.[index];
   const [tone,symbol,status] = level==='High' ? ['passing','✓','lulus']
    : level==='Low' ? ['failing','✕','belum lulus'] : ['unavailable','—','belum tercatat'];
   return `<span class="canvas-quadrant-badge is-${tone}" role="img" aria-label="${el(dimension)} ${status}">
    <span aria-hidden="true">${dimension[0]} <strong>${symbol}</strong></span></span>`;
  }).join('');
  const previous = dashboardAskTotals(Object.values(previousAsk?.groups || {}));
  const previousRates = askRates(previous.high,previous.total);
  const monthlyAsk = covered && previous.total ? dimensions.map((name,i)=>{
   const change = dashboardAsk[i]-previousRates[i];
   return {name,current:dashboardAsk[i],prior:previousRates[i],change};
  }) : [];
  const biggestChange = [...monthlyAsk].sort((a,b)=>Math.abs(b.change)-Math.abs(a.change))[0];
  const takeaway = biggestChange && Math.abs(biggestChange.change)>=0.05
   ? `${biggestChange.name} ${biggestChange.change>0?'naik':'turun'} ${fmt(Math.abs(biggestChange.change))} poin persentase.`
   : biggestChange ? 'Persentase kelulusan relatif stabil.' : 'Data pembanding untuk cakupan ini belum lengkap.';
  const quadrantTotal = quadrantRows.reduce((sum,row)=>sum+row.value,0);
  const detailsButton = (id,label)=>`<button type="button" class="canvas-link" data-canvas-dialog="${id}" aria-haspopup="dialog">${label}</button>`;
  const averageAsk = dashboardAskAverage(workbookTotals);
  const priorAsk = dashboardAskAverage(previous);
  const regularScores = rows=>[...rows[acs],...rows[bad]].filter(row=>validAssessmentScore(row.score));
  const priorTraining = multiMonth ? null : withPreviousPeriod(()=>{
   reportFrom = priorMonth;
   reportTo = iso(year,month-1,0);
   const priorAgents = filtered();
   const priorPrograms = Object.fromEntries(DASH_PROGRAMS.map(key=>[key,dashboardProgramRows(priorAgents,key)]));
   const ids = new Set(Object.values(priorPrograms).flat().map(row=>row.agent_id));
   return {programs:priorPrograms,pairs:regularTrainingTestPairs(state.agents.filter(agent=>ids.has(agent.id)))};
  });
  const mom = (value,previous,unit='')=>{
   if (multiMonth || !Number.isFinite(value)) return '';
   if (!Number.isFinite(previous)) return '<span class="canvas-kpi-mom">Pembanding belum tersedia</span>';
   const delta = value-previous;
   const flat = Math.abs(delta)<0.05;
   const symbol = flat?'→':delta>0?'▲':'▼';
   const direction = flat?'Tetap':delta>0?'Naik':'Turun';
   const change = fmt(flat?0:Math.abs(delta),unit);
   return `<span class="canvas-kpi-mom"><b class="${flat?'':delta>0?'is-up':'is-down'}" aria-label="${direction} ${change}">${symbol} ${change}</b>
    <span>vs ${fmt(previous)}</span></span>`;
  };
  const datedComparison = (current,previous,unit='')=>!multiMonth && Number.isFinite(current) && Number.isFinite(previous)
   ? `<p>Pembanding ${priorLabel} · ${fmt(previous,unit)}</p>` : '';
  const headline = (value,unit='')=>Number.isFinite(value)
   ? `<strong class="canvas-kpi-value">${score.format(value)}${unit?` <small>${unit}</small>`:''}</strong>`
   : '<strong class="canvas-kpi-value is-unavailable">Data belum tersedia</strong>';
  const regularAverage = trainingLocal ? training.post : average(regularScores(programs),'score');
  const priorRegularAverage = trainingLocal ? learning?.priorTraining?.post
   : priorTraining ? average(regularScores(priorTraining.programs),'score') : null;
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
   <strong class="canvas-kpi-test-gain${gainTone}" aria-label="${gainDirection} ${fmt(Math.abs(pairedGain),'poin')}">${gainSymbol} ${fmt(Math.abs(pairedGain),'poin')}</strong>`;
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
  const kpis = [
   kpi('csr',locationLabel==='Nasional'&&ctp==='All CTPs'?'Total CSR Nasional':'Total CSR',
    icon('M15 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m19 0v-2a4 4 0 0 0-3-4m-2-12a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'),
    headline(total,'CSR')+mom(total,prior,'CSR'),!multiMonth&&Number.isFinite(total)&&Number.isFinite(prior)?`Pembanding ${priorLabel}`:'',
    `<p>Workbook ASK lokal · ${monthLabel(reportMonth)} · CSR unik</p>${datedComparison(total,prior,'CSR')}`),
   kpi('ask','Rata-rata ASK',icon('M3 4v16h18M6 15l4-4 4 2 5-6m-4 0h4v4'),
    headline(averageAsk,'/100')+mom(averageAsk,priorAsk,'poin'),`Skor berbobot · ${askCoverage}`,
    `<p>Workbook ASK lokal · Attitude 40%, Skill 30%, Knowledge 30%</p>${datedComparison(averageAsk,priorAsk,'/100')}`),
   kpi('skills','Training Hard Skill',icon('M14 6a4 4 0 0 0-5 5.5l-5.5 5.6a2.4 2.4 0 0 0 3.4 3.4l5.6-5.5A4 4 0 0 0 18 10l-2 2-3-3 2-2Z'),
    headline(hardTotal,'CSR')+mom(hardTotal,priorHard,'CSR'),'Peserta unik',
    `<p>${trainingLocal?loadingMessage || 'Workbook Training lokal':source(programs[hard])}${hardCoverage?' · '+hardCoverage:''}</p>${datedComparison(hardTotal,priorHard,'CSR')}`),
   kpi('tryout','Rata-rata Tryout',icon('M9 4H5v17h14V4h-4m-6-1h6v4H9zM8 14l2.5 2.5L16 11'),
    headline(tryoutAverage,'/100')+mom(tryoutAverage,priorTryoutAverage,'poin'),useAskTryout?askTryoutNote:'',
    `<p>${useAskTryout?'Rata-rata nilai TO terisi pada skala 0–100.':tryoutNote}</p>${datedComparison(tryoutAverage,priorTryoutAverage,'/100')}`),
   kpi('regular','Nilai Training Reguler',icon('M15 12l3 8-4-1.5L12 22l-2-3.5L6 20l3-8m8-4a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z'),
    headline(regularAverage,'/100')+mom(regularAverage,priorRegularAverage,'poin'),'Rata-rata post-test reguler',
    `<p>${trainingNote}</p>${datedComparison(regularAverage,priorRegularAverage,'/100')}`),
   kpi('tests','Pre-test &amp; Post-test Reguler',icon('M3 7h17m-4-4 4 4-4 4m5 6H4m4-4-4 4 4 4'),
    pairedKpi,pairedCountNote,`<p>${pairNote}</p>${pairedComparisons}`),
  ];
  const askComparison = ytd ? askMonthlyTrend(trendRows,`Jan–${monthLabel(reportMonth)}`,trendChannels.map(([label])=>label),{
     heading:'Tren ASK per Channel',
     description:'Rata-rata skor ASK berbobot dari 100 per bulan.',
     score:true,
    }) : range ? `<h3>Kelulusan ASK selama periode</h3>${values(dimensions.map((label,i)=>[label,dashboardAsk[i],'%']))}` : `
     <h3>Perbandingan ASK bulanan</h3>
     <p>Persentase CSR dengan nilai minimal 80 per dimensi.</p>
     ${monthlyAsk.length?'':`<p>${monthLabel(reportMonth)} vs ${priorLabel}</p>`}
     <strong class="canvas-takeaway">${takeaway}</strong>
     ${monthlyAsk.length?dashboardAskMonthlyComparison(monthlyAsk,{period:monthLabel(reportMonth),priorPeriod:priorLabel}):''}`;
  const scoreBands = latest?.scoreBands;
  const distributionPeriod = latestDistribution ? (ytd?'Penilaian terakhir per CSR · s.d. ':'Bulan terakhir dengan penilaian · ')+monthLabel(latestDistribution.key) : '';
  const askPeriod = dashboardTrialPeriodLabel();
  const scopeParts = [ctp==='All CTPs'?'':dashboardChannelLabel(),locationLabel].filter(Boolean);
  const askScopeLabel = [...scopeParts,askPeriod].join(' · ');
  const detailScope = range&&latestDistribution ? [...scopeParts,monthLabel(latestDistribution.key)].join(' · ') : askScopeLabel;
  const selectedMapUnit = ['GraPARI','Contact Center'].includes(ctp) && dashboardHasLocalMap() ? dashboardLocalUnit() : null;
  const mapDistribution = selectedMapUnit ? `<section class="canvas-map-distribution canvas-ask-overview" aria-labelledby="dashboard-map-distribution-title">
   <header class="canvas-map-distribution-head">
    <h2 id="dashboard-map-distribution-title" tabindex="-1">Distribusi ASK · ${el(selectedMapUnit[4])}</h2>
    <p>${[...selectedMapUnit.slice(0,3),askPeriod].filter(Boolean).map(el).join(' · ')}</p>
   </header>
   <div class="canvas-map-distribution-body">
    <dl class="canvas-map-metrics">
     <div><dt>Total CSR${multiMonth?' · '+monthLabel(reportMonth):''}</dt><dd>${total==null?'—':number.format(total)}</dd>
      ${mom(total,prior,'CSR')}</div>
     <div><dt>Rata-rata ASK</dt><dd>${averageAsk==null?'—':`${score.format(averageAsk)} <small>/100</small>`}</dd>
      ${mom(averageAsk,priorAsk,'poin')}</div>
     <div><dt>${multiMonth?'Penilaian CSR':'CSR dinilai'}</dt><dd>${number.format(covered)}</dd></div>
    </dl>
    ${dashboardAskOverviewDistribution(scoreBands,previousAsk?.scoreBands,{multiMonth,priorPeriod:priorLabel,distributionPeriod,panelClass:'canvas-map-score-distribution'})}
   </div>
  </section>`:'';
  const askReport = dashboardAskReport({
   scope:locationLabel,
   channel:ctp==='All CTPs' ? 'All CTP' : dashboardChannelLabel(),
   period:askPeriod,
   priorPeriod:priorLabel,
   ytd,
   range,
   detailMonth:range ? latestDistribution?.key : '',
   coverage:monthCoverage,
   current:workbook,
   previous:previousAsk,
   dimensions,
   scoreBands,
   distributionPeriod,
   comparison:askComparison,
   quadrants:`<article class="canvas-panel canvas-quadrant"><h3>Distribusi kuadran ASK</h3>
    <p>${el(detailScope)}${quadrantTotal?` · ${number.format(quadrantTotal)} CSR${ytd?' pada penilaian terakhir':''}`:''}</p>
    <p>${quadrantTotal?'✓ Lulus · ✕ Belum lulus. Pilih batang untuk melihat nama CSR.':'Belum ada data kuadran untuk cakupan ini.'}</p>
    ${quadrantTotal?`<ol class="canvas-quadrant-list">${quadrantRows.map(({label,value,code,levels,allPass})=>`<li class="${allPass?'is-pass':''}">
     <button type="button" class="canvas-quadrant-select" data-ask-quadrant-code="${el(code)}" aria-haspopup="dialog">
      <span class="canvas-quadrant-meta"><span class="canvas-quadrant-label">
       <span class="canvas-quadrant-code"><b>${el(code)}</b><span class="canvas-quadrant-status">${quadrantBadges(levels)}</span></span>
       <small class="canvas-quadrant-summary">${el(label)}</small></span>
       <strong>${number.format(value)} <small>(${fmt(100*value/quadrantTotal,'%')})</small></strong></span>
      <span class="canvas-bar-track" aria-hidden="true"><i style="width:${100*value/quadrantTotal}%"></i></span>
     </button>
    </li>`).join('')}</ol>`:''}
   </article>`,
   ranking:`<section class="canvas-panel canvas-ask-rankings" aria-labelledby="canvas-ask-ranking-title">
    <header><div><h3 id="canvas-ask-ranking-title">Top 5 &amp; Bottom 5 ASK</h3>
     <p>${el(detailScope)} · ${ytd?'Skor valid terakhir tiap CSR':'Skor ASK berbobot /100'}</p></div></header>
    <div class="canvas-ask-rank-result"${covered?' data-ask-ranking':''} aria-live="polite"><p>${covered?'Memuat peringkat ASK…':'Belum ada skor ASK untuk cakupan ini.'}</p></div>
   </section>`,
  });
  const trainingGroups = trainingLocal ? learningGroups.map(({label,training})=>({label,...training})) : cohorts.map(group=>{
   const includesAgent = row=>group.programAgentIds.has(row.agent_id);
   return {
    label:group.label,
    regular:programCount([acs,bad],group.programAgentIds),
    acs:programCount([acs],group.programAgentIds),
    bad:programCount([bad],group.programAgentIds),
    post:average(regularScores(programs).filter(includesAgent),'score'),
    pairs:group.pairs.length,
    pairPre:average(group.pairs,'pre'),
    pairPost:average(group.pairs,'post'),
   };
  });
  const participantRows = (field,facts)=>{
   const groups = trainingGroups.filter(group=>group[field]>0).sort((a,b)=>b[field]-a[field]);
   return groups.map(group=>({label:group.label,value:fmt(group[field],'CSR'),bars:[[100*group[field]/groups[0][field]]],facts:facts(group)}));
  };
  const regularRows = participantRows('regular',group=>[
   ['ACS Booster',fmt(group.acs ?? 0,'CSR')],['Bad Ticket',fmt(group.bad ?? 0,'CSR')],['Rata-rata post-test',fmt(group.post,'/100')],
  ]);
  const tryoutBands = [['high','90–100','Nilai 90 sampai 100'],['mid','80–<90','Nilai mulai 80 hingga di bawah 90'],['low','<80','Nilai di bawah 80']];
  const demoBandCounts = ()=>scoredTryout.reduce((totals,{score})=>{
   totals[Number(score)>=90?'high':Number(score)>=80?'mid':'low']++;
   return totals;
  },{count:scoredTryout.length,high:0,mid:0,low:0});
  const bandCounts = useAskTryout ? askTryout : tryoutLocal ? practice : demoBandCounts();
  const tryoutCount = bandCounts.count;
  const tryoutMeasure = useAskTryout ? 'nilai TO' : 'nilai Tryout';
  const tryoutRows = tryoutCount>0 && tryoutBands.reduce((sum,[key])=>sum+(bandCounts[key] || 0),0)===tryoutCount
   ? tryoutBands.map(([key,label,range])=>{
    const value = bandCounts[key] || 0;
    const share = 100*value/tryoutCount;
    return {label,value:`${fmt(share,'%')} (${number.format(value)})`,bars:[[share]],facts:[
     ['Rentang skor',range],['Cakupan',`${number.format(value)} dari ${number.format(tryoutCount)} ${tryoutMeasure}`],
    ]};
   }) : [];
  const pairedRows = trainingGroups.filter(group=>group.pairs && Number.isFinite(group.pairPre) && Number.isFinite(group.pairPost))
   .sort((a,b)=>b.pairs-a.pairs).map(group=>{
    const gain = testGain(group.pairPre,group.pairPost);
    const direction = gain>0 ? '▲' : gain<0 ? '▼' : '→';
    return {label:group.label,value:`${direction} ${fmt(Math.abs(gain),'poin')}`,tone:gain>0?'is-up':gain<0?'is-down':'',bars:[
     [group.pairPre,'Pre-test',fmt(group.pairPre)],
     [group.pairPost,'Post-test',fmt(group.pairPost),true],
    ],facts:[['Pasangan tes',number.format(group.pairs)]]};
   });
  const reportScope = metric=>[askScopeLabel,metric].filter(Boolean).join(' · ');
  const regularSource = trainingLocal ? 'Workbook Training lokal' : source([...programs[acs],...programs[bad]]);
  const learningDistributions = `<section class="canvas-learning-reports" aria-label="Distribusi Training dan Tryout">
   ${dashboardHardSkillSection([ctp==='All CTPs'?'':dashboardChannelLabel(),locationLabel].filter(Boolean).join(' · '))}
   ${dashboardLearningSection('tryout','Distribusi Tryout',reportScope(tryoutCount>0?fmt(tryoutCount,tryoutMeasure):''),
    `Sebaran nilai pada skala 0–100. Pilih batang untuk melihat cakupan tiap rentang. ${useAskTryout?'Sumber Workbook ASK':tryoutLocal?'Sumber Workbook Tryout lokal':source(programs[tryout])}.`,
    tryoutRows,useAskTryout?'Rincian rentang nilai TO belum tersedia untuk cakupan ini.':tryoutNote)}
   ${dashboardLearningSection('regular','Distribusi Training Reguler',reportScope(regularTotal>0?fmt(regularTotal,'CSR unik'):''),
    `Peserta Training Reguler per CTP. Pilih batang untuk melihat peserta per program dan rata-rata post-test. ${regularSource}.`,regularRows,loadingMessage || undefined)}
   ${dashboardLearningSection('tests','Pre-test & Post-test Reguler',reportScope(pairedCountNote),
    'Rata-rata dari pasangan tes dalam kegiatan yang sama, dengan skala 0–100. Pilih CTP untuk melihat jumlah pasangan tes.',pairedRows,pairNote)}
  </section>`;
  const analysisScale = (suffix='')=>`<div class="canvas-analysis-scale" aria-hidden="true"><span>0${suffix}</span><span>50${suffix}</span><span>100${suffix}</span></div>`;
  const trainingTotals = [['Hard Skill',hardTotal],['Training Reguler',regularTotal]];
  const trainingSubtitle = loadingMessage || (trainingLocal && training.attendance
   ? `${number.format(training.attendance)} kehadiran · ${number.format(training.sessions)} sesi` : trainingNote);
  return `${mapDistribution}<section class="ctp-executive ctp-trial" aria-label="Ringkasan CTP">
   <section class="canvas-kpis" aria-label="KPI dashboard">
    <div class="canvas-kpi-group is-core" role="group" aria-labelledby="canvas-kpi-core-title">
     <h2 class="canvas-kpi-group-title" id="canvas-kpi-core-title">CSR &amp; ASK</h2>
     <div class="canvas-kpi-group-cards">${kpis.slice(0,2).join('')}</div>
    </div>
    <div class="canvas-kpi-group is-learning" role="group" aria-labelledby="canvas-kpi-learning-title">
     <h2 class="canvas-kpi-group-title" id="canvas-kpi-learning-title">Training &amp; Evaluasi</h2>
     <div class="canvas-kpi-group-cards">${kpis.slice(2).join('')}</div>
    </div>
   </section>
   <article class="canvas-panel canvas-ctp"><header><h3>CSR per CTP</h3>${detailsButton('canvas-ctp-detail','Rincian CTP')}</header>
    <p>CSR unik · ${monthLabel(reportMonth)}</p>
    ${csrBreakdown}
   </article>
   <article class="canvas-panel canvas-ask"><header><h3>Kelulusan ASK</h3><button type="button" class="canvas-link" data-dashboard-ask-detail>Buka ASK</button></header>
    <p>${askCoverage} · Lulus ≥80</p>
    ${covered?`<div class="canvas-pass-legend"><span>Lulus</span><span>Belum lulus</span></div>
    <ul class="canvas-ask-stacked">${dimensions.map((label,i)=>{
     const rate = dashboardAsk[i];
     const high = Math.round(rate*10)/10;
     return `<li><strong>${label}</strong>
      <span class="canvas-ask-stacked-track" aria-hidden="true"><i style="width:${rate}%"></i></span>
      <span class="canvas-ask-stacked-labels">
       <span class="is-pass" role="img" aria-label="Lulus ${fmt(high,'%')}, ${number.format(dashboardHigh[i])} CSR"><b>${fmt(high,'%')}</b> <small>(${number.format(dashboardHigh[i])})</small></span>
       <span class="is-below" role="img" aria-label="Belum lulus ${fmt(100-high,'%')}, ${number.format(covered-dashboardHigh[i])} CSR"><b>${fmt(100-high,'%')}</b> <small>(${number.format(covered-dashboardHigh[i])})</small></span>
      </span></li>`;
    }).join('')}</ul>${analysisScale('%')}`:'<p>Data belum tersedia</p>'}
   </article>
   <article class="canvas-panel canvas-training"><header><h3>Training &amp; Evaluasi</h3>${detailsButton('canvas-training-detail','Rincian training')}</header>
    <p>${trainingSubtitle}</p>
    <dl class="canvas-training-totals">${trainingTotals.map(([label,value])=>`<div><dt>${label}</dt><dd>${value==null?'Data belum tersedia':number.format(value)}</dd></div>`).join('')}</dl>
    <div class="canvas-test-comparison">
     <header><div><h4>Tes reguler</h4>${pairedCountNote?`<p>${pairedCountNote}</p>`:''}</div>
      ${pairedGain==null?'':`<b class="canvas-test-gain${pairedGain<0?' is-down':pairedGain>0?' is-up':''}" aria-label="${pairedGain<0?'Turun':pairedGain>0?'Naik':'Tetap'} ${fmt(Math.abs(pairedGain),'poin')}">${pairedGain<0?'▼':pairedGain>0?'▲':'→'} ${fmt(Math.abs(pairedGain),'poin')}</b>`}
     </header>
     ${pairedGain==null?'<p>Data belum tersedia</p>':`<div class="canvas-test-score-list">${[
       ['Pre-test',pairedPre],['Post-test',pairedPost],
      ].map(([label,value])=>`<div><span>${label}</span><span class="canvas-bar-track" aria-hidden="true"><i style="width:${value}%"></i></span><b>${fmt(value)}</b></div>`).join('')}
      </div>${analysisScale()}`}
    </div>
   </article>
   ${askReport}
   ${learningDistributions}
   ${quadrantTotal?`<dialog class="canvas-dialog canvas-ask-drill-dialog" id="canvas-ask-drill" aria-labelledby="canvas-ask-drill-title">
    <header class="canvas-dialog-top"><div><h3 id="canvas-ask-drill-title">Daftar CSR</h3><p>${el(detailScope)}</p></div>
     <form method="dialog"><button type="submit" class="btn">Tutup</button></form></header>
    <form class="canvas-ask-drill-search"><label class="field">Nama CSR<input type="search" name="q" maxlength="100" autocomplete="off"></label>
     <button type="submit" class="btn">Cari</button></form>
    <div class="canvas-ask-drill-rows" aria-live="polite"></div>
    <nav class="canvas-ask-drill-pager" aria-label="Halaman daftar CSR">
     <button class="btn" type="button" data-ask-page="previous" disabled>Sebelumnya</button><span role="status"></span>
     <button class="btn" type="button" data-ask-page="next" disabled>Berikutnya</button></nav>
   </dialog>`:''}
   <dialog class="canvas-dialog" id="canvas-ctp-detail" aria-labelledby="canvas-ctp-title">
    <div class="canvas-dialog-top"><h3 id="canvas-ctp-title">Perbandingan CTP</h3><form method="dialog"><button class="btn">Tutup</button></form></div>
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
