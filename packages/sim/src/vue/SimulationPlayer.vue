<script setup lang="ts">
import { Maximize2, Minimize2, Play, RotateCcw, Route, Square, Send } from 'lucide-vue-next'
import { RaButton, RaChip } from '@roboacademy/ui'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { ArenaRenderer } from '../engine/renderer'
import { initPhysics } from '../engine/physics'
import { Simulation } from '../engine/simulation'
import type { ObjectiveSet, ObjectiveStatus } from '../grading/types'
import { getCapability, type RobotApi, type RobotCapability } from '../robots'
import { createLuaWorker, createProgramWorker } from '../runtime/create-worker'
import { createPythonWorker, prewarmPythonWorker, releasePythonWorker } from '../runtime/python-worker-pool'
import { RunController, type RunResult } from '../runtime/run-controller'
import { sceneRobots, type SceneDefinition } from '../scene/types'
import { isSourceProgram, lineFromHighlight, type ProgramLanguage } from '../languages/types'
import BlocksEditor from './BlocksEditor.vue'
import CodeEditor from './CodeEditor.vue'

/** New text programs start from these, so the robot API is one keystroke away. */
const STARTERS: Record<RobotApi, Record<'javascript' | 'python' | 'lua', string>> = {
  wheeled: {
    javascript: `// Type "robot." to see everything the robot can do.
robot.move(20);
robot.turnLeft(90);
`,
    python: `# Type "robot." to see everything the robot can do.
robot.move(20)
robot.turn_left(90)
`,
    lua: `-- Type "robot." to see everything the robot can do.
robot.move(20)
robot.turn_left(90)
`,
  },
  arm: {
    javascript: `// Type "robot." to see everything the arm can do.
robot.reach(20, 5);
robot.closeGripper();
`,
    python: `# Type "robot." to see everything the arm can do.
robot.reach(20, 5)
robot.close_gripper()
`,
    lua: `-- Type "robot." to see everything the arm can do.
robot.reach(20, 5)
robot.close_gripper()
`,
  },
}

export type RunMode = 'practice' | 'graded'

export interface RunEndPayload {
  runId: string | null
  mode: RunMode
  program: object | null
  /** The program as readable code: generated from blocks, or the learner's own source. */
  generatedCode: string
  result: RunResult
}

const props = defineProps<{
  scene: SceneDefinition
  objectives: ObjectiveSet | null
  /** Graded lessons show a Submit button; a submitted run counts towards progress. */
  graded?: boolean
  /** The language to program in. Blocks by default. */
  language?: ProgramLanguage
  /** The learner's saved program, if any: Blockly JSON, or `{ source }` for a text language. */
  program?: object | null
  /**
   * Called before each run starts, e.g. to create a run record. Returning a run id ties the
   * result to it; throwing cancels the run.
   */
  beginRun?: (mode: RunMode) => Promise<string | null>
  /** Blocks the Submit button, e.g. while a previous result is being saved. */
  submitDisabled?: boolean
  height?: string
}>()

const emit = defineEmits<{
  programChange: [program: object, code: string]
  runEnd: [payload: RunEndPayload]
}>()

const capability = computed(() => getCapability(props.scene.robot.type))
/** Every robot in the scene, the main one first; empty if any has an unknown type. */
const robots = computed(() => {
  const list = sceneRobots(props.scene).map((robot) => ({ id: robot.id, capability: getCapability(robot.type) }))
  return list.every((robot) => robot.capability) ? (list as { id: string; capability: RobotCapability }[]) : []
})
const preludeRobots = computed(() => robots.value.map(({ id, capability }) => ({ id, api: capability.api })))
const wrapper = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const editor = ref<InstanceType<typeof BlocksEditor> | null>(null)
const codeEditor = ref<InstanceType<typeof CodeEditor> | null>(null)
const language = computed<ProgramLanguage>(() => props.language ?? 'blocks')
const initialSource = computed(() => {
  if (isSourceProgram(props.program)) return props.program.source
  if (language.value === 'blocks') return ''
  const starter = STARTERS[capability.value?.api ?? 'wheeled'][language.value]
  const others = robots.value.slice(1).map((robot) => `robots.${robot.id}`)
  if (!others.length) return starter
  const comment = language.value === 'javascript' ? '//' : language.value === 'python' ? '#' : '--'
  return `${comment} The other robots: ${others.join(', ')}. Use .start to keep a robot going while the next line runs.\n${starter}`
})
/** True while a run waits for its runtime to start (Python loads Pyodide first). */
const starting = ref(false)
/** A text program that didn't compile: shown like a run result, without a run. */
const compileError = ref<{ message: string; line: number | null } | null>(null)

