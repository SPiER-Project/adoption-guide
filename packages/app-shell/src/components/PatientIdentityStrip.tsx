/**
 * Who this chart is about: name, identifiers, and the highest active risk —
 * the strip both patient banners draw. The full form is the app shell's
 * banner row (name | DOB | MRN | Sex | Risk); `dense` is the panel's one
 * line (name · DOB · MRN, a small pill) for a 470px frame inside a host EHR.
 *
 * PatientBanner and PanelShell each carried a copy of this markup, and each
 * carried its own RISK_LABEL and highestRiskLevel — byte-identical, with a
 * comment in one explaining it matched the other "exactly". One component,
 * one rule (lib/riskLabel.ts), and the banner's collapse-on-narrow behaviour
 * is now the strip's own.
 */
import { usePatient } from '@spier/tool-views/context/PatientContext'
import { cx } from '@spier/ui/cx'
import { RISK_LABEL, highestActiveRiskLevel, riskTitle } from '../lib/riskLabel'
import { RiskPill } from '@spier/tool-views/components/RiskPill'
import '../css/PatientIdentityStrip.css'

function Divider() {
  return <span className="identity-strip__divider">|</span>
}

function Field({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <span className="identity-strip__field">
      <span className="identity-strip__label">{label}</span>
      <span className={cx('identity-strip__value', mono && 'identity-strip__value--mono')}>{children}</span>
    </span>
  )
}

export function PatientIdentityStrip({ dense }: { dense?: boolean }) {
  const { patientDisplay, riskAlerts } = usePatient()
  const risk = highestActiveRiskLevel(riskAlerts.map(a => a.level))

  if (dense) {
    return (
      <div className="identity-strip identity-strip--dense">
        <span className="identity-strip__name">{patientDisplay.fullName}</span>
        {/* Age rather than the date of birth, and the whole strip rather than a
            second line on the page: the landing screen's "who" and this strip
            are ONE statement of who the chart is about (clinical-app audit
            §4.1, §4.7), and at 375px there is room for one of age and DOB. The
            full strip below keeps both, because a browsing chrome has the
            width for the identifying fact as well as the placing one. */}
        <span className="identity-strip__meta">
          {patientDisplay.age && <>Age {patientDisplay.age} &middot; </>}MRN {patientDisplay.mrn}
        </span>
        <RiskPill level={risk} label={RISK_LABEL[risk]} sm title={riskTitle(risk)} />
      </div>
    )
  }

  return (
    <div className="identity-strip">
      <span className="identity-strip__name">{patientDisplay.fullName}</span>
      <Divider />
      <Field label="DOB">
        {patientDisplay.dob}
        {patientDisplay.age && ` (${patientDisplay.age})`}
      </Field>
      <Divider />
      <Field label="MRN" mono>{patientDisplay.mrn}</Field>
      <Divider />
      <Field label="Sex">{patientDisplay.gender}</Field>
      <Divider />
      <Field label="Risk">
        <RiskPill level={risk} label={RISK_LABEL[risk]} title={riskTitle(risk)} />
      </Field>
    </div>
  )
}
