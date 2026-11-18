# OmniKnow — complete editable developer package

**Current handoff:** Start with [DEVELOPER-HANDOFF.md](docs/DEVELOPER-HANDOFF.md). This package includes the latest Executive Summary, dated reporting, MoM comparisons, detailed VoC, all application source, tests and build scripts. `SOURCE-MANIFEST.json` in the ZIP identifies the source revision and file checksums.

Extract the ZIP and open its `omniknow` folder in your editor. With Node.js 24.x installed, run `npm ci --ignore-scripts` and `npm run dev`, then open http://127.0.0.1:5173. Save code changes and refresh the browser. Run `npm run build` for deployable output. No browser data, account credentials or Git metadata are included.

**Archive versus access:** The ZIP grants editable source files only. It does not grant GitHub or Vercel account permissions. Initialize your own Git repository or connect an authorized developer account separately. This current package contains no Rev X Git bundle; references to that older ZIP/bundle in the historical recovery notes below do not apply to this package.

## Historical recovery and setup notes

This project extends the recovered Rev X application with a shared redesign across all seven pages and synchronized pre/post score-distribution charts. The original recovery remains unchanged under reference/. See docs/REDESIGN.md for data rules and checks.

**Access status:** Codex can edit this local Git project and Vercel team access has been verified. No GitHub repository or Vercel Git connection has been created. The old Rev X ZIP is an archive of the recovery, not this redesign or an account permission grant.

## Start locally

The Pre-Post Evaluation page now supports separate survey response connections. See [Survey connections](docs/SURVEY-CONNECTIONS.md) for setup, scoring, polling and access limits. `api/survey-feed.js` reads accessible Google feeds; `survey-monitor.js` handles the browser UI. There is still no shared database or account login. The older recovery audit below describes the original static baseline.

Use Node.js **24.x**, with npm. There are no application or development dependencies.

```powershell
npm ci --ignore-scripts
npm run dev
```

Open **http://127.0.0.1:5173**. Edit `index.html`, save, and refresh the browser. This server intentionally does not inject a live-reload client or transform the recovered application. Stop it with Ctrl+C.

Create and inspect the deployable output:

```powershell
npm run build
npm run check
npm run preview
```

The preview uses **http://127.0.0.1:4173**. To choose another port, use `npm run dev -- --port 5174`. Each port is a different browser-storage origin.

If npm is not on PATH but Node is available (as in some bundled Codex runtimes), the same scripts can run directly:

```powershell
node scripts/serve.mjs
node scripts/build.mjs
node scripts/check.mjs
node scripts/serve.mjs --dist
```

Run each server in its own terminal. No package installation is required for the direct Node commands.

## Open/import into Codex

