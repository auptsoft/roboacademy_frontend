import { createApp } from 'vue'
import { initTheme } from '@roboacademy/ui'
import './style.css'
import App from './App.vue'
import router from './router'
import { applyTenantBranding } from './branding'

initTheme('system')
applyTenantBranding()

createApp(App)
  .use(router)
  .mount('#app')
