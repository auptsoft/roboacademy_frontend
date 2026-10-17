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
  listCapabilities,
  sceneRobots,
  shapePoints,
  DEFAULT_COVERAGE,
  PEN_COLORS,
  type ShapePreset,
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

const robotTypes = listCapabilities()
const capability = computed(() => getCapability(scene.robot.type))
// Hidden sensors apply to every robot in the scene that has them.
const hideableSensors = computed(() => {
  const all = sceneRobots(scene).flatMap((robot) => getCapability(robot.type)?.sensors ?? []).filter((s) => s.hideable)
  return all.filter((sensor, i) => all.findIndex((s) => s.name === sensor.name) === i)
})
const otherRobots = computed(() => scene.robots ?? [])

function addRobot() {
  const taken = new Set(['robot', ...otherRobots.value.map((r) => r.id)])
  let n = 2
  while (taken.has(`robot${n}`)) n++
  scene.robots = [...otherRobots.value, { id: `robot${n}`, type: scene.robot.type, start: { x: scene.robot.start.x, z: scene.robot.start.z + 0.4, headingDeg: 0 } }]
}
function removeRobot(i: number) {
  const robots = otherRobots.value.filter((_, j) => j !== i)
  if (robots.length) scene.robots = robots
  else delete scene.robots
}

/** Robot conditions can name any robot in the scene; the others always mean the main one. */
const ROBOT_KINDS = ['robotInZone', 'robotAtPose', 'propHeldBy', 'jointAtAngle']
function objectiveRobot(objective: Objective): string {
  const predicate = objective.predicate
  return 'robotId' in predicate && predicate.robotId ? predicate.robotId : 'robot'
}
function setObjectiveRobot(objective: Objective, id: string) {
  const predicate = objective.predicate as Predicate & { robotId?: string }
  if (id === 'robot') delete predicate.robotId
  else predicate.robotId = id
}
function capabilityFor(objective: Objective) {
  const id = objectiveRobot(objective)
  const robot = sceneRobots(scene).find((r) => r.id === id)
  return robot ? getCapability(robot.type) : undefined
}

const issues = computed(() => {
  const all = [...validateScene(scene), ...validateObjectives(objectives, scene)]
  if (!name.value.trim()) all.unshift({ path: 'name', message: 'Give the scene a name.' })
  return all
})

/** Simple objective kinds the form can edit; anything else is edited as JSON. */
type SimpleKind = 'robotInZone' | 'robotAtPose' | 'propInZone' | 'propHeldBy' | 'jointAtAngle' | 'inkMatches'
const SIMPLE_KINDS: { value: SimpleKind; label: string }[] = [
  { value: 'robotInZone', label: 'Robot reaches a zone' },
  { value: 'robotAtPose', label: 'Robot reaches a point' },
  { value: 'propInZone', label: 'Object moved into a zone' },
  { value: 'propHeldBy', label: 'Robot holds an object' },
  { value: 'jointAtAngle', label: 'Joint reaches an angle' },
  { value: 'inkMatches', label: 'Drawing matches a shape' },
]

type InkMatches = Extract<Predicate, { kind: 'inkMatches' }>
const SHAPE_PRESETS: { value: ShapePreset; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'line', label: 'Line' },
]

