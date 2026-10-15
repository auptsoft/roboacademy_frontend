<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { ArrowLeft, Plus, Trash2 } from 'lucide-vue-next'
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  emptyScene,
  getCapability,
  type ProgramLanguage,
  validateObjectives,
  validateScene,
  type Objective,
  type ObjectiveSet,
  type Predicate,
  type SceneDefinition,
} from '@roboacademy/sim'
import { SimulationPlayer } from '@roboacademy/sim/vue'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import SceneMap from '@/components/simulation/SceneMap.vue'
import { ApiError } from '@/api/client'
import {
  createSimulationScene,
  getSimulationScene,
  publishSimulationScene,
  updateSimulationScene,
  type SceneStatus,
} from '@/api/roboticsLab'

/**
 * A basic scene editor: forms for the arena, robot, walls, zones, lines, props and objectives,
 * a top-down map, and a test run in the real simulator. Validation is the simulator's own
 * (validateScene / validateObjectives), so what saves here is what learners' lessons load.
 */
const route = useRoute()
const router = useRouter()
const sceneId = computed(() => (route.params.sceneId === 'new' ? null : String(route.params.sceneId)))

const name = ref('')
const description = ref('')
const status = ref<SceneStatus>('Draft')
const scene = reactive<SceneDefinition>(emptyScene())
const objectives = reactive<ObjectiveSet>({ version: 1, objectives: [] })
const loading = ref(false)
const saving = ref(false)
const previewTab = ref<'map' | 'test'>('map')
const testVersion = ref(0)
const testLanguage = ref<ProgramLanguage>('blocks')
const objectivesJson = ref('')
const editingJson = ref(false)
const jsonError = ref('')

const capability = computed(() => getCapability(scene.robot.type))
const hideableSensors = computed(() => capability.value?.sensors.filter((s) => s.hideable) ?? [])

const issues = computed(() => {
  const all = [...validateScene(scene), ...validateObjectives(objectives, scene)]
  if (!name.value.trim()) all.unshift({ path: 'name', message: 'Give the scene a name.' })
  return all
})

/** Simple objective kinds the form can edit; anything else is edited as JSON. */
type SimpleKind = 'robotInZone' | 'robotAtPose' | 'propInZone'
const SIMPLE_KINDS: { value: SimpleKind; label: string }[] = [
  { value: 'robotInZone', label: 'Robot reaches a zone' },
  { value: 'robotAtPose', label: 'Robot reaches a point' },
  { value: 'propInZone', label: 'Object pushed into a zone' },
]
const allSimple = computed(() => objectives.objectives.every((o) => SIMPLE_KINDS.some((k) => k.value === o.predicate.kind)))

function nextId(prefix: string, existing: { id: string }[]): string {
  let n = existing.length + 1
  while (existing.some((item) => item.id === `${prefix}${n}`)) n++
  return `${prefix}${n}`
}

function addWall() {
  scene.walls.push({ id: nextId('wall', scene.walls), x: 0, z: 0, length: 0.5, thickness: 0.04, height: 0.15, rotationDeg: 0 })
}
function addZone() {
  scene.zones.push({ id: nextId('zone', scene.zones), label: '', center: { x: 0.8, z: 0 }, size: { x: 0.3, z: 0.3 }, color: '#3cb371' })
}
function addLine() {
  scene.lines.push({ id: nextId('line', scene.lines), points: [{ x: -1, z: 0 }, { x: 1, z: 0 }], width: 0.02, color: '#1d232a' })
}
function addProp() {
  scene.props.push({ id: nextId('box', scene.props), shape: 'box', x: 0.4, z: 0, size: { x: 0.08, y: 0.08, z: 0.08 }, color: '#e8743b', mass: 0.2 })
}
function addObjective() {
  const zone = scene.zones[0]
  objectives.objectives.push({
    id: nextId('goal', objectives.objectives),
    label: zone ? `Reach ${zone.label || zone.id}` : 'Reach the goal',
    predicate: zone ? { kind: 'robotInZone', zoneId: zone.id } : { kind: 'robotAtPose', position: { x: 0.8, y: 0, z: 0 }, toleranceM: 0.1 },
  })
}

function setKind(objective: Objective, kind: SimpleKind) {
  const zoneId = scene.zones[0]?.id
  const propId = scene.props[0]?.id ?? ''
  const predicate: Predicate =
    kind === 'robotInZone'
      ? { kind, zoneId }
      : kind === 'propInZone'
        ? { kind, propId, zoneId }
        : { kind, position: { x: 0, y: 0, z: 0 }, toleranceM: 0.1 }
  objective.predicate = predicate
}