const status = ref<'loading' | 'idle' | 'running' | 'ended' | 'error'>('loading')
const loadError = ref<string | null>(null)
const runMode = ref<RunMode>('practice')
const highlightId = ref<string | null>(null)
const objectiveStatuses = ref<ObjectiveStatus[]>([])
const output = ref<string[]>([])
const elapsedMs = ref(0)
const result = shallowRef<RunResult | null>(null)
const isFullscreen = ref(false)
const narrowTab = ref<'program' | 'robot'>('program')
const dark = ref(false)

/** Whether robots' paths are drawn on the floor. A per-viewer preference, so it's remembered locally. */
const PATH_KEY = 'roboacademy.sim.showPath'
function readShowPath(): boolean {
  try {
    return localStorage.getItem(PATH_KEY) !== 'false'
  } catch {
    return true
  }
}
const showPath = ref(readShowPath())
function toggleShowPath(): void {
  showPath.value = !showPath.value
  renderer?.setTrailsVisible(showPath.value)
  try {
    localStorage.setItem(PATH_KEY, String(showPath.value))
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

/**
 * The editor's share of the body's width when the panes sit side by side. Learners drag the
 * divider to trade editor room for stage room; the choice is remembered per browser.
 */
const SPLIT_KEY = 'roboacademy.sim.editorShare'
const DEFAULT_SPLIT = 1 / 2.2
const MIN_PANE_PX = 280
const body = ref<HTMLElement | null>(null)
const editorShare = ref(readSplit())
const dragging = ref(false)

function readSplit(): number {
  try {
    const stored = Number(localStorage.getItem(SPLIT_KEY))
    return stored > 0 && stored < 1 ? stored : DEFAULT_SPLIT
  } catch {
    return DEFAULT_SPLIT
  }
}

function setSplit(share: number): void {
  const width = body.value?.clientWidth ?? 0
  // Keep both panes usable; on a very narrow body there's no room to move, so stay centred.
  const min = width > MIN_PANE_PX * 2 ? MIN_PANE_PX / width : 0.5
  editorShare.value = Math.min(1 - min, Math.max(min, share))
  try {
    localStorage.setItem(SPLIT_KEY, String(editorShare.value))
  } catch {
    // Storage unavailable: the split still applies for this visit.
  }
}

function startDrag(event: PointerEvent): void {
  if (event.button !== 0) return
  // Capture keeps the drag going when the pointer crosses the Blockly or WebGL surfaces.
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  dragging.value = true
}

function onDrag(event: PointerEvent): void {
  if (!dragging.value || !body.value) return
  const rect = body.value.getBoundingClientRect()
  setSplit((event.clientX - rect.left) / rect.width)
}

function endDrag(): void {
  dragging.value = false
}

function onSplitterKey(event: KeyboardEvent): void {
  const step = event.shiftKey ? 0.1 : 0.02
  if (event.key === 'ArrowLeft') setSplit(editorShare.value - step)
  else if (event.key === 'ArrowRight') setSplit(editorShare.value + step)
  else if (event.key === 'Home') setSplit(0)
  else if (event.key === 'End') setSplit(1)
  else return
  event.preventDefault()
}

let sim: Simulation | null = null
let renderer: ArenaRenderer | null = null
let controller: RunController | null = null
let frameHandle = 0
let lastFrameAt = 0
let lastUiUpdateAt = 0
let currentRunId: string | null = null

function readDark(): boolean {
  return document.documentElement.getAttribute('data-theme') !== 'light'
}

function freshSimulation(): void {
  controller?.dispose()
  controller = null
  sim?.dispose()
  sim = new Simulation(props.scene, props.objectives)
  renderer?.update(sim.frame())
  objectiveStatuses.value = sim.grading()?.objectives ?? []
  elapsedMs.value = 0
}

function loop(now: number): void {
  frameHandle = requestAnimationFrame(loop)
  const delta = lastFrameAt ? Math.min(now - lastFrameAt, 100) : 0
  lastFrameAt = now
  // A hidden tab gets no work at all: no physics, no rendering.
  if (document.hidden) return

  if (controller && sim && status.value === 'running') {
    starting.value = !controller.isStarted
    controller.advance(delta)
    renderer?.update(sim.frame())
    if (now - lastUiUpdateAt > 100) {
      lastUiUpdateAt = now
      elapsedMs.value = sim.elapsedMs
      objectiveStatuses.value = sim.grading()?.objectives ?? []
    }
  }
  renderer?.render()
}

/** The program to run, compiled if it's a text language. Null when there's nothing runnable. */
async function prepareProgram(): Promise<{ code: string; readable: string; program: object | null } | null> {
  compileError.value = null
  if (language.value === 'blocks') {
    if (!editor.value) return null
    const code = editor.value.generate()
    if (!code.trim()) {
      output.value = ['Add some blocks to your program first.']
      return null
    }
    return { code, readable: code, program: editor.value.save() }
  }

  const source = codeEditor.value?.getSource() ?? ''
  if (!source.trim()) {
    output.value = ['Write some code first.']
    return null
  }
  // Python and Lua are parsed and instrumented inside their workers, which also report syntax errors.
  if (language.value === 'python' || language.value === 'lua') return { code: source, readable: source, program: { source } }
  // Babel is several megabytes, so it's loaded the first time a JavaScript program runs.
  const { compileJavaScript } = await import('../languages/javascript/compile')
  const compiled = compileJavaScript(source, preludeRobots.value)
  if (!compiled.ok) {
    compileError.value = { message: compiled.message, line: compiled.line }
    result.value = null
    status.value = 'idle'
    narrowTab.value = 'program'
    return null
  }
  return { code: compiled.code, readable: source, program: { source } }
}

async function start(mode: RunMode): Promise<void> {
  if (status.value === 'running' || status.value === 'loading') return
  const prepared = await prepareProgram()
  if (!prepared) return
  const { code, readable, program } = prepared

  try {
    currentRunId = props.beginRun ? await props.beginRun(mode) : null
  } catch {
    output.value = ['Your run could not be started. Please try again.']
    return
  }

  freshSimulation()
  runMode.value = mode
  result.value = null
  output.value = []
  highlightId.value = null
  narrowTab.value = 'robot'

  const createWorker =
    language.value === 'python' ? createPythonWorker : language.value === 'lua' ? createLuaWorker : createProgramWorker
  controller = new RunController(sim!, createWorker, {
    onHighlight: (id) => (highlightId.value = id),
    onPrint: (text) => {
      output.value = [...output.value.slice(-49), text]
    },
    onEnd: (runResult) => {
      result.value = runResult
      status.value = 'ended'
      highlightId.value = runResult.summary.error?.blockId ?? null
      elapsedMs.value = runResult.summary.durationMs
      objectiveStatuses.value = runResult.grading?.objectives ?? []
      starting.value = false
      // Warm the next Python worker now the run is over, so the next Run starts straight away.
      if (language.value === 'python') prewarmPythonWorker()
      emit('runEnd', { runId: currentRunId, mode, program, generatedCode: readable, result: runResult })
    },
  })
  status.value = 'running'
  controller.start(code)
}

function stop(): void {
  controller?.stop()
}

function reset(): void {
  if (status.value === 'loading') return
  freshSimulation()
  status.value = 'idle'
  result.value = null
  compileError.value = null
  highlightId.value = null
  output.value = []
}

function showErrorBlock(): void {
  const id = result.value?.summary.error?.blockId
  const line = compileError.value?.line ?? lineFromHighlight(id)
  narrowTab.value = 'program'
  if (line) codeEditor.value?.focusLine(line)
  else if (id) editor.value?.select(id)
}

const runningLine = computed(() => lineFromHighlight(highlightId.value))
const errorLine = computed(() => compileError.value?.line ?? lineFromHighlight(result.value?.summary.error?.blockId))
const hasErrorLocation = computed(() => !!errorLine.value || !!result.value?.summary.error?.blockId)

async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement) await document.exitFullscreen()
  else await wrapper.value?.requestFullscreen()
}

