# Workflow database bulanan OmniKnow

PostgreSQL menyimpan status impor, hasil validasi, dan versi report yang aktif. File sumber disimpan di penyimpanan privat. Setiap angka yang dipublikasikan terikat ke versi report dan periode data yang dipakai. Perubahan setelah bulan ditutup menghasilkan revisi baru.

Migrasi [001_reporting_workflow.sql](../database/001_reporting_workflow.sql) menyiapkan tabel kontrol impor, manifest sumber, hasil KPI per rilis, dan fungsi publikasi atomik. Tabel data detail dan pembaca Excel per sumber mengikuti kontrak di bawah.

## Siklus penutupan bulan

```text
File Excel / export sumber
         ↓
Arsip privat → daftar batch dan periode yang dicakup
         ↓
Staging → cleaning → cocokkan identitas, unit, dan sesi
         ↓
Validasi per file → rekonsiliasi antar sumber → hitung KPI
         ↓
Review rilis draft → publish satu versi per bulan
         ↓
Koreksi berikutnya → draft revisi baru → review dan publish
```

1. **Tetapkan periode dan daftar sumber.** Data owner menetapkan cut-off dan slot file yang wajib masuk. Slot terpisah dipakai untuk export yang memiliki cakupan berbeda, misalnya Tryout W2 Basic Susulan 1 dan Susulan 2. Catat slot opsional yang parsial atau belum masuk.
2. **Terima file.** Operator memasukkan bulan report, slot, cakupan tanggal, cut-off, nama objek privat, hash SHA-256, dan versi parser. Untuk kombinasi bulan, slot, file, dan versi parser yang sama, ambil kembali ID batch yang sudah ada. File revisi mendapat batch baru. Angka bulan sebelumnya tetap menggunakan batch yang dipilih pada rilis sebelumnya.
3. **Validasi tiap batch.** Baca sheet yang ditetapkan untuk sumber itu. Simpan referensi nama sheet dan nomor baris pada temuan validasi. Cocokkan kode dengan tabel master. Setelah review, batch berstatus `validated` jika hasil validasi diterima atau `rejected` jika file perlu diganti. Untuk batch yang diterima, jumlah baris terbaca harus sama dengan jumlah diterima ditambah jumlah dikeluarkan.
4. **Hitung rilis draft.** Pilih satu batch tervalidasi per slot yang tersedia. Cek bahwa manifest draft memuat seluruh slot yang ditetapkan data owner. Hitung KPI dengan aturan yang berlaku di periode itu. Simpan nilai, satuan, pembilang, pembagi bila relevan, dan cakupan tanggal. Tandai `partial` jika sebagian cakupan tersedia dan `missing` jika nilai belum tersedia.
5. **Review dan publish.** Reviewer mencocokkan hasil dengan angka kontrol, meninjau pengecualian dan cakupan parsial, lalu memanggil `reporting.publish_release`. Fungsi mengecek kelengkapan sumber wajib pada manifest, status batch, dan keberadaan KPI. Penandaan rilis dan perubahan versi aktif terjadi dalam satu transaksi.
6. **Koreksi.** Pelihara nomor revisi yang meningkat per bulan. Susun rilis baru menggunakan batch yang masih berlaku dan batch koreksi. Tulis alasan revisi dan cek selisih KPI sebelum publish. Untuk mengembalikan isi rilis terdahulu, salin batch dan hasilnya ke revisi baru dan catat alasan pemulihan.

Bulan report disimpan sebagai tanggal pertama bulan, misalnya `2026-10-01`. Tanggal kejadian mengikuti sumber. Cakupan file atau KPI bisa berbeda dari bulan report, seperti iFest Juli yang dipakai di ASK September. Nilai nol berarti kejadian atau skor terukur nol. Nilai `NULL` pada KPI dengan status `missing` berarti belum tersedia. Gunakan September sebagai periode pembagi pertumbuhan Oktober dan poin persentase untuk selisih proporsi.

## Kontrak sumber dan struktur detail

