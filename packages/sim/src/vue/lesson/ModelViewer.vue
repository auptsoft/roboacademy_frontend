<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Box, Loader2 } from 'lucide-vue-next'
import { useAssetUrl, type Model3dBlock } from '@roboacademy/ui'

/**
 * A rotatable 3D model (.glb). Nothing loads until the learner taps - Three.js and the model can
 * be several megabytes. Renders only when the view changes, so an idle model costs nothing.
 */
const props = defineProps<{ block: Model3dBlock }>()
const assetUrl = useAssetUrl()

const host = ref<HTMLDivElement | null>(null)
const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
let cleanup: (() => void) | null = null

async function load() {
  const url = assetUrl(props.block.asset)
  if (!url || !host.value) {
    state.value = 'error'
    return
  }
  state.value = 'loading'
  try {
    const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/controls/OrbitControls.js'),
    ])
    const gltf = await new GLTFLoader().loadAsync(url)
    const el = host.value
    if (!el) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.5))
    const sun = new THREE.DirectionalLight(0xffffff, 2)
    sun.position.set(3, 5, 4)
    scene.add(sun)
    scene.add(gltf.scene)

    // Frame the model whatever its size or units.
    const box = new THREE.Box3().setFromObject(gltf.scene)
    const size = box.getSize(new THREE.Vector3()).length() || 1
    const center = box.getCenter(new THREE.Vector3())
    const camera = new THREE.PerspectiveCamera(40, el.clientWidth / el.clientHeight, size / 100, size * 100)
    camera.position.copy(center).add(new THREE.Vector3(size * 0.6, size * 0.45, size * 0.8))

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(center)
    controls.enableDamping = false
    const render = () => renderer.render(scene, camera)
    controls.addEventListener('change', render)
    controls.update()
    render()

    const resize = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight)
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      render()
    })
    resize.observe(el)

    cleanup = () => {
      resize.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}

onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <figure class="m-0">
    <div class="relative aspect-[4/3] overflow-hidden rounded-(--ra-lg) border border-(--line-1) bg-(--bg-3)">
      <div ref="host" class="absolute inset-0" role="img" :aria-label="block.alt" />
      <button
        v-if="state !== 'ready'"
        type="button"
        class="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 border-0 bg-transparent text-(--fg-2)"
        :disabled="state === 'loading'"
        @click="load"
      >
        <Loader2 v-if="state === 'loading'" :size="26" class="animate-spin text-(--fg-3)" />
        <Box v-else :size="28" class="text-(--brand-blue)" />
        <span class="text-sm font-semibold">{{ state === 'error' ? "The model couldn't be loaded. Tap to try again." : 'Tap to view in 3D' }}</span>
        <span v-if="state === 'idle'" class="max-w-80 px-4 text-center text-xs text-(--fg-3)">{{ block.alt }}</span>
      </button>
    </div>
    <figcaption class="mt-2 text-[13px] text-(--fg-3)">
      {{ block.caption ?? '' }}<span v-if="state === 'ready'"> Drag to turn it, pinch or scroll to zoom.</span>
    </figcaption>
  </figure>
</template>