function onFullscreenChange(): void {
  isFullscreen.value = document.fullscreenElement === wrapper.value
}

const themeObserver = new MutationObserver(() => (dark.value = readDark()))

onMounted(async () => {
  dark.value = readDark()
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  document.addEventListener('fullscreenchange', onFullscreenChange)
  try {
    if (!capability.value || !robots.value.length) throw new Error('Unknown robot type')
    await initPhysics()
    if (!stage.value) return
    const background = getComputedStyle(document.documentElement).getPropertyValue('--bg-3').trim()
    renderer = new ArenaRenderer(stage.value, props.scene, background ? { background } : {})
    renderer.setTrailsVisible(showPath.value)
    freshSimulation()
    status.value = 'idle'
    frameHandle = requestAnimationFrame(loop)
    if (language.value === 'python') prewarmPythonWorker()
  } catch {
    status.value = 'error'
    loadError.value = 'The simulation could not be started on this device.'
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frameHandle)
  themeObserver.disconnect()
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  controller?.dispose()
  sim?.dispose()
  renderer?.dispose()
  if (language.value === 'python') releasePythonWorker()
  controller = null
  sim = null
  renderer = null
})

const metCount = computed(() => objectiveStatuses.value.filter((o) => o.everSatisfied).length)

const resultMessage = computed(() => {
  if (compileError.value) return { tone: 'danger', text: compileError.value.message }
  const r = result.value
  if (!r) return null
  const total = r.grading?.objectives.length ?? 0
  switch (r.outcome) {
    case 'objectives_met':
      return { tone: 'success', text: `All objectives met!${r.grading ? ` Score ${r.grading.score}.` : ''}` }
    case 'objectives_failed':
      return { tone: 'warning', text: `Not quite: ${metCount.value} of ${total} objectives met.` }
    case 'completed':
      return { tone: 'info', text: 'Program finished.' }
    case 'timeout':
      return { tone: 'warning', text: `Time's up after ${props.scene.timeLimitSec} seconds.` }
    case 'stopped':
      return { tone: 'info', text: 'Run stopped.' }
    case 'runtime_error':
      return { tone: 'danger', text: r.summary.error?.message ?? 'Your program stopped with an error.' }
    default:
      return null
  }
})

