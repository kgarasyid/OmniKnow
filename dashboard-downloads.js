function exportScope(){return `CTP: ${ctp} | Area/Site: ${ctpScope} | Region: ${region} | Geographic area: ${area} | Activity: ${category} | Agent search: ${q||'All'}${page===0?' | Location: '+dashboardLocationLabel():''}`}
function makeDashboardPdf(title,lines,bars){
  const objects=[null],add=s=>(objects.push(s),objects.length-1),catalog=add(''),pages=add(''),font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),ids=[];
  const pagesOps=[];
  const text=(value,x,y,size=10)=>`BT /F1 ${size} Tf ${x} ${y} Td (${pdfSafeText(value)}) Tj ET`;
  const cover=['0.09 0.17 0.28 rg',...pdfWrap(title,55).map((s,i)=>text(s,40,795-i*22,17)),text('Filtered showcase report | Generated '+new Date().toISOString().slice(0,10),40,735,10),...pdfWrap(exportScope(),92).map((s,i)=>text(s,40,712-i*14,9)),text('Score distribution - agent counts',40,650,13)];
  const max=Math.max(1,...bars.map(b=>b.value));
  bars.forEach((b,i)=>{const y=610-i*65,c=b.color||'#1B4F8A',rgb=[1,3,5].map(p=>parseInt(c.slice(p,p+2),16)/255).join(' ');cover.push('0.09 0.17 0.28 rg',text(b.label+' : '+b.value,40,y,11),rgb+' rg',`40 ${y-22} ${(b.value/max*500).toFixed(2)} 12 re f`)});
  cover.push('0.09 0.17 0.28 rg',text('Scores, rankings and feedback follow on subsequent pages.',40,290),text('Dummy data where labelled. Not verified employee evidence.',40,270));pagesOps.push(cover);
  const wrapped=lines.flatMap(l=>pdfWrap(l,95));for(let i=0;i<wrapped.length;i+=51){pagesOps.push(['0.09 0.17 0.28 rg',text('OmniKnow - '+title.slice(0,65),40,800,12),...wrapped.slice(i,i+51).map((s,j)=>text(s,40,770-j*14,9))])}
  pagesOps.forEach((ops,i)=>{ops.push('0.09 0.17 0.28 rg',text(`OmniKnow | Page ${i+1} of ${pagesOps.length}`,40,25,8));const stream=ops.join('\n')+'\n',content=add('<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');ids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`))});
  objects[catalog]=`<< /Type /Catalog /Pages ${pages} 0 R >>`;objects[pages]=`<< /Type /Pages /Kids [${ids.map(i=>i+' 0 R').join(' ')}] /Count ${ids.length} >>`;
  let out='%PDF-1.4\n',offsets=[0];objects.slice(1).forEach((s,i)=>{offsets.push(out.length);out+=(i+1)+' 0 obj\n'+s+'\nendobj\n'});const start=out.length;out+='xref\n0 '+objects.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${start}\n%%EOF`;return new Blob([out],{type:'application/pdf'});
}
function printVisualReport(filename){
  if(typeof window==='undefined'||typeof window.print!=='function')return false;
  const previousTitle=typeof document!=='undefined'?document.title:'';
  if(typeof document!=='undefined'&&filename)document.title=String(filename).replace(/\.pdf$/i,'');
  notify('Pilih "Save as PDF" pada dialog Print untuk menyimpan laporan visual');
  try{window.print();}finally{if(typeof document!=='undefined')setTimeout(()=>{document.title=previousTitle;},250);}
  return true;
}
function downloadPagePdf(){
  const title=page===0?dashboardViewTitle()+(dashboardSub[dashboardTab]?' - '+dashboardSub[dashboardTab]:''):NAV[page][1];
  const filename=(page===3||(page===0&&dashboardTab===1))?'OmniKnow-ASK-'+reportFrom:'OmniKnow-'+title.replace(/[^a-z0-9-]/gi,'-');
  if(printVisualReport(filename))return;
  if(page===3||(page===0&&dashboardTab===1)){
    const s=askStats(askScope(filtered())),prior=askPrior();
    const lines=[exportScope(),'Segment: '+askSegmentFilter,'Source: '+(s.all.some(isShowcaseAgent)?'Synthetic demo history':'Local dated records'),'Assessed: '+s.n+' | Non quadrant: '+s.excluded.length,'Weighted ASK: '+(s.score==null?'No data':s.score.toFixed(2))+' / 100',...s.high.map((h,i)=>['Attitude','Skill','Knowledge'][i]+' High: '+h.count+' / '+s.n+' ('+(h.rate==null?'No data':h.rate.toFixed(1)+'%')+') | Change: '+(h.rate==null||prior.high[i].rate==null?'No previous data':(h.rate-prior.high[i].rate).toFixed(1)+' pp')),...ASK_QUADRANTS.map(([q])=>q+': '+s.valid.filter(a=>askExcelLogic(a).quadrant===q).length),'High >=80. Final ASK = 40% Attitude + 30% Skill + 30% Knowledge.','Personal workbook data has not been imported.'];
    savePdfBlob(makeDashboardPdf('ASK Capability Summary',lines,s.high.filter(h=>h.rate!=null).map((h,i)=>({label:['High Attitude','High Skill','High Knowledge'][i],value:h.rate,color:['#ed1639','#f18b25','#7059d9'][i]}))),'OmniKnow-ASK-'+reportFrom+'.pdf');notify('ASK PDF download requested');return;
  }

  const root=document.querySelector(page===0?'.dw-panel':'.main');
  const lines=[exportScope(),...(root?.innerText||'No records').split('\n').map(s=>s.trim()).filter(Boolean)];
  const ds=rankDataset(filtered(),page===8?4:page===3?1:dashboardTab,page===8?'Post Test':dashboardSub[dashboardTab]);
  const bars=SCORE_BANDS.map(b=>({label:b.label,value:ds.rows.filter(a=>a.score>=b.min&&a.score<b.max).length,color:b.color}));
  savePdfBlob(makeDashboardPdf(title,lines,bars),filename+'.pdf');notify('PDF download requested for the current page and filters');
}
// Minimal standards-based XLSX writer: uncompressed ZIP, inline strings, numeric cells.
// No formulas, macros, external links or renamed CSV files.
function workbookXmlText(value){return String(value??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').slice(0,32767).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')}
function zipWorkbook(files){
  const enc=new TextEncoder(),chunks=[],directory=[];let offset=0;
  const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0};
  for(const [name,xml] of Object.entries(files)){const n=enc.encode(name),body=enc.encode(xml),sum=crc(body),h=new Uint8Array(30+n.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,body.length,true);v.setUint32(22,body.length,true);v.setUint16(26,n.length,true);h.set(n,30);chunks.push(h,body);const d=new Uint8Array(46+n.length),w=new DataView(d.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,sum,true);w.setUint32(20,body.length,true);w.setUint32(24,body.length,true);w.setUint16(28,n.length,true);w.setUint32(42,offset,true);d.set(n,46);directory.push(d);offset+=h.length+body.length}
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,directory.length,true);v.setUint16(10,directory.length,true);v.setUint32(12,directory.reduce((n,b)=>n+b.length,0),true);v.setUint32(16,offset,true);return new Blob([...chunks,...directory,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function makeDashboardWorkbook(sheets){
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rels='http://schemas.openxmlformats.org/package/2006/relationships';
  const files={'_rels/.rels':`<Relationships xmlns="${rels}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`};
  files['[Content_Types].xml']=`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  files['xl/workbook.xml']=`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${workbookXmlText(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
  files['xl/_rels/workbook.xml.rels']=`<Relationships xmlns="${rels}">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`;
  const col=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s};
  sheets.forEach((s,i)=>{const keys=[...new Set(s.rows.flatMap(r=>Object.keys(r)))];if(!keys.length)keys.push('No matching records');const data=[keys,...s.rows.map(r=>keys.map(k=>r[k]??''))];files[`xl/worksheets/sheet${i+1}.xml`]=`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${keys.map((_,j)=>`<col min="${j+1}" max="${j+1}" width="24" customWidth="1"/>`).join('')}</cols><sheetData>${data.map((row,r)=>`<row r="${r+1}">${row.map((v,c)=>typeof v==='number'&&Number.isFinite(v)?`<c r="${col(c)}${r+1}" t="n"><v>${v}</v></c>`:`<c r="${col(c)}${r+1}" t="inlineStr"><is><t xml:space="preserve">${workbookXmlText(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${col(keys.length-1)}${data.length}"/></worksheet>`});return zipWorkbook(files);
}
function dashboardWorkbookSheets(){const original=dashboardSub[5];const sheets=['Agents','Programs','Activities','VoC'].map(name=>{dashboardSub[5]=name;return {name,rows:dashFilteredRaw(filtered())}});dashboardSub[5]=original;sheets.push({name:'Report scope',rows:[{scope:exportScope(),table_search:dashboardRawQuery||'All',source:'Showcase data where labelled',generated:new Date().toISOString()}]});return sheets}
async function downloadDashboardExcel(){
 const sheets=dashboardWorkbookSheets();
 let askUnavailable=false;
 if (page===0 && localAskReport && category==='All Categories' && !q) {
  const query=new URLSearchParams(localLearningQuery());
  query.set('view','roster');
  query.set('export','all');
  try {
   const response=await fetch('/api/local-ask-drilldown?'+query);
   if (!response.ok) throw new Error('ASK detail unavailable');
   const result=await response.json();
   if (!Array.isArray(result.rows) || result.rows.length!==result.total) throw new Error('ASK export incomplete');
   sheets.unshift({name:'ASK CSR',rows:result.rows.map(row=>({
    Nama_CSR:row.name,CTP:row.channel,Area:row.area,Region:row.region,Unit:row.unit,
    Attitude:row.attitude,Skill:row.skill,Knowledge:row.knowledge,ASK_Berbobot:row.score,
    Periode:row.month||`${reportFrom} – ${reportTo}`,Sumber:'Workbook ASK lokal'
   }))});
  } catch (error) {askUnavailable=true;}
 }
 sheets[sheets.length-1].rows[0].ask_export=sheets.some(sheet=>sheet.name==='ASK CSR')
  ? 'ASK CSR mengikuti filter periode, CTP, area, region, dan unit.'
  : 'ASK CSR tidak disertakan; filter kategori dan pencarian agen hanya berlaku untuk roster aplikasi.';
 savePdfBlob(makeDashboardWorkbook(sheets),'OmniKnow-Data-Terfilter.xlsx');
 notify(askUnavailable?'Excel tabel aplikasi terfilter disiapkan; data ASK rinci belum tersedia.':'Excel sesuai filter berhasil disiapkan');
}
