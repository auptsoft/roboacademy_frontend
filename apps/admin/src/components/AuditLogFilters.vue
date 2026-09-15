<script setup lang="ts">
import UserComboBox from '@/components/UserComboBox.vue'

export interface AuditLogFilterState {
  userId: string | null
  fromDate: string
  toDate: string
  entityType: string
  action: string
}

const filters = defineModel<AuditLogFilterState>({ required: true })
defineProps<{ entityTypeOptions: { value: string; label: string }[] }>()

const ACTIONS = ['Added', 'Modified', 'Deleted']

function clearAll() {
  filters.value = { userId: null, fromDate: '', toDate: '', entityType: '', action: '' }
}

const selectClass =
  'rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2 py-1.75 text-[13px] text-(--fg-2) outline-none'
</script>

<template>
  <div class="flex flex-wrap items-end gap-3 border-b border-(--line-1) py-4 px-6">
    <label class="flex flex-col gap-1 text-xs text-(--fg-3)">
      From
      <input
        v-model="filters.fromDate"
        type="datetime-local"
        :class="selectClass"
      >
    </label>
    <label class="flex flex-col gap-1 text-xs text-(--fg-3)">
      To
      <input
        v-model="filters.toDate"
        type="datetime-local"
        :class="selectClass"
      >
    </label>
    <label class="flex flex-col gap-1 text-xs text-(--fg-3)">
      User
      <UserComboBox v-model="filters.userId" />
    </label>
    <label class="flex flex-col gap-1 text-xs text-(--fg-3)">
      Entity Type
      <select v-model="filters.entityType" :class="selectClass">
        <option value="">Any</option>
        <option v-for="option in entityTypeOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
    <label class="flex flex-col gap-1 text-xs text-(--fg-3)">
      Action
      <select v-model="filters.action" :class="selectClass">
        <option value="">Any</option>
        <option v-for="action in ACTIONS" :key="action" :value="action">{{ action }}</option>
      </select>
    </label>
    <button
      type="button"
      class="cursor-pointer bg-transparent p-0 text-xs text-(--fg-3) underline-offset-2 hover:underline"
      @click="clearAll"
    >
      Clear filters
    </button>
  </div>
</template>
