/**
 * SMART `intent` — the launch parameter that says *which tool to open*.
 *
 * SMART on FHIR defines `intent` as an opaque string agreed between the EHR and
 * the app ("open-cssrs-full"), which means the vocabulary is ours to define and
 * the definition is the interesting part. Two properties matter:
 *
 * 1. **It is DERIVED from the tool catalog, not a table.** A hand-maintained
 *    `intent → route` map is exactly the drift `CLAUDE.md` keeps cataloguing: a
 *    tool renamed in one place and stale in another, with nothing red. Both
 *    directions here read `TOOLS[].launchActions[].path`, so a new tool has an
 *    intent the day it has a launch action, and a removed one stops resolving.
 * 2. **An unknown intent resolves to null, and the caller lands on the pathway.**
 *    A launch that names a tool this build does not have must not be a dead end
 *    — the host is a different system on a different release cycle, and "open
 *    something I have never heard of" is a normal thing for it to ask.
 *
 * ⚠️ This is a *presentation* concern — where to navigate — and deliberately not
 * a data-source or chrome one. The panel plan is explicit that conflating those
 * three axes is the trap (see `PresentationContext`), so an intent never implies
 * a connected server and never implies panel chrome.
 */
import { TOOLS } from '../data/catalog'

/**
 * Every intent starts with this. It reads as an instruction rather than an id,
 * which is the convention CDS Hooks' own examples use (`reconcile-medications`),
 * and it keeps a bare tool slug from being mistaken for one.
 */
export const INTENT_PREFIX = 'open-'

/** The slug half of an intent: the last segment of a launch path. */
function slugOf(launchPath: string): string {
  const segments = launchPath.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? ''
}

/**
 * The intent an EHR should send to open this launch action —
 * `/patient/assessments/cssrs-full` → `open-cssrs-full`.
 */
export function intentForLaunchPath(launchPath: string): string {
  return `${INTENT_PREFIX}${slugOf(launchPath)}`
}

/** Launch paths in the catalog, keyed by their intent. Built once. */
const PATH_BY_INTENT: Map<string, string> = (() => {
  const index = new Map<string, string>()
  for (const tool of TOOLS) {
    for (const action of tool.launchActions) {
      const intent = intentForLaunchPath(action.path)
      // First writer wins, and `intentSlugsAreUnique` below is what stops that
      // from being a silent choice: two tools whose launch paths end in the same
      // segment would make one of them unreachable by intent.
      if (!index.has(intent)) index.set(intent, action.path)
    }
  }
  return index
})()

/**
 * The route a launch `intent` names, or null when this build has no such tool.
 *
 * Null is not an error — see the header. The caller (`SmartRedirect`) lands on
 * the patient chart instead, which is where a contextless launch lands anyway.
 */
export function launchPathForIntent(intent: string | undefined | null): string | null {
  if (typeof intent !== 'string' || !intent.startsWith(INTENT_PREFIX)) return null
  return PATH_BY_INTENT.get(intent) ?? null
}

/**
 * Every intent this build answers to. Exported for the test that pins slug
 * uniqueness, and useful when documenting the vocabulary for a host.
 */
export function knownIntents(): string[] {
  return [...PATH_BY_INTENT.keys()].sort()
}

/**
 * Launch paths whose intent collides with another tool's.
 *
 * A collision is a real defect — one of the two tools becomes unreachable by
 * intent — but it is invisible from either tool's own definition, so it is
 * surfaced as a value a test can assert on rather than a comment asking for
 * care.
 */
export function collidingLaunchPaths(): string[] {
  const seen = new Map<string, string>()
  const collisions: string[] = []
  for (const tool of TOOLS) {
    for (const action of tool.launchActions) {
      const intent = intentForLaunchPath(action.path)
      const first = seen.get(intent)
      if (first && first !== action.path) collisions.push(action.path)
      else if (!first) seen.set(intent, action.path)
    }
  }
  return collisions
}
