<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxPortal,
  ComboboxContent,
  ComboboxViewport,
  ComboboxItem,
  ComboboxEmpty,
} from 'reka-ui'
import { cn } from '@roboacademy/ui'
import { getSimulationScene, listSimulationScenes, type SimulationScene } from '@/api/roboticsLab'

/**
 * Scene picker for Simulation lessons. The stored value is the scene's id, but the field shows
 * the scene's name: typing searches the library, and closing the list puts the selected name back.
 * Reopening a lesson gives us only the stored id, so a name not in the loaded list is looked up
 * on its own. Pasting a scene id selects it directly, for scenes the search doesn't surface.
 */
const sceneRef = defineModel<string>({ required: true })

const scenes = ref<SimulationScene[]>([])
const searching = ref(false)
// False once a fetch fails or comes back empty (no scenes yet), so the control degrades to a plain
// text box rather than an empty dropdown.
const libraryAvailable = ref(false)
let searchDebounce: ReturnType<typeof setTimeout> | undefined

/** Names seen so far by scene id, so the selection keeps its name after a search narrows the list. */
const knownNames = ref<Record<string, string>>({})
/** The selected id isn't a scene we can find (deleted, or a hand-typed ref). */
const unresolved = ref(false)

const selectedName = computed(() => (sceneRef.value ? knownNames.value[sceneRef.value] ?? null : null))

const SCENE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function remember(list: SimulationScene[]) {
  const next = { ...knownNames.value }
  for (const scene of list) next[scene.sceneRef] = scene.name
  knownNames.value = next
}

async function fetchScenes(query?: string) {
  searching.value = true
  try {
    const result = await listSimulationScenes(query)
    scenes.value = result
    remember(result)
    if (result.length > 0) libraryAvailable.value = true
  } catch {
    scenes.value = []
    libraryAvailable.value = false
  } finally {
    searching.value = false
  }
}

async function resolveName(id: string) {
  unresolved.value = false
  if (!id || knownNames.value[id]) return
  try {
    const scene = await getSimulationScene(id)
    knownNames.value = { ...knownNames.value, [id]: scene.name }
  } catch {
    if (sceneRef.value === id) unresolved.value = true
  }
}

onMounted(() => fetchScenes())
watch(sceneRef, (id) => void resolveName(id), { immediate: true })

function onSearch(event: Event) {
  const value = (event.target as HTMLInputElement).value.trim()
  if (SCENE_ID.test(value)) sceneRef.value = value
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => fetchScenes(value || undefined), 300)
}

function onSelect(value: string) {
  if (value) sceneRef.value = value
}

/** What the field shows when not being typed in. */
function displayValue(id: unknown) {
  if (typeof id !== 'string' || !id) return ''
  return knownNames.value[id] ?? id
}

const inputClass =
  'h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none placeholder:text-(--fg-4)'
</script>

<template>
  <!-- No directory to offer: behave exactly like the free-text field this replaced. -->
  <input
    v-if="!libraryAvailable"
    id="lesson-scene-reference"
    :value="sceneRef"
    placeholder="e.g. 01930f2a-..."
    :class="inputClass"
    @input="sceneRef = ($event.target as HTMLInputElement).value"
  />

  <ComboboxRoot
    v-else
    :model-value="sceneRef"
    ignore-filter
    open-on-click
    class="relative"
    @update:model-value="(value) => onSelect(value as string)"
  >
    <ComboboxAnchor class="relative">
      <!-- Keyed by the shown name so the field updates when a stored id's name arrives. -->
      <ComboboxInput
        id="lesson-scene-reference"
        :key="selectedName ?? sceneRef"
        :display-value="displayValue"
        placeholder="Search scenes, or paste a scene ID"
        :class="[inputClass, sceneRef && 'pr-8']"
        @input="onSearch"
      />
      <button
        v-if="sceneRef"
        type="button"
        class="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-(--ra-sm) border-0 bg-transparent text-(--fg-4) hover:bg-(--bg-4) hover:text-(--fg-1)"
        aria-label="Clear scene"
        @click="sceneRef = ''"
      >
        <X :size="14" />
      </button>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        :side-offset="6"
        :class="
          cn(
            'z-50 w-(--reka-combobox-trigger-width) rounded-xl bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )
        "
      >
        <ComboboxViewport class="max-h-60 overflow-y-auto">
          <ComboboxEmpty class="px-2.5 py-2 text-[13px] text-(--fg-3)">
            {{ searching ? 'Searching…' : 'No matching scenes.' }}
          </ComboboxEmpty>
          <ComboboxItem
            v-for="scene in scenes"
            :key="scene.sceneRef"
            :value="scene.sceneRef"
            :text-value="scene.name"
            class="cursor-pointer px-2.5 py-2 text-[13px] text-(--fg-2) outline-none select-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
          >
            <div class="font-semibold text-(--fg-1)">{{ scene.name }}</div>
            <div class="text-xs text-(--fg-3)">
              {{ scene.robotType ? `${scene.robotType} · ` : '' }}{{ scene.objectiveCount }}
              objective{{ scene.objectiveCount === 1 ? '' : 's' }} · {{ scene.status }}
            </div>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>

  <p v-if="libraryAvailable && sceneRef && unresolved" class="m-0 text-xs text-(--fg-4)">
    Not in the scene library &mdash; will be saved as <span class="font-mono">{{ sceneRef }}</span>.
  </p>
</template>
