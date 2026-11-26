const HARD_SKILL_SERIES = {
 offlineBadTicket:'is-offline', onlineBadTicket:'is-online-bad', onlineAcsIBooster:'is-online-acs', other:'is-other',
};
const hardSkillSelection = {bucket:'',breakdown:''};
const hardSkillResults = new Map();
let hardSkillLastQuery = '';
let hardSkillSessionsOpen = false;
let hardSkillEvaluationOpen = false;
const hardSkillTicketOpen = new Set(['contact-performance','ecare-performance']);
let hardSkillGrapariService = 'Fixed';
const hardSkillGrapariDrills = new Map();
let hardSkillNavigateToTickets = false;

const hardSkillNumber = new Intl.NumberFormat('id-ID');
const hardSkillScore = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
const hardSkillDateFormat = new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const HARD_SKILL_OFFLINE_ICON = 'm2 9 10-5 10 5-10 5-10-5Zm4 2v5l6 3 6-3v-5m4-2v6';
const HARD_SKILL_ONLINE_ICON = 'M3 5h18v12H3zM8 21h8m-4-4v4m-2-13 5 3-5 3Z';
const HARD_SKILL_LOCATION_ICON = 'M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z';
const HARD_SKILL_TICKET_ICON = 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Zm12 3v1m0 4v1';
const HARD_SKILL_CHART_ICON = 'M3 3v17h18M8 15v-4m5 4V7m5 8V5';

function hardSkillIconLabel(label,icon) {
 return icon ? `<span class="hard-skill-label">${dashboardChannelIcon(icon)}${el(label)}</span>` : el(label);
}

const hardSkillDate = key=>new Date((key.length===7?key+'-01':key)+'T00:00:00Z');
const hardSkillMonthLabel = key=>dashboardTrialFormatMonth(key);
const hardSkillCount = (value,unit)=>`${hardSkillNumber.format(value)} ${unit}`;
const hardSkillShare = (value,total)=>`${hardSkillScore.format(total?100*value/total:0)}%`;

function hardSkillPeriod() {
 return [reportFrom.slice(0,7),reportTo.slice(0,7)];
}

function hardSkillMoM() {
 const [start,end] = hardSkillPeriod();
 if (start!==end || dashboardTrialWindow==='ytd') return null;
 const prior = hardSkillDate(end);
 prior.setUTCMonth(prior.getUTCMonth()-1);
 const previous = prior.toISOString().slice(0,7);
 return {current:end,previous,label:dashboardCompareMonths(end,previous)};
}

function hardSkillDateCoverage(dates) {
 if (!dates) return '';
 const {from,to} = dates;
 const start = hardSkillDate(from);
 const end = hardSkillDate(to);
 if (from===to) return hardSkillDateFormat.format(end);
 return from.slice(0,7)===to.slice(0,7) ? `${start.getUTCDate()}–${hardSkillDateFormat.format(end)}` : hardSkillDateFormat.formatRange(start,end);
}

function resetHardSkillDrilldown() {
 Object.assign(hardSkillSelection,{bucket:'',breakdown:''});
 hardSkillSessionsOpen = false;
}

function hardSkillMovement(value,prior,unit,{lowerIsBetter=false,compact=false}={}) {
 const change = dashboardMoMChange(value,prior,{lowerIsBetter});
 if (!change) return '';
 const amount = hardSkillScore.format(change.amount);
 const priorValue = unit==='pp' ? `${hardSkillScore.format(prior)}%` : `${hardSkillScore.format(prior)} ${unit}`;
 const direction = `${change.direction} ${amount} ${unit==='pp'?'poin persentase':unit}`;
 return `<small class="hard-skill-change" title="Sebelumnya ${priorValue}"><b class="dashboard-mom-value ${change.tone}" aria-label="${direction}">${change.symbol} ${amount}${compact?'':` ${unit}`}</b></small>`;
}

function hardSkillKpis({totals,methods,priorParticipation,trainingBreakdowns,priorTrainingBreakdowns},showMoM) {
 const {attendance,participants,sessions} = totals;
 const {Offline,Online} = methods;
 const prior = showMoM ? priorParticipation : null;
 const national = ctp==='All CTPs';
 const bootcamp = trainingBreakdowns.bootcamp;
 const refreshment = trainingBreakdowns.refreshment.programs || trainingBreakdowns.refreshment;
 const priorPrograms = showMoM ? priorTrainingBreakdowns : null;
 const bootcampSessions = national ? bootcamp.sessions : Offline.sessions;
 const otherSessions = sessions-bootcampSessions-Online.sessions;
 const split = `${bootcampSessions} Bootcamp · ${Online.sessions} Refreshment${otherSessions>0?` · ${otherSessions} sesi lain`:''}`;
 const icons = [
  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m1-15a3 3 0 0 1 0 6m5 9v-2a4 4 0 0 0-3-4"/>',
  `<path d="${HARD_SKILL_OFFLINE_ICON}"/>`,
  `<path d="${HARD_SKILL_ONLINE_ICON}"/>`,
 ];
 const metrics = national ? [
  ['Total Sesi',sessions,'sesi',split,prior?.totals.sessions],
  ['Total Peserta',participants,'peserta unik',hardSkillCount(attendance,'kehadiran'),prior?.totals.participants],
  ['Peserta Bootcamp Hard Skill Mobile & Fixed',bootcamp.participants,'peserta unik','Offline',priorPrograms?.bootcamp.participants],
  ['Peserta Refreshment Bad Ticket & ACS iBooster',refreshment.participants,'peserta unik','Online',priorPrograms?.refreshment.programs?.participants],
 ] : [
  ['Total sesi',sessions,'sesi',`${Offline.sessions} Bootcamp · ${Online.sessions} Refreshment`,prior?.totals.sessions],
  ['Total peserta',participants,'peserta unik',hardSkillCount(attendance,'kehadiran'),prior?.totals.participants],
  ['Bootcamp · Offline',Offline.participants,'peserta unik',hardSkillCount(Offline.attendance,'kehadiran'),prior?.methods.Offline.participants],
  ['Refreshment · Online',Online.participants,'peserta unik',hardSkillCount(Online.attendance,'kehadiran'),prior?.methods.Online.participants],
 ];
 return `<section class="hard-skill-kpi-group" aria-labelledby="hard-skill-kpi-title">
 <h4 id="hard-skill-kpi-title">${hardSkillIconLabel('KPI Training Hard Skill',HARD_SKILL_CHART_ICON)}</h4>
 <div class="hard-skill-kpis">${metrics.map(([label,value,unit,note,previous],index)=>{
  const lowerIsBetter = unit==='peserta unik';
  const tone = dashboardMoMChange(value,previous,{lowerIsBetter})?.tone || '';
  return `<article class="hard-skill-kpi"><h4><svg class="hard-skill-kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[index]}</svg>${el(label)}</h4>
   <div class="hard-skill-kpi-measure"><strong class="dashboard-mom-value ${tone}">${hardSkillNumber.format(value)} <span>${unit}</span></strong>
    ${hardSkillMovement(value,previous,unit,{compact:true,lowerIsBetter})}</div><small>${el(note)}</small>
  </article>`;
 }).join('')}</div>
 <p class="hard-skill-kpi-note">Peserta yang mengikuti kedua metode dihitung sekali pada Total peserta.</p></section>`;
}

function hardSkillChart(report,active) {
 const buckets = report.timeline.months;
 const maximum = Math.max(1,...buckets.map(bucket=>bucket.attendance));
 const magnitude = 10**Math.floor(Math.log10(maximum));
 const scale = Math.ceil(maximum/magnitude)*magnitude;
 const classes = key=>HARD_SKILL_SERIES[key] || 'is-other';
 return `<section class="hard-skill-panel"><header><h4>Kehadiran per bulan</h4>
  <p>Pilih bulan untuk melihat perubahan dan rincian sesi.</p></header>
  <div class="hard-skill-legend" aria-label="Materi dan metode">${report.series.map(({key,label})=>`<span class="${classes(key)}">${el(label)}</span>`).join('')}</div>
  <div class="hard-skill-chart"><div class="hard-skill-chart-columns" style="--columns:${buckets.length}">${buckets.map(({key,attendance,bySeries})=>{
   const label = `${hardSkillMonthLabel(key)}, ${hardSkillCount(attendance,'kehadiran')}`;
   const title = report.series.map(series=>`${series.label} ${hardSkillNumber.format(bySeries[series.key] || 0)}`).join(' · ');
   return `<button type="button" id="hard-skill-bucket-${key}" class="hard-skill-chart-column${key===active?' is-active':''}" data-hard-skill-bucket="${key}"
    aria-pressed="${hardSkillSelection.bucket===key}" aria-label="${el(label)}" title="${el(title)}">
    <strong class="hard-skill-chart-total">${hardSkillNumber.format(attendance)}</strong>
    <span class="hard-skill-chart-stack" aria-hidden="true">${report.series.map(({key})=>
     bySeries[key]?`<i class="${classes(key)}" style="--height:${100*bySeries[key]/scale}%"></i>`:'').join('')}</span>
    <span class="hard-skill-chart-label">${dashboardTrialShortMonth.format(hardSkillDate(key))}</span></button>`;
  }).join('')}</div></div>
  ${active?`<p class="hard-skill-selection">${el(hardSkillMonthLabel(active))} · ${hardSkillCount(buckets.find(bucket=>bucket.key===active)?.attendance || 0,'kehadiran')}</p>`:''}
 </section>`;
}

function hardSkillSiteLabel(label) {
 return {'Site 1':'Site 1 Bandung','Site 2':'Site 2 Semarang'}[label] || label;
}

function hardSkillBreakdownButton(id,{label,participants,sessions,attendance},filters,{note='',previous,preferParticipants=false,icon,channels}={}) {
 const scope = JSON.stringify({label,...filters});
 const unique = preferParticipants || attendance===participants;
 const unit = unique?'peserta unik':'kehadiran';
 const count = unique?participants:attendance;
 const prior = previous ? (unique?previous.participants:previous.attendance) ?? 0 : null;
 const tone = dashboardMoMChange(count,prior,{lowerIsBetter:unique})?.tone || '';
 const channelTags = channels?.length ? `<span class="hard-skill-channel-tags">${channels.map(({channel:ch,participants:p,sessions:s})=>
  `<span class="hard-skill-channel-tag" data-channel="${el(ch)}"><span class="hard-skill-channel-name">${el(ch)}</span><span class="hard-skill-channel-metrics"><b>${hardSkillNumber.format(p)}</b> <small>peserta</small> · <b>${hardSkillNumber.format(s)}</b> <small>sesi</small></span></span>`).join('')}</span>` : '';
 return `<button type="button" id="${el(id)}" class="hard-skill-summary-item" data-hard-skill-breakdown="${el(scope)}"
  aria-pressed="${hardSkillSelection.breakdown===scope}" aria-controls="hard-skill-session-details">
  <strong>${hardSkillIconLabel(label,icon)}</strong><span class="hard-skill-summary-headline"><b class="dashboard-mom-value ${tone}">${hardSkillCount(count,unit)}</b>
   ${hardSkillMovement(count,prior,unit,{compact:true,lowerIsBetter:unique})} <b class="hard-skill-session-count">${hardSkillCount(sessions,'sesi')}</b></span>
  ${attendance!==participants?`<small>${unique?hardSkillCount(attendance,'kehadiran'):hardSkillCount(participants,'peserta unik')}</small>`:''}
  ${note?`<small>${el(note)}</small>`:''}
  ${channelTags}
 </button>`;
}

