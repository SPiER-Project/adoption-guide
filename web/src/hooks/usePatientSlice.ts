/**
 * The active patient's chart slice, and the async load state around it.
 * Extracted from `PatientProvider` (#126).
 *
 * Storage (localStorage keys, legacy migration, scenario auto-seeding) all live
 * in the data source; this hook just holds the current slice in state and
 * refreshes it on key change and on source mutations.
 */
import { useEffect, useState } from 'react'
import { describeError } from '../lib/describeError'
import type { FhirDataSource } from '../lib/dataSource/types'
import type { PatientSlice } from '../types/fhir'

// Fallback initial slice for the first render when the data source can't
// resolve synchronously (async-only sources like SmartDataSource omit
// getSliceSync). LocalDataSource hydrates synchronously so this is never
// shown in the default configuration.
const EMPTY_SLICE: PatientSlice = {
  responses: [],
  observations: [],
  carePlans: [],
  riskAlerts: [],
  communications: [],
}

/** Chart-slice load state — the slice plus async fetch progress/failure. */
export interface SliceState {
  slice: PatientSlice
  isLoading: boolean
  error: string | null
}

/**
 * Initial state is hydrated synchronously where the source supports it
 * (LocalDataSource does) so the first paint isn't an empty chart; async-only
 * sources (SmartDataSource) show EMPTY_SLICE + isLoading until getSlice
 * resolves.
 */
export function usePatientSlice(
  activeSource: FhirDataSource,
  sliceKey: string | null,
): SliceState {
  const [sliceState, setSliceState] = useState<SliceState>(() => ({
    slice: activeSource.getSliceSync?.(sliceKey) ?? EMPTY_SLICE,
    isLoading: !activeSource.getSliceSync,
    error: null,
  }))

  useEffect(() => {
    let cancelled = false
    // `initial` distinguishes a source/patient switch (reset to empty while
    // the async fetch runs — never show another patient's data under the new
    // context) from a mutation refresh (keep the current slice visible).
    const load = (initial: boolean) => {
      const sync = activeSource.getSliceSync?.(sliceKey)
      if (sync) {
        setSliceState({ slice: sync, isLoading: false, error: null })
        return
      }
      setSliceState(prev => ({
        slice: initial ? EMPTY_SLICE : prev.slice,
        isLoading: true,
        error: null,
      }))
      activeSource.getSlice(sliceKey).then(
        next => {
          if (!cancelled) setSliceState({ slice: next, isLoading: false, error: null })
        },
        (err: unknown) => {
          if (!cancelled)
            setSliceState(prev => ({ ...prev, isLoading: false, error: describeError(err) }))
        },
      )
    }
    load(true)
    const unsubscribe = activeSource.subscribe(() => load(false))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [activeSource, sliceKey])

  return sliceState
}
