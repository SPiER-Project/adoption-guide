#!/usr/bin/env node
/**
 * Write `services/cds/wrangler.bootstrap.json`: the CDS Worker's own config
 * with its service bindings removed, for the ONE deploy that has to happen
 * before `spier-mock-ehr` exists.
 *
 * ⚠️ **Why this exists: the two Workers bind each other, and Cloudflare will
 * not deploy a binding to a Worker that is not there** (`code: 10143`). CDS
 * binds the mock EHR (`CLIENT`, to fetch its JWKS) and the mock EHR binds CDS
 * (`CDS`, to invoke it) — both because a same-zone `fetch()` between Workers is
 * refused (see `services/cds/src/auth.ts`). On an empty account neither can go
 * first. It happened for real on 2026-10-20, moving to the SPiER account.
 *
 * `deploy.yml` runs this only when the account has no `spier-mock-ehr`, deploys
 * CDS from the result, lets the mock EHR deploy against it, then redeploys CDS
 * from the real config (the `cds-bind` job). A CDS without `CLIENT` still runs —
 * the binding is optional and falls back to `fetch` — it just cannot verify the
 * mock EHR's tokens until that last deploy, minutes later.
 *
 * Derived, never checked in: a hand copy of the config would carry its own
 * `vars`, and `check:origins` reads only `wrangler.jsonc`. Gitignored.
 *
 * Fails, rather than writing a no-op copy, when there is no binding to remove:
 * that means the reason for this file has changed and the workflow should too.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripJsonc } from './lib/jsonc.mjs'

const dir = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'services', 'cds')
const config = JSON.parse(stripJsonc(readFileSync(join(dir, 'wrangler.jsonc'), 'utf8')))

const bindings = config.services ?? []
if (!bindings.some((b) => b.service === 'spier-mock-ehr')) {
  console.error('✗ cds-bootstrap-config: services/cds/wrangler.jsonc binds no spier-mock-ehr — nothing to bootstrap; update deploy.yml')
  process.exit(1)
}

delete config.services
// Written beside wrangler.jsonc so its relative paths (`main`, `$schema`) still resolve.
writeFileSync(join(dir, 'wrangler.bootstrap.json'), JSON.stringify(config, null, 2) + '\n')
console.log(`✓ cds-bootstrap-config: wrote services/cds/wrangler.bootstrap.json without ${bindings.map((b) => b.binding).join(', ')}`)
