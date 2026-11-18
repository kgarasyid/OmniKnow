# Connect OmniKnow to GitHub and the existing Vercel project

## Access status at handoff — 4 November 2026

The local project and its ZIP provide editable source. They do not grant GitHub repository access, Vercel membership, or deployment permission.

| Check | Result |
| --- | --- |
| Connected GitHub identity | `kgarasyid` |
| GitHub app installations and accessible repositories | Empty lists |
| Lookup of `kgarasyid/omniknow` | HTTP 404; existence and name availability are unverified |
| Local Git | Installed |
| GitHub CLI and saved Git Credential Manager accounts | CLI unavailable; no saved GitHub accounts reported |
| GitHub in Chrome | Sign-in page; authenticated browser access was unavailable |
| Vercel requests with explicit target team | HTTP 403 persisted after authorization was confirmed in chat |
| Remote changes performed by this handoff | No repository created or pushed; no Vercel Git connection or settings changed |

Authorization in chat does not create provider credentials or account permissions. The connected GitHub tools can modify an accessible existing repository, but expose no repository-creation operation. Vercel's `create_git_project` tool cannot reconnect an existing unlinked project with the same name. Complete the steps below while signed into the owning accounts.

## 1. Publish the local project as a private repository

Use the `omniknow` directory containing `index.html`, `package.json`, and `README.md` as the repository root. Do not publish its parent ChatGPT project mirror. If starting from the ZIP, extract it first and follow the README's local setup instructions.

Open a terminal in that directory and check the current state:

```powershell
git status
git branch --show-current
git log -1 --oneline
git remote -v
npm run build
```

The branch should be `main`. If the extracted copy has no Git history, initialize it once:

```powershell
git init -b main
git add .
git commit -m "Import OmniKnow Rev X deployed source"
```

If Git requests an author identity, configure your own name and a verified GitHub email or your GitHub-provided private email locally before repeating the commit.

### Option A — GitHub CLI

Install [GitHub CLI](https://cli.github.com/) if needed. Authenticate through its browser flow as `kgarasyid`, then confirm the signed-in account:

```powershell
gh auth login --hostname github.com --git-protocol https --web
gh auth status
```

When `kgarasyid/omniknow` is available and the local repository has no `origin` remote, create a private repository and push the existing commits:

```powershell
gh repo create kgarasyid/omniknow --private --source=. --remote=origin --push
```

These commands use the documented [browser authentication](https://cli.github.com/manual/gh_auth_login) and [repository creation](https://cli.github.com/manual/gh_repo_create) flows. If the name already exists, inspect that repository and its contents before choosing whether it is the intended destination. Do not overwrite another repository's history.

### Option B — GitHub website plus Git

1. Sign in as `kgarasyid` and open [Create a repository](https://github.com/new).
2. Choose owner `kgarasyid`, name `omniknow`, and **Private**. The name has not been reserved or verified as available.
3. Create an empty repository: leave README, `.gitignore`, and license initialization unchecked because this project supplies its own files.
4. Copy its HTTPS URL. From the local project, after authenticating Git through its normal browser or credential-manager flow, run:

```powershell
git remote add origin https://github.com/kgarasyid/omniknow.git
git remote -v
git push -u origin main
```

If `origin` already exists, inspect its URL before proceeding; do not add a duplicate or silently replace it. This follows GitHub's [existing local repository import instructions](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).

### Verify the upload and enable Codex access

Confirm GitHub shows the source files on `main`. Compare the two commit IDs below; the second line includes the remote branch name after the ID:

```powershell
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

For local Codex work, open this project folder, or clone the repository onto the computer where Codex runs. For connector or cloud repository work, grant the Codex/ChatGPT GitHub connection access to this private repository in its GitHub app installation settings, then verify the repository is listed. Signing in alone is not proof that repository access was granted.

## 2. Connect the existing Vercel project

Preserve this target:

| Field | Existing target |
| --- | --- |
| Team slug | `kgarasyid-4449` |
| Project | `omniknow` |
| Project ID | `prj_c3wzqYUlLSAxFJQ1llRWt62y2G0N` |

1. Sign in to [Vercel](https://vercel.com/dashboard), select team `kgarasyid-4449`, and open the existing `omniknow` project. Check its Project ID in Settings before changing it.
2. Open **Settings → Git**. Connect the GitHub repository `kgarasyid/omniknow` there. If the repository is absent, grant Vercel's GitHub integration access to that private repository. Keep using the existing project; creating another project would not preserve its deployment identity and domains. Vercel documents repository connections in the project's [Git settings](https://vercel.com/docs/git/vercel-for-github).
3. Open **Settings → Build and Deployment** and set the following values. These are the settings for this recovered static project:

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Root directory | Repository root; leave the field empty |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js version | `24.x` |
| Install command | `npm ci --ignore-scripts` (also recorded in `vercel.json`) |

The build and root settings are described in [Configure a Build](https://vercel.com/docs/builds/configure-a-build). Node `24.x` is supported; an `engines.node` value in `package.json` can override the dashboard selection. See [supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

4. Confirm the production branch is `main`, and that the connected repository's root contains `package.json`. Existing domains, environment variables, and protection settings belong to this Vercel project; preserve them.
5. Deploy the imported commit through the existing project's Git integration. Check the deployment's repository, branch, commit ID, build success, and production URL before considering the connection complete.

## 3. Verify the connected result

After a deployment succeeds, check the app's seven navigation sections, area/CTP filters, search, dashboard metrics, agent profiles, and downloads against the recovered baseline. The local verification documentation records the original artifact and checks; future intentional edits will change its hash.

A completed transfer has three independently verifiable parts: source committed and pushed to the intended GitHub repository, Codex able to read and edit that source, and the existing Vercel project reporting that repository and commit as its deployment source. A ZIP, a remote URL written in a README, or a public website alone does not establish those permissions or connections.
