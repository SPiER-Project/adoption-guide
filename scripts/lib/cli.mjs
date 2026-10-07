/**
 * Command-line helpers for the standalone scripts. One definition each:
 * `check:dupes` scans `scripts/` since 2026-10-07 and fails a second copy.
 */

/** The value after `flag` on the command line (`--tx n/a` → `'n/a'`), or undefined. */
export function argValue(flag, argv = process.argv.slice(2)) {
  const i = argv.indexOf(flag)
  return i === -1 ? undefined : argv[i + 1]
}

/** Print `✗ msg` and exit 1 — for a script with nothing worth reporting after the first failure. */
export function die(msg) {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}
