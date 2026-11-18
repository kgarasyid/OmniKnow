# Separate pre-test and post-test response connections

The evaluation page now has two independent sources. Each can save an optional form respondent URL and a separate response-data URL. Saving a form URL only creates an Open form link; it does not read responses.

Supported response sources are Google Sheets CSV exports (including readable sheet editor URLs, converted to an export for the specified gid) and deployed Google Apps Script JSON feeds. Sign-in-only sheets are rejected. This prototype does not authenticate to Google or Microsoft; Microsoft form links can be saved for opening, but their private workbooks cannot be synchronized by this connector.

## Connect

1. Create the two forms and connect each to its response spreadsheet/tab. Use one assessment per tab.
2. Include Agent ID and Score columns. IDs must match the Agent Directory. The directory supplies CTP and Area/Site; these values are not inferred from untrusted survey text.
3. For Apps Script, configure `survey-feed-template.gs` with spreadsheet IDs, sheet names and column headings. Deploy as a web app with the access you intend. The endpoint exports only Agent ID, Score and Timestamp. Use `/exec?stage=pre` and `/exec?stage=post` in the two source panels.
4. Click Read columns, map each source independently, set its maximum score, and click Connect. Plain numeric scores use the configured maximum. Fractions such as `8 / 10` and percentages normalize directly to 0–100. Timestamp must be ISO 8601 with timezone; leave it unmapped for last-row precedence.
5. Set the expected roster. The default is all directory agents. Use current filters to choose a subset, or paste exact IDs.
6. Choose Connected Pre-Test + Post-Test responses to update the assessment charts and evaluation comparisons. Existing training/service metrics stay on their existing records. Original scores are never overwritten; switch back to existing scores to restore the prior view.
7. Start auto-refresh independently on each source (30 or 60 seconds). It runs only while the evaluation page is visible; editing fields pauses new automatic requests. Refresh now remains available. Google publication/cache delays can exceed the selected interval.

## Counting and failures

Completion means unique expected IDs with valid scores, separately for pre and post. Unknown/out-of-roster IDs and invalid scores are counted as exclusions. Repeated IDs use the latest ISO timestamp; equal timestamps use the later row. With no timestamp mapping, the last valid row wins. Unscored form submissions do not count as complete.

Only valid paired responses enter pre/post distribution and gain comparisons. A pre-only response increases pre progress but does not borrow an existing dummy post score. A valid empty feed clears that source's snapshot. A failed fetch or invalid mapping retains the last successful snapshot and visibly reports the error. The last successful sync and last response are separate timestamps. Automatic failures back off to at most four times the selected interval.

Settings, snapshots and expected IDs live in the existing browser-local state. Different browsers/devices do not share settings. The original survey's open/closed state is not detected. The sample button loads deterministic local fixtures and is explicitly marked as a local sample, not a successful Google connection.

## Access and implementation

Use non-sensitive showcase records: these are unauthenticated readable feeds. Publishing data does not make it private or create a login system. A private production integration requires authentication and a separate access design.

`api/survey-feed.js` is a read-only Vercel Node function accepting same-origin POST requests. It allowlists Google source URLs and redirect hosts, rejects credentials and non-HTTPS sources, does not forward cookies, limits responses to 2 MB, and times out after 15 seconds. It does not persist or log response rows or URLs. The function is not a general URL proxy. No account token is needed for public demo feeds.

Run `npm run test:survey`, `npm run test:assessment`, `npm run build`, and `npm run check`. The local development server also serves the API and public monitor assets. `scripts/serve-survey-test.mjs` is an isolated synthetic integration fixture at port 5175 and must not be uploaded to Vercel. It exercises the actual handler and browser flow using mock upstream Google responses.

Reference documentation: [Apps Script Content Service](https://developers.google.com/apps-script/guides/content), [Apps Script web apps](https://developers.google.com/apps-script/guides/web), and [Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js).

## Verification performed

Node tests cover independent sources, score scaling and fractions, invalid/missing scores, latest timestamp versus last-row duplicates, unknown IDs, empty feeds, snapshot retention, original-score preservation, CSV/JSON parsing, source URL restrictions, Google redirects, login HTML, response size and same-origin checks. Existing assessment tests pass.

Browser integration used the actual read-only handler with a synthetic upstream feed on local port 5175: read columns, map each source, connect, select connected chart data, and enable 30-second pre-test polling. Pre-test progress advanced from 2 to 3 while post-test stayed at 2; both assessment charts remained at 2 matched pairs. A simulated upstream 404 retained those snapshots and showed an error. The same pairs appeared on the dashboard. Help download and a 520px actual narrow viewport were checked with no console errors. No user-owned Google response feed has been supplied or connected yet.

Production deployment `dpl_AjHG4kfyGkR9PS21Ere8ioHBh3BB` reached READY with the public alias. HTML, monitor JavaScript and template matched the local build. The deployed API returned the expected HTTP 400 JSON error for a non-Google URL, confirming the function is running and enforcing its source restrictions. The live browser displayed two independent form-link fields and two independent response-data fields without console errors.
