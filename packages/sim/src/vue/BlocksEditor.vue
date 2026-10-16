<script setup lang="ts">
import * as Blockly from 'blockly/core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { generateCode, registerRobotBlocks, robotToolbox, setAvailableSensors } from '../blocks/robot-blocks'
import type { RobotCapability } from '../robots/types'

const props = defineProps<{
  /** Blockly workspace JSON. Read once on mount; later changes flow out through `change`. */
  program: object | null
  capability: RobotCapability
  hiddenSensors?: string[]
  readonly?: boolean
  /** The block to highlight while a program runs. */
  highlightId?: string | null
  dark?: boolean
  /** Defaults to the robot toolbox; Interactive lesson coding tasks pass one without robot blocks. */
  toolbox?: Blockly.utils.toolbox.ToolboxDefinition
}>()

const emit = defineEmits<{
  /** The program as workspace JSON, and as readable code (stored for simulation hints). */
  change: [program: object, code: string]
}>()

const host = ref<HTMLDivElement | null>(null)
let workspace: Blockly.WorkspaceSvg | null = null
let resizeObserver: ResizeObserver | null = null
let changeTimer: ReturnType<typeof setTimeout> | undefined

function theme(dark: boolean): Blockly.Theme {
  return Blockly.Theme.defineTheme(dark ? 'roboacademy-dark' : 'roboacademy-light', {
    name: dark ? 'roboacademy-dark' : 'roboacademy-light',
    base: Blockly.Themes.Classic,
    componentStyles: dark
      ? {
          workspaceBackgroundColour: '#161b22',
          toolboxBackgroundColour: '#1f2630',
          toolboxForegroundColour: '#e6edf3',
          flyoutBackgroundColour: '#232b36',
          flyoutForegroundColour: '#e6edf3',
          scrollbarColour: '#4a5563',
        }
      : { workspaceBackgroundColour: '#f7f9fb', toolboxBackgroundColour: '#eef2f6' },
    fontStyle: { family: 'inherit', size: 11 },
  })
}

onMounted(() => {
  if (!host.value) return
  registerRobotBlocks()
  setAvailableSensors(props.capability, props.hiddenSensors ?? [])

  workspace = Blockly.inject(host.value, {
    toolbox: props.readonly ? undefined : (props.toolbox ?? robotToolbox()),
    readOnly: props.readonly ?? false,
    theme: theme(props.dark ?? false),
    trashcan: !props.readonly,
    zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2, minScale: 0.4 },
    move: { scrollbars: true, drag: true, wheel: false },
    renderer: 'zelos',
    sounds: false,
  })

  if (props.program) {
    try {
      Blockly.serialization.workspaces.load(props.program, workspace)
    } catch {
      // A program saved by an older block set shouldn't break the lesson: start empty instead.
      workspace.clear()
    }
  }

  workspace.addChangeListener((event) => {
    if (event.isUiEvent || !workspace) return
    clearTimeout(changeTimer)
    changeTimer = setTimeout(() => {
      if (workspace) emit('change', Blockly.serialization.workspaces.save(workspace), generateCode(workspace))
    }, 400)
  })

  resizeObserver = new ResizeObserver(() => workspace && Blockly.svgResize(workspace))
  resizeObserver.observe(host.value)
})

watch(
  () => props.highlightId,
  (id) => workspace?.highlightBlock(id ?? null),
)

watch(
  () => props.dark,
  (dark) => workspace?.setTheme(theme(dark ?? false)),
)

onBeforeUnmount(() => {
  clearTimeout(changeTimer)
  resizeObserver?.disconnect()
  workspace?.dispose()
  workspace = null
})

defineExpose({
  /** Generated code for the current program, or an empty string with no blocks. */
  generate: (): string => (workspace ? generateCode(workspace) : ''),
  /** The current program as workspace JSON. */
  save: (): object | null => (workspace ? Blockly.serialization.workspaces.save(workspace) : null),
  /** Selects a block, e.g. the one a runtime error came from. */
  select: (id: string) => {
    const block = workspace?.getBlockById(id)
    if (block) {
      block.select()
      workspace?.centerOnBlock(id)
    }
  },
  isEmpty: (): boolean => !workspace || workspace.getTopBlocks(false).length === 0,
})
</script>

<template>
  <div ref="host" class="sim-blocks" />
</template>

<style scoped>
.sim-blocks {
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
