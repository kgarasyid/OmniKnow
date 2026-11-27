const form = document.querySelector('#question-form');
const answer = document.querySelector('#answer');
const source = document.querySelector('#source');
const months = {januari:'01',februari:'02',maret:'03',april:'04',mei:'05',juni:'06',juli:'07',agustus:'08',september:'09',oktober:'10',november:'11',desember:'12'};
const number = value => new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(value);

form.addEventListener('submit', async event => {
  event.preventDefault();
  const question = document.querySelector('#question').value.toLocaleLowerCase('id');
  const monthName = Object.keys(months).find(name => question.includes(name));
  const numericMonth = question.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
  const year = question.match(/\b20\d{2}\b/)?.[0] || '2026';
  const period = numericMonth ? numericMonth[0] : `${year}-${months[monthName] || '10'}`;
  const periodLabel = new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(`${period}-01T00:00:00Z`));
  const groups = ['Walk In Mitra','Walk In TOMO','Call In','E-Care'];
  const group = /tomo/.test(question) ? groups[1] : /momo|mitra/.test(question) ? groups[0]
    : /call center|call in|contact center/.test(question) ? groups[2]
    : /e-care|ecare/.test(question) ? groups[3] : null;
  const selectedGroups = group ? [group] : /grapari|gra pari/.test(question) ? groups.slice(0,2) : groups;
  answer.textContent = 'Mengambil data laporan…';
  source.textContent = '';

  try {
    if (/training|pelatihan/.test(question)) {
      if (!/kehadiran|peserta|sesi|rata.rata|nilai|post.test/.test(question)) throw new Error('Untuk training, tanyakan jumlah kehadiran, sesi, atau rata-rata post-test.');
      const [from,to] = [`${period}-01`,new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7)),0)).toISOString().slice(0,10)];
      const params = new URLSearchParams({from,to});
      if (group || /grapari|gra pari/.test(question)) params.set('channel',group === 'Call In' ? 'Call Center' : group === 'E-Care' ? 'E-Care' : 'GraPARI');
      const response = await fetch('/api/local-learning?' + params);
      if (!response.ok) throw new Error('Data training belum tersedia.');
      const report = await response.json();
      const label = group === 'Call In' ? 'Call Center' : group === 'Walk In TOMO' ? 'GraPARI · TOMO' : group === 'Walk In Mitra' ? 'GraPARI · MOMO' : group;
      const training = group ? report.groups.find(item => item.label === label)?.training : report.training;
      if (!training) throw new Error(`Data training ${periodLabel} untuk cakupan ini belum tersedia.`);
      if (/sesi/.test(question)) answer.textContent = `Ada ${number(training.sessions)} sesi training pada ${periodLabel}.`;
      else if (/rata.rata|nilai|post.test/.test(question)) answer.textContent = training.post == null ? `Rata-rata post-test ${periodLabel} belum tersedia.` : `Rata-rata post-test ${periodLabel} adalah ${number(training.post)} dari 100.`;
      else answer.textContent = `Ada ${number(training.attendance)} kehadiran training pada ${periodLabel}. Satu orang yang hadir di beberapa sesi dihitung per sesi.`;
      source.textContent = `Sumber: laporan Training OmniKnow · ${periodLabel} · ${group || (/grapari|gra pari/.test(question) ? 'GraPARI' : 'nasional')}.`;
      return;
    }
    if (!/ask|attitude|skill|knowledge|csr/.test(question)) throw new Error('Saat ini saya dapat menjawab jumlah CSR, rata-rata ASK, serta jumlah skor Attitude, Skill, atau Knowledge ≥80. Pertanyaan training juga tersedia.');
    const response = await fetch('/api/local-ask-summary');
    if (!response.ok) throw new Error('Data ASK belum tersedia.');
    const report = (await response.json())[period];
    if (!report) throw new Error(`Data ASK ${periodLabel} belum tersedia.`);
    const data = selectedGroups.map(name => report.groups[name]).filter(Boolean);
    const count = data.reduce((sum,item) => sum + item.total,0);
    if (/rata.rata|average|rerata/.test(question)) {
      answer.textContent = count ? `Rata-rata skor ASK ${periodLabel} adalah ${number(data.reduce((sum,item)=>sum+item.scoreSum,0)/count)} dari 100, dari ${number(count)} CSR dengan skor lengkap.` : `Rata-rata ASK ${periodLabel} belum tersedia untuk cakupan ini.`;
    } else if (/tinggi|high|80/.test(question)) {
      const index = /attitude/.test(question) ? 0 : /skill/.test(question) ? 1 : /knowledge/.test(question) ? 2 : null;
      if (index == null) throw new Error('Sebutkan Attitude, Skill, atau Knowledge untuk jumlah skor ≥80.');
      const total = data.reduce((sum,item)=>sum+item.high[index],0);
      answer.textContent = `${number(total)} CSR memiliki skor ${['Attitude','Skill','Knowledge'][index]} ≥80 pada ${periodLabel}.`;
    } else {
      answer.textContent = `${number(count)} CSR memiliki skor ASK lengkap pada ${periodLabel}.`;
    }
    source.textContent = `Sumber: laporan ASK OmniKnow · ${periodLabel} · ${group || (/grapari|gra pari/.test(question) ? 'GraPARI' : 'nasional')}.`;
  } catch (error) {
    answer.textContent = error.message || 'Data belum dapat diambil.';
  }
});
