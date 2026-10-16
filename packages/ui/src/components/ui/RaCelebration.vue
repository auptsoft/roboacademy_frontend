<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { PartyPopper, Sparkles, Trophy } from 'lucide-vue-next'
import { dismissCelebration, useCelebration, type CelebrationSize } from '../../composables/celebration'

/**
 * The pass celebration: a confetti burst over the page and a card that pops in and leaves on its
 * own. Mount once in the app shell; anything calls `celebrate()` to show it. The overlay never
 * blocks the page underneath, and reduced-motion users get the card alone, faded in.
 */

const { current } = useCelebration()

const SHOW_MS: Record<CelebrationSize, number> = { light: 1800, standard: 2600, major: 3400, grand: 5200 }

const canvas = ref<HTMLCanvasElement | null>(null)
let hideTimer: ReturnType<typeof setTimeout> | undefined
let spawnTimers: ReturnType<typeof setTimeout>[] = []
// Keep animating until this time even with nothing on screen: delayed waves are still to come.
let spawnUntil = 0
let frame = 0

interface Piece {
  x: number; y: number; vx: number; vy: number
  rot: number; vr: number; tilt: number; vt: number
  w: number; h: number; color: string; round: boolean
}
let pieces: Piece[] = []

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function palette(): string[] {
  const css = getComputedStyle(document.documentElement)
  const fromTokens = ['--brand-blue', '--brand-violet', '--success', '--warning']
    .map(name => css.getPropertyValue(name).trim())
    .filter(Boolean)
  return [...(fromTokens.length ? fromTokens : ['#3B82F6', '#7C5CFF', '#22C55E', '#F59E0B']), '#F472B6', '#FFFFFF']
}

/** Fire `count` pieces from (x, y), aimed at `angle` degrees (0 = right, -90 = up) within `spread`. */
function burst(x: number, y: number, count: number, angle: number, spread: number, speed: number) {
  const colors = palette()
  for (let i = 0; i < count; i++) {
    const a = ((angle + (Math.random() - 0.5) * spread) * Math.PI) / 180
    const v = speed * (0.55 + Math.random() * 0.6)
    pieces.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      tilt: Math.random() * Math.PI,
      vt: 0.08 + Math.random() * 0.12,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      round: Math.random() < 0.25,
    })
  }
}

/** Pieces drifting down from above the viewport, spread across its width. */
function rain(count: number) {
  const width = window.innerWidth
  for (let i = 0; i < count; i++) burst(Math.random() * width, -20 - Math.random() * 120, 1, 90, 30, 3)
}

function launch(size: CelebrationSize) {
  const w = window.innerWidth
  const h = window.innerHeight
  const cannons = (n: number, speed: number) => {
    burst(0, h * 0.9, n, -60, 40, speed)
    burst(w, h * 0.9, n, -120, 40, speed)
  }
  const later = (ms: number, fn: () => void) => {
    spawnTimers.push(setTimeout(fn, ms))
    spawnUntil = Math.max(spawnUntil, performance.now() + ms + 50)
  }

  if (size === 'light') {
    burst(w / 2, h * 0.42, 45, -90, 110, 11)
  } else if (size === 'standard') {
    cannons(70, 22)
  } else if (size === 'major') {
    cannons(90, 24)
    later(250, () => burst(w / 2, h * 0.42, 60, -90, 140, 14))
  } else {
    cannons(110, 26)
    later(500, () => cannons(80, 22))
    later(300, () => rain(90))
    later(1400, () => rain(70))
  }
  if (!frame) frame = requestAnimationFrame(tick)
}

function tick() {
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx) {
    frame = 0
    return
  }
  const dpr = window.devicePixelRatio || 1
  const w = window.innerWidth
  const h = window.innerHeight
  if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
    el.width = Math.round(w * dpr)
    el.height = Math.round(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  for (const p of pieces) {
    p.vy += 0.35 // gravity
    p.vx *= 0.985 // air drag
    p.vy *= 0.985
    p.vy = Math.min(p.vy, 7) // flutter down rather than drop
    p.x += p.vx + Math.sin(p.tilt) * 0.6
    p.y += p.vy
    p.rot += p.vr
    p.tilt += p.vt

    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.scale(1, Math.cos(p.tilt)) // the 3D flip
    ctx.fillStyle = p.color
    if (p.round) {
      ctx.beginPath()
      ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
    }
    ctx.restore()
  }
  pieces = pieces.filter(p => p.y < h + 40 && p.x > -60 && p.x < w + 60)

  if (pieces.length || performance.now() < spawnUntil) {
    frame = requestAnimationFrame(tick)
  } else {
    frame = 0
    ctx.clearRect(0, 0, w, h)
  }
}

