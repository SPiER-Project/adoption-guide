import { Link, useParams, Navigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { TOOLS } from '../data/catalog'
import { pilotPlanBySlug } from '../data/pilot-plans'
import '../css/PilotPlan.css'

export function PilotPlan() {
  const { slug } = useParams<{ slug: string }>()
  const content = slug ? pilotPlanBySlug(slug) : undefined
  const tool = slug ? TOOLS.find(t => t.pilotPlanSlug === slug) : undefined

  if (!slug || !content) {
    return <Navigate to="/chart/workflow" replace />
  }

  return (
    <div className="pilot-plan">
      <div className="pilot-plan-breadcrumb">
        <Link to="/chart/workflow">Pathway</Link>
        {tool && (
          <>
            <span className="pilot-plan-breadcrumb-sep">/</span>
            <Link to="/chart/workflow" className="pilot-plan-breadcrumb-tool">{tool.shortName ?? tool.name}</Link>
          </>
        )}
        <span className="pilot-plan-breadcrumb-sep">/</span>
        <span>Pilot Plan</span>
      </div>

      <article className="pilot-plan-doc">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </article>
    </div>
  )
}
