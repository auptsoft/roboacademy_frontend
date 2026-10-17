<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Loader2, Medal } from 'lucide-vue-next'
import {
  getLeaderboard, getLeaderboardScopes, setHideFromLeaderboards,
  type Leaderboard, type LeaderboardPeriod, type LeaderboardScopes,
} from '@/api/gamification'

// Class and course leaderboards on the achievements page: pick a class or course, this week or
// all time. Shown only when the school has leaderboards on (the summary says so).
const props = defineProps<{ hideFromLeaderboards: boolean }>()
const emit = defineEmits<{ hiddenChange: [hidden: boolean] }>()

type ScopeKey = `${'class' | 'course'}:${string}`

const scopes = ref<LeaderboardScopes | null>(null)
const selected = ref<ScopeKey | ''>('')
const period = ref<LeaderboardPeriod>('week')
const board = ref<Leaderboard | null>(null)
const status = ref<'loading' | 'idle' | 'error'>('loading')
const hidden = ref(props.hideFromLeaderboards)
const savingHidden = ref(false)

const options = computed(() => [
  ...(scopes.value?.classes ?? []).map((s) => ({ key: `class:${s.id}` as ScopeKey, label: s.name, group: 'Classes' })),
  ...(scopes.value?.courses ?? []).map((s) => ({ key: `course:${s.id}` as ScopeKey, label: s.name, group: 'Courses' })),
])
const meOutsideTop = computed(() => board.value?.me && !board.value.top.some((r) => r.isMe) ? board.value.me : null)

async function loadScopes() {
  status.value = 'loading'
  try {
    scopes.value = await getLeaderboardScopes()
    selected.value = options.value[0]?.key ?? ''
    if (!selected.value) status.value = 'idle'
  } catch {
    status.value = 'error'
  }
}

async function loadBoard() {
  if (!selected.value) return
  const [scope, id] = selected.value.split(':') as ['class' | 'course', string]
  status.value = 'loading'
  try {
    board.value = await getLeaderboard(scope, id, period.value)
    status.value = 'idle'
  } catch {
    status.value = 'error'
  }
}

async function toggleHidden() {
  const next = !hidden.value
  savingHidden.value = true
  try {
    await setHideFromLeaderboards(next)
    hidden.value = next
    emit('hiddenChange', next)
  } finally {
    savingHidden.value = false
  }
}

watch([selected, period], () => void loadBoard())
onMounted(() => void loadScopes())
</script>

<template>
  <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
    <div class="flex items-center justify-between gap-3 mb-4 max-sm:flex-col max-sm:items-stretch">
      <h2 class="m-0 text-[20px] font-medium text-(--heading)">Leaderboards</h2>
      <div v-if="options.length" class="flex items-center gap-2 max-sm:flex-col max-sm:items-stretch">
        <select
          v-model="selected"
          aria-label="Leaderboard"
          class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-1) px-2 text-[13px] text-(--fg-1) outline-none"
        >
          <optgroup v-for="group in ['Classes', 'Courses']" :key="group" :label="group">
            <option v-for="o in options.filter((x) => x.group === group)" :key="o.key" :value="o.key">{{ o.label }}</option>
          </optgroup>
        </select>
        <div class="inline-flex rounded-(--ra-pill) border border-(--line-2) p-0.5" role="radiogroup" aria-label="Period">
          <button
            v-for="p in (['week', 'all'] as const)"
            :key="p"
            role="radio"
            :aria-checked="period === p"
            class="px-3 py-1 rounded-(--ra-pill) border-0 text-[13px] font-medium cursor-pointer"
            :class="period === p ? 'bg-(--brand-blue-soft) text-(--brand-blue)' : 'bg-transparent text-(--fg-3)'"
            @click="period = p"
          >{{ p === 'week' ? 'This week' : 'All time' }}</button>
        </div>
      </div>
    </div>

    <div v-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>
    <p v-else-if="status === 'error'" class="m-0 text-[13px] text-(--fg-3)">Couldn't load the leaderboard.</p>
    <p v-else-if="!options.length" class="m-0 text-[13px] text-(--fg-3)">Join a class or enrol in a course to see how you compare.</p>
    <template v-else-if="board">
      <p v-if="!board.top.length" class="m-0 text-[13px] text-(--fg-3)">
        Nobody has earned XP here {{ period === 'week' ? 'this week' : 'yet' }}. Be the first!
      </p>
      <ol v-else class="list-none m-0 p-0 flex flex-col">
        <li
          v-for="row in board.top"
          :key="`${row.rank}-${row.displayName}`"
          class="flex items-center gap-3 py-2.5 px-3 rounded-(--ra-md)"
          :class="row.isMe ? 'bg-(--brand-blue-soft)' : ''"
        >
          <span class="w-7 text-center text-sm font-semibold tabular-nums" :class="row.rank <= 3 ? 'text-(--warning)' : 'text-(--fg-3)'">
            <Medal v-if="row.rank <= 3" :size="16" class="inline" aria-hidden="true" /><span :class="row.rank <= 3 ? 'sr-only' : ''">{{ row.rank }}</span>
          </span>
          <span class="flex-1 min-w-0 truncate text-sm" :class="row.isMe ? 'font-semibold text-(--heading)' : 'text-(--fg-1)'">
            {{ row.displayName }}<template v-if="row.isMe"> (you)</template>
          </span>
          <span class="text-sm font-semibold tabular-nums text-(--fg-2)">{{ row.xp.toLocaleString() }} XP</span>
        </li>
      </ol>
      <p v-if="meOutsideTop" class="mt-3 mb-0 text-[13px] text-(--fg-2)">
        You're <strong>#{{ meOutsideTop.rank }}</strong> of {{ board.learners }} with {{ meOutsideTop.xp.toLocaleString() }} XP.
      </p>
      <p v-else-if="!board.me" class="mt-3 mb-0 text-[13px] text-(--fg-3)">Earn XP here to join the board.</p>
    </template>

    <label class="mt-5 inline-flex cursor-pointer items-center gap-2 text-[13px] text-(--fg-2)">
      <button
        type="button"
        role="switch"
        :aria-checked="hidden"
        :disabled="savingHidden"
        class="relative h-5 w-9 shrink-0 cursor-pointer rounded-(--ra-pill) border-0 p-0 transition-colors duration-(--dur-1) ease-(--ease-out) disabled:opacity-60"
        :class="hidden ? 'bg-(--brand-blue)' : 'bg-(--line-2)'"
        @click="toggleHidden"
      >
        <span class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-(--dur-1) ease-(--ease-out)" :class="hidden ? 'translate-x-4' : ''" />
      </button>
      Hide my name from other learners
    </label>
    <p v-if="scopes?.mode === 'Anonymised'" class="mt-1 mb-0 text-xs text-(--fg-4)">Your school shows other learners without their names.</p>
  </section>
</template>
