<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
  size?: number
  status?: 'active' | 'offline' | 'busy'
}>()

const size = computed(() => props.size ?? 36)
const initials = computed(() => props.name.split(' ').map(n => n[0]).slice(0, 2).join(''))
const hue = computed(() => (props.name.charCodeAt(0) * 17) % 360)
const bg = computed(() =>
  `linear-gradient(135deg, hsl(${hue.value},40%,30%), hsl(${(hue.value+30)%360},40%,22%))`
)
const dotColor = computed(() => {
  if (props.status === 'active') return 'var(--dot-active)'
  if (props.status === 'busy') return 'var(--dot-busy)'
  return 'var(--dot-offline)'
})
</script>

<template>
  <div :style="{ position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: 0 }">
    <div :style="{
      width: `${size}px`, height: `${size}px`,
      borderRadius: '50%',
      background: bg,
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 600,
      fontSize: `${size * 0.36}px`,
    }">{{ initials }}</div>
    <span v-if="status" :style="{
      position: 'absolute', right: '-1px', bottom: '-1px',
      width: '10px', height: '10px', borderRadius: '50%',
      background: dotColor,
      border: '2px solid var(--bg-1)',
    }" />
  </div>
</template>
