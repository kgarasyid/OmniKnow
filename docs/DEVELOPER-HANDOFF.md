# OmniKnow developer handoff

## Run and edit

Extract the ZIP, open its `omniknow` directory in any editor or Codex local project, and install Node.js 24.x with npm. Run these commands inside the extracted directory:

```sh
npm ci --ignore-scripts
npm run dev
```

Open http://127.0.0.1:5173. Edit source, save, and refresh. There are no npm application dependencies. If npm is unavailable, run `node scripts/serve.mjs` directly.

## Source map

| File | Responsibility |
|---|---|
| index.html | App shell, sidebar pages, base styles and roster logic |
| dashboard-workspace.js | Six dashboard categories, filtering UI and program tables |
| dashboard-insights.js | Executive Summary, participant charts, rankings and E-Care |
| dashboard-period.js | Date ranges, dated demo history, chart MoM and detailed VoC |
| dashboard-workspace.css | Dashboard styles, palette and responsive layouts |
| dashboard-downloads.js | PDF and native XLSX generation |
| survey-monitor.js | Separate pre/post survey connections and pairing |
| api/survey-feed.js | Server-side feed reader |
| survey-feed-template.gs | Optional Google Apps Script feed template |
| scripts/ | Local servers, build and tests |
| reference/ | Historical recovered baseline, not the current application |

Script order matters: global helpers are initialized by index.html. There is no bundler. The build copies browser assets to dist; Vercel deploys the API from api/ separately.

## Verify

```sh
npm run build
npm run check
npm run test:assessment
npm run test:survey
npm run test:dashboard
node scripts/test-period.mjs
npm run preview
```

Preview: http://127.0.0.1:4173. Test October 2026, an exact day, an empty period and each CTP. Open all three Executive Summary recommendation links and VoC detail. Export PDF and Excel. SOURCE-MANIFEST.json in the ZIP contains per-file SHA-256 hashes and the source commit.

## Executive Summary and data

The Summary tab begins with summaries for GraPARI, Call Center and E-Care, pain points, and exactly three proposed plans. The selected range and filters drive its counts, ASK scores, paired post-test scores and feedback ratings. ASK weighting is 40% Attitude, 30% Skill, 30% Knowledge. The labelled showcase threshold is 80. Recommendation populations can overlap; no completed action or company policy is inferred.

Demo history covers August–October 2026. Read REPORTING-PERIOD.md for snapshot/event differences. VoC overall is an illustrative rating / 5. Local browser edits and imports use localStorage, not shared storage, and are not included in this ZIP. There is no enterprise login or shared database. See SURVEY-CONNECTIONS.md for source setup and limitations. Older audit documents describe historical releases.

## Git and deployment access

This is an editable source archive, not an account permission grant. No .git directory, browser data, credentials, .vercel directory or node_modules are included. Initialize your own repository:

```sh
git init -b main
git add .
git commit -m "Import OmniKnow source"
```

Configure your own Git author if prompted. Create a repository in your organization and push using your authorized account. Import it into Vercel with Framework Other, Build Command `npm run build`, Output Directory `dist`, Install Command `npm ci --ignore-scripts`, and Node.js 24.x. Keep the supplied vercel.json.

To maintain the existing omniknow.vercel.app website, the owner must grant your developer team/project access and connect your repository to that existing project. Creating a new project does not transfer the existing domain. No GitHub repository is created or connected by extracting this package.
