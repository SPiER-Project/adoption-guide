import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import '../css/Dashboard.css'

export function Dashboard() {
  const { carePlans, responses } = usePatient()

  const activePlans = carePlans.filter((cp: any) => cp.status === 'active')
  const recentResponses = [...responses].reverse().slice(0, 5)

  return (
    <div className="dashboard">
      <h2 className="dashboard-title">Patient Dashboard</h2>

      <div className="dashboard-grid">
        {/* Risk Status Widget */}
        <div className="dashboard-widget">
          <h3 className="widget-title">Risk Status</h3>
          <div className="widget-body">
            {activePlans.length > 0 ? (
              <span className="risk-badge risk-badge--active">Active Safety Plan</span>
            ) : (
              <span className="risk-badge risk-badge--none">No Active Plans</span>
            )}
            <p className="widget-hint">
              Risk status is determined by screening and assessment tools.
            </p>
          </div>
        </div>

        {/* Recent Screenings Widget */}
        <div className="dashboard-widget">
          <h3 className="widget-title">Recent Screenings</h3>
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
              <p className="widget-empty">No screenings completed yet.</p>
            )}
            <Link to="/chart/screenings" className="widget-link">View all screenings</Link>
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
            <Link to="/chart/screenings/stanley-and-brown" className="widget-action-btn">
              Start Safety Plan
            </Link>
            <Link to="/chart/screenings/cams-section-a" className="widget-action-btn widget-action-btn--secondary">
              Start CAMS Assessment
            </Link>
            <Link to="/chart/workflow" className="widget-action-btn widget-action-btn--secondary">
              View Clinical Workflow
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
