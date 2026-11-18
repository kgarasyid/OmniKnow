# OmniKnow editing guide

- Read README.md and docs/SOURCE-AUDIT.md before changing application behavior.
- index.html is the editable application source recovered from Rev X. Preserve existing UI and behavior unless the task requests changes.
- reference/deployed-index.html and reference/deployment.json record the recovery baseline. Keep them unchanged; do not silently replace the baseline with edited code.
- The build copies index.html to dist/index.html without transformation. Edit index.html, never dist/.
- Run npm run build and npm run check after edits. npm run verify:baseline is expected to fail after intentional source changes; it checks exact Rev X identity. npm run verify:live compares against the current public deployment, which may change.
- Use fictional records for testing. Browser localStorage and imported records are not part of the source repository.
- Never add credentials, .env files, .vercel state, or browser storage to Git.
- This recovery does not authorize a production redeploy. Verify the existing Vercel project and requested target before any deployment.
