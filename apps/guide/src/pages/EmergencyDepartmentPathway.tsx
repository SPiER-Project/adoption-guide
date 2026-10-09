/**
 * /guide/pathway/emergency-department — the pathway in the emergency department.
 *
 * One file per setting, rather than a `page` prop at the route, because
 * `check:guide-boundary` finds each guide page's component by reading
 * `element={<Name />}` off App.tsx and walking `pages/<Name>.tsx`. The page
 * itself is `SettingPathway`; the setting's copy is in data/settingPathways.ts.
 * The root `<div>` is here, not there, because `check:template` reads the
 * page root out of THIS file.
 */
import { SETTING_PATHWAY_PAGES } from '../data/settingPathways'
import { SettingPathway } from '../components/SettingPathway'

const PAGE = SETTING_PATHWAY_PAGES.find(p => p.path === 'pathway/emergency-department')

export function EmergencyDepartmentPathway() {
  if (!PAGE) throw new Error('EmergencyDepartmentPathway: data/settingPathways.ts declares no page for "pathway/emergency-department"')
  return (
    <div className="care-pathway">
      <SettingPathway page={PAGE} />
    </div>
  )
}
