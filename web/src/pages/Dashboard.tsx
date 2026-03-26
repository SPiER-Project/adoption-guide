import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import '../css/Dashboard.css'

const LEVEL_CONFIG: Record<string, { className: string; label: string }> = {
  acute:    { className: 'alert--acute',    label: 'ACUTE' },
  high:     { className: 'alert--high',     label: 'HIGH' },
  moderate: { className: 'alert--moderate', label: 'MODERATE' },
  low:      { className: 'alert--low',      label: 'LOW' },
  none:     { className: 'alert--none',     label: 'NONE' },
}

export function Dashboard() {
  const { carePlans, responses, riskAlerts, loadDemoScenario, clearDemoData } = usePatient()
  const hasData = responses.length > 0 || carePlans.length > 0

  const activePlans = carePlans.filter((cp: any) => cp.status === 'active')
  const recentResponses = [...responses].reverse().slice(0, 5)

  // Active alerts = anything above "none"
  const activeAlerts = riskAlerts.filter(a => a.level !== 'none')
  const highestLevel = activeAlerts.length > 0
    ? (['acute', 'high', 'moderate', 'low'] as const).find(l => activeAlerts.some(a => a.level === l)) || 'none'
    : 'none'

  return (
    <div className="dashboard">
      <h2 className="dashboard-title">Patient Dashboard</h2>

      {/* Demo Scenario Banner */}
      {!hasData && (
        <div className="demo-scenario-banner">
          <div className="demo-scenario-content">
            <div>
              <strong>Welcome to SPiER</strong>
              <p>This demo is empty. Load a sample clinical scenario to see how suicide prevention tools integrate into an EHR workflow.</p>
            </div>
            <button className="demo-scenario-btn" onClick={loadDemoScenario}>
              Load Demo Scenario
            </button>
          </div>
          <p className="demo-scenario-detail">
            Loads a PHQ-9 (score 18, Item 9 positive) &rarr; ASQ (non-acute positive) &rarr; CAMS assessment &rarr; Stanley-Brown Safety Plan.
          </p>
        </div>
      )}
      {hasData && (
        <div className="demo-scenario-reset">
          <button className="demo-reset-btn" onClick={clearDemoData}>Reset Demo Data</button>
        </div>
      )}

      {/* Risk Alert Banner — only shows when there are active alerts */}
      {activeAlerts.length > 0 && (
        <div className={`risk-alert-banner ${LEVEL_CONFIG[highestLevel].className}`}>
          <div className="risk-alert-banner-header">
            <span className="risk-alert-banner-icon">&#9888;</span>
            <span className="risk-alert-banner-title">
              Suicide Risk Alert — {LEVEL_CONFIG[highestLevel].label}
            </span>
          </div>
          {activeAlerts.map((alert, idx) => (
            <div key={idx} className="risk-alert-item">
              <div className="risk-alert-item-header">
                <span className={`risk-alert-level ${LEVEL_CONFIG[alert.level].className}`}>
                  {LEVEL_CONFIG[alert.level].label}
                </span>
                <span className="risk-alert-tool">{alert.summary}</span>
              </div>
              <p className="risk-alert-detail">{alert.detail}</p>
              {alert.suggestedAction && (
                <Link to={alert.suggestedAction.path} className="risk-alert-action-btn">
                  {alert.suggestedAction.label} &rarr;
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-grid">
        {/* Risk Status Widget */}
        <div className="dashboard-widget">
          <h3 className="widget-title">Risk Status</h3>
          <div className="widget-body">
            {activeAlerts.length > 0 ? (
              <span className={`risk-badge risk-badge--${highestLevel}`}>
                {LEVEL_CONFIG[highestLevel].label} Risk
              </span>
            ) : activePlans.length > 0 ? (
              <span className="risk-badge risk-badge--active">Active Safety Plan</span>
            ) : (
              <span className="risk-badge risk-badge--none">No Screenings</span>
            )}
            <p className="widget-hint">
              Based on most recent screening results.
            </p>
          </div>
        </div>

        {/* Recent Screenings Widget */}
        <div className="dashboard-widget">
          <h3 className="widget-title">Recent Results</h3>
          <div className="widget-body">
            {recentResponses.length > 0 ? (
              <ul className="widget-list">
                {recentResponses.map(r => (
                  <li key={r.id} className="widget-list-item">
                    <span className="widget-list-name">{r.questionnaireName}</span>
                    <span className="widget-list-date">
                      {new Date(r.completedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="widget-empty">No assessments completed yet.</p>
            )}
            <Link to="/chart/screenings" className="widget-link">View all results</Link>
          </div>
        </div>

        {/* Active Care Plans Widget */}
        <div className="dashboard-widget">
          <h3 className="widget-title">Active Care Plans</h3>
          <div className="widget-body">
            {activePlans.length > 0 ? (
              <>
                <span className="widget-count">{activePlans.length}</span>
                <span className="widget-count-label">active plan{activePlans.length !== 1 ? 's' : ''}</span>
              </>
            ) : (
              <p className="widget-empty">No care plans generated yet.</p>
            )}
            <Link to="/chart/careplan" className="widget-link">View care plans</Link>
          </div>
        </div>

        {/* Quick Actions Widget */}
        <div className="dashboard-widget">
          <h3 className="widget-title">Quick Actions</h3>
          <div className="widget-body widget-actions">
            <Link to="/chart/screenings/phq-9" className="widget-action-btn">
              Start PHQ-9 Screening
            </Link>
            <Link to="/chart/screenings/stanley-and-brown" className="widget-action-btn widget-action-btn--secondary">
              Start Safety Plan
            </Link>
            <Link to="/chart/screenings/cams-section-a" className="widget-action-btn widget-action-btn--secondary">
              Start CAMS Assessment
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
