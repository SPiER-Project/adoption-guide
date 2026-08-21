/**
 * The unstaged ("Other activity") bucket. Extracted from `PatientChart` (#126).
 *
 * Artifacts that resolve to no pathway stage — typically foreign EHR data read
 * over SMART (QRs against non-SPiER Questionnaire canonicals, survey
 * Observations written by other systems). Collapsed by default: a connected EHR
 * patient can carry dozens of these, and they're context rather than pathway
 * state.
 *
 * No CSS import, matching every sibling chart section — `PatientChart.css` is
 * imported once by the page.
 */
import { useState } from 'react'
import { ArtifactCards } from './ChartArtifacts'
import { artifactCount } from '../lib/chartDisplay'
import type { FhirResourceLike, StoredResponseLike } from '@spier/core/lib/patientPathway'

export function OtherActivitySection({
  responses,
  carePlans,
  observations,
  communications,
  workflowArtifacts,
}: {
  responses: StoredResponseLike[]
  carePlans: FhirResourceLike[]
  observations: FhirResourceLike[]
  communications: FhirResourceLike[]
  workflowArtifacts: FhirResourceLike[]
}) {
  const [open, setOpen] = useState(false)
  const count = artifactCount({
    responses,
    carePlans,
    observations,
    communications,
    workflowArtifacts,
  })
  if (count === 0) return null
  return (
    <section id="stage-other" className="pathway-other" aria-label="Other activity">
      <h4 className="pathway-node-heading">
        <button
          type="button"
          className="pathway-node-toggle"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
        >
          <span className="pathway-node-main">
            <span className="pathway-node-step">Off pathway</span>
            <span className="pathway-node-title">Other activity</span>
          </span>
          <span className="pathway-node-aside">
            <span className="pathway-node-status pathway-node-status--upcoming">
              {count} {count === 1 ? 'item' : 'items'}
            </span>
            <span className="pathway-node-chevron" aria-hidden>{open ? '▲' : '▼'}</span>
          </span>
        </button>
      </h4>
      {open && (
        <div className="pathway-node-body">
          <p className="pathway-node-desc">
            Captured resources that don't map to a SPiER pathway stage — for example, records
            written by other systems on a connected EHR.
          </p>
          <ArtifactCards
            responses={responses}
            carePlans={carePlans}
            observations={observations}
            communications={communications}
            workflowArtifacts={workflowArtifacts}
          />
        </div>
      )}
    </section>
  )
}