function hardSkillTrainingSummary({bootcamp,refreshment,contactCenter,callCenter,eCare},channel,prior,kpisHtml='') {
 const national = ctp==='All CTPs';
 const groupPanel = (title,channel,body,icon=HARD_SKILL_ONLINE_ICON)=>`<section class="hard-skill-summary-panel" data-report-channel="${el(channel)}">
  <header><span class="hard-skill-summary-icon">${dashboardChannelIcon(icon)}</span><h4>${el(title)}</h4></header><div class="hard-skill-summary-body">${body}</div>
 </section>`;
 const priorEntry = (groups,key,value)=>groups ? groups.find(group=>group[key]===value) || {} : null;
 const locations = (groups,prefix,filters,priorLocations)=>`<div class="hard-skill-summary-items">${groups.map((group,index)=>
  hardSkillBreakdownButton(`hard-skill-${prefix}-${index}`,{...group,label:hardSkillSiteLabel(group.label)},
   {...filters,place:group.key},{previous:priorEntry(priorLocations,'key',group.key),preferParticipants:national,
    icon:HARD_SKILL_LOCATION_ICON})).join('')}</div>`;
 const fact = (label,description,icon)=>`<p class="hard-skill-summary-fact"><strong>${hardSkillIconLabel(label,icon)}</strong> ${el(description)}</p>`;
 const emptyEntry = (label,icon)=>`<div class="hard-skill-summary-program"><strong>${hardSkillIconLabel(label,icon)}</strong><span>Belum ada sesi dalam filter</span></div>`;
 if (national) {
  const areas = ['Area 1','Area 2','Area 3','Area 4'];
  const buildingIcon = DASH_CHANNELS.find(item=>item.label==='GraPARI').icon;
  const supportIcon = DASH_CHANNELS.find(item=>item.label==='Call Center').icon;
  const bookIcon = 'M12 5v15M3 4h5l4 2 4-2h5v14h-5l-4 2-4-2H3z';
  const activeAreas = areas.flatMap(label=>{
   const group = bootcamp.locations.find(item=>item.label===label && (item.participants || item.attendance));
   return group ? [group] : [];
  });
  const offline = groupPanel('Bootcamp Hard Skill - Offline','GraPARI',
   `<div class="hard-skill-summary-items">${activeAreas.length ? activeAreas.map((group,index)=>
    hardSkillBreakdownButton(`hard-skill-bootcamp-${index}`,group,
     {method:'Offline',channels:['GraPARI'],place:group.key},
     {previous:priorEntry(prior?.bootcamp.locations,'key',group.key),preferParticipants:true,icon:buildingIcon})
   ).join('') : emptyEntry('Semua Area',buildingIcon)}</div>
   <div class="hard-skill-summary-facts">
    ${fact('Peserta menurut Fungsi Kerja',bootcamp.roles.map(({label,participants})=>`${label} [${hardSkillNumber.format(participants)}]`).join(' · ') || 'Belum ada data',DASHBOARD_CSR_ICON_PATH)}
    ${fact('Materi',bootcamp.materials.map(({label})=>label).join(' · ') || 'Belum ada data',bookIcon)}
   </div>`+
   (bootcamp.materials.some(({label})=>label==='Bad Ticket')?
    fact('Topik Bootcamp','SOP Bad Ticket, 360 Diagnosis, Root Cause Analysis, Stuck Order, studi kasus, dan praktik penanganan.',bookIcon):''),
   HARD_SKILL_OFFLINE_ICON);
  const online = groupPanel('Refreshment - Online',channel,
   `<div class="hard-skill-summary-programs">${[['Bad Ticket','Bad Ticket',HARD_SKILL_TICKET_ICON],['ACS iBooster','Aplikasi ACS',HARD_SKILL_ONLINE_ICON]].map(([material,label,icon],index)=>{
    const group = refreshment.materials.find(item=>item.label===material);
    return group ? hardSkillBreakdownButton(`hard-skill-online-${index}`,{...group,label},{method:'Online',material},{
     note:hardSkillDateCoverage(group.dates),previous:priorEntry(prior?.refreshment.materials,'label',material),preferParticipants:true,icon,channels:group.channels})
     : emptyEntry(label,icon);
   }).join('')}</div>`);
  return `<div class="hard-skill-training-summary">${offline}${online}</div>`;
 }
 const offline = bootcamp.attendance ? groupPanel('Bootcamp Hard Skills – Offline · GraPARI','GraPARI',
  locations(bootcamp.locations,'bootcamp',{method:'Offline',channels:['GraPARI']},prior?.bootcamp.locations)+
  fact('Peserta per fungsi',bootcamp.roles.map(({label,participants})=>`${label} (${hardSkillNumber.format(participants)})`).join(' · '),DASHBOARD_CSR_ICON_PATH)+
  fact('Materi',bootcamp.materials.map(({label})=>label).join(' · '),HARD_SKILL_TICKET_ICON)+
  (bootcamp.materials.some(({label})=>label==='Bad Ticket') ?
   fact('Topik Bootcamp','SOP Bad Ticket, 360 Diagnosis, Root Cause Analysis, Stuck Order, studi kasus, dan praktik penanganan.',HARD_SKILL_OFFLINE_ICON) : ''),
  HARD_SKILL_OFFLINE_ICON
 ) : '';
 const singleContact = channel==='Call Center' ? callCenter : channel==='E-Care' ? eCare : null;
 const materials = refreshment.materials.filter(group=>!singleContact || group.label!=='Bad Ticket');
 const online = materials.length ?
  groupPanel(singleContact?'Materi Refreshment Lain – Online':'Refreshment – Online',channel,`<div class="hard-skill-summary-programs">${materials.map((group,index)=>
   hardSkillBreakdownButton(`hard-skill-online-${index}`,group,{method:'Online',material:group.label},
    {note:hardSkillDateCoverage(group.dates),previous:priorEntry(prior?.refreshment.materials,'label',group.label),icon:group.label==='Bad Ticket'?HARD_SKILL_TICKET_ICON:HARD_SKILL_ONLINE_ICON})).join('')}
   ${!singleContact && refreshment.contact.attendance?`<div class="hard-skill-summary-program"><strong>Contact Center &amp; E-Care</strong>
    <span>${hardSkillCount(refreshment.contact.attendance,'kehadiran')} dalam rekap Online · ${hardSkillCount(refreshment.contact.participants,'peserta unik')}</span>
    <small>${el(refreshment.contact.locations.map(group=>`${hardSkillSiteLabel(group.label)} ${hardSkillCount(group.attendance,'kehadiran')}`).join(' · '))}</small></div>`:''}
   </div>`) : '';
 const contact = singleContact || contactCenter;
 const priorContact = !singleContact ? prior?.contactCenter : channel==='E-Care' ? prior?.eCare : prior?.callCenter;
 const contactChannel = channel==='E-Care'?'E-Care':'Call Center';
 const contactTitle = channel==='E-Care'?'Refreshment E-Care – Online':channel==='Call Center'?'Refreshment Call Center – Online':'Refreshment Contact Center – Online';
 const contactPanel = contact.attendance?groupPanel(contactTitle,contactChannel,
  locations(contact.locations,'contact',{method:'Online',channels:singleContact?[channel]:['Call Center','E-Care'],material:'Bad Ticket'},priorContact?.locations)+
  fact('Total peserta',`${hardSkillCount(contact.participants,'peserta unik')} · ${hardSkillCount(contact.attendance,'kehadiran')}`,DASHBOARD_CSR_ICON_PATH)+fact('Materi','Bad Ticket',HARD_SKILL_TICKET_ICON)):'';
 const panels = singleContact ? [contactPanel,online].filter(Boolean) : [offline,online,contactPanel].filter(Boolean);
 if (singleContact && kpisHtml && contactPanel) {
  return `<div class="hard-skill-national-top">${kpisHtml}${contactPanel}</div>${online?`<div class="hard-skill-training-summary">${online}</div>`:''}`;
 }
 return (kpisHtml || '') + (panels.length?`<div class="hard-skill-training-summary">${panels.join('')}</div>`:'');
}

