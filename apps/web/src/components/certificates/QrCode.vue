<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import QRCode from 'qrcode'

// Renders `value` as an inline SVG QR code. Always dark-on-white regardless of theme: it has
// to scan from paper and screens alike.
const props = defineProps<{ value: string; size?: number }>()

const svg = ref('')

watchEffect(async () => {
  try {
    svg.value = await QRCode.toString(props.value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
  } catch {
    svg.value = ''
  }
})
</script>

<template>
  <div
    v-if="svg"
    class="bg-white p-2 [&>svg]:block [&>svg]:w-full [&>svg]:h-full"
    :style="{ width: `${props.size ?? 96}px`, height: `${props.size ?? 96}px` }"
    role="img"
    aria-label="QR code linking to the verification page"
    v-html="svg"
  />
</template>
