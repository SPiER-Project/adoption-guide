const MOCK_ENCOUNTERS = [
  {
    id: 'enc-001',
    date: '2026-03-15',
    type: 'Initial Assessment',
    provider: 'Dr. Sarah Chen',
    location: 'Outpatient Behavioral Health',
    status: 'completed',
    notes: 'Initial suicide risk assessment. PHQ-9 administered. C-SSRS screening positive. Safety plan initiated.',
  },
  {
    id: 'enc-002',
    date: '2026-03-17',
    type: 'Safety Planning Session',
    provider: 'Dr. Sarah Chen',
    location: 'Outpatient Behavioral Health',
    status: 'completed',
    notes: 'Stanley-Brown Safety Plan completed collaboratively. Lethal means counseling provided. Follow-up scheduled.',
  },
  {
    id: 'enc-003',
    date: '2026-03-24',
    type: 'Follow-up Visit',
    provider: 'Dr. Sarah Chen',
    location: 'Outpatient Behavioral Health',
    status: 'scheduled',
    notes: 'Scheduled follow-up. CAMS Therapeutic Worksheet planned. Re-assess safety plan.',
  },
]

export function EncountersTab() {
  return (
    <div className="encounters-tab">
      <h2 className="page-title">Encounters</h2>
      <p className="encounters-note">
        Mock encounter data for demonstration purposes. In a production EHR, encounters would be
        linked to completed screenings and care plans.
      </p>

      <div className="encounters-timeline">
        {MOCK_ENCOUNTERS.map(enc => (
          <div key={enc.id} className={`encounter-item encounter-item--${enc.status}`}>
            <div className="encounter-date">
              <span className="encounter-date-day">
                {new Date(enc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className="encounter-date-year">
                {new Date(enc.date).getFullYear()}
              </span>
            </div>
            <div className="encounter-marker">
              <div className={`encounter-dot encounter-dot--${enc.status}`} />
              <div className="encounter-line" />
            </div>
            <div className="encounter-card">
              <div className="encounter-card-header">
                <h4 className="encounter-card-type">{enc.type}</h4>
                <span className={`encounter-status encounter-status--${enc.status}`}>
                  {enc.status}
                </span>
              </div>
              <div className="encounter-card-meta">
                <span>{enc.provider}</span>
                <span className="encounter-card-divider">&middot;</span>
                <span>{enc.location}</span>
              </div>
              <p className="encounter-card-notes">{enc.notes}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
