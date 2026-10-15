<script setup lang="ts">
import { computed } from 'vue'
import { getCapability, type SceneDefinition } from '@roboacademy/sim'

/**
 * Top-down map of a scene for the editor. Seen from above, +X is right and +Z is down, matching
 * the simulator; headings and wall rotations are counter-clockwise, so SVG rotates by -angle.
 * Clicking the floor reports the point, which the editor uses to place the robot.
 */
const props = defineProps<{ scene: SceneDefinition }>()
const emit = defineEmits<{ place: [point: { x: number; z: number }] }>()

const width = computed(() => props.scene.arena.width)
const depth = computed(() => props.scene.arena.depth)
const viewBox = computed(() => {
  const pad = 0.1
  return `${-width.value / 2 - pad} ${-depth.value / 2 - pad} ${width.value + pad * 2} ${depth.value + pad * 2}`
})

const robotSize = computed(() => getCapability(props.scene.robot.type)?.size ?? { width: 0.18, length: 0.2, height: 0.1 })

const gridLines = computed(() => {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (let x = Math.ceil(-width.value / 2 * 10) / 10; x <= width.value / 2; x += 0.1) {
    lines.push({ x1: x, y1: -depth.value / 2, x2: x, y2: depth.value / 2 })
  }
  for (let z = Math.ceil(-depth.value / 2 * 10) / 10; z <= depth.value / 2; z += 0.1) {
    lines.push({ x1: -width.value / 2, y1: z, x2: width.value / 2, y2: z })
  }
  return lines
})

function onClick(event: MouseEvent) {
  const svg = event.currentTarget as SVGSVGElement
  const matrix = svg.getScreenCTM()
  if (!matrix) return
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  if (Math.abs(point.x) > width.value / 2 || Math.abs(point.y) > depth.value / 2) return
  emit('place', { x: Math.round(point.x * 100) / 100, z: Math.round(point.y * 100) / 100 })
}
</script>

<template>
  <svg :viewBox="viewBox" class="block w-full h-auto cursor-crosshair select-none" role="img" aria-label="Scene map" @click="onClick">
    <rect :x="-width / 2" :y="-depth / 2" :width="width" :height="depth" :fill="scene.arena.floorColor" stroke="#5b6b7b" stroke-width="0.02" />
    <line
      v-for="(g, i) in gridLines"
      :key="i"
      v-bind="g"
      stroke="#9aa7b4"
      stroke-opacity="0.35"
      stroke-width="0.003"
    />
    <rect
      v-for="zone in scene.zones"
      :key="zone.id"
      :x="zone.center.x - zone.size.x / 2"
      :y="zone.center.z - zone.size.z / 2"
      :width="zone.size.x"
      :height="zone.size.z"
      :fill="zone.color"
      fill-opacity="0.45"
    >
      <title>{{ zone.label || zone.id }}</title>
    </rect>
    <polyline
      v-for="line in scene.lines"
      :key="line.id"
      :points="line.points.map((p) => `${p.x},${p.z}`).join(' ')"
      fill="none"
      :stroke="line.color"
      :stroke-width="line.width"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    <rect
      v-for="wall in scene.walls"
      :key="wall.id"
      :x="-wall.length / 2"
      :y="-wall.thickness / 2"
      :width="wall.length"
      :height="wall.thickness"
      fill="#8795a3"
      :transform="`translate(${wall.x} ${wall.z}) rotate(${-wall.rotationDeg})`"
    />
    <template v-for="prop in scene.props" :key="prop.id">
      <circle v-if="prop.shape !== 'box'" :cx="prop.x" :cy="prop.z" :r="prop.size.x" :fill="prop.color" />
      <rect
        v-else
        :x="prop.x - prop.size.x / 2"
        :y="prop.z - prop.size.z / 2"
        :width="prop.size.x"
        :height="prop.size.z"
        :fill="prop.color"
      />
    </template>
    <g :transform="`translate(${scene.robot.start.x} ${scene.robot.start.z}) rotate(${-scene.robot.start.headingDeg})`">
      <rect
        :x="-robotSize.length / 2"
        :y="-robotSize.width / 2"
        :width="robotSize.length"
        :height="robotSize.width"
        fill="#2f6fec"
        rx="0.015"
      />
      <polygon
        :points="`${robotSize.length / 2},0 ${robotSize.length * 0.05},${-robotSize.width * 0.3} ${robotSize.length * 0.05},${robotSize.width * 0.3}`"
        fill="#ffd23f"
      />
    </g>
  </svg>
</template>
