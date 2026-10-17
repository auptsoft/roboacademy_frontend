<script setup lang="ts">
import { computed, ref } from 'vue'
import { HandHelping, Heart, PartyPopper, Hand } from 'lucide-vue-next'
import { setReaction, REACTION_LABELS, type ReactionKind, type Reactions } from '@/api/community'

// Reactions on a post or reply. Optimistic: the count changes on tap and rolls back if the API refuses.

const props = defineProps<{
  contentType: 'Post' | 'Reply'
  contentId: string
  reactions: Reactions
  /** Offer "Same question" (questions only). */
  question?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ error: [message: string] }>()

const counts = ref({ ...props.reactions.counts })
const mine = ref(new Set(props.reactions.mine))
const busy = ref(false)

const kinds = computed<ReactionKind[]>(() =>
  props.question ? ['SameQuestion', 'Like', 'Helpful'] : ['Like', 'Helpful', 'Celebrate'])
const icons = { Like: Heart, Helpful: HandHelping, Celebrate: PartyPopper, SameQuestion: Hand }

async function toggle(kind: ReactionKind) {
  if (busy.value || props.disabled) return
  const on = !mine.value.has(kind)
  const apply = (value: boolean) => {
    const next = new Set(mine.value)
    if (value) next.add(kind)
    else next.delete(kind)
    mine.value = next
    counts.value = { ...counts.value, [kind]: Math.max(0, (counts.value[kind] ?? 0) + (value ? 1 : -1)) }
  }
  apply(on)
  busy.value = true
  try {
    await setReaction(props.contentType, props.contentId, kind, on)
  } catch (e) {
    apply(!on)
    emit('error', e instanceof Error ? e.message : "Couldn't save your reaction.")
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <button
      v-for="kind in kinds"
      :key="kind"
      type="button"
      :disabled="disabled"
      :aria-pressed="mine.has(kind)"
      :class="[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        mine.has(kind)
          ? 'border-(--brand-blue) bg-(--brand-blue-soft) text-(--brand-blue)'
          : 'border-(--line-2) bg-transparent text-(--fg-3) hover:text-(--fg-1) hover:border-(--fg-3)',
      ]"
      @click="toggle(kind)"
    >
      <component :is="icons[kind]" :size="13" />
      {{ REACTION_LABELS[kind] }}
      <span v-if="counts[kind]" class="tabular-nums">{{ counts[kind] }}</span>
    </button>
  </div>
</template>
