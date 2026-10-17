<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { MoreVertical, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { ApiError } from '@/api/client'
import {
  deleteSimulationScene,
  listSimulationScenes,
  publishSimulationScene,
  unpublishSimulationScene,
  type SimulationScene,
} from '@/api/roboticsLab'

const router = useRouter()
const scenes = ref<SimulationScene[]>([])
const loading = ref(false)
const query = ref('')
let debounce: ReturnType<typeof setTimeout> | undefined

async function load() {
  loading.value = true
  try {
    scenes.value = await listSimulationScenes(query.value.trim() || undefined)
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : 'Scenes could not be loaded.')
  } finally {
    loading.value = false
  }
}

watch(query, () => {
  clearTimeout(debounce)
  debounce = setTimeout(load, 300)
})

onMounted(load)

async function togglePublished(scene: SimulationScene) {
  try {
    if (scene.status === 'Published') await unpublishSimulationScene(scene.sceneRef)
    else await publishSimulationScene(scene.sceneRef)
    toast.success(scene.status === 'Published' ? 'Scene returned to draft.' : 'Scene published.')
    await load()
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : 'Something went wrong.')
  }
}

async function remove(scene: SimulationScene) {
  if (!window.confirm(`Delete "${scene.name}"? This can't be undone.`)) return
  try {
    await deleteSimulationScene(scene.sceneRef)
    toast.success('Scene deleted.')
    await load()
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : 'Something went wrong.')
  }
}

const rowClass =
  'grid grid-cols-[2fr_1fr_110px_110px_1fr_60px] items-center gap-3 py-3.5 px-6 max-md:grid-cols-1 max-md:gap-1.5'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Simulation Scenes</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">
          Worlds for Simulation lessons: the arena, the robot and the objectives learners are graded on.
          Publish a scene to attach it to a lesson.
        </p>
      </div>
      <Button @click="router.push('/roboticslab/scenes/new')">
        <Plus :size="16" />
        New scene
      </Button>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 border-b border-(--line-1) py-3 px-6">
        <Input v-model="query" placeholder="Search scenes" class="max-w-80" />
      </div>

      <div :class="[rowClass, 'border-b border-(--line-1) text-xs text-(--fg-3) max-md:hidden']">
        <span>Name</span>
        <span>Robot</span>
        <span>Objectives</span>
        <span>Status</span>
        <span>Updated</span>
        <span class="text-right">Actions</span>
      </div>

      <p v-if="loading && scenes.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">Loading scenes…</p>
      <p v-else-if="scenes.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">
        No scenes yet. Create one to build a Simulation lesson.
      </p>

      <div
        v-for="(scene, i) in scenes"
        :key="scene.sceneRef"
        :class="[rowClass, i < scenes.length - 1 && 'border-b border-(--line-1)']"
      >
        <RouterLink :to="`/roboticslab/scenes/${scene.sceneRef}`" class="min-w-0 no-underline">
          <div class="truncate text-sm font-semibold text-(--fg-1)">{{ scene.name }}</div>
          <div v-if="scene.description" class="truncate text-xs text-(--fg-3)">{{ scene.description }}</div>
        </RouterLink>
        <div class="text-sm text-(--fg-2)">{{ scene.robotType }}</div>
        <div class="text-sm text-(--fg-2)">{{ scene.objectiveCount }}</div>
        <div><RaChip :tone="scene.status === 'Published' ? 'info' : 'neutral'">{{ scene.status }}</RaChip></div>
        <div class="text-sm text-(--fg-2)">{{ scene.updatedAt ? formatDate(scene.updatedAt) : '—' }}</div>
        <div class="flex justify-end max-md:justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger
              class="inline-flex size-9 items-center justify-center rounded-lg border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <MoreVertical :size="16" />
              <span class="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem @select="router.push(`/roboticslab/scenes/${scene.sceneRef}`)">Edit</DropdownMenuItem>
              <DropdownMenuItem @select="togglePublished(scene)">
                {{ scene.status === 'Published' ? 'Return to draft' : 'Publish' }}
              </DropdownMenuItem>
              <DropdownMenuItem class="text-(--danger)" @select="remove(scene)">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </RaCard>
  </div>
</template>
