/**
 * The measure CQL, translated and executed in-process — the other half of
 * tests/measuresCqlParity.test.ts.
 *
 * TRANSLATION uses `@cqframework/cql`, the Kotlin→JS build of the same
 * cql-to-elm translator the IG Publisher bundles, with the publisher's default
 * options. So the ELM evaluated here is the ELM the IG publishes, not a second
 * opinion about it. EXECUTION uses `cql-execution` + `cql-exec-fhir`, the
 * independent reference engine; the translator's own JS engine is beta.
 *
 * Three inputs, and where each comes from:
 *
 *   FHIR 4.0.1 model info + FHIRHelpers 4.0.1   ~/.fhir/packages/fhir.cqf.common#4.0.1,
 *                                               which SUSHI downloads because the IG
 *                                               depends on it (so `npm run copy-fhir`
 *                                               puts it there, locally and in CI)
 *   System model info                           tests/cql/system-modelinfo.xml, vendored:
 *                                               the JVM translator reads it from a jar
 *                                               resource, and the JS build registers no
 *                                               default model-info providers at all
 *   UCUM                                        @lhncbc/ucum-lhc, cql-execution's own
 *                                               dependency; the JS translator has no
 *                                               default UCUM service and refuses `24 hours`
 *                                               without one
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import ucum from '@lhncbc/ucum-lhc'
import cql from 'cql-execution'
import cqlfhir from 'cql-exec-fhir'
import type { MeasurementPeriod } from '@spier/core/lib/measures'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')
export const MEASURE_CQL = path.join(REPO, 'ig/input/cql/SPiERSuicideSaferCareMeasures.cql')
const SYSTEM_MODELINFO = path.join(HERE, 'system-modelinfo.xml')
const CQF_COMMON = path.join(
  process.env.FHIR_PACKAGE_CACHE ?? path.join(os.homedir(), '.fhir/packages'),
  'fhir.cqf.common#4.0.1/package',
)

/** The base64 content of one type out of a Library in the cqf.common package. */
function libraryContent(file: string, contentType: string): string {
  const full = path.join(CQF_COMMON, file)
  if (!fs.existsSync(full)) {
    // A missing package is a setup error, never a skip: a skipped differential
    // test is a green one, and green is the claim this file exists to earn.
    throw new Error(
      `${full} is missing. It is the IG's fhir.cqf.common dependency, which SUSHI downloads — run \`npm run copy-fhir\`.`,
    )
  }
  const lib = JSON.parse(fs.readFileSync(full, 'utf8')) as {
    content?: Array<{ contentType?: string; data?: string }>
  }
  const data = lib.content?.find(c => c.contentType === contentType)?.data
  if (!data) throw new Error(`${file} carries no ${contentType} content`)
  return Buffer.from(data, 'base64').toString('utf8')
}

export interface TranslatedLibraries {
  measures: object
  fhirHelpers: object
}

/**
 * CQL → ELM JSON for the measure library and FHIRHelpers. Throws on ANY
 * translator error: a library that does not translate cleanly is not one the
 * publisher would publish, so evaluating its partial ELM would compare against
 * something that does not exist.
 */