/** Lines are edited as "x,z; x,z; …" text. */
function linePointsText(points: { x: number; z: number }[]): string {
  return points.map((p) => `${p.x},${p.z}`).join('; ')
}
function setLinePoints(line: { points: { x: number; z: number }[] }, text: string) {
  const points = text
    .split(';')
    .map((pair) => pair.split(',').map((v) => Number(v.trim())))
    .filter((pair) => pair.length === 2 && pair.every(Number.isFinite))
    .map(([x, z]) => ({ x: x!, z: z! }))
  if (points.length >= 2) line.points = points
}

function toggleHidden(sensor: string, hidden: boolean) {
  scene.hiddenSensors = hidden ? [...scene.hiddenSensors, sensor] : scene.hiddenSensors.filter((s) => s !== sensor)
}

function openJsonEditor() {
  objectivesJson.value = JSON.stringify(objectives, null, 2)
  jsonError.value = ''
  editingJson.value = true
}

function applyJson() {
  try {
    const parsed = JSON.parse(objectivesJson.value) as ObjectiveSet
    if (parsed?.version !== 1 || !Array.isArray(parsed.objectives)) throw new Error('Expected { "version": 1, "objectives": [...] }.')
    Object.assign(objectives, { passMark: undefined }, parsed)
    editingJson.value = false
  } catch (err) {
    jsonError.value = err instanceof Error ? err.message : 'Invalid JSON.'
  }
}

function snapshot(): { definition: SceneDefinition; objectives: ObjectiveSet } {
  return { definition: JSON.parse(JSON.stringify(scene)), objectives: JSON.parse(JSON.stringify(objectives)) }
}

const testScene = computed(() => {
  void testVersion.value
  return snapshot()
})

async function save(thenPublish = false) {
  if (issues.value.length) return
  saving.value = true
  try {
    const { definition, objectives: objectiveSet } = snapshot()
    const request = {
      name: name.value.trim(),
      description: description.value.trim() || null,
      robotType: scene.robot.type,
      definition,
      objectives: objectiveSet,
    }
    let saved = sceneId.value ? await updateSimulationScene(sceneId.value, request) : await createSimulationScene(request)
    if (thenPublish && saved.status !== 'Published') saved = await publishSimulationScene(saved.id)
    status.value = saved.status
    toast.success(thenPublish ? 'Scene saved and published.' : 'Scene saved.')
    if (!sceneId.value) await router.replace(`/roboticslab/scenes/${saved.id}`)
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : 'The scene could not be saved.')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!sceneId.value) return
  loading.value = true
  try {
    const loaded = await getSimulationScene(sceneId.value)
    name.value = loaded.name
    description.value = loaded.description ?? ''
    status.value = loaded.status
    Object.assign(scene, loaded.definition)
    Object.assign(objectives, loaded.objectives)
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : 'The scene could not be loaded.')
  } finally {
    loading.value = false
  }
})

