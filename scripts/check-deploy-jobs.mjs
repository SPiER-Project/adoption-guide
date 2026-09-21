#!/usr/bin/env node
/**
 * Every Worker this repo can deploy is deployed by CI, from `main`, and by a
 * job that runs in the Worker's own directory.
 *
 * Until 2026-09-21 `services/mock-ehr` was the one Worker
 * `.github/workflows/deploy.yml` did not carry. Its README said so and asked
 * for `npm run deploy` by hand after any merge under that directory; eleven
 * commits touched it in six days and none of them reached the host. The demo
 * that resulted is the reason this file exists: the served chart page posted to
 * a CDS origin the 2026-09-20 split had already vacated, so *Recommendations
 * from SPiER* failed on every chart while `main` was green and every gate
 * passed. Nothing could see it, because "someone remembers to deploy" is not a
 * property a test can hold — unless the test is this one.
 *
 * RULES
 *   1. Every `services/<dir>/wrangler.jsonc` declares a `name`. A Worker with
 *      no name is one wrangler would name after the directory, silently.
 *   2. That name appears in `deploy.yml`. It is the string a reader of the
 *      workflow matches against the Cloudflare dashboard, and the reason a
 *      renamed Worker is worth noticing here rather than in a 404.
 *   3. Some job in `deploy.yml` both works in `./services/<dir>` AND runs a
 *      deploy there (`wrangler deploy`, or an `npm run deploy` that wraps it).
 *      Rule 2 alone would pass on a name typed into a comment, which is exactly
 *      the shape `check-worker-csp.mjs` rule 3 was planted against.
 *   4. The reverse direction: every deploy step in the workflow names a
 *      `services/<dir>` that exists and holds a `wrangler.jsonc`. A renamed or
 *      deleted service otherwise leaves a job deploying nothing.
 *   5. FLOOR: at least four services with a `wrangler.jsonc`, at least four
 *      deploy jobs matched, and the workflow parsed into jobs at all. A gate
 *      that reads no services and reports ✓ has checked nothing — the failure
 *      this repo keeps finding (#232, #261).
 *
 * Offline. Text-scanned rather than YAML-parsed on purpose: no YAML parser is a
 * declared dependency of this repo, and a gate that depends on a transitive one
 * breaks on an unrelated `npm install`. The scan is anchored to the workflow's
 * own two-space job indentation and fails loudly if that shape is gone.
 *
 * In the root `verify` as `check:deploy-jobs`.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const WORKFLOW = '.github/workflows/deploy.yml'
const SERVICES_DIR = 'services'
const MIN_SERVICES = 4

const failures = []
const fail = (msg) => failures.push(msg)

const stripJsonComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// ─── The Workers ────────────────────────────────────────────────────────────
const servicesPath = join(root, SERVICES_DIR)
if (!existsSync(servicesPath)) {
  console.error(`✗ no ${SERVICES_DIR}/ directory — the scan is broken, not the configs`)
  process.exit(1)
}

/** @type {Array<{ dir: string, name: string | null }>} */
const workers = []
for (const dir of readdirSync(servicesPath).sort()) {
  const configPath = join(servicesPath, dir, 'wrangler.jsonc')
  if (!statSync(join(servicesPath, dir)).isDirectory() || !existsSync(configPath)) continue
  let cfg
  try {
    cfg = JSON.parse(stripJsonComments(readFileSync(configPath, 'utf8')))
  } catch (err) {
    fail(`${SERVICES_DIR}/${dir}/wrangler.jsonc could not be parsed (${err.message})`)
    workers.push({ dir, name: null })
    continue
  }
  // Rule 1
  if (typeof cfg?.name !== 'string' || !cfg.name.trim()) {
    fail(`${SERVICES_DIR}/${dir}/wrangler.jsonc declares no "name" — wrangler would name the Worker after the directory, silently`)
    workers.push({ dir, name: null })
    continue
  }
  workers.push({ dir, name: cfg.name.trim() })
}

// ─── The workflow, split into jobs ──────────────────────────────────────────
const workflowPath = join(root, WORKFLOW)
if (!existsSync(workflowPath)) {
  console.error(`✗ ${WORKFLOW} is missing — every Worker is deployed by hand and nothing says so`)
  process.exit(1)
}
const workflow = readFileSync(workflowPath, 'utf8')
const lines = workflow.split('\n')