export async function translateMeasureLibrary(cqlText = fs.readFileSync(MEASURE_CQL, 'utf8')): Promise<TranslatedLibraries> {
  // kotlinx-io looks for a global `require` under Node (Kotlin/kotlinx-io#345);
  // the translator's own Node example installs the same polyfill.
  const g = globalThis as { require?: NodeRequire }
  g.require ??= createRequire(import.meta.url)
  const {
    CqlTranslator,
    LibraryManager,
    ModelManager,
    createLibrarySourceProvider,
    createModelInfoProvider,
    createUcumService,
    stringAsSource,
  } = await import('@cqframework/cql/cql-to-elm')

  const fhirModelInfo = libraryContent('Library-FHIR-ModelInfo.json', 'application/xml')
  const helpersCql = libraryContent('Library-FHIRHelpers.json', 'text/cql')
  const systemModelInfo = fs.readFileSync(SYSTEM_MODELINFO, 'utf8')
  // The Kotlin-generated declarations type a Source as `any`; narrowed here once.
  const source = (text: string): unknown => stringAsSource(text)

  const models = new ModelManager()
  models.modelInfoLoader.registerModelInfoProvider(
    createModelInfoProvider((id: string, _system?: string | null, version?: string | null) => {
      if (id === 'System') return source(systemModelInfo)
      if (id === 'FHIR' && version === '4.0.1') return source(fhirModelInfo)
      return null
    }),
  )

  const units = ucum.UcumLhcUtils.getInstance()
  const ucumService: unknown = createUcumService(
    (value: string, from: string, to: string) => {
      const r = units.convertUnitTo(from, Number(value), to)
      if (r.status !== 'succeeded') throw new Error(`UCUM: ${(r.msg ?? []).join('; ')}`)
      return String(r.toVal)
    },
    (unit: string) => {
      const r = units.validateUnitString(unit)
      return r.status === 'valid' ? null : (r.msg ?? []).join('; ') || `invalid unit ${unit}`
    },
    // Not reached by this library; failing loudly beats a wrong answer.
    () => {
      throw new Error('UCUM multiply is not implemented in this harness')
    },
    () => {
      throw new Error('UCUM divide is not implemented in this harness')
    },
  )

  const libraries = new LibraryManager(models, undefined, undefined, ucumService)
  libraries.librarySourceLoader.registerProvider(
    createLibrarySourceProvider((id: string, _system?: string | null, version?: string | null) =>
      id === 'FHIRHelpers' && version === '4.0.1' ? source(helpersCql) : null,
    ),
  )

  const translate = (text: string, name: string): object => {
    const translator = CqlTranslator.fromText(text, libraries)
    // A Kotlin list, not a JS array: the view is the documented bridge.
    const errors = translator.errors.asJsReadonlyArrayView().map(e => e.message ?? String(e))
    if (errors.length) throw new Error(`${name} did not translate:\n  ${errors.join('\n  ')}`)
    return JSON.parse(translator.toJson()) as object
  }

  return {
    fhirHelpers: translate(helpersCql, 'FHIRHelpers'),
    measures: translate(cqlText, 'SPiERSuicideSaferCareMeasures'),
  }
}

export type FhirBundle = { resourceType: 'Bundle'; type: 'collection'; entry: Array<{ resource: object }> }

/** Every define's value, per patient id. */
export type CqlResults = Record<string, Record<string, unknown>>

/**
 * Execute the measure library over patient bundles. One bundle per patient; the
 * Patient resource in it supplies the id the results are keyed by.
 */
export async function executeMeasureLibrary(
  elm: TranslatedLibraries,
  bundles: FhirBundle[],
  period: MeasurementPeriod,
): Promise<CqlResults> {
  const library = new cql.Library(elm.measures, new cql.Repository({ FHIRHelpers: elm.fhirHelpers }))
  const parameters = {
    'Measurement Period': new cql.Interval(
      cql.DateTime.parse(period.start),
      cql.DateTime.parse(period.end),
      true,
      true,
    ),
  }
  const executor = new cql.Executor(library, new cql.CodeService({}), parameters)
  const source = cqlfhir.PatientSource.FHIRv401()
  source.loadBundles(bundles)
  const results = await executor.exec(source)
  return results.patientResults as CqlResults
}

/**
 * A PatientSlice as the FHIR the CQL retrieves from: every bucket's resources,
 * plus a Patient to key results by. `responses` holds StoredResponse wrappers,
 * so it contributes their `.resource`. `riskAlerts` and `walkthrough` are app
 * state and narration, not FHIR, and are left out — no define reads either.
 */
export function bundleFor(patientId: string, slice: object): FhirBundle {
  const entry: Array<{ resource: object }> = [{ resource: { resourceType: 'Patient', id: patientId } }]
  for (const [bucket, items] of Object.entries(slice)) {
    if (!Array.isArray(items)) continue
    for (const item of items as Array<{ resourceType?: string; resource?: object }>) {
      if (bucket === 'responses' && item.resource) entry.push({ resource: item.resource })
      else if (item.resourceType) entry.push({ resource: item })
    }
  }
  return { resourceType: 'Bundle', type: 'collection', entry }
}
