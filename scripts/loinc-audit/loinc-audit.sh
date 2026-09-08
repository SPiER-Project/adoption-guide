#!/usr/bin/env bash
# Prompt for LOINC credentials, then hand off to loinc_audit.py.
#   loinc-audit.sh <repo>            # every instrument
#   loinc-audit.sh <repo> C-SSRS     # just folders matching a name
# The password is read from the tty into a 0600 netrc that is deleted on exit
# (including Ctrl-C). It is never in argv, never in shell history, and goes
# nowhere but fhir.loinc.org.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${1:?usage: loinc-audit.sh <repo-path> [instrument-filter]}"
NETRC="$(mktemp)"; chmod 600 "$NETRC"
trap 'rm -f "$NETRC"' EXIT INT TERM
read -r  -p "LOINC username: " LU
read -rs -p "LOINC password: " LP; echo; echo
printf 'machine fhir.loinc.org login %s password %s\n' "$LU" "$LP" > "$NETRC"
unset LP
exec python3 "$HERE/loinc_audit.py" "$REPO" "${2:-}" --netrc "$NETRC"
