#!/usr/bin/env node
/**
 * Copy the hand-authored screening Questionnaires from FHIR-Resources/ into
 * ig/input/resources/ so the HL7 IG Publisher includes them in the render.
 *
 * FHIR-Resources/ stays the single source of truth (the React app uses it too);
 * ig/input/resources/ is gitignored and rebuilt by this script. Run it BEFORE
 * the IG Publisher (the CI ig-publish workflow does; for a local _genonce run,
 * invoke `node ig/scripts/copy-ig-questionnaires.mjs` first). SUSHI does not
 * need it — only the publisher includes input/resources.
 *
 * Each copy's `id` is set to the canonical's last path segment so the resource
 * id matches its url (the publisher enforces url == [canonical]/Questionnaire/[id]).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const destDir = join(repoRoot, 'ig/input/resources')

// The 10 Questionnaires the IG references by canonical.
const SOURCES = [
  'FHIR-Resources/ASQ/fhir/questionnaires/questionnaire.json',
  'FHIR-Resources/PHQ-9/fhir/questionnaires/questionnaire.json',
  'FHIR-Resources/SBQ-R/fhir/questionnaires/questionnaire.json',
  'FHIR-Resources/C-SSRS/fhir/questionnaires/screener.json',
  'FHIR-Resources/C-SSRS/fhir/questionnaires/full-lifetime-recent.json',
  'FHIR-Resources/Stanley-Brown/fhir/questionnaires/questionnaire.json',
  'FHIR-Resources/CAMS/fhir/questionnaires/SSF5_SectionA.json',
  // CAMS SSF-5 Section B is intentionally excluded: its `plan-access` and
  // `history-type` choice items use answerOption.valueString (valid FHIR), which
  // the IG Publisher's QuestionnaireRenderer NPEs on. Re-include once those answer
  // options are coded (valueCoding) or the publisher bug is resolved. The
  // AdministerCAMSSectionB ActivityDefinition still references it by canonical
  // (one residual unresolved-canonical warning).
  // 'FHIR-Resources/CAMS/fhir/questionnaires/SSF5_SectionB.json',
  'FHIR-Resources/CAMS/fhir/questionnaires/Therapeutic_Worksheet.json',
  'FHIR-Resources/CAMS/fhir/questionnaires/Stabilization_Plan.json',
]

mkdirSync(destDir, { recursive: true })

let copied = 0
for (const rel of SOURCES) {
  const src = join(repoRoot, rel)
  const q = JSON.parse(readFileSync(src, 'utf8'))
  if (q.resourceType !== 'Questionnaire') {
    console.error(`✗ ${rel}: not a Questionnaire (${q.resourceType})`)
    process.exit(1)
  }
  if (!q.url) {
    console.error(`✗ ${rel}: Questionnaire has no url`)
    process.exit(1)
  }
  // id = canonical's last segment, so resource id matches the url.
  const id = q.url.split('/').pop()
  q.id = id
  const destName = `Questionnaire-${id}.json`
  writeFileSync(join(destDir, destName), JSON.stringify(q, null, 2) + '\n')
  console.log(`✓ ${rel} → ig/input/resources/${destName}  (id=${id}, version=${q.version ?? '—'})`)
  copied++
}
console.log(`\nCopied ${copied} Questionnaire(s) into ${destDir}`)
