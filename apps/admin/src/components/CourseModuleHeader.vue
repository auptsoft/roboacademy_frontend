<script setup lang="ts">
import { X, GripVertical, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import type { CourseModuleItem } from '@/api/learning'

export interface CourseModuleEditForm {
  title: string
  description: string
}

const form = defineModel<CourseModuleEditForm>({ required: true })
defineProps<{
  mod: CourseModuleItem
  isDraft: boolean
  editing: boolean
  saving: boolean
  deleting: boolean
  reorderingModules: boolean
}>()
defineEmits<{ edit: []; cancel: []; save: []; delete: [] }>()
</script>

<template>
  <template v-if="editing">
    <div class="flex flex-col gap-2">
      <Input v-model="form.title" class="h-9" placeholder="Module title" />
      <Input v-model="form.description" class="h-9" placeholder="Description (optional)" />
      <div class="flex gap-2">
        <Button size="sm" :disabled="saving" @click="$emit('save')">Save</Button>
        <Button variant="ghost" size="icon-sm" aria-label="Cancel" @click="$emit('cancel')">
          <X :size="14" />
        </Button>
      </div>
    </div>
  </template>
  <template v-else>
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-2">
        <GripVertical
          v-if="isDraft"
          :size="14"
          class="mt-0.5 shrink-0 text-(--fg-4)"
          :class="reorderingModules ? 'cursor-not-allowed' : 'cursor-move'"
        />
        <div>
          <h4 class="m-0 text-sm font-bold text-(--fg-1)">{{ mod.order }}. {{ mod.title }}</h4>
          <p v-if="mod.description" class="m-0 mt-0.5 text-xs text-(--fg-3)">{{ mod.description }}</p>
        </div>
      </div>
      <div v-if="isDraft" class="flex shrink-0 gap-1.5">
        <Button variant="outline" size="sm" @click="$emit('edit')">Edit</Button>
        <Button
          variant="destructive"
          size="icon-sm"
          aria-label="Delete module"
          :disabled="deleting"
          @click="$emit('delete')"
        >
          <Trash2 :size="14" />
        </Button>
      </div>
    </div>
  </template>
</template>
