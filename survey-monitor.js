/* Separate pre/post sources. Stored locally; no survey score overwrites the demo roster. */
const surveyRuntime = { pre:{}, post:{}, timer:null };
function surveyState(){
  return state.surveyMonitor ||= {enabled:false,roster:state.agents.map(a=>a.id),pre:{},post:{}};
}
function surveySource(key){return surveyState()[key] ||= {};}
function surveyRowsFromText(text){
  let headers, rows;
  if (/^\s*[\[{]/.test(text)) {
    const data=JSON.parse(text); if(data.error)throw Error(String(data.error));
    const values=Array.isArray(data)?data:data.rows;
    if(!Array.isArray(values))throw Error('JSON must contain a rows array.');
    if(Array.isArray(data.headers)){headers=data.headers;rows=values;}
    else if(values.length&&typeof values[0]==='object'&&!Array.isArray(values[0])) {headers=Object.keys(values[0]);rows=values.map(r=>headers.map(h=>r[h]??''));}
    else throw Error('The JSON feed needs headers and rows, even when it has no responses.');
  }else{const values=parseCSV(text);headers=values.shift();rows=values;}
  if(!headers?.length||headers.length>100||rows.length>10000)throw Error('Use a feed with 1–100 columns and at most 10,000 responses.');
  headers=headers.map(h=>String(h).replace(/^\uFEFF/,'').trim());
  if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw Error('Every column needs a unique, non-empty heading.');
  if(rows.some(r=>!Array.isArray(r)))throw Error('Invalid response row format.');
  return {headers,rows};
}
function surveyGuess(headers){const find=names=>headers.find(h=>names.includes(h.toLowerCase()))||'';return {id:find(['agent_id','agent id','id','nik']),score:find(['score','nilai','points']),timestamp:find(['timestamp','submitted_at','submission time','waktu'])};}
function surveyScore(value,max){
  const s=String(value??'').trim(); if(!s)return null;
  const fraction=s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  const percent=s.match(/^(\d+(?:\.\d+)?)\s*%$/);
  let n=fraction?Number(fraction[1])/Number(fraction[2])*100:percent?Number(percent[1]):/^\d+(?:\.\d+)?$/.test(s)?Number(s)/max*100:NaN;
  return Number.isFinite(n)&&n>=0&&n<=100?Math.round(n*100)/100:null;
}
function surveyNormalize(feed,map,max,roster){
  if(!map.id||!map.score||!feed.headers.includes(map.id)||!feed.headers.includes(map.score)||map.id===map.score)throw Error('Choose different Agent ID and Score columns.');
  if(map.timestamp&&(!feed.headers.includes(map.timestamp)||[map.id,map.score].includes(map.timestamp)))throw Error('Choose a separate Timestamp column or None.');
  if(!Number.isFinite(max)||max<=0)throw Error('Maximum score must be greater than zero.');
  const ids=new Set(roster), records=new Map();let invalid=0,unknown=0,duplicates=0;
  const ii=feed.headers.indexOf(map.id),si=feed.headers.indexOf(map.score),ti=feed.headers.indexOf(map.timestamp);
  for(let i=0;i<feed.rows.length;i++){
    const row=feed.rows[i],id=String(row[ii]??'').trim();if(row.every(v=>String(v??'').trim()===''))continue;
    if(!ids.has(id)){unknown++;continue;}
    const score=surveyScore(row[si],max),rawTime=ti>=0?String(row[ti]??'').trim():'';
    // ISO timestamps avoid day/month ambiguity. Leave timestamp unmapped for sheet-order precedence.
    const timestamp=rawTime&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(rawTime)?Date.parse(rawTime):NaN;
    if(score===null||(ti>=0&&!Number.isFinite(timestamp))){invalid++;continue;}
    const item={id,score,timestamp:Number.isFinite(timestamp)?new Date(timestamp).toISOString():null,row:i};
    if(records.has(id)){duplicates++;const prev=records.get(id);if(ti>=0&&Date.parse(prev.timestamp)>timestamp)continue;}
    records.set(id,item);
  }
  return {records:[...records.values()],invalid,unknown,duplicates,totalRows:feed.rows.length};
}
function surveyAssessmentRows(rows){
  const monitor=surveyState();if(!monitor.enabled)return rows;
  const pre=new Map((monitor.pre.records||[]).map(r=>[r.id,r.score])),post=new Map((monitor.post.records||[]).map(r=>[r.id,r.score]));
  return rows.filter(a=>monitor.roster.includes(a.id)).map(a=>({...a,pre:pre.get(a.id)??null,post:post.get(a.id)??null}));
}
function surveyDate(v){return v?new Date(v).toLocaleString():'Not yet';}
function surveyStatus(key){const s=surveySource(key),r=surveyRuntime[key];return r.busy?'Refreshing…':s.error?'Sync failed — last successful data retained':s.lastSuccess?(s.auto?'Auto-refresh enabled':'Snapshot saved / paused'):'Not connected';}
function surveyCard(key){
  const s=surveySource(key),r=surveyRuntime[key],name=key==='pre'?'Pre-Test':'Post-Test',roster=surveyState().roster;
  const ids=new Set((s.records||[]).map(x=>x.id)),missing=roster.filter(id=>!ids.has(id)),n=roster.length-missing.length;
  const last=(s.records||[]).map(x=>x.timestamp).filter(Boolean).sort().at(-1);
  const draft=r.preview, map=draft?(r.mapping||surveyGuess(draft.headers)):null;
  return `<article class="card survey-source" data-survey-card="${key}"><div class="headrow"><h2>${name} source</h2><span class="pill">${el(surveyStatus(key))}</span></div>
  <form data-survey-form="${key}"><label class="field">${name} survey form link (optional)<input type="url" name="formUrl" value="${el(r.formDraft??s.formUrl??'')}" data-survey-form-draft="${key}" placeholder="Respondent link — opens the questionnaire"></label><button class="btn">Save form link</button>${s.formUrl?` <a class="cardlink" href="${el(s.formUrl)}" target="_blank" rel="noopener noreferrer">Open ${name} form ↗</a>`:''}</form>
  <form data-survey-connect="${key}"><label class="field">${name} response-data link<input type="url" name="url" data-survey-draft="${key}" value="${el(r.urlDraft??s.url??'')}" placeholder="Google Sheets link or Apps Script /exec URL" required></label>
  <p class="small">This link reads responses. Use a separate source for each test.</p><button class="btn primary" ${r.busy?'disabled':''}>Read columns</button></form>
  ${draft?`<form data-survey-map="${key}" class="survey-map"><h3>Match ${name} columns</h3>${[['id','Agent ID'],['score','Score'],['timestamp','Timestamp (ISO, optional)']].map(([field,label])=>`<label class="field">${label}<select name="${field}" data-survey-map-field="${key}:${field}"><option value="">${field==='timestamp'?'None — use last sheet row':'Select column…'}</option>${draft.headers.map(h=>`<option ${map[field]===h?'selected':''}>${el(h)}</option>`).join('')}</select></label>`).join('')}<label class="field">Maximum score for numeric values<input name="max" type="number" min="0.01" step="any" value="${el(r.maxDraft??100)}" data-survey-max="${key}" required></label><p class="small">Fractions such as 8 / 10 and percentages are normalized automatically. Duplicate IDs use the latest mapped timestamp, or the last sheet row when Timestamp is None.</p><p class="small">${draft.rows.length} rows found. Roster supplies CTP and Area/Site.</p><button class="btn primary">Connect ${name}</button></form>`:''}
  <div class="survey-progress"><strong>${n} / ${roster.length}</strong><span>${roster.length?Math.round(n/roster.length*100)+'%':'—'} valid respondents</span></div><progress max="${Math.max(1,roster.length)}" value="${n}" aria-label="${name} completion"></progress>
  <div class="small">Last successful sync: ${el(surveyDate(s.lastSuccess))}<br>Last response: ${el(surveyDate(last))}${!last?' (map an ISO timestamp to track this)':''}<br>Last attempt: ${el(surveyDate(s.lastAttempt))}</div>
  ${s.demo?'<p class="notice">Local sample feed — not a Google connection.</p>':''}${s.error?`<p class="notice" role="alert">${el(s.error)}</p>`:''}
  ${s.stats?`<p class="small">${s.stats.invalid} invalid · ${s.stats.unknown} unknown / out-of-roster · ${s.stats.duplicates} repeat responses. Only valid roster IDs count.</p>`:''}
  <div class="actions"><button class="btn" data-survey-refresh="${key}" ${!s.mapping||r.busy?'disabled':''}>Refresh now</button><button class="btn" data-survey-auto="${key}" ${!s.mapping||s.demo?'disabled':''}>${s.auto?'Pause':'Start auto-refresh'}</button><label class="field">Interval<select data-survey-interval="${key}"><option value="60" ${(s.interval||60)===60?'selected':''}>60 seconds</option><option value="30" ${s.interval===30?'selected':''}>30 seconds</option></select></label><button class="btn" data-survey-disconnect="${key}" ${!s.lastSuccess&&!s.error&&!r.preview&&!s.formUrl?'disabled':''}>Disconnect</button></div>
  <details><summary>Missing respondents (${missing.length})</summary><div class="survey-missing">${missing.map(id=>el(id+' · '+(state.agents.find(a=>a.id===id)?.name||''))).join('<br>')||'Everyone in the roster has a valid response.'}</div></details></article>`;
}
function surveyMonitorPanel(){
  const m=surveyState(),paired=surveyAssessmentRows(state.agents).filter(a=>validAssessmentScore(a.pre)&&validAssessmentScore(a.post)).length;
  return `<section class="survey-monitor" aria-label="Survey response connections"><div class="section-heading"><div><div class="eyebrow">Survey response monitor</div><h2>Connect Pre-Test & Post-Test</h2><p>Two separate response feeds. One shared agent roster for matching and progress.</p></div><button class="btn" id="surveyHelp">Connection guide</button></div>
  <div class="notice">Connections and snapshots are saved in this browser. Auto-refresh runs while this page is visible and stops when you leave it. Google may serve delayed data; the sync time shows when OmniKnow last checked.</div>
  <div class="card survey-settings"><form id="surveyRoster"><label class="field">Expected Agent IDs (comma or newline separated)<textarea name="ids" rows="2">${el(surveyRuntime.rosterDraft??m.roster.join(', '))}</textarea></label><div class="actions"><button class="btn">Save roster</button><button type="button" class="btn" id="surveyUseScope">Use agents in current filters</button></div><p class="small">${m.roster.length} expected agents. IDs must exist in the Agent Directory; its CTP and Area/Site assignments define the breakdowns.</p></form><label class="field">Assessment chart data<select id="surveyDataset"><option value="demo" ${!m.enabled?'selected':''}>Existing showcase / imported scores</option><option value="feeds" ${m.enabled?'selected':''}>Connected Pre-Test + Post-Test responses</option></select></label><p class="small">${m.enabled?paired+' matched pre/post pairs. Only matched pairs enter the comparison charts.':'Connect both sources, then choose connected responses to update the assessment comparison.'} Other training and service metrics remain their existing data.</p><button class="btn" id="surveyExport">Export response snapshot</button><button class="btn" id="surveySample">Try sample responses</button></div>
  <div class="grid two survey-sources">${surveyCard('pre')}${surveyCard('post')}</div></section>`;
}
function surveyGuide(){return `<p>Create your forms in Google Forms, then connect each form to its response spreadsheet. Pre-test and post-test can use separate spreadsheets or separate tabs.</p><ol><li>Include an Agent ID question matching the OmniKnow roster.</li><li>For a simple demo, use a readable Google Sheet link or publish its response tab as CSV. For Apps Script, download the template below, set the spreadsheet IDs, tab names and column headings, then deploy it as a web app.</li><li>Paste the pre-test response link in Pre-Test and the post-test response link in Post-Test. For one Apps Script deployment, use <code>/exec?stage=pre</code> and <code>/exec?stage=post</code>.</li><li>Click Read columns, choose Agent ID and Score, optionally select an ISO timestamp, set the maximum score and click Connect.</li><li>Save the expected roster, choose connected responses for the assessment charts, and start auto-refresh separately for each source.</li></ol><p><strong>Use non-sensitive showcase data.</strong> This connector reads feeds without signing in to Google. Anyone who can access a published feed can read its data. A private sheet will require a different authenticated integration. Do not paste account passwords or access tokens.</p><p>Only valid roster responses count. Unscored responses do not count as completed; repeated responses use the latest timestamp or last row. A failed refresh retains the last successful snapshot and displays an error.</p><p><a class="btn" href="/survey-feed-template.gs" download>Download Apps Script template</a></p><p>Each source is a single assessment. Keep mixed activities in separate sheets/tabs. Refreshing here does not detect whether the original form is open or closed.</p>`;}
function surveyPersist(){save();}
function surveyRender(){if(page===8)render();}
async function surveyLoad(url){
  const r=await fetch('/api/survey-feed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url}),signal:AbortSignal.timeout(20000)});
  const payload=await r.json();if(!r.ok)throw Error(payload.error||'Could not connect.');return surveyRowsFromText(payload.text);
}
function surveyCommit(key,feed,map,max,url,demo=false){
  const s=surveySource(key),result=surveyNormalize(feed,map,max,surveyState().roster);
  if(feed.rows.length&&!result.records.length)throw Error('No valid responses match the roster. Check Agent ID, Score, maximum score and Timestamp mappings. Last successful data was kept.');
  Object.assign(s,{url,mapping:map,max,records:result.records,stats:{invalid:result.invalid,unknown:result.unknown,duplicates:result.duplicates},lastSuccess:new Date().toISOString(),error:'',demo});
  surveyPersist();
}
async function surveyRefresh(key){
  const s=surveySource(key),r=surveyRuntime[key];if(r.busy||!s.mapping)return;
  r.busy=true;r.generation=(r.generation||0)+1;const generation=r.generation;s.lastAttempt=new Date().toISOString();surveyRender();
  try{const feed=s.demo?surveySampleFeed(key):await surveyLoad(s.url);if(generation!==r.generation)return;surveyCommit(key,feed,s.mapping,s.max,s.url,s.demo);r.failures=0;}
  catch(e){if(generation===r.generation){s.error=e.message;r.failures=(r.failures||0)+1;surveyPersist();}}
  finally{if(generation===r.generation){r.busy=false;r.next=Date.now()+(s.interval||60)*1000*Math.min(4,2**(r.failures||0));surveyRender();}}
}
function surveySampleFeed(key){return {headers:['agent_id','score','timestamp'],rows:state.agents.slice(0,key==='pre'?12:8).map((a,i)=>[a.id,key==='pre'?50+i*3:65+i*4,`2026-11-04T0${key==='pre'?8:9}:${String(i).padStart(2,'0')}:00Z`])};}
function bindSurveyMonitor(){
  document.querySelectorAll('[data-survey-form-draft]').forEach(n=>n.oninput=()=>surveyRuntime[n.dataset.surveyFormDraft].formDraft=n.value);
  document.querySelectorAll('[data-survey-form]').forEach(f=>f.onsubmit=e=>{e.preventDefault();try{const value=f.elements.formUrl.value.trim();if(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw Error('Use an HTTPS form link without credentials.');}surveySource(f.dataset.surveyForm).formUrl=value;surveyPersist();render();}catch(e){notify(e.message)}});
  document.querySelector('#surveyRoster textarea')?.addEventListener('input',e=>surveyRuntime.rosterDraft=e.target.value);
  document.querySelectorAll('[data-survey-draft]').forEach(n=>n.oninput=()=>surveyRuntime[n.dataset.surveyDraft].urlDraft=n.value);
  document.querySelectorAll('[data-survey-map-field]').forEach(n=>n.onchange=()=>{const [key,field]=n.dataset.surveyMapField.split(':');surveyRuntime[key].mapping[field]=n.value});
  document.querySelectorAll('[data-survey-max]').forEach(n=>n.oninput=()=>surveyRuntime[n.dataset.surveyMax].maxDraft=n.value);
  document.querySelectorAll('[data-survey-connect]').forEach(f=>f.onsubmit=async e=>{e.preventDefault();const key=f.dataset.surveyConnect,r=surveyRuntime[key],s=surveySource(key);if(r.busy)return;r.urlDraft=f.elements.url.value.trim();r.pendingUrl=r.urlDraft;r.preview=null;r.busy=true;r.generation=(r.generation||0)+1;const generation=r.generation;s.auto=false;s.lastAttempt=new Date().toISOString();surveyRender();try{const feed=await surveyLoad(r.pendingUrl);if(generation!==r.generation)return;r.preview=feed;r.mapping=surveyGuess(feed.headers);r.maxDraft=100;s.error='';}catch(e){s.error=e.message;}finally{r.busy=false;surveyPersist();surveyRender()}});
  document.querySelectorAll('[data-survey-map]').forEach(f=>f.onsubmit=e=>{e.preventDefault();const key=f.dataset.surveyMap,r=surveyRuntime[key],s=surveySource(key);try{surveyCommit(key,r.preview,r.mapping,Number(r.maxDraft),r.pendingUrl);r.preview=null;r.next=Date.now()+(s.interval||60)*1000;s.auto=false;}catch(e){s.error=e.message}surveyRender()});
  document.querySelectorAll('[data-survey-refresh]').forEach(b=>b.onclick=()=>surveyRefresh(b.dataset.surveyRefresh));
  document.querySelectorAll('[data-survey-auto]').forEach(b=>b.onclick=()=>{const key=b.dataset.surveyAuto,s=surveySource(key);s.auto=!s.auto;surveyRuntime[key].next=Date.now();surveyPersist();surveyRender()});
  document.querySelectorAll('[data-survey-interval]').forEach(n=>n.onchange=()=>{surveySource(n.dataset.surveyInterval).interval=Number(n.value);surveyPersist()});
  document.querySelectorAll('[data-survey-disconnect]').forEach(b=>b.onclick=()=>{const key=b.dataset.surveyDisconnect;surveyRuntime[key].generation=(surveyRuntime[key].generation||0)+1;surveyState()[key]={};surveyRuntime[key]={generation:surveyRuntime[key].generation};surveyPersist();render()});
  document.getElementById('surveyHelp')?.addEventListener('click',()=>{modal={type:'survey-help'};render()});
  document.getElementById('surveyDataset')?.addEventListener('change',e=>{surveyState().enabled=e.target.value==='feeds';surveyPersist();render()});
  const setRoster=ids=>{if(!ids.length)throw Error('Select at least one expected agent.');const known=new Set(state.agents.map(a=>a.id));if(ids.some(id=>!known.has(id)))throw Error('All expected IDs must exist in the Agent Directory.');surveyState().roster=[...new Set(ids)];delete surveyRuntime.rosterDraft;surveyPersist();render()};
  document.getElementById('surveyRoster')?.addEventListener('submit',e=>{e.preventDefault();try{setRoster(e.target.elements.ids.value.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean))}catch(e){notify(e.message)}});
  document.getElementById('surveyUseScope')?.addEventListener('click',()=>{try{setRoster(filtered().map(a=>a.id))}catch(e){notify(e.message)}});
  document.getElementById('surveyExport')?.addEventListener('click',()=>csvDownload('omniknow-survey-snapshot',['pre','post'].flatMap(key=>(surveySource(key).records||[]).map(r=>({test:key,agent_id:r.id,score:r.score,timestamp:r.timestamp||'',last_sync:surveySource(key).lastSuccess})))));
  document.getElementById('surveySample')?.addEventListener('click',()=>{if(['pre','post'].some(k=>surveySource(k).lastSuccess)&&!confirm('Replace the saved survey snapshots with local sample responses?'))return;surveyState().roster=state.agents.map(a=>a.id);for(const key of ['pre','post']){surveyRuntime[key].generation=(surveyRuntime[key].generation||0)+1;surveyRuntime[key].busy=false;surveyCommit(key,surveySampleFeed(key),{id:'agent_id',score:'score',timestamp:'timestamp'},100,'',true);surveySource(key).auto=false;}surveyState().enabled=true;surveyPersist();render()});
  if(!surveyRuntime.timer)surveyRuntime.timer=setInterval(()=>{if(page!==8||document.hidden||document.querySelector('.survey-monitor input:focus,.survey-monitor textarea:focus,.survey-monitor select:focus'))return;for(const key of ['pre','post']){const s=surveySource(key),r=surveyRuntime[key];if(s.auto&&!s.demo&&!r.preview&&Date.now()>=(r.next||0))surveyRefresh(key)}},1000);
}
