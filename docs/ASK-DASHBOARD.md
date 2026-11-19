# ASK capability dashboard

Available in ASK & Capability and Training Dashboard > ASK Performance. Both views use the same calculations and independent ASK segment, quadrant and detail-search controls alongside shared CTP/location/region/reporting-period filters.

- High is >=80 for each final dimension; weighted ASK is 40% Attitude, 30% Skill, 30% Knowledge.
- Eight quadrant combinations and recommendations follow the September workbook. Talent bands: >=80 Excellent, >=70 Good, >=60 Core, below 60 Growth Potential.
- Unique agent IDs are counted once. Non Agent / CS SAR (askRole, job or JOB) are excluded. All three dimensions must be present, numeric and within 0–100; missing/invalid rows are shown as incomplete rather than scored zero.
- MOMO/TOMO requires an explicit businessModel, business_model or model on the agent. No business model is inferred from synthetic unit assignments.
- High-rate changes use percentage points; score changes use points. Direction is written in text and shown with an arrow. Quadrant count changes use neutral text because increases in different quadrants have different interpretations.
- Comparisons reuse the existing dated reporting system. Demo August–October snapshots remain synthetic; no personal workbook data has been embedded or imported. Non-demo records need assessmentDate or date. There is no new Excel importer or historical store in this change.
- Drill-down is paginated at 15 records, sorts by lowest weighted score, opens existing profiles and exports all matching rows as CSV. ASK PDF contains scoped summary metrics and all eight quadrant counts.
- Raw tapping normalization, detailed parameter analysis, tNPS and actual historical imports are outside this first stage. Inputs here are the final A/S/K dimension scores.

Validation: `npm run test:ask`, existing assessment/survey/dashboard tests, `node scripts/test-period.mjs`, `npm run build`, `npm run check`. Browser checks use synthetic records only. Production deployment is not part of this change.

## Charts and quadrant colors

High/Low stacked bars share a 0–100% scale and the complete-score population. The ASK line chart uses the current selected range and two recursively shifted ranges; exact bounds and population counts appear beneath it. The full score scale is 0–100 and missing periods are never joined. These are aggregate changes, not individual transitions.

High Quadrant means at least two High dimensions; Low Quadrant means at least two Low dimensions. Cards are green for three High, green-to-yellow for two High, green-to-red for one High, and red for zero High. All eight workbook labels remain unique. Level arrows, written dimension names, counts, proportions, and neutral period-change text accompany the colors. Cards still open the filtered agent detail.

## ASK comparison controls

The assessed population appears in a separate coverage section. The primary metric row contains only High Attitude, High Skill and High Knowledge. Each card includes native collapsed Comparison details with exact periods, current/previous numerators and denominators, percentage-point change.

ASK Activity Category reuses existing linked-activity scope. ASK Performance Window is local to ASK and does not change the other pages' window selection. MoM/Quarter/Semester shift comparison boundaries by 1/3/6 months with month-end clamping. Selecting YTD sets the report From date to January 1 of the To date's year and compares with the same dates in the prior year. Missing history remains unavailable. ASK exports include the selected comparison window and its bounds.

## Local slide 2 report

Run `npm run dev -- --port 5175 --ask-dir "/path/to/private/ASK"` with Python 3 installed. The folder can contain the original August–October 2026 workbooks or files named `ASK_YYYY-MM.xlsx`. Restart the server after adding or replacing a workbook. The local endpoint returns monthly aggregates only and is unavailable in the deployment gateway. Workbooks stay outside the repository. The local report has its own monthly selector and uses the exact previous calendar month when available.

The local report supports CTP, GraPARI model, Area, Region, and Unit. GraPARI uses Area → Region → Unit. Call Center and E-Care use Region → Unit. The unit selector uses the source CTP, area, region, unit ID, and unit name together. The same selected location is used for the reporting period and the comparison. Multi-month quadrant counts use each CSR's latest valid placement across the period. Only aggregated counts are returned.

For an explicitly enabled local review, add `--ask-details` alongside `--ask-dir`. The loopback development server then serves names and scores for one selected unit and quadrant at a time. Multi-month detail uses the same last valid CSR assessment as the quadrant chart. The deployment gateway has no details route.

## Urutan pengembangan report September 2026

- Slide 2 sudah tersedia di localhost dari tab asli Data ASK. Alurnya Nasional → CTP → Area/Region → Unit → rincian kuadran dan detail CSR.
- Slide 3 memakai kartu Kelulusan Nasional yang sama. September mencatat High Attitude 3.957 (78,1%), High Skill 4.461 (88,0%), dan High Knowledge 4.162 (82,1%) dari 5.068 CSR. Pada pembaruan tampilan, beri keterangan High = skor ≥80.
- Slide 4 memakai kartu Kelulusan per Segmen untuk menampilkan jumlah High, jumlah Low, dan % High untuk Attitude, Skill, dan Knowledge per segmen. Tambahan yang perlu disiapkan adalah tiga parameter terendah per dimensi. Cocokkan dulu sumber tapping, populasi, pembagi, dan rumus peringkat dengan report September. Narasi Attitude di slide menyebut 0% High untuk Call Center dan E-Care, sedangkan tabel mencatat 49,2% dan 66,2%. Pakai angka tabel yang telah cocok dengan tab Data ASK untuk indikator kelulusan.
