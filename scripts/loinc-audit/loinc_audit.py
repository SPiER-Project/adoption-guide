#!/usr/bin/env python3
"""Audit every LOINC coding in SPiER's Questionnaires against Regenstrief.

Shells out to curl with --netrc-file so the password is never in argv. All
parsing is done here rather than in shell, because two earlier bash versions of
this got it wrong in ways that reported false results: curl returns pretty-
printed multi-line JSON (breaks a line-based TSV) and some codings carry no
display at all (bash `read` collapses the adjacent tabs and shifts every field).
"""
import argparse, json, os, subprocess, sys, time

LOINC = 'http://loinc.org'

def codings(root, filt):
    """Every distinct (file, code, display) in every Questionnaire under root."""
    seen, rows = set(), []
    for dirpath, _, files in os.walk(root):
        if filt and filt.lower() not in dirpath.lower():
            continue
        for fn in sorted(files):
            if not fn.endswith('.json'):
                continue
            path = os.path.join(dirpath, fn)
            try:
                d = json.load(open(path))
            except Exception:
                continue
            if d.get('resourceType') != 'Questionnaire':
                continue
            rel = os.path.relpath(path, os.path.dirname(root))

            def add(c, where):
                if c.get('system') != LOINC:
                    return
                # display may be absent — that is legal, and it means the code is
                # checked code-only. Keep it as None, distinct from empty string.
                key = (rel, c['code'], c.get('display'))
                if key in seen:
                    return
                seen.add(key)
                rows.append({'file': rel, 'code': c['code'],
                             'display': c.get('display'), 'where': where})

            for c in d.get('code', []) or []:
                add(c, 'Questionnaire.code')

            def walk(items):
                for it in items or []:
                    lid = it.get('linkId', '?')
                    for c in it.get('code', []) or []:
                        add(c, lid)
                    for ao in it.get('answerOption', []) or []:
                        if 'valueCoding' in ao:
                            add(ao['valueCoding'], lid + '/answer')
                    walk(it.get('item'))
            walk(d.get('item'))
    return rows

def fetch(netrc, code, display):
    url = 'https://fhir.loinc.org/CodeSystem/$validate-code'
    cmd = ['curl', '-sS', '--netrc-file', netrc, '-H', 'Accept: application/fhir+json',
           '--max-time', '30', '-G', url,
           '--data-urlencode', f'url={LOINC}', '--data-urlencode', f'code={code}']
    if display is not None:
        cmd += ['--data-urlencode', f'display={display}']
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        return {'_transport': p.stderr.strip() or f'curl exit {p.returncode}'}
    try:
        return json.loads(p.stdout)
    except Exception as e:
        return {'_transport': f'unparseable response: {e}: {p.stdout[:120]}'}

def truthy(v):
    """fhir.loinc.org returns result as valueString "true", not valueBoolean."""
    return v is True or (isinstance(v, str) and v.strip().lower() == 'true')

def assess(body):
    """-> (status, message, loinc_display). status in ok/BAD/ERROR."""
    if '_transport' in body:
        return 'ERROR', body['_transport'], None
    if body.get('resourceType') == 'OperationOutcome':
        return 'ERROR', (body.get('issue') or [{}])[0].get('diagnostics', '?'), None
    pm = {}
    for p in body.get('parameter', []):
        for k in ('valueString', 'valueBoolean', 'valueCode'):
            if k in p:
                pm[p['name']] = p[k]
                break
    if 'result' not in pm:
        return 'ERROR', 'response carried no `result` parameter', None
    return ('ok' if truthy(pm['result']) else 'BAD',
            pm.get('message', ''), pm.get('display'))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('repo'); ap.add_argument('filter', nargs='?', default='')
    ap.add_argument('--netrc'); ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--responses', help='dir of canned responses, for self-test')
    a = ap.parse_args()

    root = os.path.join(a.repo, 'FHIR-Resources')
    if not os.path.isdir(root):
        sys.exit(f'Not a SPiER checkout: {root}')
    rows = codings(root, a.filter)
    if not rows:
        sys.exit(f'No LOINC codings found{" for " + a.filter if a.filter else ""}.')

    nodisp = sum(1 for r in rows if r['display'] is None)
    print(f'{len(rows)} distinct LOINC coding(s); {nodisp} carry no display '
          f'(checked code-only)\n')
    if a.dry_run:
        for r in rows:
            print(f"  {r['code']:<11} {r['file']} :: {r['where']}"
                  f"{'' if r['display'] is None else '  = ' + r['display'][:60]}")
        return 0

    for i, r in enumerate(rows, 1):
        if a.responses:
            f = os.path.join(a.responses, f"{r['code']}.json")
            body = json.load(open(f)) if os.path.exists(f) else {'_transport': 'no canned response'}
        else:
            body = fetch(a.netrc, r['code'], r['display'])
            time.sleep(0.15)
        r['status'], r['msg'], r['loinc'] = assess(body)
        if not a.responses:
            print('.', end='', flush=True)
            if i % 60 == 0: print()
    if not a.responses: print('\n')

    per = {}
    for r in rows:
        per.setdefault(r['file'], []).append(r)
    for f in sorted(per):
        n = sum(1 for r in per[f] if r['status'] != 'ok')
        print(f"  {'OK' if n == 0 else str(n) + ' BAD':>7}  {len(per[f]):>3} coding(s)  {f}")

    bad = [r for r in rows if r['status'] != 'ok']
    print()
    if not bad:
        print(f'All {len(rows)} LOINC coding(s) match Regenstrief.')
        return 0
    print(f'{len(bad)} coding(s) need attention:\n')
    for r in bad:
        print(f"  {r['code']}  [{r['status']}]  ({r['file']} :: {r['where']})")
        print(f"      repo:  {r['display']!r}")
        if r['loinc']: print(f"      LOINC: {r['loinc']!r}")
        if r['msg']:   print(f"      why:   {r['msg']}")
        print()
    return 1

if __name__ == '__main__':
    sys.exit(main())
