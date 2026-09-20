/**
 * The origins SPiER is deployed at, typed, from the one file that names them.
 *
 * `deploy-origins.json` sits at the repo root because three kinds of consumer
 * reach it and only one of them can use an alias: this module (for the apps,
 * `packages/core` itself and the mock EHR, all of which import
 * `@spier/core/lib/deployOrigins`), `packages/worker-http`, which imports the
 * JSON relatively because the two asset Workers that bundle it have no
 * `@spier/core` alias to offer, and `services/<name>/wrangler.jsonc`, which cannot
 * import at all and is held to the file by `scripts/check-deploy-origins.mjs`.
 *
 * ⚠️ Origins, not URLs. Every value is `scheme://host` with no trailing slash
 * (`pages` alone carries the path GitHub Pages serves under), so a consumer
 * always appends its own path and two consumers can never disagree about a
 * slash. The test beside this file holds that shape.
 *
 * ⚠️ These are personal-account `workers.dev` hosts until the project has a
 * domain (see `docs/internals/workers.md`). When it does, this file and the
 * wrangler copies the gate names are the whole change.
 */
import origins from '../../../../deploy-origins.json'

export type DeployOriginKey = 'guide' | 'clinical' | 'cds' | 'mockEhr' | 'pages'

const { $comment: _comment, ...values } = origins

export const DEPLOY_ORIGINS: Readonly<Record<DeployOriginKey, string>> = values
