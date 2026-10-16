import { onBeforeUnmount, onMounted, ref } from 'vue'

/** Follows the app's theme (data-theme on <html>), as SimulationPlayer does. */
export function useDark() {
  const dark = ref(false)
  const read = () => document.documentElement.getAttribute('data-theme') !== 'light'
  const observer = new MutationObserver(() => (dark.value = read()))
  onMounted(() => {
    dark.value = read()
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  })
  onBeforeUnmount(() => observer.disconnect())
  return dark
}
