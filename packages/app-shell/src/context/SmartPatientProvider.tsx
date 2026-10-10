import React, { useMemo } from 'react'
import { SmartDataSource } from '@spier/core/lib/dataSource/smartDataSource'
import type { FhirDataSource } from '@spier/core/lib/dataSource/types'
import type { RegistryPatient } from '@spier/core/lib/registry'
import { useSmart } from './SmartContext'
import { PatientProvider, type SmartBinding } from './PatientProvider'

/**
 * `PatientProvider` with the SMART session wired in: the clinical app's
 * provider, and only the clinical app's.
 *
 * Under SMART, chart data is read from and written to the connected FHIR server
 * through `SmartDataSource`; without a session it falls through to the injected
 * local source, exactly as before. This is the one module that turns a SMART
 * client into a data source — which is why it is a separate module from
 * `PatientProvider`, so the Adoption Guide can mount that one without carrying
 * this. See `SmartBinding`.
 */
export function SmartPatientProvider({
  children,
  dataSource,
  populationPatients,
}: {
  children: React.ReactNode
  dataSource?: FhirDataSource
  populationPatients?: RegistryPatient[]
}) {
  const { client, patient } = useSmart()
  // ⚠️ Keyed on the CLIENT, not on there being a patient: a worklist launch has
  // a client and no patient, and must still read from the server (#401).
  const source = useMemo(() => (client ? new SmartDataSource(client) : null), [client])
  const smart = useMemo<SmartBinding>(() => ({ client, patient, source }), [client, patient, source])
  return (
    <PatientProvider dataSource={dataSource} populationPatients={populationPatients} smart={smart}>
      {children}
    </PatientProvider>
  )
}
