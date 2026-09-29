import { createApp } from 'vue'
import { initTheme } from '@roboacademy/ui'
import './style.css'
import App from './App.vue'
import router from './router'

initTheme('light')

createApp(App)
.use(router)
.mount('#app')
