import { useState } from 'react'
import { PatientJourney } from './PatientJourney'
import { DataDictionary } from './DataDictionary'
import { EhrAdoptionRubric } from './EhrAdoptionRubric'
import '../css/ImplementationGuide.css'

type Tab = 'pathway' | 'dictionary' | 'rubric'

export function ImplementationGuide() {
  const [activeTab, setActiveTab] = useState<Tab>('pathway')

  return (
    <div className="implementation-guide">
      <header className="ig-header">
        <h2 className="ig-title">Implementation Guide</h2>
        <nav className="ig-tabs">
          <button 
            className={`ig-tab-btn ${activeTab === 'pathway' ? 'ig-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('pathway')}
          >
            Pathway
          </button>
          <button 
            className={`ig-tab-btn ${activeTab === 'dictionary' ? 'ig-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('dictionary')}
          >
            Data Dictionary
          </button>
          <button 
            className={`ig-tab-btn ${activeTab === 'rubric' ? 'ig-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('rubric')}
          >
            Adoption Rubric
          </button>
        </nav>
      </header>

      <main className="ig-content">
        {activeTab === 'pathway' && <PatientJourney />}
        {activeTab === 'dictionary' && <DataDictionary />}
        {activeTab === 'rubric' && <EhrAdoptionRubric />}
      </main>
    </div>
  )
}