const seconds = computed(() => (elapsedMs.value / 1000).toFixed(1))

defineExpose({ reset, stop })
</script>

<template>
  <div ref="wrapper" class="sim-player" :style="{ height: isFullscreen ? '100%' : (height ?? '640px') }">
    <div class="sim-player__toolbar">
      <RaButton v-if="status !== 'running'" variant="secondary" :disabled="status === 'loading' || status === 'error'" @click="start('practice')">
        <template #icon><Play :size="14" /></template>
        Run
      </RaButton>
      <RaButton v-else variant="secondary" @click="stop">
        <template #icon><Square :size="14" /></template>
        Stop
      </RaButton>
      <RaButton variant="ghost" :disabled="status === 'running' || status === 'loading'" @click="reset">
        <template #icon><RotateCcw :size="14" /></template>
        Reset
      </RaButton>
      <RaButton
        v-if="graded"
        variant="primary"
        :disabled="status === 'running' || status === 'loading' || status === 'error' || submitDisabled"
        @click="start('graded')"
      >
        <template #icon><Send :size="14" /></template>
        Submit
      </RaButton>
      <RaChip v-if="status === 'running' && starting" tone="neutral">Starting Python…</RaChip>
      <RaChip v-else-if="status === 'running'" :tone="runMode === 'graded' ? 'info' : 'neutral'">
        {{ runMode === 'graded' ? 'Graded run' : 'Practice run' }} · {{ seconds }} s
      </RaChip>
      <div class="sim-player__spacer" />
      <div class="sim-player__tabs" role="tablist">
        <button role="tab" :aria-selected="narrowTab === 'program'" @click="narrowTab = 'program'">Program</button>
        <button role="tab" :aria-selected="narrowTab === 'robot'" @click="narrowTab = 'robot'">Robot</button>
      </div>
      <RaButton
        variant="ghost"
        :aria-pressed="showPath"
        :title="showPath ? 'Hide the robots\' paths' : 'Show the robots\' paths'"
        @click="toggleShowPath"
      >
        <template #icon><Route :size="14" /></template>
        <span class="sim-player__label">{{ showPath ? 'Hide path' : 'Show path' }}</span>
      </RaButton>
      <RaButton variant="ghost" @click="toggleFullscreen">
        <template #icon>
          <Minimize2 v-if="isFullscreen" :size="14" />
          <Maximize2 v-else :size="14" />
        </template>
        <span class="sim-player__label">{{ isFullscreen ? 'Exit full screen' : 'Full screen' }}</span>
      </RaButton>
    </div>

    <div
      ref="body"
      class="sim-player__body"
      :class="{ 'sim-player__body--dragging': dragging }"
      :data-tab="narrowTab"
      :style="{ '--editor-share': editorShare }"
    >
      <section class="sim-player__program" aria-label="Program">
        <BlocksEditor
          v-if="language === 'blocks' && capability"
          ref="editor"
          :program="program ?? null"
          :capability="capability"
          :robots="robots"
          :hidden-sensors="scene.hiddenSensors"
          :readonly="status === 'running'"
          :highlight-id="highlightId"
          :dark="dark"
          @change="(program, code) => emit('programChange', program, code)"
        />
        <CodeEditor
          v-else-if="language !== 'blocks'"
          ref="codeEditor"
          :source="initialSource"
          :language="language"
          :robots="preludeRobots"
          :readonly="status === 'running'"
          :running-line="status === 'running' ? runningLine : null"
          :error-line="status === 'running' ? null : errorLine"
          :dark="dark"
          @change="(source) => emit('programChange', { source }, source)"
        />
      </section>

      <div
        class="sim-player__splitter"
        role="separator"
        tabindex="0"
        aria-orientation="vertical"
        aria-label="Resize the program editor"
        :aria-valuenow="Math.round(editorShare * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        title="Drag to resize · double-click to reset"
        @pointerdown="startDrag"
        @pointermove="onDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @dblclick="setSplit(DEFAULT_SPLIT)"
        @keydown="onSplitterKey"
      />

      <section class="sim-player__robot" aria-label="Robot">
        <div ref="stage" class="sim-player__stage">
          <div v-if="status === 'loading'" class="sim-player__state">Preparing the simulation…</div>
          <div v-else-if="status === 'error'" class="sim-player__state">{{ loadError }}</div>
        </div>

        <div
          v-if="resultMessage"
          class="sim-player__result"
          :data-tone="resultMessage.tone"
          role="status"
        >
          <span>{{ resultMessage.text }}</span>
          <button v-if="hasErrorLocation" class="sim-player__link" @click="showErrorBlock">
            {{ language === 'blocks' ? 'Show the block' : 'Show the line' }}
          </button>
        </div>

        <div class="sim-player__panels">
          <div v-if="objectiveStatuses.length" class="sim-player__panel">
            <h4>Objectives · {{ metCount }}/{{ objectiveStatuses.length }}</h4>
            <ul>
              <li v-for="objective in objectiveStatuses" :key="objective.id" :data-met="objective.everSatisfied">
                <span class="sim-player__dot" aria-hidden="true" />
                {{ objective.label }}
              </li>
            </ul>
          </div>
          <div v-if="output.length" class="sim-player__panel">
            <h4>Output</h4>
            <pre>{{ output.join('\n') }}</pre>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.sim-player {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--line-1);
  border-radius: var(--ra-lg);
  background: var(--bg-2);
  overflow: hidden;
}

