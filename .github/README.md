# `.github/`

## `.nvmrc` — why it is here and not at the repo root

`.nvmrc` pins the Node version for **GitHub Actions only**. Every `setup-node`
step across the eight workflows reads it via `node-version-file:
.github/.nvmrc`, so the version has one definition instead of the thirteen
hardcoded `node-version: 20` lines it replaced.

⚠️ **Do not move it to the repo root.** Cloudflare Workers Builds — which deploys
`services/cds-hooks` (the one Worker serving both the SPA and the CDS Hooks API,
see `docs/internals/workers.md`) — reads a root `.nvmrc` to choose the Node
version for the *deploy* build. Putting it there silently repoints production's
build environment as a side effect of a CI-only change, and the build fails at
environment setup in under a second with no log output, which is very hard to
read as "your Node pin did this". That happened on the first attempt; the file
lives here so a CI pin cannot reach the deploy.

The same caution applies to `.node-version`, which Workers Builds also reads.

To change the CI Node version, edit this one file. To change the *deploy's* Node
version, set it in the Cloudflare Workers Builds configuration, not here.
