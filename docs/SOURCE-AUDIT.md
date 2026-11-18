# OmniKnow Rev-X source audit

## Scope

This audit examines the recovered `index.html` without changing its application code. The page title is **OmniKnow — Training Intelligence** and its visible revision marker is **Build 2026-10-26 Rev-X**. Recovery, packaging, and any Git repository do not themselves transfer access to a Vercel account or project. Deployment provenance and connection status are documented separately.

The application is one self-contained HTML document with inline CSS and JavaScript. No external script or stylesheet dependencies, embedded HTTP resource URLs, API requests, or backend connections were found in this source. It uses modern browser features including `structuredClone`, `Blob`, object URLs, and `File.text()`.

## Application behavior to preserve

Seven sections appear in the sidebar:

1. Training Dashboard
2. Add Activity
3. ASK & Capability
4. Pre-Post Test Evaluation
5. BCSA & Agent Directory
6. Reports & Exports
7. Administration

Navigation changes an in-memory page index and replaces the application markup. There are no URL routes or deep links. Legacy Training Operations and Agent Directory functions remain in the source; navigation shortcuts redirect to the combined dashboard and directory sections.

Filters cover area, region, channel/CTP, activity category, performance comparison window, and agent/region search. Category filtering depends on agent IDs linked through activity attendance or assessment records. Consequently, the seeded Bootcamp activity initially matches no agents even though the activity itself exists.

The application initializes 48 synthetic agents, 24 GraPARI unit profiles, and two activities. ASK scoring uses 40% attitude, 30% skill, and 30% knowledge. BCSA calculates its ASK input as the simple average of those three components, then applies the configurable training/ASK/service weights. These are distinct existing calculations.

## Persistence and access boundaries

Changes are stored in browser `localStorage` under `omniknow-proto-v1`. Storage is specific to an origin and browser profile. The production site, a localhost development server, a preview deployment, and a different browser each have separate stored data. Copying this source or importing a ZIP does not migrate browser edits, account ownership, permissions, or deployment access. Changing the local port also changes the local origin.

If storage is unavailable, the application reports that edits last only for the current session. Its reset control restores the synthetic initial state. Audit entries are editable browser-local data, not a durable or independently verified audit trail.

There is no shared database, real login, SSO, role enforcement, or authenticated enterprise integration. The visible Demo Admin identity is presentation state. Meeting providers are not connected. The meeting draft action truncates the supplied transcript and appends fixed text; it does not call an AI or transcription service. Historical comparison values are generated synthetic fixtures rather than stored historical observations. Scoring approvals and publication statuses are local simulations, not enterprise approvals.

## Import and export behavior

| Action | Existing implementation |
| --- | --- |
| Filtered CSV and report exports | CSV generated in the browser, with quoted fields and a UTF-8 BOM. |
| Filtered Excel export | Excel 2003 Spreadsheet XML saved with an `.xls` extension; this is not an `.xlsx` workbook or binary XLS file. |
| Filtered ASK and individual profile PDFs | Directly generated PDF 1.4 documents, downloaded through a Blob URL. |
| Meeting minutes | Browser-generated `.txt` download. |
| Agent CSV import | Validates required columns, IDs, geographic values, booleans, and score ranges before appending records. |
| GraPARI unit CSV import | Validates required columns and selected values, then replaces the current unit profile list. |
| Activity assessment CSV import | Accepts `agent_id,score` pre/post CSV records, validates them, and updates linked assessment records and agent scores. |
| Unit profiles, scoring, evidence, and reviews | Local editing and persistence; no server submission. |

Download controls create object URLs and click temporary anchor elements. Successful generation or a notification that a download was requested does not alone prove that a browser saved the file. Browser download permissions and the browser's destination behavior still apply. PDF output uses a basic text layout and normalizes unsupported characters; it is not a capture of the on-screen charts.

## Preserved existing inconsistencies

These observations are documented without repairing the recovered application:

- The certification chart checks the spelling `Remidial`, while agent metadata uses `Remedial`. The chart can therefore omit that group from its displayed segments.
- The Reports notice says PDF generation requires a backend, but the current source contains direct browser PDF generation.
- The filtered PDF option is labelled “PDF (Print / Save),” although it requests a direct PDF download.
- The ASK screen uses weighted ASK scores, while BCSA uses an unweighted ASK average as one input to its separately weighted formula. Changing one to match the other would change existing behavior.

## Source-level verification performed

The inline script was evaluated in an isolated Node VM with synthetic storage and final DOM rendering suppressed. The checks below exercise source functions; **they are not browser interaction, visual, download-save, or deployment verification**.

| Check | Observed result |
| --- | --- |
| Initial agents / units / activities | 48 / 24 / 2 |
| Completed agents and completion KPI | 42; 88% |
| Certified agents and certification KPI | 41; 85% |
| Average knowledge gain | 16.5 percentage points |
| BCSA eligible agents | 36 |
| First synthetic agent weighted ASK / BCSA scores | 61.8 / 63.5 |
| Sumatera filter | 12 agents |
| Search for `SYN-0001` | 1 agent |
| Initial Bootcamp category filter | 0 linked agents |
| CSV quoted commas and escaped quotes | Parsed as expected |
| Generated PDF Blob type | `application/pdf` |

## Manual browser smoke checklist

Use a fresh browser profile or an unused local origin so existing local edits do not alter the initial expected values. Use synthetic records throughout.

- [ ] Open the application and confirm the Rev-X marker, seven navigation sections, and initial KPI values above. Visit every section and check for missing content or browser errors.
- [ ] Filter to Sumatera and confirm 12 agents. Search for `SYN-0001` and confirm one matching record. Reset filters and exercise a table sort and an agent profile.
- [ ] Change comparison windows and chart groupings; confirm the page updates without losing the current filters.
- [ ] Download a filtered CSV and inspect its rows. Download the Excel option and confirm that the file is Spreadsheet XML. Download an ASK PDF and an individual profile PDF, open both, and check their scope and readable content. Confirm the files actually appear in the browser's download destination.
- [ ] In a test activity, import a small valid pre/post assessment CSV, confirm score changes in the evaluation view and reports, then try an invalid or unknown agent ID and confirm rejection.
- [ ] Add or edit a synthetic unit, reload, and confirm persistence on the same origin. Use an isolated test state when trying unit CSV import because it replaces the unit list.
- [ ] Save a synthetic meeting note, download its text file, and inspect the contents. Confirm review/publication status changes remain after reload.
- [ ] Change scoring weights to a valid total of 100 and confirm the new draft version. Try an invalid total and confirm validation. Reset the synthetic demo when finished.
- [ ] Confirm that another origin starts with its own synthetic state; do not mistake that separation for failed migration of repository files.
