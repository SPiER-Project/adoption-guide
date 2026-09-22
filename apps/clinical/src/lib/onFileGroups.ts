/**
 * Everything on file for this patient, resolved and grouped — the data half of
 * *What’s on file* (`components/OnFileList.tsx` is the markup).
 *
 * Split from that component because it exports a hook beside a component, which
 * costs the component Fast Refresh (`react-refresh/only-export-components`).
 *
 * ── What it replaces ──────────────────────────────────────────────────────
 *
 * Three sections, each a different answer to the same question (clinical-app
 * audit §4.4):
 *
 *   *Episode record*     — assembled by following references, and correct, but
 *                          it explained the FHIR R4 reference model to a
 *                          clinician in order to say why four artifacts were
 *                          listed separately.
 *   *Patient Documents*  — "the show me everything view", with a `QR` / `CP` /
 *                          `OBS` badge on every row and four filter chips whose
 *                          only distinction was the resource type.
 *   *Other activity*     — the same rows again for anything that resolved to no
 *                          pathway stage, behind a closed drawer.
 *
 * Between them a clinician met each artifact up to three times, labelled by the
 * three different vocabularies the app happened to have for it.
 *
 * ── The list ──────────────────────────────────────────────────────────────
 *
 * One row per artifact: **what was recorded, when, and by which instrument.**
 * The resource type is gone from the row entirely — §1.9's first line — and so
 * is the emoji that stood in for it.
 *
 * ⚠️ **Grouped by episode where the references allow, and not otherwise.**
 * `groupByEpisode` resolves membership the way the IG tells a partner to
 * (`artifact.encounter → Encounter.episodeOfCare`), and an artifact it cannot
 * reach lands in the closing group rather than being guessed into an episode.
 * What is gone is the *explanation* of the three ways that can happen: "no
 * route in FHIR R4", "an Encounter records a visit that happened" and the rest
 * are true, they are the implementer's argument, and they are in the Adoption
 * Guide. The clinician's version of that fact is one heading.
 *
 * ⚠️ **The instrument is resolved by `instrumentName` in core, not here.** It
 * carries a same-stage-same-day heuristic for the fixtures' older Observations,
 * and a second copy of that judgement would name a different instrument on the
 * same artifact the day either was tuned — which is what `check:dupes` is for.
 */
import { useMemo } from 'react'
import { groupByEpisode } from '@spier/core/lib/episodeRecord'
import { instrumentName } from '@spier/core/lib/pathwayEvaluation'
import { bestArtifactDate } from '@spier/core/lib/artifactDate'
import type { FhirResourceLike } from '@spier/core/lib/patientPathway'
import type { PatientSlice } from '@spier/core/types/fhir'
import { artifactLabel } from './chartDisplay'
import { recordPath } from './recordKeys'

/** One thing on file, resolved for reading. */
export interface OnFileRow {
  key: string
  /** What was recorded, in the clinician's words. */
  name: string
  /** The instrument behind it, when it is not the row's own name. */
  instrument: string | null
  when: string | undefined
  /** Sortable stamp; `NaN` for an undated artifact, which sorts last. */
  at: number
  /**
   * The artifact itself, so the page that opens one resolves it against this
   * same list rather than walking the buckets a second time — *What's on file*
   * is what "everything on file" means here, and a record it does not list is
   * a record nothing can open.
   */
  resource: FhirResourceLike
  /** Where this row opens, or null for an artifact with no id to address. */
  href: string | null
}

/** A heading and the rows under it. */
export interface OnFileGroup {
  key: string
  title: string
  /** Open or closed, in the clinician's words — never the resource's status code. */
  state: string | null
  when: string | undefined
  rows: OnFileRow[]
}

function timeOf(iso: string | undefined): number {
  return iso ? new Date(iso).getTime() : Number.NaN
}

function rowFor(resource: FhirResourceLike, slice: PatientSlice, index: number): OnFileRow {
  const name = artifactLabel(resource)
  const instrument = instrumentName(resource, slice)
  const when = bestArtifactDate(resource)
  return {
    key: `${resource.resourceType}/${resource.id ?? index}`,
    name,
    resource,
    href: recordPath(resource),
    // A questionnaire's response IS its instrument; repeating the name beside
    // itself is the noise the resource-type meta used to be.
    instrument: instrument && instrument !== name ? instrument : null,
    when,
    at: timeOf(when),
  }
}

/** Newest first, undated last. */
function byNewest(a: { at: number }, b: { at: number }): number {
  if (!Number.isFinite(a.at) && !Number.isFinite(b.at)) return 0
  if (!Number.isFinite(a.at)) return 1
  if (!Number.isFinite(b.at)) return -1
  return b.at - a.at
}

/** `EpisodeOfCare.status` in the words a clinician uses for it. */
function episodeState(status: string): string | null {
  if (status === 'active' || status === 'onhold') return 'Open'
  if (status === 'finished' || status === 'cancelled') return 'Closed'
  return null
}

/**
 * The buckets as the one slice `instrumentName` and `sourceResponse` take.
 *
 * ⚠️ **Exported because the record page needs the same one**, and a second copy
 * of this cast is a second answer to which buckets those two walk — the class
 * `check:dupes` exists for. `instrumentName` reads only the responses, but its
 * parameter is the whole slice, so a future hop it learns to follow does not
 * need either call site changed.
 */
export function sliceOf(input: Parameters<typeof groupByEpisode>[0]): PatientSlice {
  return {
    responses: input.responses ?? [],
    observations: input.observations ?? [],
    carePlans: input.carePlans ?? [],
    riskAlerts: [],
  } as unknown as PatientSlice
}

export function useOnFileGroups(input: Parameters<typeof groupByEpisode>[0]): OnFileGroup[] {
  return useMemo(() => {
    const { records, unassigned } = groupByEpisode(input)
    const slice = sliceOf(input)

    const groups: OnFileGroup[] = records.map((record, i) => {
      const period = (record.episode as { period?: { start?: string } }).period ?? {}
      const status = String((record.episode as { status?: string }).status ?? '')
      return {
        key: `episode-${record.episode.id ?? i}`,
        title: 'Suicide-safer care episode',
        state: episodeState(status),
        when: period.start,
        rows: record.artifacts.map((r, j) => rowFor(r, slice, j)).sort(byNewest),
      }
    })
    groups.sort((a, b) => byNewest({ at: timeOf(a.when) }, { at: timeOf(b.when) }))

    if (unassigned.length > 0) {
      groups.push({
        key: 'outside',
        title: 'Not part of an episode',
        state: null,
        when: undefined,
        rows: unassigned.map(({ resource }, j) => rowFor(resource, slice, j)).sort(byNewest),
      })
    }
    return groups
  }, [input])
}
