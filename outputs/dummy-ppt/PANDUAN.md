# Paket dummy OmniKnow untuk bahan presentasi

Seluruh data fiktif. Periode: 1–31 Oktober 2026. Paket ini tidak mengubah aplikasi dan tidak mengunggah data ke website.

## Cara menggunakan
1. Buka Administration, pilih impor CSV agen, lalu pilih 01-agen-import.csv. Impor menambah 36 agen ke data yang sudah ada. Jangan impor ulang: ID duplikat akan ditolak.
2. Atur periode dashboard ke 2026-10-01 sampai 2026-10-31. Cari DUMMY-PPT untuk melihat hanya agen paket ini; reset filter area/region/CTP yang tidak diperlukan.
3. Buat aktivitas melalui Add Activity menggunakan 04-aktivitas-manual.txt. Buka detail aktivitas, pilih CSV pre-test 02-pre-test.csv dan post-test 03-post-test.csv, lalu jalankan impor. Agen harus sudah diimpor terlebih dahulu. File penilaian lengkap ini untuk satu aktivitas uji gabungan; bila membuat aktivitas per CTP, pisahkan baris CSV sesuai CTP.
4. Lihat dashboard, ASK, dan Pre-Post Evaluation. Gunakan ekspor PDF/Excel yang tersedia sebagai bahan PowerPoint.

## Format data yang diperlukan
- CSV UTF-8, separator koma, baris pertama header. Jangan ubah nama kolom.
- Satu baris file agen = satu agen. ID unik, nama, area, region dan ctp wajib diisi.
- Kolom wajib agen: id,name,area,region,ctp,pre,post,attitude,skill,knowledge,complete,certified,csat,trainingHours.
- assessmentDate ditambahkan agar data masuk filter periode; format YYYY-MM-DD.
- pre/post/attitude/skill/knowledge/csat: angka 0–100, tanpa tanda persen. trainingHours: angka >=0. complete dan certified: true atau false huruf kecil.
- area dan region harus sesuai pasangan di aplikasi; ctp hanya GraPARI, Contact Center, atau E-Care.
- Satu baris penilaian = nilai satu agen dalam aktivitas. Header persis agent_id,score; skor 0–100 dan agent_id merujuk id file agen. Pre dan post dipisahkan menjadi dua file.
- Data aktivitas diisi melalui formulir; file TXT bukan file impor.

## Bahan presentasi yang bisa dibuat
1. Ringkasan: jumlah agen, completion dan certification.
2. Hasil training: rata-rata pre/post serta gain dalam poin.
3. ASK: attitude, skill, knowledge, serta gap kompetensi.
4. Perbandingan: area, region, CTP, dan agen prioritas coaching.
5. Tindak lanjut: temuan, action, PIC, deadline dari catatan aktivitas.

## Batasan saat ini
- Source website belum memiliki ekspor PPT/PPTX. CSV ini mengisi data dashboard, bukan menghasilkan PPT otomatis.
- Data tersimpan di browser dan origin tempat impor dilakukan; tidak otomatis tersinkron ke pengguna lain.
- Data bawaan tetap ada; gunakan pencarian DUMMY-PPT untuk membatasi hasil.
- Paket satu bulan ini tidak menyediakan histori bulan sebelumnya untuk MoM. Jangan gunakan ID agen baru tiap bulan sebagai pengganti histori agen yang sama.
- VoC untuk agen impor belum mempunyai jalur impor feedback di source saat ini; data agen tidak otomatis menghasilkan feedback pelanggan. Untuk slide VoC diperlukan tanggal, agent_id, topik, teks feedback, sentimen, dan rating 1–5 serta dukungan impor tambahan.
