<script setup lang="ts">
import { Plus, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'

const props = defineProps<{
  options: string[]
  correctOptionIndex: number
}>()

const emit = defineEmits<{
  'update:options': [options: string[]]
  'update:correctOptionIndex': [index: number]
}>()

const groupName = `correct-option-${Math.random().toString(36).slice(2)}`

function updateOption(index: number, value: string) {
  const next = [...props.options]
  next[index] = value
  emit('update:options', next)
}

function addOption() {
  emit('update:options', [...props.options, ''])
}

function removeOption(index: number) {
  const next = props.options.filter((_, i) => i !== index)
  emit('update:options', next)
  if (props.correctOptionIndex >= next.length) {
    emit('update:correctOptionIndex', Math.max(0, next.length - 1))
  } else if (props.correctOptionIndex > index) {
    emit('update:correctOptionIndex', props.correctOptionIndex - 1)
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="(option, index) in options" :key="index" class="flex items-center gap-2">
      <input
        type="radio"
        :name="groupName"
        :checked="correctOptionIndex === index"
        class="size-4 accent-(--brand-blue)"
        aria-label="Correct answer"
        @change="emit('update:correctOptionIndex', index)"
      >
      <Input
        :model-value="option"
        placeholder="Option text"
        class="flex-1"
        @update:model-value="(value) => updateOption(index, String(value))"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Remove option"
        :disabled="options.length <= 2"
        @click="removeOption(index)"
      >
        <X :size="14" />
      </Button>
    </div>
    <Button variant="outline" size="sm" type="button" class="self-start" @click="addOption">
      <Plus :size="14" /> Add Option
    </Button>
    <p class="m-0 text-xs text-(--fg-4)">Select the radio next to the correct answer. At least two options are required.</p>
  </div>
</template>