.sim-player__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line-1);
  background: var(--bg-3);
}

.sim-player__spacer {
  flex: 1 1 auto;
}

.sim-player__body {
  display: grid;
  grid-template-columns:
    minmax(0, calc(var(--editor-share) * 100%))
    7px
    minmax(0, 1fr);
  flex: 1 1 auto;
  min-height: 0;
}

/* While dragging, the editor and canvas mustn't steal the pointer or select text. */
.sim-player__body--dragging {
  cursor: col-resize;
  user-select: none;
}

.sim-player__body--dragging .sim-player__program,
.sim-player__body--dragging .sim-player__robot {
  pointer-events: none;
}

.sim-player__program {
  min-width: 0;
  min-height: 0;
}

.sim-player__splitter {
  position: relative;
  cursor: col-resize;
  touch-action: none;
  background: var(--bg-3);
  border-inline: 1px solid var(--line-1);
  transition: background var(--dur-1, 120ms);
}

.sim-player__splitter::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 3px;
  height: 32px;
  transform: translate(-50%, -50%);
  border-radius: 2px;
  background: var(--line-3);
}

.sim-player__splitter:hover,
.sim-player__splitter:focus-visible,
.sim-player__body--dragging .sim-player__splitter {
  background: var(--bg-4);
  outline: none;
}

