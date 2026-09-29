<script setup lang="ts" generic="T extends string">
// Folder-style tabs that sit flush on top of a panel. Pair with a panel using
// `rounded-tl-none` so the active tab reads as attached to it.
const props = defineProps<{
  tabs: { id: T; label: string }[]
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="flex gap-1.5 overflow-x-auto" role="tablist">
    <button
      v-for="t in props.tabs"
      :key="t.id"
      role="tab"
      :aria-selected="model === t.id"
      class="shrink-0 px-5 py-3 rounded-t-(--ra-lg) border-0 cursor-pointer text-[15px] whitespace-nowrap transition-colors duration-(--dur-1)"
      :class="model === t.id ? 'bg-(--surface) text-(--heading) font-medium shadow-[inset_0_3px_0_var(--brand-sand)]' : 'bg-(--bg-4) text-(--fg-3) hover:text-(--fg-2)'"
      @click="model = t.id"
    >{{ t.label }}</button>
  </div>
</template>
