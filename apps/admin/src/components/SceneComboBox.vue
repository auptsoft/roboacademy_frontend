<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
import { listSimulationScenes, type SimulationScene } from '@/api/roboticsLab'

/**
 * Scene picker for Simulation lessons. The input text IS the scene ref: typing edits the saved
 * value directly and picking from the list overwrites it. That keeps the field showing exactly
 * what gets stored, which matters because reopening a lesson gives us only the stored id - there
 * is no name to display until the library loads, and it may never list a hand-typed ref at all.
 */
const sceneRef = defineModel<string>({ required: true })

const scenes = ref<SimulationScene[]>([])
const searching = ref(false)
// False once a fetch fails or comes back empty: the external app has no scene directory, so the
// control degrades to the plain text box lessons were authored with before this existed.
const libraryAvailable = ref(false)
let searchDebounce: ReturnType<typeof setTimeout> | undefined

const matched = computed(
  () => scenes.value.find((s) => s.sceneRef === sceneRef.value) ?? null,
)

async function fetchScenes(query?: string) {
  searching.value = true
  try {
    const result = await listSimulationScenes(query)
    scenes.value = result
    if (result.length > 0) libraryAvailable.value = true
  } catch {
    scenes.value = []
    libraryAvailable.value = false
  } finally {
    searching.value = false
  }
}

onMounted(() => fetchScenes())

function onInput(value: string) {
  sceneRef.value = value
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => fetchScenes(value || undefined), 300)
}

function onSelect(value: string) {
  if (value) sceneRef.value = value
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
    class="relative"
    @update:model-value="(value) => onSelect(value as string)"
  >
    <ComboboxAnchor>
      <ComboboxInput
        id="lesson-scene-reference"
        :model-value="sceneRef"
        placeholder="Search scenes, or paste a scene ID"
        :class="inputClass"
        @update:model-value="(value) => onInput(value as string)"
      />
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        :class="
          cn(
            'z-50 w-(--reka-combobox-trigger-width) rounded-none bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
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

  <p v-if="libraryAvailable && sceneRef" class="m-0 text-xs" :class="matched ? 'text-(--fg-3)' : 'text-(--fg-4)'">
    <template v-if="matched">
      Selected: <span class="font-semibold text-(--fg-1)">{{ matched.name }}</span>
    </template>
    <template v-else>Not in the scene library &mdash; will be saved as typed.</template>
  </p>
</template>