.sim-player__splitter:hover::after,
.sim-player__splitter:focus-visible::after,
.sim-player__body--dragging .sim-player__splitter::after {
  background: var(--brand-blue);
}

.sim-player__robot {
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sim-player__stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 200px;
}

.sim-player__state {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  text-align: center;
  color: var(--fg-3);
  font-size: 14px;
}

.sim-player__result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  font-size: 14px;
  border-top: 1px solid var(--line-1);
  color: var(--fg-1);
}

.sim-player__result[data-tone='success'] {
  background: var(--success-soft);
}
.sim-player__result[data-tone='warning'] {
  background: var(--warning-soft);
}
.sim-player__result[data-tone='danger'] {
  background: var(--danger-soft);
}
.sim-player__result[data-tone='info'] {
  background: var(--info-soft);
}

.sim-player__link {
  margin-left: auto;
  border: 0;
  background: none;
  color: var(--brand-blue);
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
}

.sim-player__panels {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  max-height: 35%;
  overflow: auto;
  padding: 0 12px;
}

.sim-player__panels:not(:empty) {
  padding: 10px 12px 12px;
  border-top: 1px solid var(--line-1);
}

.sim-player__panel {
  flex: 1 1 200px;
  min-width: 0;
}

.sim-player__panel h4 {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sim-player__panel ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 4px;
  font-size: 13px;
  color: var(--fg-2);
}

.sim-player__panel li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sim-player__dot {
  width: 10px;
  height: 10px;
  flex: none;
  border-radius: 50%;
  border: 2px solid var(--line-3);
}

.sim-player__panel li[data-met='true'] .sim-player__dot {
  background: var(--success);
  border-color: var(--success);
}

.sim-player__panel pre {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  color: var(--fg-2);
}

.sim-player__tabs {
  display: none;
  border: 1px solid var(--line-2);
  border-radius: var(--ra-md);
  overflow: hidden;
}

.sim-player__tabs button {
  border: 0;
  padding: 6px 12px;
  background: transparent;
  color: var(--fg-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.sim-player__tabs button[aria-selected='true'] {
  background: var(--bg-4);
  color: var(--fg-1);
}

@media (max-width: 900px) {
  .sim-player__body {
    grid-template-columns: 1fr;
  }

  .sim-player__tabs {
    display: inline-flex;
  }

  .sim-player__label {
    display: none;
  }

  .sim-player__splitter {
    display: none;
  }

  /* Both panes stay mounted so the editor and the WebGL canvas keep their state. */
  .sim-player__body[data-tab='program'] .sim-player__robot,
  .sim-player__body[data-tab='robot'] .sim-player__program {
    display: none;
  }
}
</style>
