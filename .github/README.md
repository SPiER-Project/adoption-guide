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

## Lower bound on the Node version

`web/`'s jsdom (`^30`) declares `engines: ^22.22.2 || ^24.15.0 || >=26.0.0`, so
**`.nvmrc` must not be pinned below 22.22.2.** As written it says `22`, which
`setup-node` resolves to the newest 22.x — 22.23.2 at the time of writing — and
that satisfies it.

⚠️ npm will not stop you getting this wrong: `engine-strict` is off by default,
so an install on a too-old Node only prints a warning. The failure shows up much
later, when the 18 jsdom test suites fail to load and therefore never run.

Verified on jsdom 30.0.1 rather than assumed: Node 20.17.0 fails, 22.22.2 — the
exact floor — passes, as do 22.22.3 and 24.18.0. **Do not match on a specific
error string**: the failure on 20.17.0 is `ERR_REQUIRE_ESM` (`require()` of an ES
module from `html-encoding-sniffer`), not the `webidl.util.markAsUncloneable` this
was previously documented as. The message moves between versions; the load
failure is the stable part. See the comment at the top of `web/vitest.config.ts`.
