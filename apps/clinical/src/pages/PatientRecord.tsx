/**
 * One record, opened.
 *
 * ── Why a page, and why this one ──────────────────────────────────────────
 *
 * *Where this patient is* and *What's on file* both list what was recorded, how
 * it stands and when, and both stopped there: a clinician could see that a
 * PHQ-9 was completed on Jul 31 and could not see a single answer to it, the
 * score it came to, or what it left on the chart. Brad flagged that on
 * 2026-09-22 — *"not something we need to fix right now, but we should come
 * back to it"*. This is the coming back.
 *
 * Three shapes were possible: a deep link into *What's on file*, a row that
 * expands in place, or a page per record.
 *
 *  - **A deep link** cannot work, because the thing that is missing is not on
 *    that page either. It lists the same three columns.
 *  - **An expanding row** would exist twice — the stage rows and the on-file
 *    rows are two components — or would force the two lists to become one, and
 *    a nine-question form opening inside a 470px stage node pushes every stage
 *    under it off the screen.
 *  - **A page** is one implementation, reached from both lists, and it is the
 *    shape the rest of this surface already uses for a drill-in (*Why this?*,
 *    *Where this patient is*, the stage pages). It is a CHILD of
 *    `/patient/on-file` rather than a peer, so its `up` is the list a reader
 *    came from and the two cannot become rival answers to "what is on file".
 *
 * ⚠️ **The record is resolved against `useOnFileGroups`, not against the
 * buckets.** That hook is what "everything on file" means on this surface, and
 * resolving here from `usePatient()` directly would let the two disagree — a
 * row the list shows and this page cannot open, or the reverse. It also means
 * the row's own name, instrument and date are the ones the list showed, rather
 * than a second derivation of them.
 *
 * ⚠️ **No patient in the path**, like `/patient/why`, `/patient/where` and
 * `/patient/on-file` above it: the active patient travels in context.
 *
 * ⚠️ **Nothing here is inspection-gated, because nothing here is the wire
 * format.** The page renders the instrument's questions, the patient's answers,
 * the value and interpretation a result carries and the steps of a plan — all
 * of it clinical content that happens to be stored in FHIR. The resource behind
 * it is the Adoption Guide's to show (`context/InspectContext.ts`).
 */
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@spier/ui/PageHeader'
import { Card } from '@spier/ui/Card'
import { Notice } from '@spier/ui/Notice'
import { SectionHeader } from '@spier/ui/SectionHeader'
import { usePatient } from '@spier/tool-views/context/PatientContext'
import { formatDate } from '@spier/tool-views/lib/dates'
import { sourceResponse } from '@spier/core/lib/pathwayEvaluation'
import type { FhirResourceLike } from '@spier/core/lib/patientPathway'
import type { QuestionnaireResponseResource } from '@spier/core/types/fhir'
import { sliceOf, useOnFileGroups } from '../lib/onFileGroups'
import { artifactLabel, lifecycleWord } from '../lib/chartDisplay'
import { KIND_WORD, recordKey, recordKind, recordPath } from '../lib/recordKeys'
import { answerSections, planSteps, recordFacts, resultReading } from '../lib/recordDetail'
import '../css/PatientRecord.css'

/** The record's own line under the title: what it is, how it stands, when. */
function subtitle(resource: FhirResourceLike, when: string | undefined): string {
  const state = lifecycleWord(typeof resource.status === 'string' ? resource.status : undefined)
  return [KIND_WORD[recordKind(resource)], state, when ? formatDate(when) : null]
    .filter(Boolean)
    .join(' · ')
}

/** A row in one of the two "what is this joined to" lists. */
function RecordLink({ resource, note }: { resource: FhirResourceLike; note?: string | null }) {
  const to = recordPath(resource)
  const name = artifactLabel(resource)
  return (
    <li className="record-link">
      {to ? <Link to={to}>{name}</Link> : <span>{name}</span>}
      {note && <span className="record-link__note">{note}</span>}
    </li>
  )
}