function hardSkillDetails(report) {
 const {bucket,breakdown} = hardSkillSelection;
 const selected = breakdown ? JSON.parse(breakdown) : {};
 const rows = report.details.filter(row=>(!bucket || row.date.slice(0,7)===bucket) &&
  (!selected.place || row.place===selected.place) && (!selected.method || row.method===selected.method) &&
  (!selected.material || row.material===selected.material) && (!selected.channels || selected.channels.includes(row.channel)));
 const label = [bucket?hardSkillMonthLabel(bucket):'',selected.label].filter(Boolean).join(' · ');
 const count = rows.reduce((total,row)=>total+row.attendance,0);
 const columns = [
  ['Tanggal',row=>hardSkillDateFormat.format(hardSkillDate(row.date))],['Batch',row=>row.batch],['Materi',row=>row.title || row.material],
  ['Metode',row=>row.method],['Fungsi kerja',row=>row.function],['Area/Site',row=>row.placeLabel],
  ...(rows.some(row=>row.region)?[['Regional',row=>row.region]]:[]),...(rows.some(row=>row.unit)?[['Unit',row=>row.unit]]:[]),
  ['Kehadiran',row=>hardSkillNumber.format(row.attendance)],
 ];
 return `<details class="hard-skill-evaluation" id="hard-skill-session-details" data-hard-skill-details${hardSkillSessionsOpen?' open':''}>
  <summary id="hard-skill-detail-summary">Rincian sesi · ${label?`${el(label)} · `:''}${hardSkillCount(count,'kehadiran')}</summary>
  ${rows.length?`<div class="hard-skill-table-wrap" tabindex="0" role="region" aria-label="Tabel rincian sesi"><table class="hard-skill-table">
   <thead><tr>${columns.map(([name])=>`<th scope="col">${name}</th>`).join('')}</tr></thead>
   <tbody>${rows.map(row=>`<tr>${columns.map(([,read])=>`<td>${el(read(row) || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:
   '<p class="hard-skill-empty">Data sesi belum tersedia untuk pilihan ini.</p>'}</details>`;
}

function hardSkillEvaluation({pairs,pre,post,surveySubmitted,surveyRecorded},period) {
 const gain = pairs ? Math.round((post-pre)*10)/10 : 0;
 return `<details class="hard-skill-evaluation" data-hard-skill-eval${hardSkillEvaluationOpen?' open':''}>
  <summary id="hard-skill-eval-summary">Pre-test &amp; Post-test · ${el(period)}</summary>
  ${pairs?`<p><strong>${hardSkillCount(pairs,'pasangan tes')}</strong> dari peserta dan sesi yang sama · <b class="${gain>0?'is-up':gain<0?'is-down':''}">${gain>0?'▲':gain<0?'▼':'→'} ${hardSkillScore.format(Math.abs(gain))} poin</b></p>
   ${hardSkillReportBars([['Pre-test',pre],['Post-test',post]].map(([label,count])=>({label,count})),100,'/100',hardSkillScore)}`:
   '<p>Data pasangan pre-test dan post-test belum tersedia untuk filter ini.</p>'}
  ${surveyRecorded?`<p>Survei · ${hardSkillCount(surveySubmitted,'pengisian tercatat')} pada rekap kehadiran.</p>`:'<p>Data pengisian survei belum tersedia untuk filter ini.</p>'}
 </details>`;
}

function hardSkillReportBars(rows,max,unit,format=hardSkillNumber) {
 return `<ul class="hard-skill-report-bars">${rows.map(({label,count})=>`<li>
  <span>${el(label)}</span><strong>${count==null?'Belum ada data':`${format.format(count)} ${unit}`}</strong>
  ${count!=null?`<span class="hard-skill-area-track" aria-hidden="true"><i style="--width:${100*count/max}%"></i></span>`:''}
 </li>`).join('')}</ul>`;
}

function hardSkillTicketCount(count,prior,unit,comparison,scopeDiffers=false) {
 const current = hardSkillCount(count,unit);
 if (!comparison) return `<strong>${current}</strong>`;
 const currentMonth = el(hardSkillMonthLabel(comparison.current));
 const previousMonth = el(hardSkillMonthLabel(comparison.previous));
 return `<span class="hard-skill-ticket-comparison">${prior==null
  ? `<strong>${currentMonth} ${current}</strong><small>${scopeDiffers?'Cakupan Fixed dan Mobile berbeda dari '+previousMonth:'Data pembanding '+previousMonth+' belum tersedia'}</small>`
  : `<span>${previousMonth} ${hardSkillCount(prior,unit)}</span><span aria-hidden="true">→</span>
     <strong>${currentMonth} ${current}</strong>${hardSkillMovement(count,prior,unit,{lowerIsBetter:true})}`}</span>`;
}

const hardSkillSiteAgentDrills = new Map();

function hardSkillTicketService({name,count,prior,sites=[],source,symptoms=[],agents=[]},months,comparison,channelKey='') {
 const topSymptom = symptoms[0];
 const showMoM = Boolean(comparison && months.length===1);
 const chartMonths = showMoM ? [comparison.previous,...months] : months;
 const valueAt = (site,month,index)=>showMoM && index===0 ? site.prior : site.months.find(entry=>entry.month===month)?.count ?? 0;
 const largestCount = Math.max(1,...sites.flatMap(site=>chartMonths.map((month,index)=>valueAt(site,month,index) ?? 0)));
 const monthlyGroups = chartMonths.map((month,index)=> {
  const label = hardSkillMonthLabel(month);
  return `<div class="hard-skill-ticket-month">
   <div class="hard-skill-ticket-month-bars">${sites.map(site=>{
    const raw = valueAt(site,month,index);
    const value = Number.isFinite(raw) ? raw : 0;
    const tip = Number.isFinite(raw) ? hardSkillCount(raw,'tiket') : 'Data belum tersedia';
    return `<div class="hard-skill-ticket-column" data-site="${site.key}" style="--ticket-height:${100*value/largestCount}%" title="${el(label+' · '+site.label)} · ${tip}">
     <b>${Number.isFinite(raw)?hardSkillNumber.format(raw):'—'}</b><i></i>
    </div>`;
   }).join('')}</div><small>${el(label)}</small>
  </div>`;
 }).join('');
 const drillKey = `${channelKey}:${name}`;
 const drill = hardSkillSiteAgentDrills.get(drillKey) || {};
 const selectedSite = drill.site || '';
 const siteSort = drill.sort==='asc' ? 'asc' : 'desc';
 const siteAgents = selectedSite ? agents
  .filter(row=>(row.site || row.location)===selectedSite)
  .sort((a,b)=>(siteSort==='asc'?a.count-b.count:b.count-a.count) || a.label.localeCompare(b.label,'id-ID')) : [];
 const agentList = selectedSite ? `<div class="hard-skill-gra-agent-list">
  <div class="hard-skill-gra-agent-head">
   <strong>Agen · ${el(selectedSite)} (${hardSkillNumber.format(siteAgents.length)})</strong>
   <div>
    <button type="button" class="hard-skill-gra-link" data-hard-skill-site-sort="${el(drillKey)}">${siteSort==='asc'?'Terkecil → Terbesar ↑':'Terbesar → Terkecil ↓'}</button>
    <button type="button" class="hard-skill-gra-link" data-hard-skill-site-agent="${el(selectedSite)}" data-hard-skill-site-key="${el(drillKey)}">Tutup ✕</button>
   </div>
  </div>
  ${siteAgents.length?`<div class="hard-skill-slide-table-wrap" tabindex="0"><table class="hard-skill-slide-table">
   <thead><tr><th scope="col">No</th><th scope="col">Nama</th><th scope="col">Tiket</th></tr></thead>
   <tbody>${siteAgents.map((row,index)=>`<tr><td>${index+1}</td><th scope="row">${el(row.label)}</th><td>${hardSkillNumber.format(row.count)}</td></tr>`).join('')}</tbody>
  </table></div>`:'<p class="hard-skill-slide-empty">Belum ada data nama agen untuk site ini.</p>'}
 </div>` : '';
 return `<section class="hard-skill-ticket-service" data-hard-skill-service-card="${el(drillKey)}">
  <header><div><h6>Bad Ticket ${el(name)}</h6>${source? `<small>${el(source)}</small>`:''}</div>
   ${count!=null ? hardSkillTicketCount(count,prior,'tiket',comparison) : ''}</header>
  ${sites.length ? `<div class="hard-skill-ticket-service-body">
   <div class="hard-skill-ticket-chart" aria-hidden="true">
    <div class="hard-skill-ticket-key">${sites.map(({key,label})=>`<span data-site="${key}">${el(label)}</span>`).join('')}</div>
    <div class="hard-skill-ticket-months" style="--ticket-months:${chartMonths.length}">${monthlyGroups}</div>
   </div>
   <div class="hard-skill-ticket-site-detail">
    <div class="hard-skill-ticket-site-cards">${sites.map(({key,label,count:siteTotal,prior:sitePrior,months:siteMonths})=>{
     const siteMoM = comparison && Number.isFinite(sitePrior) ? hardSkillMovement(siteTotal,sitePrior,'tiket',{lowerIsBetter:true,compact:true}) : '';
     const isSelected = selectedSite===label;
     const cardBody = `<h6>${el(label)}</h6><p><strong>${hardSkillCount(siteTotal,'tiket')}</strong>${sites.length>1?` · ${hardSkillShare(siteTotal,count)}`:''}${siteMoM?` ${siteMoM}`:''}</p>
      ${showMoM?`<dl><div><dt>${el(hardSkillMonthLabel(comparison.previous))}</dt><dd>${Number.isFinite(sitePrior)?hardSkillNumber.format(sitePrior):'—'}</dd></div><div><dt>${el(hardSkillMonthLabel(months[0]))}</dt><dd>${hardSkillNumber.format(siteTotal)}</dd></div></dl>`
       :siteMonths.length>1?`<dl>${siteMonths.map(({month,count})=>`<div><dt>${el(hardSkillMonthLabel(month))}</dt><dd>${hardSkillNumber.format(count)}</dd></div>`).join('')}</dl>`:''}
      ${agents.length?'<small class="hard-skill-site-click-hint">Klik untuk lihat agen</small>':''}`;
     return agents.length
      ? `<button type="button" class="hard-skill-ticket-site-btn" data-site="${key}" data-hard-skill-site-agent="${el(label)}" data-hard-skill-site-key="${el(drillKey)}" aria-pressed="${isSelected}">${cardBody}</button>`
      : `<article data-site="${key}">${cardBody}</article>`;
    }).join('')}</div>
    ${agentList}
    <dl class="hard-skill-ticket-facts">
     <div><dt>KIP Symptom teratas</dt><dd>${topSymptom?`${el(topSymptom.label)} · ${hardSkillCount(topSymptom.count,'tiket')}`:'—'}</dd></div>
    </dl>
   </div>
  </div>` : `<p class="hard-skill-slide-empty">${count==null?'Data belum tersedia untuk filter ini.':'Tidak ada tiket di lokasi ini.'}</p>`}
 </section>`;
}

function hardSkillTicketPerformance({services=[]}={},comparison,channelKey='') {
 return `<section class="hard-skill-ticket-performance">
  ${['Fixed','Mobile'].map(name=>{
   const service = services.find(item=>item.name===name) || {name};
   return hardSkillTicketService(service,service.months || [],comparison,channelKey);
  }).join('')}
 </section>`;
}

function hardSkillTicketAgentRanking({agents,agentsAfterTraining,agentCoverage}) {
 if (!agents) return '';
 const heading = 'Top 5 Agen dengan Bad Ticket';
 return `<section class="hard-skill-ticket-wide hard-skill-ticket-agent-ranking">
  <h5>${agentsAfterTraining?heading+' Setelah Training':'Bad Ticket Setelah Training'}</h5>
  ${agentCoverage?.withSiad?`<p>Dari <strong>${hardSkillCount(agentCoverage.withSiad,'tiket unik dengan SIAD')}</strong>,
   ${hardSkillCount(agentCoverage.matched,'tiket')} bisa dicocokkan ke peserta dan punya tanggal pembuatan yang terbaca.
   <strong>${hardSkillCount(agentCoverage.afterTraining,'tiket')}</strong> dibuat setelah kehadiran pertama di training Bad Ticket pada kanal yang sama.</p>`:''}
  ${agentsAfterTraining?'':'<p>Belum ada tiket yang terverifikasi terjadi setelah training untuk filter ini.</p>'}
  ${agents.length?`${agentsAfterTraining?'':`<h5>${heading} · Semua Agen Tercatat</h5>`}
   <div class="hard-skill-table-wrap"><table class="hard-skill-table" aria-label="${heading}${agentsAfterTraining?' Setelah Training':''}">
    <thead><tr><th scope="col">Agen</th><th scope="col">Unit / Site</th><th scope="col">Tiket unik</th></tr></thead>
    <tbody>${agents.map(({label,location,count})=>`<tr><td>${el(label)}</td><td>${el(location || 'Belum tercatat')}</td>
     <td>${hardSkillNumber.format(count)}</td></tr>`).join('')}</tbody>
   </table></div>`:''}
 </section>`;
}

const hardSkillPptPeriod = 'Referensi PPT · Agustus–Oktober 2026';
const hardSkillWorkbookSource = 'Workbook Bad Ticket';

function hardSkillMobileCoverage(report) {
 const cutoff = report?.mobileTicketThrough;
 return cutoff ? `<p>Tanggal tiket Mobile terakhir di workbook · ${el(hardSkillDateFormat.format(hardSkillDate(cutoff)))}</p>` : '';
}

function hardSkillSlideDisclosure(id,title,subline,body) {
 return `<details class="hard-skill-slide" data-hard-skill-ticket="${id}"${hardSkillTicketOpen.has(id)?' open':''}>
  <summary id="hard-skill-slide-${id}"><span><strong>${el(title)}</strong><small>${el(subline)}</small></span></summary>
  <div class="hard-skill-slide-body">${body}</div></details>`;
}

const hardSkillSlideValue = value => value==null?'—':value?.html || (typeof value==='number'?hardSkillNumber.format(value):el(value));

function hardSkillSlideTable(title,headers,rows,{source='',alignRows=false,emptyText='Data belum tersedia untuk filter ini.'}={}) {
 const tableRole = name=>alignRows?` role="${name}"`:'';
 return `<section class="hard-skill-slide-card"${alignRows?' data-aligned-ranks':''}><header><h5>${el(title)}</h5>${source?`<small>${el(source)}</small>`:''}</header>
  ${rows.length?`<div class="hard-skill-slide-table-wrap" tabindex="0" role="region" aria-label="${el(title)}"><table class="hard-skill-slide-table"${tableRole('table')}>
   <thead${tableRole('rowgroup')}><tr${tableRole('row')}>${headers.map(label=>`<th scope="col"${tableRole('columnheader')}>${el(label)}</th>`).join('')}</tr></thead>
   <tbody${tableRole('rowgroup')}>${rows.map(row=>`<tr${tableRole('row')}><th scope="row"${tableRole('rowheader')}>${hardSkillSlideValue(row[0])}</th>
    ${row.slice(1).map(value=>`<td${tableRole('cell')}>${hardSkillSlideValue(value)}</td>`).join('')}</tr>`).join('')}</tbody>
   </table></div>`:`<p class="hard-skill-slide-empty">${el(emptyText)}</p>`}</section>`;
}

function hardSkillSitePerformanceNotes(ticket,comparison) {
 if (!ticket) return '';
 const services = ticket.performance?.services || [];
 const leader = ticket.locations?.[0];
 const category = ticket.categoryMonths?.[0] || ticket.categories?.[0];
 const increases = comparison ? services.filter(({prior,count})=>prior!=null && count>prior) : [];
 const tierThree = ticket.tiers?.[0]?.slice(3).reduce((total,count)=>total+(count || 0),0);
 const summaryItems = [
  ...services.filter(s=>s.count!=null).map(({name,count})=>({
   icon:HARD_SKILL_TICKET_ICON,
   label:`Bad Ticket ${name}`,
   text:`Mencatat ${hardSkillCount(count,'tiket')} pada periode ini.`,
  })),
  leader?.count ? {
   icon:HARD_SKILL_LOCATION_ICON,
   label:'Site Tertinggi',
   text:`${leader.label} mencatat volume tertinggi (${hardSkillCount(leader.count,'tiket')}).`,
  } : null,
 ];
 const painItems = [
  ...increases.map(service=>({
   icon:HARD_SKILL_TICKET_ICON,
   label:`Kenaikan ${service.name}`,
   text:`Naik ${hardSkillCount(service.count-service.prior,'tiket')} dibanding bulan sebelumnya.`,
  })),
  category?.count ? {
   icon:HARD_SKILL_CHART_ICON,
   label:'Kategori Terbanyak',
   text:`${category.label} menjadi kategori terbanyak (${hardSkillCount(category.count,'tiket')}).`,
  } : null,
 ];
 const actionItems = [
  {
   icon:HARD_SKILL_ONLINE_ICON,
   label:'Fokus Refreshment',
   text:category?.count ? `Tinjau sampel tiket kategori ${category.label} untuk menentukan fokus refreshment.` : 'Tinjau sampel tiket pada site dengan volume tertinggi.',
  },
  ...(tierThree ? [{
   icon:HARD_SKILL_LOCATION_ICON,
   label:'Prioritas Tier 3',
   text:'Prioritaskan review berulang untuk agen di Tier 3.',
  }] : []),
  {
   icon:HARD_SKILL_CHART_ICON,
   label:'Monitoring Bulanan',
   text:'Pantau tren MoM Bad Ticket pada site terkait setelah sesi refreshment.',
  },
 ];
 if (!summaryItems.length && !painItems.length) return '';
 return hardSkillExecutiveCards(`Executive Training · ${ticket.channel}`,summaryItems,painItems,actionItems);
}

function hardSkillSitePerformance(ticket,period,comparison) {
 const monthHeaders = ticket.months.map(({month})=>dashboardShortMonth(month));
 const priorMonth = ticket.tableComparison?.previous;
 const showPrior = priorMonth && !ticket.months.some(({month})=>month===priorMonth);
 const headers = [...(showPrior?[dashboardShortMonth(priorMonth)]:[]),...monthHeaders,'MoM'];
 const movement = row=>({html:hardSkillMovement(row.momCurrent,row.momPrior,'tiket',{lowerIsBetter:true,compact:true}) || '—'});
 const categories = hardSkillSlideTable('Top 5 Bad Ticket per Category',['Kategori',...headers],
  (ticket.categoryMonths || []).map(row=>[row.label,...(showPrior?[row.momPrior]:[]),...row.months.map(month=>month.count),movement(row)]),
  {source:'Periode Input · Klasifikasi Unit Creator · Kategori Bad Tiket'});
 const agents = hardSkillSlideTable('Top 5 Agent Most Bad Ticket After Training',['Agent Name','Site',...headers],
  (ticket.afterTrainingAgents || []).map(row=>[row.label,row.location,...(showPrior?[row.momPrior]:[]),...row.months.map(month=>month.count),movement(row)]),
  {source:'Tiket unik Fixed setelah kehadiran pertama di training Bad Ticket',emptyText:'Belum ada tiket yang terverifikasi setelah training untuk filter ini.'});
 const id = ticket.channel==='Call Center' ? 'contact-performance' : 'ecare-performance';
 return hardSkillSlideDisclosure(id,`${ticket.channel} Bad Ticket Performance`,comparison?.label || period,`
  <div class="hard-skill-site-performance">${hardSkillTicketPerformance(ticket.performance,comparison,ticket.channel)}</div>
  <div class="hard-skill-site-only-tables">${categories}${agents}</div>`);
}

function hardSkillGrapariScope() {
 const filters = new URLSearchParams(localLearningQuery());
 const areas = filters.get('area') || filters.getAll('reportArea').filter(label=>label.startsWith('Area ')).join(', ');
 return [areas,area==='All Areas'?'':area,filters.get('region'),filters.get('unit')].filter(Boolean).join(' · ') || 'Nasional';
}

function hardSkillGrapariAreaChart(areas,months,group='area',comparison=null,selectedArea='') {
 if (!areas.length || !months.length) return '';
 const ordered = [...areas].sort((a,b)=>a.label.localeCompare(b.label,'id-ID',{numeric:true}));
 const showComparison = Boolean(comparison && months.length===1 && ordered.some(row=>Number.isFinite(row.prior)));
 const seriesMonths = showComparison ? [{month:comparison.previous,prior:true},...months.map(({month})=>({month}))] : months.map(({month})=>({month}));
 const valueFor = (row,entry)=>entry.prior ? row.prior : row.months.find(item=>item.month===entry.month)?.count;
 const largest = Math.max(1,...ordered.flatMap(row=>seriesMonths.map(entry=>valueFor(row,entry) ?? 0)));
 const groupWidth = Math.max(48,seriesMonths.length*22-3);
 return `<div class="hard-skill-gra-chart" role="region" aria-label="Grafik volume tiket per ${group}" tabindex="0">
  <ul class="hard-skill-gra-plot" style="--area-count:${ordered.length};--series-count:${seriesMonths.length};--group-width:${groupWidth}px">
   ${ordered.map(row=>{
    const current = row.months.find(item=>item.month===months[0].month)?.count;
    const mom = showComparison ? hardSkillMovement(current,row.prior,'tiket',{lowerIsBetter:true,compact:true}) : '';
    const active = selectedArea===row.label;
    const bars = `<ul class="hard-skill-gra-plot-bars">${seriesMonths.map(entry=>{
     const count = valueFor(row,entry) ?? 0;
     const label = `${hardSkillMonthLabel(entry.month)} · ${hardSkillCount(count,'tiket')}`;
     return `<li title="${el(label)}" aria-label="${el(label)}" style="--bar-height:${100*count/largest}%"><b>${hardSkillNumber.format(count)}</b><i aria-hidden="true"></i></li>`;
    }).join('')}</ul>
    ${seriesMonths.length>1?`<div class="hard-skill-gra-plot-months" aria-hidden="true">${seriesMonths.map(({month})=>
     `<span>${el(dashboardTrialShortMonth.format(hardSkillDate(month)))}</span>`).join('')}</div>`:''}
    <strong>${el(row.label)}</strong>${mom?`<small class="hard-skill-gra-plot-mom">${mom}</small>`:''}`;
    return `<li class="hard-skill-gra-plot-group">
    ${group==='area'?`<button type="button" class="hard-skill-gra-area-btn" data-hard-skill-gra-area="${el(row.label)}" aria-pressed="${active}" title="Lihat daftar agen ${el(row.label)}">${bars}</button>`:bars}
   </li>`;
   }).join('')}
  </ul>
 </div>`;
}

function hardSkillGrapariDistribution({title,group,rows,total,source,action,back},comparison,ascending) {
 const dateColumns = comparison ? [comparison.previous,comparison.current] : total.months.map(({month})=>month);
 const includeYear = dateColumns[0].slice(0,4)!==dateColumns.at(-1).slice(0,4);
 const columnLabels = dateColumns.map(month=>includeYear?hardSkillMonthLabel(month):dashboardTrialShortMonth.format(hardSkillDate(month)));
 const values = row => comparison ? [row.prior,row.months[0].count] : row.months.map(({count})=>count);
 const largest = Math.max(1,...rows.flatMap(row=>values(row).filter(Number.isFinite)));
 const sorted = [...rows].sort((a,b)=>(ascending?a.count-b.count:b.count-a.count) || a.label.localeCompare(b.label,'id-ID',{numeric:true}));
 const rowMarkup = (row,summary=false)=>{
  const monthly = values(row);
  const heat = value=>!summary && Number.isFinite(value)?` data-heat="${Math.ceil(5*value/largest)}"`:'';
  const change = comparison ? hardSkillMovement(row.months[0].count,row.prior,'tiket',{lowerIsBetter:true,compact:true}) || '—' : '';
  const label = !summary && action
   ? `<button type="button" class="hard-skill-gra-link" data-hard-skill-gra-drill="${action}" data-location="${el(row.label)}">${el(row.label)} <span aria-hidden="true">›</span></button>`
   : el(row.label);
  return `<tr><th scope="row">${label}
   <details class="hard-skill-gra-periods"><summary>Rincian bulan</summary>
    <dl>${monthly.map((value,index)=>`<div${heat(value)}><dt>${el(columnLabels[index])}</dt><dd>${hardSkillSlideValue(value)}</dd></div>`).join('')}</dl>
   </details>
  </th>${monthly.map(value=>`<td class="hard-skill-gra-month-cell"${heat(value)}>${hardSkillSlideValue(value)}</td>`).join('')}
   ${comparison?`<td class="hard-skill-gra-mom">${change}</td>`:''}
   <td class="hard-skill-gra-qty">${hardSkillSlideValue(row.months.some(month=>month.count!=null)?row.count:null)}</td></tr>`;
 };
 return `<section class="hard-skill-slide-card hard-skill-slide-heatmap"${dateColumns.length>4?' data-many-months':''}>
  <header><h5>${el(title)}</h5><small>${el(source)}</small></header>
  <div class="hard-skill-gra-table-tools">
   ${back?`<button type="button" class="hard-skill-gra-link" data-hard-skill-gra-drill="back"><span aria-hidden="true">‹</span> ${el(back)}</button>`:''}
   ${rows.length?'<div class="hard-skill-heat-key"><span>Tiket sedikit</span><i aria-hidden="true"></i><span>Tiket banyak</span></div>':''}
  </div>
  ${rows.length?`<div class="hard-skill-slide-table-wrap" tabindex="0" role="region" aria-label="${el(title)}">
   <table class="hard-skill-slide-table"><thead><tr><th scope="col">${el(group)}</th>
    ${columnLabels.map(label=>`<th scope="col" class="hard-skill-gra-month-cell">${el(label)}</th>`).join('')}
    ${comparison?`<th scope="col" class="hard-skill-gra-mom">${el(dashboardShortComparison(comparison.previous))}</th>`:''}
    <th scope="col" class="hard-skill-gra-qty" aria-sort="${ascending?'ascending':'descending'}">
     <button type="button" class="hard-skill-gra-link" data-hard-skill-gra-drill="sort" aria-label="Urutkan Qty dari ${ascending?'terbesar':'terkecil'}">
      Qty <span aria-hidden="true">${ascending?'↑':'↓'}</span></button></th>
   </tr></thead><tbody>${sorted.map(row=>rowMarkup(row)).join('')}</tbody>
   <tfoot>${rowMarkup({...total,label:'Grand Total'},true)}</tfoot></table></div>`
   :`<p class="hard-skill-slide-empty" tabindex="-1" data-hard-skill-gra-empty>${back?'Rincian workbook belum tersedia untuk pilihan ini.':'Data belum tersedia untuk filter ini.'}</p>`}
 </section>`;
}

function hardSkillGrapariOverview(report,comparison) {
 const {service,months,prior,priorFromPpt,localMonths,pptMonths,areas,regions} = report;
 const path = hardSkillGrapariDrills.get(service);
 const selectedRegion = regions.find(row=>row.label===path?.region);
 const selectedUnit = selectedRegion?.units?.find(row=>row.label===path?.unit);
 const active = selectedUnit || selectedRegion || report;
 const covered = active.months.filter(month=>month.count!=null);
 const referenceMonths = [...(priorFromPpt && comparison ? [comparison.previous] : []),...pptMonths];
 const hasWorkbook = localMonths.length || (comparison && prior!=null && !priorFromPpt);
 const source = referenceMonths.length
  ? [hasWorkbook?'Workbook lokal':'',`PPT · ${referenceMonths.map(hardSkillMonthLabel).join(' · ')}`].filter(Boolean).join(' + ')
  : 'Workbook lokal';
 const table = selectedUnit
  ? {title:`Bad Ticket per Kategori · ${selectedUnit.label}`,group:'Kategori',rows:selectedUnit.categories || [],total:selectedUnit,back:selectedRegion.label}
  : selectedRegion
   ? {title:`Unit / Site · ${selectedRegion.label}`,group:'Unit / Site',rows:selectedRegion.units || [],action:'unit',back:'Semua region'}
   : {title:'Bad Ticket Distribution per Region',group:'Region',rows:regions,total:report,action:'region'};
 if (!table.total) {
  const sumOf = select=>table.rows.reduce((sum,row)=>sum+(select(row) || 0),0);
  table.total = {
   count:sumOf(row=>row.count),
   months:months.map(({month},index)=>({month,count:localMonths.includes(month)?sumOf(row=>row.months[index].count):null})),
   prior:prior!=null && !priorFromPpt ? sumOf(row=>row.prior) : null,
  };
 }
 table.source = selectedRegion ? hardSkillWorkbookSource : source;
 const graphicalRows = selectedRegion ? [active] : areas;
 const change = comparison && covered.length ? hardSkillMovement(active.count,active.prior,'tiket',{lowerIsBetter:true}) : '';
 const scope = active.label || hardSkillGrapariScope();
 const selectedArea = !selectedRegion && path?.area ? path.area : '';
 const areaSort = path?.areaSort==='asc' ? 'asc' : 'desc';
 const areaAgents = selectedArea ? (report.agents || [])
  .filter(row=>row.area===selectedArea)
  .sort((a,b)=>(areaSort==='asc'?a.count-b.count:b.count-a.count) || a.label.localeCompare(b.label,'id-ID')) : [];
 const areaList = selectedArea ? `<div class="hard-skill-gra-agent-list">
  <div class="hard-skill-gra-agent-head">
   <strong>Agen · ${el(selectedArea)} (${hardSkillNumber.format(areaAgents.length)})</strong>
   <div>
    <button type="button" class="hard-skill-gra-link" data-hard-skill-gra-area-sort aria-label="Urutkan jumlah tiket">${areaSort==='asc'?'Terkecil → Terbesar ↑':'Terbesar → Terkecil ↓'}</button>
    <button type="button" class="hard-skill-gra-link" data-hard-skill-gra-area="${el(selectedArea)}">Tutup ✕</button>
   </div>
  </div>
  ${areaAgents.length?`<div class="hard-skill-slide-table-wrap" tabindex="0"><table class="hard-skill-slide-table">
   <thead><tr><th scope="col">No</th><th scope="col">Nama</th><th scope="col">Unit</th><th scope="col">Tiket</th></tr></thead>
   <tbody>${areaAgents.map((row,index)=>`<tr><td>${index+1}</td><th scope="row">${el(row.label)}</th><td>${el(row.location || '—')}</td><td>${hardSkillNumber.format(row.count)}</td></tr>`).join('')}</tbody>
  </table></div>`:'<p class="hard-skill-slide-empty">Belum ada data nama agen untuk area ini.</p>'}
 </div>` : '';
 return `<section class="hard-skill-slide-card"><header><h5>Total Ticket · ${el(scope)}</h5><small>${el(selectedUnit?hardSkillWorkbookSource:source)}</small></header>
  <div class="hard-skill-gra-total-body">
   <div class="hard-skill-gra-total-line">
    <strong>${covered.length?hardSkillCount(active.count,'tiket'):'—'}</strong>
    ${change?`<span>${change} <small>vs ${el(hardSkillMonthLabel(comparison.previous))}</small></span>`:''}
   </div>
   ${covered.length && graphicalRows.length?`<h6>Volume tiket ${selectedRegion?'':'<small class="hard-skill-gra-hint">· klik area untuk lihat nama</small>'}</h6>${hardSkillGrapariAreaChart(graphicalRows,covered,selectedUnit?'unit':selectedRegion?'region':'area',comparison,selectedArea)}${areaList}`:''}
   ${covered.length?'':'<p class="hard-skill-slide-empty">Data periode ini belum tersedia.</p>'}
  </div></section>${hardSkillGrapariDistribution(table,comparison,Boolean(path?.ascending))}`;
}

function hardSkillGrapariRankGrid(cards,className,alignFirstPair=false) {
 const rowCount = cards[0]?.rows.length || 0;
 const matching = group=>group.length>1 && rowCount>0 && group.every(card=>card.rows.length===rowCount);
 const alignedCount = matching(cards) ? cards.length : alignFirstPair && matching(cards.slice(0,2)) ? 2 : 0;
 return `<div class="hard-skill-gra-ranks ${className}"${alignedCount?` data-align-ranks="${alignedCount}" style="--rank-rows:${rowCount}"`:''}>
  ${cards.map(({title,headers,rows,source},index)=>hardSkillSlideTable(title,['No',...headers],
   rows.map((row,rank)=>[rank+1,...row]),{source,alignRows:index<alignedCount})).join('')}
 </div>`;
}

function hardSkillGrapariTicketBody(report,comparison) {
 const {service,months,prior,unitsByArea,unitCategories,suspects,suspectCount,symptoms,reference} = report;
 if (!months.some(month=>month.count!=null) && !(comparison && prior!=null) && !reference?.units) {
  return '<p class="hard-skill-slide-empty">Data belum tersedia untuk filter ini.</p>';
 }
 const hasLocalUnits = unitsByArea.some(({rows})=>rows.length);
 const unitGroups = hasLocalUnits || !reference?.units ? unitsByArea.map(({area,rows})=>({
  area, rows:rows.map(row=>[row.label,row.region,row.count]),
 })) : reference.units.map((rows,index)=>({area:`Area ${index+1}`,rows}));
 const unitTables = unitGroups.map(({area,rows})=>({
  title:`Top 10 GraPARI Bad-Ticket ${area}`,headers:['Unit Name','Region','Qty'],rows,
  source:hasLocalUnits?hardSkillWorkbookSource:reference?.units?hardSkillPptPeriod:'',
 }));
 const ranked = (title,headers,local,ppt)=>({
  title,headers,rows:local.length?local:ppt || [],
  source:local.length?hardSkillWorkbookSource:ppt?.length?hardSkillPptPeriod:'',
 });
 const rankings = [
  ranked('Top 10 GraPARI Bad Ticket Category',['GraPARI','Top Category each GraPARI','Area','Qty'],
   unitCategories.map(row=>[row.label,row.category,row.area,row.count]),reference?.categories),
  ranked(`Top 10${suspectCount || reference?.suspectCount ? ` dari ${hardSkillNumber.format(suspectCount || reference.suspectCount)}` : ''} Agent Suspected Bad-Ticket`,
   ['Agent CSR','GraPARI','Area','Qty'],suspects.map(row=>[row.label,row.location,row.area,row.count]),reference?.suspects),
  ranked('Top 10 KIP Symptom',['KIP Symptom','Qty'],symptoms.map(row=>[row.label,row.count]),reference?.symptoms),
 ];
 return `<div class="hard-skill-slide-gra-overview" data-hard-skill-gra-distribution="${el(service)}">${hardSkillGrapariOverview(report,comparison)}</div>
   ${hardSkillGrapariRankGrid(unitTables,'hard-skill-slide-unit-grid')}
   ${hardSkillGrapariRankGrid(rankings,'hard-skill-gra-rankings',true)}`;
}

function hardSkillGrapariTicketTabs(reports,period,comparison) {
 const services = ['Fixed','Mobile'];
 const tabId = service=>`hard-skill-gra-tab-${service.toLowerCase()}`;
 const panelId = service=>`hard-skill-gra-panel-${service.toLowerCase()}`;
 return `<div class="hard-skill-gra-tabs" role="tablist" aria-label="Layanan Bad Ticket GraPARI">
  ${services.map(service=>{
   const selected = service===hardSkillGrapariService;
   return `<button type="button" id="${tabId(service)}" role="tab" aria-selected="${selected}" aria-controls="${panelId(service)}"
    tabindex="${selected?0:-1}" data-hard-skill-gra-service="${service}">${service}</button>`;
  }).join('')}
 </div>
 ${services.map(service=>{
  const report = reports.find(item=>item.service===service);
  return `<section class="hard-skill-slide hard-skill-gra-report" id="${panelId(service)}" role="tabpanel" aria-labelledby="${tabId(service)}" tabindex="0"${service===hardSkillGrapariService?'':' hidden'}>
   <header class="hard-skill-gra-heading"><h5>Performance Bad Ticket ${service} GraPARI</h5><small>${el(period)}</small></header>
   <div class="hard-skill-slide-body">${report ? hardSkillGrapariTicketBody(report,comparison) : '<p class="hard-skill-slide-empty">Data belum tersedia untuk filter ini.</p>'}</div>
  </section>`;
 }).join('')}`;
}

function hardSkillBadTickets(reports,period,comparison,trainingReport) {
 if (!reports?.length || ctp==='All CTPs') return '';
 const displayedPeriod = el(comparison?.label || period);
 const active = reports[0];
 const slides = active.channel==='GraPARI' ? hardSkillGrapariTicketTabs(active.services || [],period,comparison)
  : '';
 const sitePerformance = active.channel==='GraPARI' ? '' : hardSkillSitePerformance(active,period,comparison);
 return `<section class="hard-skill-panel hard-skill-tickets" tabindex="-1"><header><h4>Performa Bad Ticket · ${el(dashboardChannelLabel())}</h4>
  <p>${displayedPeriod}</p>${hardSkillMobileCoverage(trainingReport)}</header>
  ${sitePerformance}${slides}
 </section>`;
}

function hardSkillExecutiveCards(title,summaryItems,painItems,actionItems) {
 const card = (heading,items,tone,icon)=>`<article class="hard-skill-panel is-${tone}"><header><h5>${hardSkillIconLabel(heading,icon)}</h5></header><ol class="hard-skill-highlight-list">${items.filter(Boolean).map(({icon:itemIcon,label,text})=>`<li><span class="hard-skill-highlight-icon">${dashboardChannelIcon(itemIcon)}</span><div><strong>${el(label)}</strong><span>${el(text)}</span></div></li>`).join('')}</ol></article>`;
 return `<section class="hard-skill-highlights hard-skill-exec-summary"><h4>${hardSkillIconLabel(title,HARD_SKILL_CHART_ICON)}</h4>
  <div class="hard-skill-exec-cols">${card('Summary',summaryItems,'summary','M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z')}
  ${card('Pain Points',painItems,'pain','M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z')}
  ${card('Action Plan / Recommendation',actionItems,'action','M4 12h15m-6-6 6 6-6 6')}</div></section>`;
}

function hardSkillGrapariNotes(report) {
 const bootcamp = report.trainingBreakdowns.bootcamp;
 const refreshment = report.trainingBreakdowns.refreshment.programs || report.trainingBreakdowns.refreshment;
 const leastReached = [...bootcamp.locations].sort((a,b)=>a.participants-b.participants)[0];
 const prior = report.priorTrainingBreakdowns?.bootcamp?.participants;
 const summaryItems = [
  {icon:HARD_SKILL_ONLINE_ICON,label:'Jangkauan Training',text:`${hardSkillCount(report.totals.sessions,'sesi')} menjangkau ${hardSkillCount(report.totals.participants,'peserta unik')} di GraPARI.`},
  {icon:HARD_SKILL_OFFLINE_ICON,label:'Bootcamp Offline',text:hardSkillCount(bootcamp.participants,'peserta unik')},
  {icon:HARD_SKILL_ONLINE_ICON,label:'Refreshment Online',text:hardSkillCount(refreshment.participants,'peserta unik')},
 ];
 const painItems = [
  leastReached ? {icon:HARD_SKILL_LOCATION_ICON,label:'Cakupan Bootcamp',text:`Peserta paling sedikit di ${leastReached.label} (${hardSkillCount(leastReached.participants,'peserta unik')}).`} : null,
  Number.isFinite(prior) && bootcamp.participants<prior ? {icon:HARD_SKILL_CHART_ICON,label:'Perubahan Peserta',text:`Peserta Bootcamp turun ${hardSkillCount(prior-bootcamp.participants,'orang')} dari bulan sebelumnya.`} : null,
 ];
 const actionItems = [
  {icon:HARD_SKILL_LOCATION_ICON,label:'Pemerataan Peserta',text:leastReached?`Tinjau kebutuhan sesi lanjutan di ${leastReached.label}.`:'Tinjau area yang belum terjangkau Bootcamp.'},
  {icon:HARD_SKILL_CHART_ICON,label:'Evaluasi Hasil',text:'Pantau kehadiran dan hasil evaluasi peserta setelah sesi training.'},
 ];
 return hardSkillExecutiveCards('Executive Training · GraPARI',summaryItems,painItems,actionItems);
}

function hardSkillHighlights(report,comparison) {
 const {bootcamp,refreshment} = report.trainingBreakdowns;
 const programs = refreshment.programs || refreshment;
 const reached = bootcamp.locations.reduce((largest,area)=>!largest || area.participants>largest.participants ? area : largest,null);
 const uncovered = bootcamp.locations.reduce((smallest,area)=>!smallest || area.participants<smallest.participants ? area : smallest,null);
 const audit = comparison ? ['badTicketFixed','badTicketMobile'].flatMap((key,index)=>
  (report.performanceAnalytics?.[key] || []).map(row=>({
   label:row.label,
   service:index===0?'Fixed':'Mobile',
   increase:row.values[0] && row.prior ? row.values[0].count-row.prior.count : 0,
  }))).filter(row=>row.increase>0).sort((a,b)=>b.increase-a.increase)[0] : null;
 const summaryItems = [
  {
   icon:HARD_SKILL_ONLINE_ICON,
   label:'Total Jangkauan',
   text:`${hardSkillCount(report.totals.sessions,'sesi')} menjangkau ${hardSkillCount(report.totals.participants,'peserta unik')} (${hardSkillCount(report.totals.attendance,'kehadiran')}).`,
  },
  {
   icon:HARD_SKILL_OFFLINE_ICON,
   label:'Bootcamp Offline',
   text:reached ? `${hardSkillCount(bootcamp.participants,'peserta unik')} · Partisipasi tertinggi di ${reached.label} (${hardSkillCount(reached.participants,'peserta')}).`
    : 'Belum ada sesi Bootcamp dalam filter ini.',
  },
  {
   icon:HARD_SKILL_TICKET_ICON,
   label:'Refreshment Online',
   text:`Bad Ticket & Aplikasi ACS menjangkau ${hardSkillCount(programs.participants,'peserta unik')}.`,
  },
 ];
 const painItems = [
  {
   icon:HARD_SKILL_LOCATION_ICON,
   label:'Cakupan Area Bootcamp',
   text:uncovered ? `Jangkauan terkecil di antara area aktif tercatat di ${uncovered.label} (${hardSkillCount(uncovered.participants,'peserta')}).`
    : 'Belum ada area aktif Bootcamp pada periode ini.',
  },
  {
   icon:HARD_SKILL_TICKET_ICON,
   label:'Tekanan Bad Ticket',
   text:audit ? `Bad Ticket ${audit.service} di ${audit.label} naik +${hardSkillNumber.format(audit.increase)} tiket dibanding bulan lalu.`
    : 'Temuan masih terpusat pada kategori teratas di Top 5 Bad Ticket Nasional.',
  },
 ];
 const actionItems = [
  {
   icon:HARD_SKILL_LOCATION_ICON,
   label:'Fokus Area Bootcamp',
   text:uncovered ? `Tinjau kebutuhan refreshment atau jadwal Bootcamp lanjutan di ${uncovered.label}.`
    : 'Cek ketersediaan jadwal Bootcamp untuk periode berikutnya.',
  },
  {
   icon:HARD_SKILL_TICKET_ICON,
   label:'Investigasi Bad Ticket',
   text:audit ? `Telusuri penyebab kenaikan Bad Ticket ${audit.service} di ${audit.label}.`
    : 'Tinjau kategori temuan terbanyak di Top 5 Bad Ticket Nasional.',
  },
  {
   icon:HARD_SKILL_CHART_ICON,
   label:'Monitoring Pasca-Training',
   text:'Pantau pergerakan Bad Ticket bulan berikutnya khusus untuk peserta yang mengikuti training.',
  },
 ];
 return hardSkillExecutiveCards('Executive Training',summaryItems,painItems,actionItems);
}

function hardSkillAnalyticsPanel(title,source,body,icon='') {
 return `<article class="hard-skill-panel hard-skill-analytics-card">
  <header><h5>${icon?hardSkillIconLabel(title,icon):el(title)}</h5><p>${el(source)}</p></header>${body}</article>`;
}

function hardSkillGrapariAnalytics(report,period,comparison) {
 const metrics = report?.performanceAnalytics;
 const months = metrics?.months || [];
 const unavailable = '<p>Data belum tersedia untuk periode dan cakupan ini.</p>';
 const rows = (series,metric,group,read,format,lowerIsBetter=false)=>{
  const available = (series || []).filter(row=>row.values.some(value=>value!=null) || (comparison && row.prior!=null));
  if (!available.length) return unavailable;
  const columns = comparison ? [comparison.previous,comparison.current] : months;
  const monthHeading = month=>{
   const date = hardSkillDate(month);
   const label = dashboardTrialShortMonth.format(date);
   return comparison && comparison.previous.slice(0,4)!==comparison.current.slice(0,4) ? `${label} ${date.getUTCFullYear()}` : label;
  };
  return `<div class="hard-skill-analytics-table-wrap"><table class="hard-skill-analytics-table" aria-label="${el(metric)} per bulan">
   <thead><tr><th scope="col">${group}</th>${columns.map(month=>`<th scope="col" title="${el(hardSkillMonthLabel(month))}">${el(metric)} ${el(monthHeading(month))}</th>`).join('')}
    ${comparison?`<th scope="col">${el(dashboardShortComparison(comparison.previous))}</th>`:''}</tr></thead>
   <tbody>${available.map(({label,values,prior})=>{
   const previous = read(prior);
   const current = read(values[0]);
   const cells = comparison ? [prior,values[0]] : values;
   const movement = Number.isFinite(previous)&&Number.isFinite(current) ? hardSkillMovement(current,previous,'pp',{lowerIsBetter}) : '';
   return `<tr><th scope="row">${el(label)}</th>${cells.map(value=>`<td>${format(value)}</td>`).join('')}
    ${comparison?`<td>${movement || '<span aria-label="Pembanding belum tersedia" title="Pembanding belum tersedia">—</span>'}</td>`:''}</tr>`;
  }).join('')}</tbody></table></div>`;
 };
 const rate = value=>Number.isFinite(value)?`${hardSkillScore.format(value)}%`:'—';
 const ticketRate = value=>value?`${rate(value.rate)}<small>${hardSkillCount(value.count,'tiket')}</small>`:'—';
 const ticketSource = service => {
  const {workbook=[],reference=[]} = metrics?.ticketSources?.[service] || {};
  const labels = [workbook.length ? `Workbook Bad Ticket ${service}` : '',
   reference.length ? `Referensi PPT (${[...reference].sort().map(hardSkillMonthLabel).join(' · ')})` : ''].filter(Boolean);
  return ['Porsi dari total GraPARI',...labels].join(' · ');
 };
 return `<section class="hard-skill-analytics" aria-labelledby="hard-skill-analytics-title">
  <header><h4 id="hard-skill-analytics-title">Performance Bad Ticket</h4>
   <p>${el(comparison?.label || period)}</p>${hardSkillMobileCoverage(report)}</header>
  <div class="hard-skill-analytics-grid">
   ${hardSkillAnalyticsPanel('Bad Ticket Fixed · GraPARI',ticketSource('Fixed'),rows(metrics?.badTicketFixed,'Fixed','Area',value=>value?.rate,ticketRate,true))}
   ${hardSkillAnalyticsPanel('Bad Ticket Mobile · GraPARI',ticketSource('Mobile'),rows(metrics?.badTicketMobile,'Mobile','Area',value=>value?.rate,ticketRate,true))}
  </div>
 </section>`;
}

function hardSkillNationalDetailRows(report) {
 return (report.badTickets || []).flatMap(({channel,categoryDetails=[]})=>categoryDetails.map(row=>({
  month:row.month,channel,service:row.service,category:row.category,count:row.count,
 }))).sort((a,b)=>a.month.localeCompare(b.month) || a.channel.localeCompare(b.channel,'id-ID') ||
  a.service.localeCompare(b.service,'id-ID') || b.count-a.count || a.category.localeCompare(b.category,'id-ID'));
}

function hardSkillNationalWorkbookSheets(report) {
 const detail = hardSkillNationalDetailRows(report);
 return [
  {name:'Rincian kategori',rows:detail.map(row=>({
   Periode:hardSkillMonthLabel(row.month),CTP:row.channel,Layanan:row.service,Kategori:row.category,Jumlah_tiket:row.count,
  }))},
  {name:'Volume per CTP',rows:(report.badTickets || []).flatMap(({channel,serviceTotals=[]})=>serviceTotals.map(row=>({
   CTP:channel,Layanan:row.name,Periode:`${reportFrom} – ${reportTo}`,
   Jumlah_tiket:row.count,Pembanding_bulan_sebelumnya:row.prior,
  })))},
  {name:'Cakupan',rows:[{Periode_mulai:reportFrom,Periode_akhir:reportTo,
   Filter:exportScope(),Sumber:'Rekap workbook Bad Ticket sesuai filter aktif'}]},
 ];
}

function hardSkillNationalAnalytics(report,period,comparison) {
 const tickets = report.badTickets || [];
 if (!tickets.length) return '';
 const monthLine = comparison?.label || period;
 const channelFor = label=>DASH_CHANNELS.find(item=>item.label===label);
 const table = (name,label,columns,rows)=>`<div class="hard-skill-analytics-table-wrap">
  <table class="hard-skill-analytics-table" aria-label="${el(name)}">
   <thead><tr><th scope="col">${label}</th>${columns.map(value=>`<th scope="col">${el(value)}</th>`).join('')}</tr></thead>
   <tbody>${rows}</tbody>
  </table></div>`;
 const cards = ['Fixed','Mobile'].map(name=>{
  const title = 'Bad Ticket '+name;
  return hardSkillAnalyticsPanel(title,'Volume tiket per CTP',table(title,'CTP',[
   'Jumlah tiket',...(comparison?[dashboardShortComparison(comparison.previous)]:[]),
  ],tickets.map(({channel,serviceTotals=[],months})=>{
   const service = serviceTotals.find(item=>item.name===name);
   const partial = service?.months.length && service.months.length<months.length;
   const coverage = partial ? `<small>${el(service.months.map(hardSkillMonthLabel).join(' · '))}</small>` : '';
   return `<tr><th scope="row" data-report-channel="${el(channel)}"><span class="hard-skill-metric-channel">
    ${dashboardChannelIcon(channelFor(channel)?.icon)}${el(channel)}</span></th>
    <td>${service?.count!=null?`<strong>${hardSkillNumber.format(service.count)}</strong>${coverage}`:'<small>Data belum tersedia</small>'}</td>
    ${comparison?`<td>${hardSkillMovement(service?.count,service?.prior,'tiket',{lowerIsBetter:true,compact:true}) || '—'}</td>`:''}</tr>`;
  }).join('')),HARD_SKILL_TICKET_ICON);
 });
 const categoryTotals = new Map();
 for (const {channel,categories=[],categoryDetails=[]} of tickets) {
  const counts = categoryDetails.length ? [...categoryDetails.reduce((groups,row)=>{
   groups.set(row.category,(groups.get(row.category) || 0)+row.count);
   return groups;
  },new Map())].map(([label,count])=>({label,count})) : categories;
  for (const {label,count} of counts) {
   if (!label || !count) continue;
   const entry = categoryTotals.get(label) || {label,count:0,channels:[]};
   entry.count += count;
   entry.channels.push({channel,count});
   categoryTotals.set(label,entry);
  }
 }
 const topCategories = [...categoryTotals.values()]
  .sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label,'id-ID'))
  .slice(0,5);
 if (topCategories.length) {
  cards.push(hardSkillAnalyticsPanel('Top 5 Bad Ticket Nasional','Gabungan 3 CTP',
   table('Top 5 Bad Ticket Nasional','Kategori',['Total'],topCategories.map((row,index)=>
    `<tr><th scope="row"><b>${index+1}.</b> ${el(row.label)}<span class="hard-skill-channel-tags">${row.channels.map(({channel:ch,count:c})=>
     `<span class="hard-skill-channel-tag" data-channel="${el(ch)}"><span>${el(ch)}</span><b>${hardSkillNumber.format(c)}</b></span>`).join('')}</span></th>
     <td><strong>${hardSkillNumber.format(row.count)}</strong></td></tr>`).join('')),HARD_SKILL_TICKET_ICON));
 }
 const gridBody = cards.length>2
  ? `<div class="hard-skill-analytics-stack">${cards.slice(0,2).join('')}</div>${cards.slice(2).join('')}`
  : cards.join('');
 const detailRows = hardSkillNationalDetailRows(report);
 const details = `<details class="hard-skill-national-details">
  <summary>Lihat data Bad Ticket lengkap <span>${hardSkillNumber.format(detailRows.length)} baris rekap</span></summary>
  <div class="hard-skill-national-details-body">
   <p>Rincian kategori per periode, CTP, dan layanan sesuai filter aktif.</p>
   ${detailRows.length?`<button type="button" class="btn" data-hard-skill-national-download>Unduh Excel sesuai filter</button>
    <div class="hard-skill-analytics-table-wrap"><table class="hard-skill-analytics-table" aria-label="Rincian data Bad Ticket Nasional">
     <thead><tr><th scope="col">Periode</th><th scope="col">CTP</th><th scope="col">Layanan</th><th scope="col">Kategori</th><th scope="col">Tiket</th></tr></thead>
     <tbody>${detailRows.map(row=>`<tr><td>${el(hardSkillMonthLabel(row.month))}</td><td>${el(row.channel)}</td><td>${el(row.service)}</td>
      <th scope="row">${el(row.category)}</th><td>${hardSkillNumber.format(row.count)}</td></tr>`).join('')}</tbody>
    </table></div>`:'<p>Rincian kategori belum tersedia untuk filter ini.</p>'}
  </div></details>`;
 return `<section class="hard-skill-analytics hard-skill-tickets" tabindex="-1" aria-labelledby="hard-skill-analytics-title">
  <header><h4 id="hard-skill-analytics-title">${hardSkillIconLabel('Performance Bad Ticket',HARD_SKILL_TICKET_ICON)}</h4><p>${el(monthLine)}</p>
   ${hardSkillMobileCoverage(report)}</header>
  <div class="hard-skill-analytics-grid">${gridBody}</div>
  ${details}
  <nav class="hard-skill-channel-links" aria-label="Rincian Bad Ticket per CTP">${tickets.map(({channel})=>{
   const target = channelFor(channel);
   return target?`<button type="button" class="btn" data-report-channel="${el(channel)}" data-hard-skill-channel="${el(target.value)}">
    ${dashboardChannelIcon(target.icon)}Lihat performa ${el(channel)}</button>`:'';
  }).join('')}</nav>
 </section>`;
}

function dashboardHardSkillBody() {
 const [start,end] = hardSkillPeriod();
 const monthly = start!==end;
 const comparison = hardSkillMoM();
 const showMoM = Boolean(comparison);
 const national = ctp==='All CTPs';
 const period = dashboardTrialPeriodLabel();
 const result = hardSkillResults.get(localLearningQuery());
 const report = result?.report;
 const coverage = hardSkillDateCoverage(report?.dates || report?.periodDates);
 const scope = [dashboardChannelLabel(),dashboardLocationLabel(),comparison?.label || period].filter(Boolean).join(' · ');
 const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M7 16v-3m5 3V9m5 7V5M5 5l3 3 4-4"/></svg>';
 const header = `<header class="hard-skill-hero"><div><h3>${national?'Bootcamp Hard Skills Offline &amp; Refreshment Online':'Jangkauan pelatihan Hard Skill'}</h3>
  ${national?'':`<p>${el(scope)}</p>`}${coverage?`<small>Data ${el(coverage)}</small>`:''}</div><span class="hard-skill-icon" aria-hidden="true">${icon}</span></header>`;
 const tickets = hardSkillBadTickets(report?.badTickets,period,comparison,report);
 const analytics = !report ? '' : national ? hardSkillNationalAnalytics(report,period,comparison) : '';
 let body;
 if (!report?.totals.attendance) {
  const message = result?.status==='error'?'Rekap Hard Skill belum dapat dimuat.':!report?'Memuat rekap Hard Skill…':
   dashboardTrialWindow==='current'&&!report.periodDates?'Data bulan ini belum tersedia':'Data Hard Skill belum tersedia untuk filter ini.';
  body = `<p class="hard-skill-empty" role="status">${message}</p>`+tickets+analytics;
 } else {
  const active = monthly ? hardSkillSelection.bucket || report.timeline.months.findLast(bucket=>bucket.attendance>0)?.key : end;
  const useTopGrid = !national && ['Call Center','E-Care'].includes(dashboardChannelLabel());
  body = (national?hardSkillHighlights(report,comparison):dashboardChannelLabel()==='GraPARI'?hardSkillGrapariNotes(report):hardSkillSitePerformanceNotes(report.badTickets?.[0],comparison))+
   (useTopGrid?'':hardSkillKpis(report,showMoM))+
   hardSkillTrainingSummary(report.trainingBreakdowns,dashboardChannelLabel(),showMoM?report.priorTrainingBreakdowns:null,useTopGrid?hardSkillKpis(report,showMoM):'')+
   (national?analytics+hardSkillEvaluation(report.evaluation,period)+hardSkillDetails(report)
    :hardSkillDetails(report)+tickets+analytics+hardSkillEvaluation(report.evaluation,period))+
   (monthly?hardSkillChart(report,active):'');
 }
 return `<div class="hard-skill-report" data-report-channel="${el(dashboardChannelLabel())}">${header}${body}</div>`;
}

function dashboardHardSkillSection(scope) {
 if (ctp==='All CTPs') {
  const comparison = hardSkillMoM();
  const period = `Periode: ${comparison?.label || dashboardTrialPeriodLabel()}`;
  return dashboardLearningDisclosure('hard','Training Hard Skill Nasional',period,'<div data-hard-skill-mount></div>');
 }
 return dashboardLearningDisclosure('hard','Distribusi Hard Skill & Performa Bad Ticket',scope,'<div data-hard-skill-mount></div>');
}

function openDashboardBadTickets() {
 const panel = document.querySelector('details[data-learning-disclosure="hard"]');
 if (!panel) return;
 dashboardLearningOpen.add('hard');
 const tickets = panel.querySelector('.hard-skill-tickets');
 hardSkillNavigateToTickets = !tickets;
 panel.open = true;
 const target = tickets || panel.querySelector('summary');
 target?.focus({preventScroll:true});
 target?.scrollIntoView({block:'start'});
}

function bindDashboardHardSkill() {
 const panel = document.querySelector('details[data-learning-disclosure="hard"]');
 const mount = panel?.querySelector('[data-hard-skill-mount]');
 if (!mount) return;
 const redraw = (focusId='')=>{
  const scroll = mount.querySelector('.hard-skill-chart')?.scrollLeft || 0;
  mount.innerHTML = dashboardHardSkillBody();
  alignNumericTableCells(mount);
  const chart = mount.querySelector('.hard-skill-chart');
  if (chart) chart.scrollLeft = scroll;
  if (focusId) document.getElementById(focusId)?.focus({preventScroll:true});
  const tickets = mount.querySelector('.hard-skill-tickets');
  if (hardSkillNavigateToTickets && (tickets || !hardSkillResults.get(localLearningQuery())?.pending)) {
   hardSkillNavigateToTickets = false;
   const target = tickets || panel.querySelector('summary');
   target?.focus({preventScroll:true});
   target?.scrollIntoView({block:'start'});
  }
 };
 const load = async ()=>{
  if (!panel.open) return;
  const query = localLearningQuery();
  if (query!==hardSkillLastQuery) {
   hardSkillLastQuery = query;
   resetHardSkillDrilldown();
   for (const path of hardSkillGrapariDrills.values()) {
    path.region = '';
    path.unit = '';
   }
  }
  const stored = hardSkillResults.get(query);
  let pending = stored?.pending;
  if (!pending && !stored?.report) {
   pending = fetch('/api/local-hard-skill?'+query).then(async response=>{
    if (!response.ok) throw Error('Hard Skill report unavailable');
    hardSkillResults.set(query,{report:await response.json()});
   }).catch(()=>hardSkillResults.set(query,{status:'error'}));
   hardSkillResults.set(query,{pending});
  }
  redraw();
  if (pending) {
   await pending;
   if (panel.isConnected && panel.open && localLearningQuery()===query) {
    redraw(mount.contains(document.activeElement)?document.activeElement.id:'');
   }
  }
 };
 panel.addEventListener('toggle',()=>{if(panel.isConnected) load();});
 mount.addEventListener('toggle',event=>{
  if (!event.target.isConnected) return;
  if (event.target.matches('[data-hard-skill-details]')) hardSkillSessionsOpen = event.target.open;
  if (event.target.matches('[data-hard-skill-eval]')) hardSkillEvaluationOpen = event.target.open;
  const ticket = event.target.dataset.hardSkillTicket;
  if (ticket) {
   if (event.target.open) hardSkillTicketOpen.add(ticket);
   else hardSkillTicketOpen.delete(ticket);
  }
 },true);
 mount.addEventListener('keydown',event=>{
  const tab = event.target.closest('[data-hard-skill-gra-service]');
  if (!tab) return;
  const targets = {
   ArrowLeft:tab.previousElementSibling || tab.parentElement.lastElementChild,
   ArrowRight:tab.nextElementSibling || tab.parentElement.firstElementChild,
   Home:tab.parentElement.firstElementChild,
   End:tab.parentElement.lastElementChild,
  };
  const next = targets[event.key];
  if (!next) return;
  event.preventDefault();
  next.click();
  next.focus();
 });
 mount.addEventListener('click',event=>{
  if (event.target.closest('[data-hard-skill-national-download]')) {
   const report = hardSkillResults.get(localLearningQuery())?.report;
   if (!report || !hardSkillNationalDetailRows(report).length) {
    notify('Rincian Bad Ticket belum tersedia untuk filter ini.');
    return;
   }
   savePdfBlob(makeDashboardWorkbook(hardSkillNationalWorkbookSheets(report)),
    `OmniKnow-Bad-Ticket-${reportFrom.slice(0,7)}-${reportTo.slice(0,7)}.xlsx`);
   notify('Excel Bad Ticket sesuai filter berhasil disiapkan.');
   return;
  }
  const channelButton = event.target.closest('[data-hard-skill-channel]');
  if (channelButton) {
   selectDashboardChannel(channelButton.dataset.hardSkillChannel);
   dashboardLearningOpen.add('hard');
   if (dashboardChannelLabel()==='Call Center') hardSkillTicketOpen.add('contact-performance');
   if (dashboardChannelLabel()==='E-Care') hardSkillTicketOpen.add('ecare-performance');
   hardSkillNavigateToTickets = true;
   render();
   return;
  }
  const serviceTab = event.target.closest('[data-hard-skill-gra-service]');
  if (serviceTab) {
   hardSkillGrapariService = serviceTab.dataset.hardSkillGraService;
   for (const tab of serviceTab.parentElement.children) {
    const selected = tab===serviceTab;
    tab.setAttribute('aria-selected',selected);
    tab.tabIndex = selected?0:-1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
   }
   return;
  }
  const siteAgentButton = event.target.closest('[data-hard-skill-site-agent],[data-hard-skill-site-sort]');
  if (siteAgentButton) {
   const drillKey = siteAgentButton.dataset.hardSkillSiteKey || siteAgentButton.dataset.hardSkillSiteSort;
   const [channelName,serviceName] = (drillKey || '').split(':');
   const card = siteAgentButton.closest('[data-hard-skill-service-card]');
   const ticket = hardSkillResults.get(localLearningQuery())?.report?.badTickets?.find(item=>item.channel===channelName);
   const service = ticket?.performance?.services?.find(item=>item.name===serviceName);
   if (!card || !service) return;
   const drill = hardSkillSiteAgentDrills.get(drillKey) || {};
   if (siteAgentButton.hasAttribute('data-hard-skill-site-sort')) {
    drill.sort = drill.sort==='asc' ? 'desc' : 'asc';
   } else {
    const clicked = siteAgentButton.dataset.hardSkillSiteAgent;
    drill.site = drill.site===clicked ? '' : clicked;
   }
   hardSkillSiteAgentDrills.set(drillKey,drill);
   card.outerHTML = hardSkillTicketService(service,service.months || [],hardSkillMoM(),channelName);
   return;
  }
  const areaButton = event.target.closest('[data-hard-skill-gra-area],[data-hard-skill-gra-area-sort]');
  if (areaButton) {
   const overview = areaButton.closest('[data-hard-skill-gra-distribution]');
   const service = overview?.dataset.hardSkillGraDistribution;
   const report = hardSkillResults.get(localLearningQuery())?.report?.badTickets
    ?.find(item=>item.channel==='GraPARI')?.services?.find(item=>item.service===service);
   if (!report) return;
   const path = hardSkillGrapariDrills.get(service) || {};
   if (areaButton.hasAttribute('data-hard-skill-gra-area-sort')) {
    path.areaSort = path.areaSort==='asc' ? 'desc' : 'asc';
   } else {
    const clicked = areaButton.dataset.hardSkillGraArea;
    path.area = path.area===clicked ? '' : clicked;
   }
   hardSkillGrapariDrills.set(service,path);
   overview.innerHTML = hardSkillGrapariOverview(report,hardSkillMoM());
   alignNumericTableCells(overview);
   return;
  }
  const drillButton = event.target.closest('[data-hard-skill-gra-drill]');
  if (drillButton) {
   const overview = drillButton.closest('[data-hard-skill-gra-distribution]');
   const service = overview.dataset.hardSkillGraDistribution;
   const report = hardSkillResults.get(localLearningQuery())?.report?.badTickets
    ?.find(item=>item.channel==='GraPARI')?.services?.find(item=>item.service===service);
   if (!report) return;
   const path = hardSkillGrapariDrills.get(service) || {};
   const action = drillButton.dataset.hardSkillGraDrill;
   if (action==='region') path.region = drillButton.dataset.location;
   if (action==='unit') path.unit = drillButton.dataset.location;
   if (action==='sort') path.ascending = !path.ascending;
   if (action==='back') {
    if (path.unit) path.unit = '';
    else path.region = '';
   }
   hardSkillGrapariDrills.set(service,path);
   overview.innerHTML = hardSkillGrapariOverview(report,hardSkillMoM());
   alignNumericTableCells(overview);
   const next = action==='sort' ? 'sort' : path.region ? 'back' : 'region';
   (overview.querySelector(`[data-hard-skill-gra-drill="${next}"]`) || overview.querySelector('[data-hard-skill-gra-empty]'))?.focus();
   return;
  }
  const button = event.target.closest('[data-hard-skill-bucket],[data-hard-skill-breakdown]');
  if (!button) return;
  const field = button.dataset.hardSkillBucket?'bucket':'breakdown';
  const selected = button.dataset.hardSkillBucket || button.dataset.hardSkillBreakdown;
  resetHardSkillDrilldown();
  hardSkillSelection[field] = button.getAttribute('aria-pressed')==='true'?'':selected;
  hardSkillSessionsOpen = true;
  redraw(button.id);
 });
 load();
}
