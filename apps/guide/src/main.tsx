import App from './App.tsx'
import { bootstrap } from '@spier/app-shell/bootstrap'

// Everything interesting is in the shared bootstrap: the SMART launch/redirect
// hand-off and the stale-chunk reload guard, which are facts about how this app
// is hosted rather than about which app it is.
bootstrap(App)
