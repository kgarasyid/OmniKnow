# Recovery verification — 4 November 2026

## Scope and source identity

The task is to make the deployed Rev X client application editable in Codex while preserving its behavior. The checked path is: public production response → recovered source → static build → local browser → existing client-side data and exports. There is no backend/API data path in the recovered application.

The public HTTPS response from `https://omniknow.vercel.app/` was saved without changing its bytes. The HTML contains `Build 2026-10-26 Rev-X`. The Vercel connector's project summary reported:

- Project `omniknow`, ID `prj_c3wzqYUlLSAxFJQ1llRWt62y2G0N`
- Team ID `team_WJia9XLZutMg9OMjMGjtHs0D`, slug `kgarasyid-4449`
- Latest production deployment `dpl_A2TVJtZFgcZU1SmTa7r7EczYyr5p`, state `READY`
- Deployment URL `https://omniknow-6zg75imb2-kgarasyid-4449.vercel.app`

Deployment details/source-tree requests with the explicit team returned HTTP 403, including a retry after the user confirmed team authorization. Therefore the recovery is from the public application response, not an authenticated source-tree export. No private source history, server configuration, or user browser data was recovered. The public app is self-contained and has no external asset dependencies in its source.

## Integrity and build checks

All four artifacts matched byte-for-byte: editable `index.html`, `reference/deployed-index.html`, generated `dist/index.html`, and a fresh public production response.

- Size: **161,415 bytes**
- SHA-256: `4a935063307e91045ced5abbb7723b1b62e6ff15e6d221f6e24f3666033688be`
- Capture timestamp and response headers: `reference/deployment.json`
- Runtime: Node **24.19.0**
- npm: **12.2.1**, temporarily obtained from the official npm registry and checked against its SHA-512 integrity value because npm was not on this machine's PATH; no global npm installation was made
- `npm ci --ignore-scripts`: passed, no dependencies
- `npm run build`: passed
- `npm run check`: passed (inline JavaScript parses; source and build are identical)
- `npm run verify:baseline`: passed
- `npm run verify:live`: passed at recovery

The npm commands were invoked using the temporary npm CLI path. The repository itself uses ordinary portable npm scripts and has no dependency on that temporary path.

The local build server returned HTTP 200 and 161,415 bytes for `/` and `/index.html`. It returned HTTP 404 for `/package.json`, `/.git/config`, and a README traversal request. It binds to `127.0.0.1`. Independent scaffold review found malformed URLs could terminate the new local server; URL parsing was guarded, and a regression check confirmed `//` returns HTTP 400 while the server stays alive and continues serving the exact source bytes. No application HTML changed.

## Browser comparison

A fresh production tab and the local build at `http://127.0.0.1:4173` were navigated through all seven sections using their actual sidebar controls. Full rendered body text matched for each corresponding page. No error-level console messages were captured in either tab during this comparison.

| Page | Production/local rendered text |
| --- | --- |
| Training Dashboard | Equal; 14,755 characters |
| Add Activity | Equal; 1,764 characters |
| ASK & Capability | Equal; 12,414 characters |
| Pre-Post Test Evaluation | Equal; 6,117 characters |
| BCSA & Agent Directory | Equal; 15,086 characters |
| Reports & Exports | Equal; 1,634 characters |
| Administration | Equal; 4,325 characters |

The local dashboard screenshot was visually inspected. Its navigation, charts, cards, and initial KPIs rendered: 48 agents, 88% completion, 16.5 percentage-point gain, and 85% certification. Text equality is not a pixel-by-pixel screenshot comparison or an exhaustive responsive-layout audit.

Local interactions also confirmed:

- Selecting Sumatera and applying Search Now produced **12 agents**.
- Searching `SYN-0001` produced **one agent**, Alya Pratama, with pre/post values **48/57**.
- The ASK table exposed an individual **Download PDF for Alya Pratama** button.
- The ASK page displayed the **Rev-X** marker.

The first attempted text comparison involved a production tab that had changed to another page. A fresh comparison tab resolved that differing page state; the table above records the corresponding-page comparisons.

## Actual saved downloads

The following files were created in the local Downloads folder by clicking the local application's existing controls using synthetic data:

| File | Size | Check |
| --- | ---: | --- |
| `OmniKnow-Agent-SYN-0001.pdf` | 1,822 bytes | `%PDF-1.4` signature, EOF marker, SYN-0001 and Alya Pratama present |
| `OmniKnow-ASK-Filtered-2026-11-04.pdf` | 10,391 bytes | PDF signature and EOF marker; synthetic agent identity present |
| `omniknow-filtered-2026-11-04.csv` | 2,889 bytes | Header plus 12 filtered records; SYN-0001 present |
| `omniknow-filtered-2026-11-04.xls` | 15,208 bytes | Spreadsheet XML namespace; SYN-0001 present |

The browser tool's download-event waiter timed out for the individual PDF, but filesystem inspection confirmed that the file was actually saved. The timeout was not treated as proof of a failed app download. PDF signatures/content markers were checked; PDF page layout and opening the XML export in Microsoft Excel were not tested.

## Limits and preserved behavior

- The application source was not repaired or refactored. The audit documents existing certification spelling, PDF-label, and scoring inconsistencies.
- No exhaustive CSV-import, persistence/recovery, activity approval, every-record export, or mobile test was performed. The complete source and build identity protects those unchanged implementations, but does not establish that they are defect-free.
- No GitHub repository was created or pushed. Connected GitHub repository access was unavailable; its browser session was signed out.
- No Vercel Git connection, project setting, protection setting, or production deployment was changed.
- An importable ZIP and a Git bundle provide source/history portability only. Provider credentials and permissions remain separate.

Future edits should run `npm run build` and `npm run check`. Use baseline/live checks when exact identity is intended, and test changed user flows in a browser.
