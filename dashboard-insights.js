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
function dashboardEnrichment(xs){return `${dashboardTab===0?'':participantOverview(xs)}${extraCharts(xs)}${rankingPanel(rankDataset(xs))}${dashboardTab===0||(dashboardTab===4&&dashboardSub[4]!=='Reguler Try Out')?agentVocPanel(xs):''}`}
function bindInsights(){bindOverviewFilters();document.querySelectorAll('[data-insight-action]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.insightKey;if(b.dataset.insightAction==='region')region=k;if(b.dataset.insightAction==='voc-sentiment')vocSentiment=k;if(b.dataset.insightAction==='voc-topic')vocTopic=k;render()}));document.querySelectorAll('[data-voc-reset]').forEach(b=>b.addEventListener('click',()=>{vocSentiment='All';vocTopic='All';render()}));document.querySelectorAll('.di-scatter [data-agent]').forEach(b=>b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();modal={type:'agent',id:b.dataset.agent};render()}}));document.querySelectorAll('[data-download-page]').forEach(b=>b.addEventListener('click',()=>downloadPagePdf()));document.querySelectorAll('[data-download-excel]').forEach(b=>b.addEventListener('click',()=>downloadDashboardExcel()));}

const overviewDimensions = [
 {key:'ctp', label:'CTP', value:a=>a.ctp},
 {key:'area', label:'Area / Site', value:a=>agentLocation(a)},
 {key:'region', label:'Region', value:a=>a.region||'Unassigned'},
 {key:'unit', label:'Unit', value:a=>a.unitName||a.branch||'Unassigned'}
];
const overviewSelection = {};
function bindOverviewFilters(){
 const form=document.querySelector('.overview-filters');
 if(!form)return;
 form.onchange=event=>{
  const key=event.target.name;
  const index=overviewDimensions.findIndex(d=>d.key===key);
  if(index<0)return;
  overviewSelection[key]=event.target.value;
  for(const child of overviewDimensions.slice(index+1))delete overviewSelection[child.key];
  render();
  document.querySelector('.overview-filters [name="'+key+'"]')?.focus();
 };
 form.onreset=event=>{
  event.preventDefault();
  for(const d of overviewDimensions)delete overviewSelection[d.key];
  render();
  document.querySelector('.overview-filters select')?.focus();
 };
}
function participantOverview(xs){
 const controls=[];
 for(const {key,label,value} of overviewDimensions){
  const selected=overviewSelection[key]||'';
  const options=new Set(xs.map(value).filter(Boolean));
  if(selected)options.add(selected);
  controls.push(`<label class="field">${label}<select name="${key}"><option value="">All</option>${[...options].sort().map(v=>`<option value="${el(v)}" ${v===selected?'selected':''}>${el(v==='Contact Center'?'Call Center':v)}</option>`).join('')}</select></label>`);
  if(selected)xs=xs.filter(a=>value(a)===selected);
 }
 const form=`<form class="overview-filters" aria-label="Participant overview filters">${controls.join('')}<button type="reset" class="btn">Reset overview filters</button></form>`;
 const ids=new Set(xs.map(a=>a.id));
 const pairs=assessmentRows(xs).filter(a=>ids.has(a.id)),demo=xs.filter(isShowcaseAgent),weighted=a=>a.attitude*.4+a.skill*.3+a.knowledge*.3;
 const metric=(label,value,note)=>'<article class="dw-metric"><span>'+label+'</span><strong>'+value+'</strong><small>'+note+'</small></article>';
 const counts=key=>[...new Set(xs.map(key))].map(k=>({label:k,value:xs.filter(a=>key(a)===k).length}));
 const regions=counts(a=>a.region).map(r=>({...r,action:'region',key:r.label}));
 const monthKeys=[...new Set(xs.map(a=>(a.report_date||'2026-10-01').slice(0,7)))].sort();const months=monthKeys.map(label=>({label,value:xs.filter(a=>(a.report_date||'2026-10-01').startsWith(label)).length}));
 const mix=['Offline','Online'].map((label,i)=>({label,value:demo.filter(a=>Number(a.id.replace(/\D/g,''))%2===i).length,color:i?'#374151':'#1B4F8A'}));
 const scores=['attitude','skill','knowledge'].map((k,i)=>({label:k[0].toUpperCase()+k.slice(1),value:xs.length?Number(avg(xs.map(a=>a[k])).toFixed(1)):0,color:['#1B4F8A','#6B7280','#374151'][i]}));
 scores.push({label:'Weighted ASK',value:xs.length?Number(avg(xs.map(weighted)).toFixed(1)):0,color:'#C8202E'});
 return '<section class="di-overview"><h2>Participant & capability overview</h2>'+form+'<div class="dw-metrics">'+metric('Total participants',xs.length,'Agents in this overview')+metric('Unique agent IDs',new Set(xs.map(a=>a.id)).size,'Unique roster identities')+metric('Average post-test',pairs.length?avg(pairs.map(a=>a.post)).toFixed(1):'—',pairs.length+' valid pre/post pairs')+metric('Average total ASK',xs.length?avg(xs.map(weighted)).toFixed(1):'—','40% Attitude · 30% Skill · 30% Knowledge')+'</div><div class="dw-grid">'+dashCard('Participants by Month','Latest selected snapshot month per agent; dated dummy history',insightBars(months,Math.max(1,demo.length)))+dashCard('Participants by Region','All matching regions · click to filter',insightBars(regions,Math.max(1,...regions.map(r=>r.value))))+dashCard('Online vs Offline','Illustrative delivery mode for '+demo.length+' demo agents; other records excluded',askDonutChart(mix,demo.length,'learners'))+dashCard('ASK Score Averages','Dimension averages and weighted total / 100',xs.length?insightBars(scores):'<p>No matching agents.</p>')+'</div>'+dashCard('Participants by Area / Site','Operational locations; E-Care location is unassigned',insightBars(counts(agentLocation),Math.max(1,xs.length)))+'</section>';
}
function executiveSummary(xs){
 const pairs=assessmentRows(xs),feedback=vocRows(xs),weighted=a=>a.attitude*.4+a.skill*.3+a.knowledge*.3;
 const summary=CTPS.map(ctp=>{const agents=xs.filter(a=>a.ctp===ctp),tests=pairs.filter(a=>a.ctp===ctp),voc=feedback.filter(r=>r.ctp===ctp);return {CTP:ctp==='Contact Center'?'Call Center':ctp,Agents:agents.length,'Training complete':agents.length?agents.filter(a=>a.complete).length+' / '+agents.length:'—','ASK / 100':agents.length?avg(agents.map(weighted)).toFixed(1):'—','Post-test / 100':tests.length?avg(tests.map(a=>a.post)).toFixed(1):'—','VoC overall / 5':voc.some(r=>Number.isFinite(r.overall))?avg(voc.filter(r=>Number.isFinite(r.overall)).map(r=>r.overall)).toFixed(2):'—','VoC responses':voc.length}});
 const askLow=xs.filter(a=>weighted(a)<80),testLow=pairs.filter(a=>a.post<80),unfinished=xs.filter(a=>!a.complete),negative=feedback.filter(r=>r.sentiment==='Negative');
 const topicCounts=[...new Set(negative.map(r=>r.topic))].map(topic=>({topic,count:negative.filter(r=>r.topic===topic).length})).sort((a,b)=>b.count-a.count||a.topic.localeCompare(b.topic));
 const pain=[{count:askLow.length,text:`${askLow.length} of ${xs.length} agents have weighted ASK below the showcase target of 80.`},{count:testLow.length,text:`${testLow.length} of ${pairs.length} paired agents have post-test scores below 80.`},{count:unfinished.length,text:`${unfinished.length} of ${xs.length} agents have unfinished training.`},{count:negative.length,text:`${negative.length} of ${feedback.length} customer responses are negative.${topicCounts[0]?' Most frequent negative-feedback topic: '+topicCounts[0].topic+' ('+topicCounts[0].count+' responses).':''}`}].filter(p=>p.count>0);
 const plans=[{title:'1. Target capability gaps',body:askLow.length?`Review the ${askLow.length} agents below ASK 80, identify their lowest dimension, and assign focused coaching.`:'Maintain capability checks; use the ASK breakdown to identify emerging gaps.',measure:'Suggested measure: next-period ASK average and number below 80.',tab:1},{title:'2. Close training and assessment gaps',body:`Review ${unfinished.length} unfinished training records and ${testLow.length} below-target post-tests. Confirm attendance, assign refresher learning where needed, and schedule reassessment. These groups may overlap.`,measure:'Suggested measure: completion rate and post-test improvement.',tab:4},{title:'3. Act on customer feedback',body:negative.length?`Read the ${negative.length} negative responses in full${topicCounts[0]?', starting with '+topicCounts[0].topic:''}. Check the context with the agent and agree a follow-up action.`:'Review the full feedback table and preserve practices associated with positive feedback.',measure:'Suggested measure: negative-response share and average overall rating.',tab:null}];
 return `<section class="executive-summary" aria-label="Executive Summary"><div class="dw-section-title"><div><h2>Executive Summary</h2><p>Selected period and filters · Dated showcase data · Recommendations are proposed actions, not completed work.</p></div></div><h3>Summary on each CTP</h3>${dashTable(summary,['CTP','Agents','Training complete','ASK / 100','Post-test / 100','VoC overall / 5','VoC responses'])}<p class="small">Agent metrics use selected roster snapshots; tests use valid paired assessments; VoC uses dated feedback events. Their populations may differ.</p><div class="dw-card"><div class="dw-card-head"><h3>Pain Point</h3></div><div class="dw-card-body">${pain.length?'<ul>'+pain.map(p=>'<li>'+el(p.text)+'</li>').join('')+'</ul>':'<p>'+(!xs.length&&!feedback.length?'No dated data in this scope. Select another period to identify pain points.':'No gaps against these showcase thresholds in this scope.')+'</p>'}</div></div><h3>3 Recommendation Plan</h3><div class="executive-plans">${plans.map(p=>`<article class="dw-card"><div class="dw-card-head"><h3>${p.title}</h3></div><div class="dw-card-body"><p>${!xs.length&&!feedback.length?'Collect or select dated records before assigning actions.':el(p.body)}</p><p class="small">${p.measure}</p><button class="btn" ${p.tab===null?'data-voc-detail':`data-dash-tab="${p.tab}"`}>${p.tab===null?'Review feedback →':'Open supporting data →'}</button></div></article>`).join('')}</div></section>`;
}
