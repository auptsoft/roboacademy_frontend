<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, Flame, Star, Trophy } from 'lucide-vue-next'
import { levelProgress, type GamificationSummary } from '@/api/gamification'
import { badgeIcon } from './badge-icons'

// The learner's level, XP to the next level, weekly streak, stars and latest badges. `link`
// adds a way to the achievements page; off on that page itself, where it would go nowhere.
const props = withDefaults(defineProps<{ summary: GamificationSummary; link?: boolean }>(), { link: true })

const router = useRouter()
const percent = computed(() => Math.round(levelProgress(props.summary) * 100))
const toNext = computed(() => Math.max(0, props.summary.nextLevelXp - props.summary.totalXp))
</script>

<template>
  <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4 flex items-center gap-8 max-md:flex-col max-md:items-stretch max-md:gap-5">
    <div class="flex items-center gap-4 min-w-0 flex-1">
      <div class="w-14 h-14 shrink-0 rounded-full bg-(--brand-violet-soft) text-(--brand-violet) flex flex-col items-center justify-center leading-none">
        <span class="text-[10px] font-semibold uppercase tracking-[0.06em]">Level</span>
        <span class="text-[22px] font-bold tabular-nums">{{ props.summary.level }}</span>
      </div>
      <div class="flex flex-col gap-2 min-w-0 flex-1">
        <div class="flex items-baseline justify-between gap-3 flex-wrap">
          <span class="text-[17px] font-semibold text-(--heading)">{{ props.summary.levelTitle }}</span>
          <span class="text-[13px] text-(--fg-3) tabular-nums">{{ props.summary.totalXp.toLocaleString() }} XP</span>
        </div>
        <div
          class="h-2 rounded-(--ra-pill) bg-(--bg-3) overflow-hidden"
          role="progressbar"
          :aria-valuenow="percent"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`Progress to level ${props.summary.level + 1}`"
        >
          <div class="h-full rounded-(--ra-pill) bg-(--brand-violet) transition-[width] duration-(--dur-3) ease-(--ease-out)" :style="{ width: `${percent}%` }" />
        </div>
        <span class="text-[13px] text-(--fg-3)">{{ toNext.toLocaleString() }} XP to level {{ props.summary.level + 1 }}</span>
        <span v-if="props.summary.streak" class="text-[13px] text-(--fg-3)">
          <template v-if="props.summary.streak.thisWeek >= props.summary.streak.goal">Weekly goal met</template>
          <template v-else>{{ props.summary.streak.thisWeek }} of {{ props.summary.streak.goal }} activities this week</template>
          <template v-if="props.summary.streak.freezes"> · {{ props.summary.streak.freezes }} streak freeze{{ props.summary.streak.freezes === 1 ? '' : 's' }}</template>
        </span>
      </div>
    </div>

    <div class="flex items-center gap-6 shrink-0 max-md:justify-between">
      <div v-if="props.summary.streak" class="flex flex-col gap-1">
        <span class="text-[12px] text-(--fg-3)">Streak</span>
        <span class="inline-flex items-center gap-1.5 text-[17px] font-semibold text-(--heading) tabular-nums" :title="`Longest: ${props.summary.streak.longest} weeks`">
          <Flame :size="16" class="text-(--danger)" aria-hidden="true" />{{ props.summary.streak.streak }}<span class="text-(--fg-4) font-normal text-[13px]">wk</span>
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-[12px] text-(--fg-3)">Stars</span>
        <span class="inline-flex items-center gap-1.5 text-[17px] font-semibold text-(--heading) tabular-nums">
          <Star :size="16" class="text-(--warning) fill-current" aria-hidden="true" />{{ props.summary.stars }}
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-[12px] text-(--fg-3)">Badges</span>
        <span class="inline-flex items-center gap-1.5 text-[17px] font-semibold text-(--heading) tabular-nums">
          <Trophy :size="16" class="text-(--brand-violet)" aria-hidden="true" />{{ props.summary.badgesEarned }}<span class="text-(--fg-4) font-normal text-[13px]">/ {{ props.summary.badgesTotal }}</span>
        </span>
      </div>
      <div v-if="props.summary.recentBadges.length" class="flex -space-x-2 max-sm:hidden" aria-label="Latest badges">
        <span
          v-for="badge in props.summary.recentBadges"
          :key="badge.key"
          :title="badge.name"
          class="w-9 h-9 rounded-full bg-(--brand-blue-soft) text-(--brand-blue) border-2 border-(--surface) flex items-center justify-center"
        >
          <component :is="badgeIcon(badge.icon)" :size="16" aria-hidden="true" />
        </span>
      </div>
      <button
        v-if="props.link"
        class="inline-flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer text-[13px] font-medium text-(--link) hover:underline"
        @click="router.push('/app/achievements')"
      >
        Achievements <ChevronRight :size="14" />
      </button>
    </div>
  </section>
</template>