/** Replaces a drawing objective's shape with a preset, `size` across, keeping where it is. */
function applyShape(predicate: InkMatches, preset: ShapePreset, size: number) {
  if (!(size > 0)) return
  const centre = shapeCentre(predicate.shape)
  const { shape, closed } = shapePoints(preset, size, predicate.anywhere ? { x: 0, z: 0 } : centre)
  predicate.shape = shape
  predicate.closed = closed
}
function shapeCentre(points: { x: number; z: number }[]) {
  if (!points.length) return { x: 0, z: 0 }
  const xs = points.map((p) => p.x)
  const zs = points.map((p) => p.z)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
}
/** Moves a traced shape so its centre is at a point. */
function moveShape(predicate: InkMatches, axis: 'x' | 'z', value: number) {
  if (!Number.isFinite(value)) return
  const shift = value - shapeCentre(predicate.shape)[axis]
  predicate.shape = predicate.shape.map((p) => ({ ...p, [axis]: Math.round((p[axis] + shift) * 10000) / 10000 }))
}
/** Scales a shape about its centre so it's `size` across. */
function resizeShape(predicate: InkMatches, size: number) {
  const now = shapeSize(predicate.shape)
  if (!(size > 0 && now > 0)) return
  const c = shapeCentre(predicate.shape)
  const scale = (from: number, value: number) => Math.round((from + (value - from) * (size / now)) * 10000) / 10000
  predicate.shape = predicate.shape.map((p) => ({ x: scale(c.x, p.x), z: scale(c.z, p.z) }))
}
/** Sets or clears an optional drawing setting: an empty choice means "any". */
function setInkFilter(predicate: InkMatches, key: 'color' | 'robotId', value: string) {
  if (value) predicate[key] = value
  else delete predicate[key]
}
function shapeSize(points: { x: number; z: number }[]): number {
  const xs = points.map((p) => p.x)
  const zs = points.map((p) => p.z)
  return Math.round(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) * 1000) / 1000
}
/** Copies a traced shape into the scene as a line, so learners can see what to trace. */
function addGuideLine(predicate: InkMatches) {
  const points = predicate.closed ? [...predicate.shape, predicate.shape[0]!] : predicate.shape
  scene.lines.push({ id: nextId('guide', scene.lines), points: points.map((p) => ({ ...p })), width: 0.01, color: '#b8c2cc' })
}
/** Traced shapes, drawn on the map for the author. */
const tracedShapes = computed(() =>
  objectives.objectives.flatMap((o) => (o.predicate.kind === 'inkMatches' && !o.predicate.anywhere ? [{ points: o.predicate.shape, closed: !!o.predicate.closed }] : [])),
)
/** Kinds this scene's robot can satisfy, plus the objective's own so a mismatch still shows. */
function kindsFor(objective: Objective) {
  return SIMPLE_KINDS.filter((kind) =>
    kind.value === objective.predicate.kind
    || (kind.value === 'propHeldBy' ? !!capabilityFor(objective)?.gripper : kind.value === 'jointAtAngle' ? !!capabilityFor(objective)?.joints?.length : true))
}
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
  const prop = scene.props[0]
  if (capability.value?.gripper && prop) {
    objectives.objectives.push({
      id: nextId('goal', objectives.objectives),
      label: zone ? `Move ${prop.id} to ${zone.label || zone.id}` : `Pick up ${prop.id}`,
      predicate: zone ? { kind: 'propInZone', propId: prop.id, zoneId: zone.id } : { kind: 'propHeldBy', propId: prop.id },
    })
    return
  }
  objectives.objectives.push({
    id: nextId('goal', objectives.objectives),
    label: zone ? `Reach ${zone.label || zone.id}` : 'Reach the goal',
    predicate: zone ? { kind: 'robotInZone', zoneId: zone.id } : { kind: 'robotAtPose', position: { x: 0.8, y: 0, z: 0 }, toleranceM: 0.1 },
  })
}