| Sumber | Satu baris mewakili | Kolom dan hubungan minimum | Aturan validasi |
|---|---|---|---|
| **SIAD dan daftar unit** | Satu penempatan CSR pada satu periode berlaku | `agent_id`, NIK SIAD, status, kode unit, CTP, region, role, tanggal mulai kontrak dan masa berlaku penempatan | Pertahankan NIK sebagai teks. Simpan perpindahan unit sebagai riwayat. Gunakan snapshot penutupan bulan untuk periode terkait dan simpan mapping NIK CSDM, Login ID, serta email per sistem sumber. |
| **ASK** | Satu skor final per CSR per bulan | `agent_id`, periode, CTP, unit, model, role, A, S, K, kuadran, sumber skor, dan versi aturan | Impor tab `Data ASK`. Validasi A/S/K 0–100 dan NIK unik dalam file. Gunakan High ≥80 per dimensi. Catat skor turunan tim/leader dan identitas atau model yang belum cocok. |
| **Tapping dan tNPS** | Satu komponen tapping atau satu respons tNPS | ID penilaian atau transaksi, identitas yang tersedia, tanggal penilaian/survei, parameter, hasil, kategori, wilayah, dan sumber | Samakan nama parameter melalui mapping. Hitung tNPS People dari respons valid bulan survei. Klasifikasikan Promoter/Passive/Detractor, catat pembagi, dan tandai dimensi wilayah yang rusak. |
| **Tryout dan iFest** | Satu peserta eligible per sesi, satu attempt, atau satu jawaban | `session_id`, minggu, tanggal, utama/susulan, level, `agent_id` atau identitas sumber, `attempt_id`, timestamp, ID dan versi soal | Simpan attempt asli. Tentukan attempt yang dihitung sesuai kebijakan sesi dan koreksi resmi. Participation rate membutuhkan roster eligible. Simpan bulan dan kuartal iFest sesuai tanggal event. |
| **Training dan feedback** | Satu sesi, satu kehadiran per peserta dan sesi, satu attempt pre/post, atau satu respons survei | Program, `session_id`, tanggal, batch, metode, `agent_id`, kehadiran, jenis tes, skor, ID respons, timestamp | Pasangkan pre/post menggunakan peserta dan sesi. Kehadiran di dua sesi menghasilkan dua catatan. Gunakan timestamp untuk analisis respons jika belum bisa dihubungkan ke sesi. |
| **Bad Ticket** | Satu temuan tiket atau satu baris agregat resmi per periode dan cakupan | `ticket_id` bila tersedia, sumber, periode input, tanggal pembuatan, CTP, produk Fixed/Mobile, unit, kategori, symptom, serta pembagi bila ada | Bedakan jumlah temuan dari tiket unik. Verifikasi pengulangan ID sebelum menghapus baris. Simpan sumber agregat Mobile pada grain bulan dan area sampai raw tersedia. Untuk rate, gunakan total tiket yang sesuai cakupan. |
| **Program dan profil CCKCM** | Satu aktivitas program atau satu snapshot headcount per cakupan | ID program, tanggal, PIC, status, satuan, jumlah, CTP/unit bila tersedia, dan sumber bukti | Pisahkan rencana dan realisasi. Gunakan definisi populasi report saat membandingkan headcount dan nilai program lintas bulan. |

Di lapisan detail, gunakan ID internal `agent_id`, `unit_id`, dan `session_id` untuk join. Setiap record hasil cleaning menyimpan `batch_id` dan referensi baris sumber. Simpan fakta berdasarkan batch agar perhitungan rilis lama masih bisa diulang. Data identitas dan file sumber berada pada penyimpanan terbatas. Akses pembaca report cukup melalui view `reporting.active_metrics`.

## Rekonsiliasi saat backfill

| Pemeriksaan | Angka kontrol | Keputusan ketika ada selisih |
|---|---|---|
| ASK September | 5.068 CSR dengan A/S/K lengkap. High A/S/K 3.957 / 4.461 / 4.162. | Cek tab, cakupan CSR, filter Non Agent/CS SAR, skor tidak lengkap, dan mapping model. Cocokkan ke Monthly Update ASK September slide 3. |
| ASK Oktober | 5.165 CSR dengan A/S/K lengkap. High A/S/K 3.774 / 4.438 / 4.319. | Gunakan workbook Oktober. Sejumlah halaman ASK di PDF CCKCM Oktober masih berlabel September. |
| Training | Agustus–Oktober 785 kehadiran dari 43 sesi. September 360/19 dan Oktober 280/18. Pasangan pre/post valid Oktober 225. | Cek duplikasi lintas tab, batch yang kosong, dan pemisahan kehadiran per sesi. Cocokkan dengan CCKCM hlm. 21. |
| Bad Ticket | GraPARI Fixed 371 → 734 dan Mobile 320 → 262. Call Center Fixed + Mobile 1.649 → 1.126. | Gunakan cakupan yang setara. Rincian per site Call Center berasal dari CCKCM hlm. 23. Cakupan E-Care Oktober hanya minggu 1–3 dan diberi status parsial. |
| tNPS People dan Tryout | tNPS nasional memakai bulan survei. Tryout November memiliki lima export susulan Week 2 dan 2.147 baris attempt. | Wilayah tNPS Oktober perlu mapping yang terverifikasi. Participation rate November menunggu roster eligible dan cakupan sesi yang diperlukan. |

Sumber kontrol mencakup workbook Data ASK Agustus–Oktober, Monthly Update ASK September, Recap Report Training, Performance Bad Ticket GraPARI Agustus–Oktober, Monthly Report Dept CCKCM Oktober, dan lima export Tryout November.

## Penggunaan migrasi

Jalankan migrasi di database PostgreSQL yang dipilih untuk lingkungan pengembangan. `DATABASE_URL` berasal dari konfigurasi lingkungan.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/001_reporting_workflow.sql
```

Setelah loader mengisi batch, temuan validasi, manifest, dan KPI draft, akun reviewer menjalankan fungsi publikasi dengan identitas reviewer dari sesi autentikasi. Contoh `42` mewakili ID rilis yang sudah direkonsiliasi.

```sql
SELECT reporting.publish_release(42, 'reviewer-verified-id');

SELECT report_month, revision, metric_key, scope_key, value, coverage
FROM reporting.active_metrics
WHERE report_month = DATE '2026-10-01'
ORDER BY metric_key, scope_key;
```

Berikan hak akses sesuai peran pada konfigurasi deployment. Loader mengisi draft dan melakukan validasi, sementara reviewer mendapat izin menjalankan fungsi publikasi. Batasi perubahan langsung pada penunjuk rilis aktif dan kolom publikasi ke pemilik migrasi. Loader memvalidasi bahwa manifest draft mencakup semua slot dari daftar sumber periode sebelum menyerahkannya ke reviewer.

Untuk impor pertama, mulai dari ASK September, cocokkan tiga hitungan High, lalu backfill Agustus dan Oktober. Setelah itu, tambahkan training dan Bad Ticket pada cakupan yang sudah dapat direkonsiliasi. Gunakan slot opsional dengan catatan cakupan selama sumber historis yang tersisa dilengkapi.
