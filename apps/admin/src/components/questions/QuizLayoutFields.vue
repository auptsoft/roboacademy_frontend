<script setup lang="ts">
/** A quiz's layout: all questions on one page, or one at a time (optionally without going back). */
const display = defineModel<'AllOnOnePage' | 'OneAtATime'>('display', { required: true })
const allowBack = defineModel<boolean>('allowBack', { required: true })
</script>

<template>
  <fieldset class="m-0 flex flex-col gap-1.5 border-0 p-0">
    <legend class="mb-1.5 p-0 text-sm font-medium text-(--fg-1)">Show questions</legend>
    <label class="flex items-center gap-1.5 text-sm text-(--fg-2)">
      <input v-model="display" type="radio" value="AllOnOnePage" class="accent-(--brand-blue)"> All on one page
    </label>
    <label class="flex items-center gap-1.5 text-sm text-(--fg-2)">
      <input v-model="display" type="radio" value="OneAtATime" class="accent-(--brand-blue)"> One at a time
    </label>
    <label v-if="display === 'OneAtATime'" class="ml-5 flex items-center gap-1.5 text-sm text-(--fg-2)">
      <input v-model="allowBack" type="checkbox" class="size-4 accent-(--brand-blue)"> Let learners go back to earlier questions
    </label>
    <p v-if="display === 'OneAtATime' && !allowBack" class="m-0 ml-5 text-xs text-(--fg-4)">
      Each answer is locked once the learner moves on, as in an exam.
    </p>
  </fieldset>
</template>
