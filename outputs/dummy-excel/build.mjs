import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const out=fileURLToPath(new URL('./',import.meta.url));
const csv=await fs.readFile(new URL('../dummy-ppt/01-agen-import.csv',import.meta.url),'utf8');
const wb=await Workbook.fromCSV(csv.replace(/^\uFEFF/,''),{sheetName:'Data Agen'});
const agen=wb.worksheets.getItem('Data Agen');
const raw=agen.getRange('A1:O37').values;
for(let r=1;r<raw.length;r++){
 for(const c of [5,6,7,8,9,12,13])raw[r][c]=Number(raw[r][c]);
 // CSV contains 15 columns; date is column O.
 raw[r][14]=new Date(String(raw[r][14]).slice(0,10)+'T00:00:00Z');
 raw[r]=raw[r].slice(0,15);
}
agen.getRange('A1:O37').values=raw.map(r=>r.slice(0,15));
agen.getRange('O2:O37').setNumberFormat('dd mmm yyyy');
agen.getRange('F2:N37').setNumberFormat('0');
const pre=wb.worksheets.add('Pre-Test'),post=wb.worksheets.add('Post-Test'),guide=wb.worksheets.add('Panduan');
for(const [sheet,col] of [[pre,'F'],[post,'G']]){
 sheet.getRange('A1:C1').values=[['ID Agen','Nama Agen','Nilai (0–100)']];
 sheet.getRange('A2:C37').formulas=Array.from({length:36},(_,i)=>{const r=i+2;return [`='Data Agen'!A${r}`,`='Data Agen'!B${r}`,`='Data Agen'!${col}${r}`]});
}
guide.getRange('A1:C1').values=[['Kolom / topik','Arti','Format / keterangan']];
const notes=[
 ['Sumber','Seluruh data fiktif','36 agen; 12 region; 3 CTP; Oktober 2026.'],
 ['Cara membaca','Data Agen adalah data utama','Pre-Test dan Post-Test tertaut ke Data Agen.'],
 ['id','Identitas unik agen','Contoh DUMMY-PPT-001.'],
 ['name','Nama agen','Nama fiktif.'],
 ['area / region','Wilayah dan region','Gunakan pasangan wilayah yang valid di website.'],
 ['ctp','Kanal layanan','GraPARI, Contact Center, E-Care.'],
 ['pre / post','Nilai sebelum / sesudah training','Angka 0–100.'],
 ['attitude','Nilai sikap','Angka 0–100.'],
 ['skill','Nilai keterampilan','Angka 0–100.'],
 ['knowledge','Nilai pengetahuan','Angka 0–100.'],
 ['complete','Status penyelesaian training','true = selesai; false = belum selesai.'],
 ['certified','Status sertifikasi','true = tersertifikasi; false = belum.'],
 ['csat','Kepuasan pelanggan simulasi','Skala 0–100, bukan rating 1–5.'],
 ['trainingHours','Durasi training','Jam; angka nol atau lebih.'],
 ['assessmentDate','Tanggal penilaian','20 Oktober 2026; untuk filter periode.'],
 ['Impor website','Gunakan CSV dari paket sebelumnya','Excel ini untuk membaca dan mengedit data.'],
 ['Aktivitas contoh','DUMMY - Service Excellence Oktober 2026','Bootcamp; tanggal 20 Oktober 2026.'],
 ['Tindak lanjut contoh','Coaching agen dengan post-test <80','PIC Trainer Dummy; tenggat 30 Oktober 2026.'],
 ['Ekspor presentasi','Website memiliki ekspor PDF dan Excel','Ekspor PPT otomatis belum tersedia.'],
 ['Histori / VoC','Belum disertakan pada paket ini','Data satu bulan; feedback pelanggan terpisah.']
];
guide.getRange('A2:C21').values=notes;
function style(s,range,cols){
 s.showGridLines=false;
 s.getRange(range).format.font={name:'Arial',size:11,color:'#172C45'};
 s.getRange(range).format.rowHeight=24;
 s.getRange(range).format.verticalAlignment='center';
 const last=cols===15?'O':'C';
 s.getRange(`A1:${last}1`).format={fill:'#173D64',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},rowHeight:32};
 s.getRange(`A1:${last}1`).format.horizontalAlignment='center';
 s.freezePanes.freezeRows(1);
 for(let r=3;r<=Number(range.match(/\d+$/)[0]);r+=2)s.getRange(`A${r}:${last}${r}`).format.fill='#F0F5FA';
}
style(agen,'A1:O37',15);style(pre,'A1:C37',3);style(post,'A1:C37',3);style(guide,'A1:C21',3);
agen.freezePanes.freezeColumns(2);
agen.getRange('A1:B37').format.columnWidth=23;
agen.getRange('C1:E37').format.columnWidth=23;
agen.getRange('F1:N37').format.columnWidth=16;
agen.getRange('O1:O37').format.columnWidth=21;
for(const s of [pre,post]){s.getRange('A1:B37').format.columnWidth=25;s.getRange('C1:C37').format.columnWidth=20;}
guide.getRange('A1:A21').format.columnWidth=25;guide.getRange('B1:B21').format.columnWidth=49;guide.getRange('C1:C21').format.columnWidth=65;
for(const s of [agen,pre,post])s.tables.add(s===agen?'A1:O37':'A1:C37',true,s===agen?'DataAgen':s===pre?'NilaiPre':'NilaiPost');
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'Data Agen!A1:G4',include:'values',tableMaxRows:4,tableMaxCols:7})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#N/A',options:{useRegex:true,maxResults:20}})).ndjson);
for(const [s,range] of [['Data Agen','A1:G8'],['Pre-Test','A1:C8'],['Post-Test','A1:C8'],['Panduan','A1:C21']]){
 const png=await wb.render({sheetName:s,range,scale:1.5,format:'png'});
 await fs.writeFile(out+s.replaceAll(' ','-')+'.png',new Uint8Array(await png.arrayBuffer()));
}
await (await SpreadsheetFile.exportXlsx(wb)).save(out+'OmniKnow-Data-Dummy.xlsx');
console.log('Saved workbook with 36 agents and four sheets.');