export function PatientRecord() {
  const { recordKey: wanted } = useParams<{ recordKey: string }>()
  const {
    responses,
    carePlans,
    observations,
    communications,
    documentReferences,
    serviceRequests,
    appointments,
    consents,
    procedures,
    episodes,
    encounters,
    flags,
    tasks,
  } = usePatient()

  const input = useMemo(
    () => ({
      episodes,
      encounters,
      responses,
      observations,
      carePlans,
      communications,
      serviceRequests,
      procedures,
      documentReferences,
      appointments,
      consents,
      flags,
      tasks,
    }),
    [
      episodes,
      encounters,
      responses,
      observations,
      carePlans,
      communications,
      serviceRequests,
      procedures,
      documentReferences,
      appointments,
      consents,
      flags,
      tasks,
    ],
  )
  const groups = useOnFileGroups(input)
  const row = useMemo(() => {
    const key = wanted ? decodeURIComponent(wanted) : ''
    return groups.flatMap(g => g.rows).find(r => recordKey(r.resource) === key)
  }, [groups, wanted])

  const slice = useMemo(() => sliceOf(input), [input])

  // What a completed form left behind, and where a result or a plan came from —
  // the same resolution in both directions, so the two pages agree.
  const producedBy = useMemo(() => {
    if (!row || row.resource.resourceType !== 'QuestionnaireResponse') return []
    return [...observations, ...carePlans].filter(
      r => sourceResponse(r as FhirResourceLike, slice)?.id === row.resource.id,
    ) as FhirResourceLike[]
  }, [row, observations, carePlans, slice])
  const cameFrom = useMemo(() => {
    if (!row || row.resource.resourceType === 'QuestionnaireResponse') return null
    return sourceResponse(row.resource, slice)
  }, [row, slice])

  if (!row) {
    return (
      <div className="patient-record">
        <PageHeader
          eyebrow={'What\u2019s on file'}
          up="/patient/on-file"
          eyebrowStyle="pill"
          title="Record not found"
        />
        <Notice title="This is not on the open chart.">
          <p>
            It may belong to another patient, or it may have been opened from an older link.{' '}
            <Link to="/patient/on-file">See what is on file</Link>.
          </p>
        </Notice>
      </div>
    )
  }

  const resource = row.resource
  const kind = recordKind(resource)
  const sections = kind === 'form' ? answerSections(resource as QuestionnaireResponseResource) : []
  const reading = kind === 'result' ? resultReading(resource) : null
  const steps = kind === 'plan' ? planSteps(resource) : []
  // A fact that repeats the title is the row's name printed twice — the reason
  // element is also the name a contact falls back to (`artifactLabel`).
  const facts = recordFacts(resource).filter(f => f.value !== row.name)

  return (
    <div className="patient-record">
      <PageHeader
        eyebrow={'What\u2019s on file'}
        up="/patient/on-file"
        eyebrowStyle="pill"
        title={row.name}
        lede={subtitle(resource, row.when)}
      />

      {reading && (reading.value || reading.interpretation) && (
        <Card as="section" padding="compact" accent className="record-reading">
          {reading.value && <p className="record-reading__value">{reading.value}</p>}
          {reading.interpretation && (
            <p className="record-reading__note">{reading.interpretation}</p>
          )}
        </Card>
      )}

      {sections.length > 0 && (
        <Card as="section" padding="compact">
          <SectionHeader title="Answers" />
          {sections.map((section, i) => (
            <div className="record-answers__section" key={section.heading ?? i}>
              {section.heading && <h4 className="record-answers__heading">{section.heading}</h4>}
              <dl className="record-answers">
                {section.lines.map(line => (
                  <div className="record-answers__line" key={line.linkId}>
                    <dt className="record-answers__q">{line.question ?? '—'}</dt>
                    <dd className="record-answers__a">{line.answers.join(', ')}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </Card>
      )}

      {steps.length > 0 && (
        <Card as="section" padding="compact">
          <SectionHeader title="What it says" />
          <dl className="record-answers">
            {steps.map(step => (
              <div className="record-answers__line" key={step.title}>
                <dt className="record-answers__q">{step.title}</dt>
                <dd className="record-answers__a">{step.detail}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {facts.length > 0 && (
        <Card as="section" padding="compact">
          <SectionHeader title="Details" />
          <dl className="record-answers">
            {facts.map(fact => (
              <div className="record-answers__line" key={fact.label}>
                <dt className="record-answers__q">{fact.label}</dt>
                <dd className="record-answers__a">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {producedBy.length > 0 && (
        <Card as="section" padding="compact">
          <SectionHeader title="What this produced" />
          <ul className="record-links">
            {producedBy.map(r => (
              <RecordLink
                key={recordKey(r)}
                resource={r}
                note={
                  r.resourceType === 'Observation'
                    ? (resultReading(r).interpretation ?? resultReading(r).value)
                    : null
                }
              />
            ))}
          </ul>
        </Card>
      )}

      {cameFrom && (
        <Card as="section" padding="compact">
          <SectionHeader title="Where this came from" />
          <ul className="record-links">
            <RecordLink
              resource={cameFrom.resource}
              note={cameFrom.completedAt ? formatDate(cameFrom.completedAt) : null}
            />
          </ul>
        </Card>
      )}
    </div>
  )
}
