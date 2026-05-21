#!/usr/bin/env node
// Fetches the SPiER roadmap from GitHub Issues and writes a static snapshot
// at web/src/data/roadmap.generated.json. The snapshot is committed (NOT
// gitignored) so the site always builds offline — running this script is
// only needed when refreshing the snapshot.
//
// Usage:
//   node web/scripts/fetch-roadmap.mjs                  # public repo, unauth
//   GITHUB_TOKEN=ghp_… node web/scripts/fetch-roadmap.mjs   # higher rate limit
//
// The fetch is best-effort: if GitHub is unreachable and a prior snapshot
// exists, we leave the existing file in place rather than corrupting it.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..', '..')
const outPath = join(repoRoot, 'web', 'src', 'data', 'roadmap.generated.json')

const REPO = process.env.SPIER_ROADMAP_REPO ?? 'bbthorson/SPiER'
const API_BASE = 'https://api.github.com'

function log(msg) {
  console.log(`[fetch-roadmap] ${msg}`)
}

function warn(msg) {
  console.warn(`[fetch-roadmap] WARN: ${msg}`)
}

function buildHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'spier-roadmap-fetch',
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  return headers
}

async function fetchAllIssues() {
  // GitHub paginates at 100/page. SPiER will never have thousands of issues,
  // but we paginate anyway in case of long-tail labels.
  const all = []
  let page = 1
  while (true) {
    const url = `${API_BASE}/repos/${REPO}/issues?state=all&per_page=100&page=${page}`
    const resp = await fetch(url, { headers: buildHeaders() })
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      throw new Error(`GET ${url} -> ${resp.status} ${resp.statusText} ${body}`)
    }
    const batch = await resp.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (batch.length < 100) break
    page += 1
  }
  return all
}

// ─────────────────────────────────────────────────────────────
// Label conventions (kept in sync with scripts/seed-roadmap-issues.mjs):
//   tool:TL-XXX        → bound to a specific tool catalog entry
//   priority:p1|p2|p3  → cross-cutting roadmap priorities
//   status:built|planned|future
//   type:epic          → top-level tracking issue (one per tool)
//   stage:<slug>       → pathway stage slug (matches catalog/stages.ts)
//   area:<slug>        → cross-cutting areas (patient-view, population, …)
// ─────────────────────────────────────────────────────────────

function pickLabel(labels, prefix) {
  const match = labels.find((l) => l.startsWith(`${prefix}:`))
  return match ? match.slice(prefix.length + 1) : undefined
}

function transform(rawIssue) {
  // GitHub's /issues endpoint returns PRs mixed in. Filter those out.
  if (rawIssue.pull_request) return null

  const labels = (rawIssue.labels ?? []).map((l) =>
    typeof l === 'string' ? l : l.name,
  )

  const status = pickLabel(labels, 'status')
  const priority = pickLabel(labels, 'priority')
  const type = pickLabel(labels, 'type')
  const toolId = pickLabel(labels, 'tool')
  const stage = pickLabel(labels, 'stage')
  const area = pickLabel(labels, 'area')

  return {
    number: rawIssue.number,
    title: rawIssue.title,
    state: rawIssue.state,
    url: rawIssue.html_url,
    bodyMd: rawIssue.body ?? '',
    labels,
    createdAt: rawIssue.created_at,
    updatedAt: rawIssue.updated_at,
    closedAt: rawIssue.closed_at ?? undefined,
    // Derived helpers — saves the page from re-parsing labels
    toolId,
    priority,
    status,
    type,
    stage,
    area,
  }
}

function readPriorSnapshot() {
  if (!existsSync(outPath)) return null
  try {
    return JSON.parse(readFileSync(outPath, 'utf8'))
  } catch (err) {
    warn(`could not parse existing snapshot: ${err.message}`)
    return null
  }
}

async function main() {
  log(`fetching issues from ${REPO}…`)
  let raw
  try {
    raw = await fetchAllIssues()
  } catch (err) {
    const prior = readPriorSnapshot()
    if (prior) {
      warn(`fetch failed (${err.message}); leaving prior snapshot in place`)
      return
    }
    warn(`fetch failed (${err.message}) and no prior snapshot; writing empty stub`)
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          fetchedAt: new Date().toISOString(),
          repo: REPO,
          error: err.message,
          issues: [],
        },
        null,
        2,
      ) + '\n',
      'utf8',
    )
    return
  }

  const issues = raw.map(transform).filter(Boolean)
  // Deterministic ordering: by issue number ascending. The page does its own
  // grouping; raw order here is just for diff stability.
  issues.sort((a, b) => a.number - b.number)

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    repo: REPO,
    issues,
  }
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8')
  log(`wrote ${issues.length} issue(s) to ${outPath.replace(repoRoot + '/', '')}`)
}

main().catch((err) => {
  console.error('[fetch-roadmap] FAILED:', err)
  process.exit(1)
})