const jobsAt = lines.findIndex((l) => /^jobs:\s*$/.test(l))
if (jobsAt === -1) {
  console.error(`✗ ${WORKFLOW} has no top-level \`jobs:\` block — this scan reads the file by indentation and cannot`)
  process.exit(1)
}

/** Job id → its lines. Jobs are the two-space keys under `jobs:`. */
const jobs = new Map()
let current = null
for (const line of lines.slice(jobsAt + 1)) {
  if (/^\S/.test(line) && line.trim()) break // back to column 0 — out of `jobs:`
  const header = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/)
  if (header) {
    current = header[1]
    jobs.set(current, [])
    continue
  }
  if (current) jobs.get(current).push(line)
}
if (jobs.size === 0) {
  console.error(`✗ ${WORKFLOW}: read zero jobs under \`jobs:\` — the indentation this scan anchors to has changed`)
  process.exit(1)
}

/** A `run:` command that ships a Worker, in either of the two forms in use. */
const DEPLOYS = /(?:^|\s)(?:npx\s+)?wrangler\s+deploy\b|npm\s+run\s+deploy\b/

/**
 * Which service directories each job deploys into.
 *
 * A step's `working-directory:` applies to that step, so the pair that matters
 * is a working-directory and a deploy command inside ONE step. Steps are the
 * `- ` list items at six spaces.
 */
function deployedDirs(jobLines) {
  const dirs = new Set()
  /** @type {{ dir: string | null, deploys: boolean }} */
  let step = { dir: null, deploys: false }
  const flush = () => {
    if (step.dir && step.deploys) dirs.add(step.dir)
    step = { dir: null, deploys: false }
  }
  for (const line of jobLines) {
    if (/^ {6}- /.test(line)) flush()
    const wd = line.match(/working-directory:\s*\.?\/?(services\/[A-Za-z0-9_-]+)\/?\s*$/)
    if (wd) step.dir = wd[1]
    // `run:` may be inline or a block scalar; either way the command text is on
    // this line or the ones under it, and both are inside the same step.
    if (DEPLOYS.test(line)) step.deploys = true
  }
  flush()
  return dirs
}

const deployedByJob = new Map()
for (const [id, jobLines] of jobs) {
  const dirs = deployedDirs(jobLines)
  if (dirs.size > 0) deployedByJob.set(id, dirs)
}
const allDeployed = new Set([...deployedByJob.values()].flatMap((s) => [...s]))

// ─── Rules 2 and 3 ──────────────────────────────────────────────────────────
for (const { dir, name } of workers) {
  const path = `${SERVICES_DIR}/${dir}`
  if (name && !workflow.includes(name)) {
    fail(`${path}/wrangler.jsonc names the Worker "${name}", which appears nowhere in ${WORKFLOW} — a renamed Worker must be renamed in the job that ships it`)
  }
  if (!allDeployed.has(path)) {
    fail(`${path} has a wrangler.jsonc and no job in ${WORKFLOW} deploys it — add one beside the others, or this Worker ships only when someone remembers to run \`npm run deploy\` (which is how the demo host fell weeks behind main)`)
  }
}

// ─── Rule 4 ─────────────────────────────────────────────────────────────────
const known = new Set(workers.map((w) => `${SERVICES_DIR}/${w.dir}`))
for (const [id, dirs] of deployedByJob) {
  for (const dir of dirs) {
    if (!known.has(dir)) {
      fail(`${WORKFLOW} job "${id}" deploys from ${dir}, which is not a service with a wrangler.jsonc — a renamed or deleted service leaves a job shipping nothing`)
    }
  }
}

// ─── Rule 5 ─────────────────────────────────────────────────────────────────
if (workers.length < MIN_SERVICES) {
  fail(`found ${workers.length} service(s) with a wrangler.jsonc, below the floor of ${MIN_SERVICES} — the scan is broken, not the repo`)
}
if (allDeployed.size < MIN_SERVICES) {
  fail(`matched ${allDeployed.size} deploy job(s) in ${WORKFLOW}, below the floor of ${MIN_SERVICES} — either a Worker lost its job or the step reader is broken`)
}

const summary = `check-deploy-jobs: ${workers.length} Worker(s) in ${SERVICES_DIR}/, ${allDeployed.size} deployed by ${WORKFLOW} (${[...deployedByJob.keys()].join(', ')})`
if (failures.length) {
  console.error(`✗ ${summary}`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`✓ ${summary} — every Worker ships from main`)
