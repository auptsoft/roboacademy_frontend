<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import Label from '@/components/ui/label.vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// A confirm step that takes a short piece of text (a refund reason, a decision note). The parent
// keeps the dialog open while it works and shows any error here.

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description?: string
  label: string
  confirmLabel: string
  required?: boolean
  pending?: boolean
  error?: string | null
  destructive?: boolean
}>(), { description: undefined, required: true, pending: false, error: null, destructive: false })

const emit = defineEmits<{ 'update:open': [open: boolean]; submit: [text: string] }>()

const text = ref('')
watch(() => props.open, (open) => { if (open) text.value = '' })
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="emit('submit', text.trim())">
        <div class="flex flex-col gap-1.5">
          <Label for="reason-text">{{ label }}</Label>
          <textarea
            id="reason-text"
            v-model="text"
            rows="3"
            maxlength="1000"
            :required="required"
            class="rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-3 py-2 text-sm text-(--fg-1) outline-none focus:border-ring"
          />
        </div>
        <p v-if="error" class="m-0 text-xs text-(--danger)">{{ error }}</p>
        <DialogFooter>
          <Button variant="outline" type="button" @click="emit('update:open', false)">Cancel</Button>
          <Button type="submit" :variant="destructive ? 'destructive' : 'default'" :disabled="pending || (required && !text.trim())">
            {{ pending ? 'Working…' : confirmLabel }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
