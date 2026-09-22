/**
 * "What's on file" — one list of everything recorded for this patient.
 *
 * Clinical-app audit §4.4. Reached from the landing screen's *What's on file ·
 * N records* link, from *Why this?*'s "see it in what's on file", and from a
 * filler's "View in chart" after a submit — which until 2026-09-21 all landed
 * on an anchor part-way down the chart, above three sections that said the same
 * things three different ways.
 *
 * ⚠️ **No patient in the path**, for the same reason as `/patient/why` and
 * `/patient/why`: the active patient travels in context.
 *
 * The list itself, and what it stopped explaining, is `components/OnFileList.tsx`.
 */
import { useMemo } from 'react'
import { PageHeader } from '@spier/ui/PageHeader'
import { Notice } from '@spier/ui/Notice'
import { usePatient } from '@spier/tool-views/context/PatientContext'
import { OnFileList } from '../components/OnFileList'
import { useOnFileGroups } from '../lib/onFileGroups'

export function PatientOnFile() {
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
    isSliceLoading,
    dataSourceError,
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
  const total = groups.reduce((n, g) => n + g.rows.length, 0)

  return (
    <div className="patient-on-file">
      <PageHeader
        eyebrow="Patient Chart"
        up="/patient/record"
        eyebrowStyle="pill"
        title={'What\u2019s on file'}
        lede={`${total} ${total === 1 ? 'record' : 'records'}`}
      />

      {dataSourceError && (
        <Notice tone="danger" title="EHR data error.">
          {dataSourceError}
        </Notice>
      )}
      {isSliceLoading && <Notice tone="info">Loading chart data from the connected EHR…</Notice>}

      <OnFileList groups={groups} />
    </div>
  )
}
