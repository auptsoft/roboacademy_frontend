<script setup lang="ts">
import { computed, ref } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  modelValue: string | null
  placeholder?: string
  rows?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const previewing = ref(false)

// Author's choice of raw HTML or Markdown - marked passes raw HTML through untouched, and
// DOMPurify sanitizes the combined output before it's rendered via v-html.
const renderedHtml = computed(() => DOMPurify.sanitize(marked.parse(props.modelValue ?? '', { async: false })))
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class="text-xs text-(--fg-4)">HTML or Markdown</span>
      <Button variant="ghost" size="sm" type="button" @click="previewing = !previewing">
        {{ previewing ? 'Edit' : 'Preview' }}
      </Button>
    </div>
    <textarea
      v-if="!previewing"
      :value="modelValue ?? ''"
      :rows="rows ?? 6"
      :placeholder="placeholder"
      class="w-full resize-none rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.75 font-mono text-sm text-(--fg-2) outline-none placeholder:text-(--fg-4)"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <div
      v-else
      class="min-h-24 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 py-1.75 text-sm text-(--fg-2)"
      v-html="renderedHtml"
    />
  </div>
</template>
