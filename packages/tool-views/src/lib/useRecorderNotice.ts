/**
 * What a recorder says after a submit, and what it just wrote — one state, set
 * in one call.
 *
 * Every one of the eleven recorders held `const [notice, setNotice] =
 * useState<string | null>(null)` and set it at the end of its submit handler.
 * Since 2026-09-21 the frame also needs the RESOURCES that submit produced, so
 * the confirmation beat can answer "and now what" from the chart including
 * them rather than from the chart as it stood a round trip ago (`NextStep`,
 * clinical-app audit §4.6). Adding a second `useState` beside the first in
 * eleven files is eleven copies of the same two lines and eleven chances to
 * set one without the other, so the pair is this hook and it is set together.
 *
 * ⚠️ **`report` takes the resources as arguments rather than reading them from
 * the form.** Two recorders write more than one resource in a single act — the
 * risk episode opens an EpisodeOfCare and raises its Flag, lethal-means
 * counseling records a Procedure and one Observation per means — and only the
 * handler knows which of them it actually saved on this pass.
 */
import { useCallback, useState } from 'react'
import type { FhirResource } from '@spier/core/types/fhir'

interface RecorderNotice {
  /** The success sentence, or null before the first submit. */
  notice: string | null
  /** What the most recent submit wrote — pass to `WorkflowForm`'s `justRecorded`. */
  written: FhirResource[]
  /** Record the outcome of a submit: its sentence, and everything it saved. */
  report: (notice: string, ...written: FhirResource[]) => void
}

export function useRecorderNotice(): RecorderNotice {
  const [state, setState] = useState<{ notice: string | null; written: FhirResource[] }>({
    notice: null,
    written: [],
  })
  const report = useCallback(
    (notice: string, ...written: FhirResource[]) => setState({ notice, written }),
    [],
  )
  return { notice: state.notice, written: state.written, report }
}