function clearSpawns() {
  spawnTimers.forEach(clearTimeout)
  spawnTimers = []
  spawnUntil = 0
}

watch(
  () => current.value?.id,
  () => {
    clearTimeout(hideTimer)
    const shown = current.value
    if (!shown) return
    if (!reducedMotion()) {
      clearSpawns()
      launch(shown.size)
    }
    hideTimer = setTimeout(dismissCelebration, SHOW_MS[shown.size])
  },
)

onBeforeUnmount(() => {
  clearTimeout(hideTimer)
  clearSpawns()
  cancelAnimationFrame(frame)
  pieces = []
})
</script>

<template>
  <div class="ra-celebration">
    <canvas ref="canvas" class="ra-celebration__canvas" aria-hidden="true" />
    <div class="ra-celebration__live" role="status" aria-live="polite">
      <Transition name="ra-celebration-card">
        <button
          v-if="current"
          :key="current.id"
          type="button"
          class="ra-celebration__card"
          :class="`ra-celebration__card--${current.size}`"
          title="Dismiss"
          @click="dismissCelebration"
        >
          <span class="ra-celebration__badge">
            <Trophy v-if="current.size === 'grand' || current.size === 'major'" :size="current.size === 'grand' ? 30 : 24" />
            <PartyPopper v-else-if="current.size === 'standard'" :size="22" />
            <Sparkles v-else :size="18" />
          </span>
          <span class="ra-celebration__title">{{ current.title }}</span>
          <span v-if="current.subtitle" class="ra-celebration__subtitle">{{ current.subtitle }}</span>
        </button>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.ra-celebration {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
}
.ra-celebration__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.ra-celebration__live {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
}
.ra-celebration__card {
  pointer-events: auto;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  max-width: 360px;
  padding: 24px 32px;
  border: 1px solid var(--line-2);
  border-radius: var(--ra-2xl);
  background: var(--bg-1);
  box-shadow: var(--elev-3);
  color: var(--fg-1);
  font: inherit;
  text-align: center;
}
.ra-celebration__card--light {
  padding: 16px 24px;
}
.ra-celebration__card--grand {
  max-width: 420px;
  padding: 32px 40px;
  border-color: var(--brand-violet-ring);
  box-shadow: var(--elev-3), 0 0 0 6px var(--brand-violet-soft);
}
.ra-celebration__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 4px;
  border-radius: 999px;
  background: var(--success-soft);
  color: var(--success);
}
.ra-celebration__card--light .ra-celebration__badge {
  width: 36px;
  height: 36px;
}
.ra-celebration__card--major .ra-celebration__badge {
  background: var(--warning-soft);
  color: var(--warning);
}
.ra-celebration__card--grand .ra-celebration__badge {
  width: 64px;
  height: 64px;
  background: var(--brand-violet-soft);
  color: var(--brand-violet);
}
.ra-celebration__title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.ra-celebration__card--light .ra-celebration__title {
  font-size: 16px;
}
.ra-celebration__card--grand .ra-celebration__title {
  font-size: 26px;
}
.ra-celebration__subtitle {
  font-size: 13px;
  color: var(--fg-3);
}

.ra-celebration-card-enter-active {
  transition: opacity var(--dur-3) var(--ease-out), transform var(--dur-4) cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ra-celebration-card-leave-active {
  transition: opacity var(--dur-3) var(--ease-in-out), transform var(--dur-3) var(--ease-in-out);
}
.ra-celebration-card-enter-from {
  opacity: 0;
  transform: scale(0.7) translateY(12px);
}
.ra-celebration-card-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .ra-celebration-card-enter-active,
  .ra-celebration-card-leave-active {
    transition: opacity var(--dur-3) linear;
  }
  .ra-celebration-card-enter-from,
  .ra-celebration-card-leave-to {
    transform: none;
  }
}
</style>