const numberInput = 'h-8 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2 text-[13px] text-(--fg-2) outline-none'
const sectionTitle = 'm-0 text-sm font-semibold text-(--fg-1)'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-6 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <RouterLink to="/roboticslab/scenes" class="inline-flex items-center gap-1 text-xs text-(--fg-3) no-underline">
          <ArrowLeft :size="14" /> Scenes
        </RouterLink>
        <h1 class="m-0 mt-1 text-[28px] font-bold tracking-[-0.01em] text-(--fg-1)">
          {{ sceneId ? name || 'Scene' : 'New scene' }}
        </h1>
        <RaChip class="mt-2" :tone="status === 'Published' ? 'info' : 'neutral'">{{ status }}</RaChip>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" :disabled="saving || issues.length > 0" @click="save(false)">Save</Button>
        <Button v-if="status !== 'Published'" :disabled="saving || issues.length > 0" @click="save(true)">Save & publish</Button>
      </div>
    </div>

    <p v-if="loading" class="text-[13px] text-(--fg-3)">Loading scene…</p>

    <div v-else class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 max-lg:grid-cols-1">
      <div class="flex flex-col gap-4">
        <RaCard :padding="20" class="flex flex-col gap-3">
          <h2 :class="sectionTitle">Details</h2>
          <div class="grid gap-1.5"><Label for="scene-name">Name</Label><Input id="scene-name" v-model="name" placeholder="e.g. Drive to the green zone" /></div>
          <div class="grid gap-1.5"><Label for="scene-description">Description</Label><Input id="scene-description" v-model="description" placeholder="Optional" /></div>
        </RaCard>

        <RaCard :padding="20" class="flex flex-col gap-3">
          <h2 :class="sectionTitle">Arena and robot</h2>
          <div class="grid grid-cols-3 gap-3">
            <label class="grid gap-1 text-xs text-(--fg-3)">Width (m)<input v-model.number="scene.arena.width" type="number" step="0.1" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Depth (m)<input v-model.number="scene.arena.depth" type="number" step="0.1" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Floor<input v-model="scene.arena.floorColor" type="color" class="h-8 w-full" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Robot x (m)<input v-model.number="scene.robot.start.x" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Robot z (m)<input v-model.number="scene.robot.start.z" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Heading (°)<input v-model.number="scene.robot.start.headingDeg" type="number" step="15" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Time limit (s)<input v-model.number="scene.timeLimitSec" type="number" step="10" :class="numberInput" /></label>
          </div>
          <div v-if="hideableSensors.length" class="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-(--fg-2)">
            <span class="text-xs text-(--fg-3) w-full">Hide sensors in this scene</span>
            <label v-for="sensor in hideableSensors" :key="sensor.name" class="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                :checked="scene.hiddenSensors.includes(sensor.name)"
                @change="toggleHidden(sensor.name, ($event.target as HTMLInputElement).checked)"
              />
              {{ sensor.label }}
            </label>
          </div>
        </RaCard>

        <RaCard :padding="20" class="flex flex-col gap-3">
          <div class="flex items-center justify-between"><h2 :class="sectionTitle">Zones</h2><Button variant="ghost" size="sm" @click="addZone"><Plus :size="14" />Add</Button></div>
          <p v-if="!scene.zones.length" class="m-0 text-xs text-(--fg-3)">Zones mark target areas for objectives.</p>
          <div v-for="(zone, i) in scene.zones" :key="i" class="grid grid-cols-[1fr_1fr_repeat(4,64px)_40px_32px] items-end gap-2 max-md:grid-cols-4">
            <label class="grid gap-1 text-xs text-(--fg-3)">Id<input v-model="zone.id" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Label<input v-model="zone.label" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">x<input v-model.number="zone.center.x" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">z<input v-model.number="zone.center.z" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">w<input v-model.number="zone.size.x" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">d<input v-model.number="zone.size.z" type="number" step="0.05" :class="numberInput" /></label>
            <input v-model="zone.color" type="color" class="h-8 w-full" aria-label="Colour" />
            <Button variant="ghost" size="icon-sm" aria-label="Remove zone" @click="scene.zones.splice(i, 1)"><Trash2 :size="14" /></Button>
          </div>
        </RaCard>

        <RaCard :padding="20" class="flex flex-col gap-3">
          <div class="flex items-center justify-between"><h2 :class="sectionTitle">Walls</h2><Button variant="ghost" size="sm" @click="addWall"><Plus :size="14" />Add</Button></div>
          <div v-for="(wall, i) in scene.walls" :key="i" class="grid grid-cols-[1fr_repeat(5,64px)_32px] items-end gap-2 max-md:grid-cols-4">
            <label class="grid gap-1 text-xs text-(--fg-3)">Id<input v-model="wall.id" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">x<input v-model.number="wall.x" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">z<input v-model.number="wall.z" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Length<input v-model.number="wall.length" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Thick<input v-model.number="wall.thickness" type="number" step="0.01" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Angle<input v-model.number="wall.rotationDeg" type="number" step="15" :class="numberInput" /></label>
            <Button variant="ghost" size="icon-sm" aria-label="Remove wall" @click="scene.walls.splice(i, 1)"><Trash2 :size="14" /></Button>
          </div>
        </RaCard>

        <RaCard :padding="20" class="flex flex-col gap-3">
          <div class="flex items-center justify-between"><h2 :class="sectionTitle">Lines</h2><Button variant="ghost" size="sm" @click="addLine"><Plus :size="14" />Add</Button></div>
          <p v-if="!scene.lines.length" class="m-0 text-xs text-(--fg-3)">Lines on the floor, for the line sensors.</p>
          <div v-for="(line, i) in scene.lines" :key="i" class="grid grid-cols-[100px_1fr_64px_40px_32px] items-end gap-2 max-md:grid-cols-2">
            <label class="grid gap-1 text-xs text-(--fg-3)">Id<input v-model="line.id" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Points (x,z; x,z; …)
              <input :value="linePointsText(line.points)" :class="numberInput" @change="setLinePoints(line, ($event.target as HTMLInputElement).value)" />
            </label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Width<input v-model.number="line.width" type="number" step="0.005" :class="numberInput" /></label>
            <input v-model="line.color" type="color" class="h-8 w-full" aria-label="Colour" />
            <Button variant="ghost" size="icon-sm" aria-label="Remove line" @click="scene.lines.splice(i, 1)"><Trash2 :size="14" /></Button>
          </div>
        </RaCard>

        <RaCard :padding="20" class="flex flex-col gap-3">
          <div class="flex items-center justify-between"><h2 :class="sectionTitle">Objects</h2><Button variant="ghost" size="sm" @click="addProp"><Plus :size="14" />Add</Button></div>
          <div v-for="(prop, i) in scene.props" :key="i" class="grid grid-cols-[1fr_96px_repeat(4,64px)_40px_32px] items-end gap-2 max-md:grid-cols-4">
            <label class="grid gap-1 text-xs text-(--fg-3)">Id<input v-model="prop.id" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Shape
              <select v-model="prop.shape" :class="numberInput">
                <option value="box">Box</option><option value="sphere">Ball</option><option value="cylinder">Cylinder</option>
              </select>
            </label>
            <label class="grid gap-1 text-xs text-(--fg-3)">x<input v-model.number="prop.x" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">z<input v-model.number="prop.z" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">{{ prop.shape === 'box' ? 'Size' : 'Radius' }}
              <input
                :value="prop.size.x"
                type="number"
                step="0.01"
                :class="numberInput"
                @input="prop.size = prop.shape === 'box'
                  ? { x: Number(($event.target as HTMLInputElement).value), y: Number(($event.target as HTMLInputElement).value), z: Number(($event.target as HTMLInputElement).value) }
                  : { ...prop.size, x: Number(($event.target as HTMLInputElement).value) }"
              />
            </label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Mass (kg)<input v-model.number="prop.mass" type="number" step="0.05" :class="numberInput" /></label>
            <input v-model="prop.color" type="color" class="h-8 w-full" aria-label="Colour" />
            <Button variant="ghost" size="icon-sm" aria-label="Remove object" @click="scene.props.splice(i, 1)"><Trash2 :size="14" /></Button>
          </div>
        </RaCard>

        <RaCard :padding="20" class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h2 :class="sectionTitle">Objectives</h2>
            <div class="flex gap-1">
              <Button variant="ghost" size="sm" @click="openJsonEditor">Edit as JSON</Button>
              <Button v-if="allSimple" variant="ghost" size="sm" @click="addObjective"><Plus :size="14" />Add</Button>
            </div>
          </div>
          <template v-if="editingJson">
            <textarea v-model="objectivesJson" rows="14" class="w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) p-2 font-mono text-xs text-(--fg-2)" />
            <p v-if="jsonError" class="m-0 text-xs text-(--danger)">{{ jsonError }}</p>
            <div class="flex gap-2"><Button size="sm" @click="applyJson">Apply</Button><Button variant="ghost" size="sm" @click="editingJson = false">Cancel</Button></div>
          </template>
          <template v-else-if="allSimple">
            <label class="grid max-w-50 gap-1 text-xs text-(--fg-3)">Pass mark (%, optional)
              <input
                :value="objectives.passMark ?? ''"
                type="number"
                min="0"
                max="100"
                :class="numberInput"
                placeholder="All required objectives"
                @input="objectives.passMark = ($event.target as HTMLInputElement).value === '' ? undefined : Number(($event.target as HTMLInputElement).value)"
              />
            </label>
            <p v-if="!objectives.objectives.length" class="m-0 text-xs text-(--fg-3)">A scene without objectives is practice only: learners can run it but not submit it for a grade.</p>
            <div v-for="(objective, i) in objectives.objectives" :key="i" class="grid gap-2 rounded-(--ra-md) border border-(--line-1) p-3">
              <div class="grid grid-cols-[1fr_1fr_32px] items-end gap-2">
                <label class="grid gap-1 text-xs text-(--fg-3)">Label<input v-model="objective.label" :class="numberInput" /></label>
                <label class="grid gap-1 text-xs text-(--fg-3)">Condition
                  <select :value="objective.predicate.kind" :class="numberInput" @change="setKind(objective, ($event.target as HTMLSelectElement).value as SimpleKind)">
                    <option v-for="kind in SIMPLE_KINDS" :key="kind.value" :value="kind.value">{{ kind.label }}</option>
                  </select>
                </label>
                <Button variant="ghost" size="icon-sm" aria-label="Remove objective" @click="objectives.objectives.splice(i, 1)"><Trash2 :size="14" /></Button>
              </div>
              <div class="grid grid-cols-4 items-end gap-2 max-md:grid-cols-2">
                <label v-if="objective.predicate.kind === 'propInZone'" class="grid gap-1 text-xs text-(--fg-3)">Object
                  <select v-model="objective.predicate.propId" :class="numberInput">
                    <option v-for="prop in scene.props" :key="prop.id" :value="prop.id">{{ prop.id }}</option>
                  </select>
                </label>
                <label v-if="objective.predicate.kind === 'robotInZone' || objective.predicate.kind === 'propInZone'" class="grid gap-1 text-xs text-(--fg-3)">Zone
                  <select v-model="objective.predicate.zoneId" :class="numberInput">
                    <option v-for="zone in scene.zones" :key="zone.id" :value="zone.id">{{ zone.label || zone.id }}</option>
                  </select>
                </label>
                <template v-if="objective.predicate.kind === 'robotAtPose'">
                  <label class="grid gap-1 text-xs text-(--fg-3)">x<input v-model.number="objective.predicate.position.x" type="number" step="0.05" :class="numberInput" /></label>
                  <label class="grid gap-1 text-xs text-(--fg-3)">z<input v-model.number="objective.predicate.position.z" type="number" step="0.05" :class="numberInput" /></label>
                  <label class="grid gap-1 text-xs text-(--fg-3)">Within (m)<input v-model.number="objective.predicate.toleranceM" type="number" step="0.01" :class="numberInput" /></label>
                </template>
                <label class="grid gap-1 text-xs text-(--fg-3)">Weight<input v-model.number="objective.weight" type="number" min="0" step="1" placeholder="1" :class="numberInput" /></label>
                <label class="grid gap-1 text-xs text-(--fg-3)">Hold (ms)<input v-model.number="objective.holdMs" type="number" min="0" step="100" placeholder="0" :class="numberInput" /></label>
                <label class="inline-flex items-center gap-1.5 pb-1.5 text-[13px] text-(--fg-2)">
                  <input type="checkbox" :checked="objective.required ?? true" @change="objective.required = ($event.target as HTMLInputElement).checked" />
                  Required
                </label>
              </div>
            </div>
          </template>
          <p v-else class="m-0 text-xs text-(--fg-3)">
            These objectives use combined conditions (all / any / in order), so they're edited as JSON.
            {{ objectives.objectives.length }} objective{{ objectives.objectives.length === 1 ? '' : 's' }}.
          </p>
        </RaCard>
      </div>

      <div class="flex flex-col gap-4 lg:sticky lg:top-6 self-start w-full">
        <RaCard :padding="0" class="overflow-hidden">
          <div class="flex items-center gap-2 border-b border-(--line-1) px-4 py-2">
            <Button :variant="previewTab === 'map' ? 'secondary' : 'ghost'" size="sm" @click="previewTab = 'map'">Map</Button>
            <Button :variant="previewTab === 'test' ? 'secondary' : 'ghost'" size="sm" @click="previewTab = 'test'; testVersion++">Test run</Button>
            <span v-if="previewTab === 'map'" class="ml-auto text-xs text-(--fg-3)">Click the floor to place the robot.</span>
            <template v-else>
              <select
                v-model="testLanguage"
                aria-label="Test in language"
                class="ml-auto h-8 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2 text-[13px] text-(--fg-2)"
              >
                <option v-for="option in SUPPORTED_LANGUAGES" :key="option" :value="option">{{ LANGUAGE_LABELS[option] }}</option>
              </select>
              <Button variant="ghost" size="sm" @click="testVersion++">Reload changes</Button>
            </template>
          </div>
          <div v-if="previewTab === 'map'" class="p-4">
            <SceneMap :scene="scene" @place="(p) => { scene.robot.start.x = p.x; scene.robot.start.z = p.z }" />
          </div>
          <SimulationPlayer
            v-else-if="!validateScene(testScene.definition).length"
            :key="`${testVersion}:${testLanguage}`"
            :language="testLanguage"
            :scene="testScene.definition"
            :objectives="testScene.objectives.objectives.length ? testScene.objectives : null"
            height="560px"
            class="rounded-none border-0"
          />
          <p v-else class="p-6 text-center text-[13px] text-(--fg-3)">Fix the problems below to test the scene.</p>
        </RaCard>

        <RaCard v-if="issues.length" :padding="16">
          <h2 :class="sectionTitle">Problems to fix</h2>
          <ul class="mt-2 mb-0 grid gap-1 pl-4 text-[13px] text-(--danger)">
            <li v-for="issue in issues" :key="issue.path + issue.message">{{ issue.message }}</li>
          </ul>
        </RaCard>
      </div>
    </div>
  </div>
</template>