function setKind(objective: Objective, kind: SimpleKind) {
  const zoneId = scene.zones[0]?.id
  const propId = scene.props[0]?.id ?? ''
  const joint = capabilityFor(objective)?.joints?.[0]
  const robotId = objectiveRobot(objective)
  const predicate: Predicate =
    kind === 'robotInZone'
      ? { kind, zoneId }
      : kind === 'propInZone'
        ? { kind, propId, zoneId }
        : kind === 'propHeldBy'
          ? { kind, propId }
          : kind === 'jointAtAngle'
            ? { kind, joint: joint?.name ?? '', value: joint?.rest ?? 0, toleranceDeg: 5 }
            : kind === 'inkMatches'
            ? { kind, ...shapePoints('square', 0.2), anywhere: true, toleranceM: 0.02 }
            : { kind, position: { x: 0, y: 0, z: 0 }, toleranceM: 0.1 }
  objective.predicate = predicate
  // Keep the robot it was about, when the new condition is about a robot too.
  if (ROBOT_KINDS.includes(kind)) setObjectiveRobot(objective, robotId)
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

/** Sets one part of the three-star target, dropping the target when both parts are empty. */
function setPar(key: 'simTimeMs' | 'blocks', raw: string) {
  const value = raw === '' ? undefined : key === 'simTimeMs' ? Math.round(Number(raw) * 1000) : Math.round(Number(raw))
  const par = { ...objectives.par, [key]: value }
  objectives.par = par.simTimeMs === undefined && par.blocks === undefined ? undefined : par
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
    Object.assign(objectives, { passMark: undefined, par: undefined }, parsed)
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
            <label class="col-span-3 grid gap-1 text-xs text-(--fg-3)">Robot
              <select v-model="scene.robot.type" :class="numberInput">
                <option v-for="robot in robotTypes" :key="robot.type" :value="robot.type">{{ robot.label }}</option>
              </select>
            </label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Robot x (m)<input v-model.number="scene.robot.start.x" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Robot z (m)<input v-model.number="scene.robot.start.z" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Heading (°)<input v-model.number="scene.robot.start.headingDeg" type="number" step="15" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Time limit (s)<input v-model.number="scene.timeLimitSec" type="number" step="10" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Robot colour
              <input :value="scene.robot.color ?? '#2f6fec'" type="color" class="h-8 w-full" @input="scene.robot.color = ($event.target as HTMLInputElement).value" />
            </label>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-(--fg-3)">Other robots — programs use them as <code>robots.&lt;name&gt;</code>; the robot above is <code>robot</code>.</span>
            <Button variant="ghost" size="sm" :disabled="otherRobots.length >= 3" @click="addRobot"><Plus :size="14" />Add robot</Button>
          </div>
          <div v-for="(robot, i) in otherRobots" :key="i" class="grid grid-cols-[1fr_1.4fr_repeat(3,64px)_40px_32px] items-end gap-2 max-md:grid-cols-4">
            <label class="grid gap-1 text-xs text-(--fg-3)">Name<input v-model="robot.id" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">Type
              <select v-model="robot.type" :class="numberInput">
                <option v-for="type in robotTypes" :key="type.type" :value="type.type">{{ type.label }}</option>
              </select>
            </label>
            <label class="grid gap-1 text-xs text-(--fg-3)">x<input v-model.number="robot.start.x" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">z<input v-model.number="robot.start.z" type="number" step="0.05" :class="numberInput" /></label>
            <label class="grid gap-1 text-xs text-(--fg-3)">°<input v-model.number="robot.start.headingDeg" type="number" step="15" :class="numberInput" /></label>
            <input :value="robot.color ?? '#e8742a'" type="color" class="h-8 w-full" aria-label="Colour" @input="robot.color = ($event.target as HTMLInputElement).value" />
            <Button variant="ghost" size="icon-sm" aria-label="Remove robot" @click="removeRobot(i)"><Trash2 :size="14" /></Button>
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
            <div class="grid gap-1">
              <div class="grid grid-cols-2 max-w-100 gap-2">
                <label class="grid gap-1 text-xs text-(--fg-3)">Three-star time (s)
                  <input
                    :value="objectives.par?.simTimeMs !== undefined ? objectives.par.simTimeMs / 1000 : ''"
                    type="number"
                    min="0.1"
                    step="0.1"
                    :class="numberInput"
                    placeholder="No limit"
                    @input="setPar('simTimeMs', ($event.target as HTMLInputElement).value)"
                  />
                </label>
                <label class="grid gap-1 text-xs text-(--fg-3)">Three-star blocks
                  <input
                    :value="objectives.par?.blocks ?? ''"
                    type="number"
                    min="1"
                    step="1"
                    :class="numberInput"
                    placeholder="No limit"
                    @input="setPar('blocks', ($event.target as HTMLInputElement).value)"
                  />
                </label>
              </div>
              <p class="m-0 text-xs text-(--fg-3)">
                Learners get one star for passing and two for meeting every objective. The third is for doing it within these targets (blocks only apply to block programs). Leave both empty to give three stars for meeting every objective.
              </p>
            </div>
            <p v-if="!objectives.objectives.length" class="m-0 text-xs text-(--fg-3)">A scene without objectives is practice only: learners can run it but not submit it for a grade.</p>
            <div v-for="(objective, i) in objectives.objectives" :key="i" class="grid gap-2 rounded-(--ra-md) border border-(--line-1) p-3">
              <div class="grid grid-cols-[1fr_1fr_32px] items-end gap-2">
                <label class="grid gap-1 text-xs text-(--fg-3)">Label<input v-model="objective.label" :class="numberInput" /></label>
                <label class="grid gap-1 text-xs text-(--fg-3)">Condition
                  <select :value="objective.predicate.kind" :class="numberInput" @change="setKind(objective, ($event.target as HTMLSelectElement).value as SimpleKind)">
                    <option v-for="kind in kindsFor(objective)" :key="kind.value" :value="kind.value">{{ kind.label }}</option>
                  </select>
                </label>
                <Button variant="ghost" size="icon-sm" aria-label="Remove objective" @click="objectives.objectives.splice(i, 1)"><Trash2 :size="14" /></Button>
              </div>
              <div class="grid grid-cols-4 items-end gap-2 max-md:grid-cols-2">
                <label v-if="otherRobots.length && ROBOT_KINDS.includes(objective.predicate.kind)" class="grid gap-1 text-xs text-(--fg-3)">Robot
                  <select :value="objectiveRobot(objective)" :class="numberInput" @change="setObjectiveRobot(objective, ($event.target as HTMLSelectElement).value)">
                    <option value="robot">robot (main)</option>
                    <option v-for="robot in otherRobots" :key="robot.id" :value="robot.id">{{ robot.id }}</option>
                  </select>
                </label>
                <label v-if="objective.predicate.kind === 'propInZone' || objective.predicate.kind === 'propHeldBy'" class="grid gap-1 text-xs text-(--fg-3)">Object
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
                <template v-if="objective.predicate.kind === 'inkMatches'">
                  <label class="grid gap-1 text-xs text-(--fg-3)">Shape
                    <select :class="numberInput" @change="applyShape(objective.predicate, ($event.target as HTMLSelectElement).value as ShapePreset, shapeSize(objective.predicate.shape)); ($event.target as HTMLSelectElement).value = ''">
                      <option value="" selected>Replace with…</option>
                      <option v-for="preset in SHAPE_PRESETS" :key="preset.value" :value="preset.value">{{ preset.label }}</option>
                    </select>
                  </label>
                  <label class="grid gap-1 text-xs text-(--fg-3)">Size (m)
                    <input :value="shapeSize(objective.predicate.shape)" type="number" step="0.05" min="0.02" :class="numberInput"
                      @change="resizeShape(objective.predicate, Number(($event.target as HTMLInputElement).value))" />
                  </label>
                  <label class="grid gap-1 text-xs text-(--fg-3)">Within (m)<input v-model.number="objective.predicate.toleranceM" type="number" step="0.005" :class="numberInput" /></label>
                  <label class="grid gap-1 text-xs text-(--fg-3)">Coverage (%)
                    <input :value="Math.round((objective.predicate.coverage ?? DEFAULT_COVERAGE) * 100)" type="number" min="1" max="100" step="5" :class="numberInput"
                      @change="(objective.predicate as InkMatches).coverage = Number(($event.target as HTMLInputElement).value) / 100" />
                  </label>
                  <label class="grid gap-1 text-xs text-(--fg-3)">Colour
                    <select :value="objective.predicate.color ?? ''" :class="numberInput"
                      @change="setInkFilter(objective.predicate, 'color', ($event.target as HTMLSelectElement).value)">
                      <option value="">any</option>
                      <option v-for="color in PEN_COLORS" :key="color.name" :value="color.name">{{ color.name }}</option>
                    </select>
                  </label>
                  <label v-if="otherRobots.length" class="grid gap-1 text-xs text-(--fg-3)">Drawn by
                    <select :value="objective.predicate.robotId ?? ''" :class="numberInput"
                      @change="setInkFilter(objective.predicate, 'robotId', ($event.target as HTMLSelectElement).value)">
                      <option value="">any robot</option>
                      <option value="robot">robot (main)</option>
                      <option v-for="robot in otherRobots" :key="robot.id" :value="robot.id">{{ robot.id }}</option>
                    </select>
                  </label>
                  <template v-if="!objective.predicate.anywhere">
                    <label class="grid gap-1 text-xs text-(--fg-3)">Centre x
                      <input :value="shapeCentre(objective.predicate.shape).x" type="number" step="0.05" :class="numberInput" @change="moveShape(objective.predicate, 'x', Number(($event.target as HTMLInputElement).value))" />
                    </label>
                    <label class="grid gap-1 text-xs text-(--fg-3)">Centre z
                      <input :value="shapeCentre(objective.predicate.shape).z" type="number" step="0.05" :class="numberInput" @change="moveShape(objective.predicate, 'z', Number(($event.target as HTMLInputElement).value))" />
                    </label>
                  </template>
                  <div class="col-span-full flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-(--fg-2)">
                    <label class="inline-flex items-center gap-1.5">
                      <input type="checkbox" :checked="!!objective.predicate.anywhere" @change="(objective.predicate as InkMatches).anywhere = ($event.target as HTMLInputElement).checked" />
                      Anywhere, any way round
                    </label>
                    <label class="inline-flex items-center gap-1.5">
                      <input type="checkbox" :checked="objective.predicate.strict ?? true" @change="(objective.predicate as InkMatches).strict = ($event.target as HTMLInputElement).checked" />
                      No other ink allowed
                    </label>
                    <label class="inline-flex items-center gap-1.5">
                      <input type="checkbox" :checked="!!objective.predicate.closed" @change="(objective.predicate as InkMatches).closed = ($event.target as HTMLInputElement).checked" />
                      Closed shape
                    </label>
                    <Button v-if="!objective.predicate.anywhere" variant="ghost" size="sm" @click="addGuideLine(objective.predicate)">Show it as a scene line</Button>
                  </div>
                  <p v-if="objective.predicate.anywhere && (objective.predicate.strict ?? true) === false && !objective.predicate.color" class="col-span-full m-0 text-xs text-(--fg-3)">
                    A shape drawn anywhere is found from its ink alone: with other ink allowed, give it its own colour so the two can be told apart.
                  </p>
                </template>
                <template v-if="objective.predicate.kind === 'jointAtAngle'">
                  <label class="grid gap-1 text-xs text-(--fg-3)">Joint
                    <select v-model="objective.predicate.joint" :class="numberInput">
                      <option v-for="joint in capabilityFor(objective)?.joints ?? []" :key="joint.name" :value="joint.name">{{ joint.label }}</option>
                    </select>
                  </label>
                  <label class="grid gap-1 text-xs text-(--fg-3)">Angle (°)<input v-model.number="objective.predicate.value" type="number" step="5" :class="numberInput" /></label>
                  <label class="grid gap-1 text-xs text-(--fg-3)">Within (°)<input v-model.number="objective.predicate.toleranceDeg" type="number" step="1" :class="numberInput" /></label>
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
            <SceneMap :scene="scene" :guides="tracedShapes" @place="(p) => { scene.robot.start.x = p.x; scene.robot.start.z = p.z }" />
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
