import { createApp } from 'vue'
import { initTheme } from '@roboacademy/ui'
import './style.css'
import App from './App.vue'
import router from './router'
import UnknownTenantHost from './components/UnknownTenantHost.vue'
import { resolveTenantFromHost } from './lib/tenant-from-host'

initTheme('light')

// The tenant has to be settled before the router guard or any page sends X-Tenant-Id - on a
// school's own domain that means looking the hostname up first.
async function bootstrap(): Promise<void> {
  const hostTenant = await resolveTenantFromHost()
  if (hostTenant === 'unknown' || hostTenant === 'unreachable') {
    createApp(UnknownTenantHost, { reason: hostTenant }).mount('#app')
    return
  }

  createApp(App)
    .use(router)
    .mount('#app')
}

void bootstrap()