1. Extract `omniknow-rev-x-codex.zip` to a permanent folder, for example `C:\Users\Kgs Abdul Rasyid\Documents\Codex\omniknow`. Use the extracted `omniknow` folder containing this README and `package.json`, not the ZIP file or its parent directory. Do not put working files in the synced ChatGPT project's `sources/` folder.
2. Add that folder as a **local project** in the desktop app. For an existing local project, open its menu → **Edit project** → **Add folder**, then make this folder primary. The primary folder supplies Git context and `AGENTS.md` to new chats. These controls are documented in [OpenAI's Projects and chats guide](https://learn.chatgpt.com/docs/projects#use-local-projects-for-folders-and-codebases).
3. Start a chat in that local project. A useful first request is: “Read README.md and docs/SOURCE-AUDIT.md, run the build and checks, then start OmniKnow locally. Preserve Rev X behavior until I request a change.”
4. If using the Codex CLI instead, open a terminal in this folder and run `codex`, or use `codex --cd "C:\Users\Kgs Abdul Rasyid\Documents\Codex\omniknow"`. In the IDE extension, open this folder as the workspace. See the same [official project guidance](https://learn.chatgpt.com/docs/projects).
5. The source ZIP does not include a hidden `.git` folder. It includes `omniknow-rev-x.bundle` beside the source folder. To restore the prepared history, extract the bundle and clone it into a new folder: `git clone "C:\path\to\omniknow-rev-x.bundle" omniknow`. Run `git remote remove origin` afterward; the initial origin points to the local bundle, not GitHub. Alternatively initialize the extracted ZIP with `git init -b main`, `git add .`, and `git commit -m "Import OmniKnow Rev X"` after configuring your own Git author name/email.

Opening a folder makes its source editable locally. Uploading an archive to a ChatGPT project's Sources does not create a writable local project or a remote repository. Publishing to GitHub and granting its integration access are separate steps.

## Files and edit points

```text
index.html                    Editable application: HTML, CSS, JavaScript, synthetic data
package.json                  Local development, build, and verification commands
package-lock.json             Reproducible dependency-free npm project
vercel.json                   Static build: npm run build → dist
scripts/build.mjs             Copies application bytes unchanged
scripts/serve.mjs             Local-only static server for source or build
scripts/check.mjs             Syntax and artifact-integrity checks
reference/deployed-index.html Unmodified recovery baseline
reference/deployment.json     Capture time, hashes, URLs, project/deployment evidence
docs/SOURCE-AUDIT.md           Behavior, persistence, exports, existing limitations
docs/VERIFICATION.md           Checks actually performed and their limits
docs/REMOTE-SETUP.md           GitHub publishing and existing Vercel connection steps
AGENTS.md                     Guidance for later Codex edits
dist/index.html               Generated deployment output; ignored by Git
```

The original application stays in one HTML file to preserve script order, event handlers, selectors, and behavior. A later extraction into separate CSS/JavaScript modules should be a separately reviewed change. The build copies the file directly; it does not bundle, minify, or rewrite anything.

## Verify fidelity

```powershell
npm run build
npm run check
npm run verify:baseline
npm run verify:live
```

`check` confirms that the inline script parses and the build equals the editable source. `verify:baseline` additionally compares it against the frozen recovery and its recorded hash. `verify:live` fetches the current public URL and compares its full response body. The live check needs internet access. A mismatch after deliberate editing or a later deployment is expected and should be investigated; these checks never overwrite source.

At recovery, the source and build were **161,415 bytes**, with SHA-256:

```text
4a935063307e91045ced5abbb7723b1b62e6ff15e6d221f6e24f3666033688be
```

This proves equality to the public response captured at recovery, not recovery of private server files or historical source-control commits. The Vercel connector reported production deployment `dpl_A2TVJtZFgcZU1SmTa7r7EczYyr5p`; its source-tree API remained forbidden, so the association relies on the connector's project summary plus the public page's Rev-X marker. The raw response is sufficient to run this self-contained client application.

## Data and existing behavior

The application is a synthetic training-intelligence prototype with 48 seeded agents. It has no backend, shared database, real login, or environment-variable requirements. Edits and imports use browser `localStorage` under `omniknow-proto-v1`. Production, localhost, and preview origins have separate data. This recovery includes shipped sample data, not your browser's saved edits or uploaded records.

The browser creates CSV, Excel-compatible XML (`.xls`), PDF, and meeting-note downloads. Existing text and calculation inconsistencies are preserved and documented in [the source audit](docs/SOURCE-AUDIT.md); source fidelity does not mean every pre-existing feature is defect-free.

## GitHub and Vercel

Follow [REMOTE-SETUP.md](docs/REMOTE-SETUP.md) to publish a private repository and connect it to **the existing** Vercel project `omniknow`, team `kgarasyid-4449`. Do not create a replacement Vercel project. Verify the repository URL and deployed commit afterward. `vercel.json` records the build settings but does not authenticate or link the project.

The local recovery commit uses a clearly labelled machine author (`OmniKnow Recovery <recovery@localhost>`) because no local Git author identity was configured. Set your own repository-local identity before your next commit. No publishing license has been invented or granted by this recovery.
