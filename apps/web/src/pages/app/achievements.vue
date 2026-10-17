<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AlertTriangle, Loader2, Lock, Trophy } from 'lucide-vue-next'
import { RaButton } from '@roboacademy/ui'
import { getMyBadges, getMyXpHistory, isGamificationDisabled, type Badge, type XpEntry, type XpSource } from '@/api/gamification'
import { brandingKey, featureConfirmed } from '@/branding'
import { useAchievements } from '@/composables/useAchievements'
import LevelCard from '@/components/gamification/LevelCard.vue'
import ChallengeStars from '@/components/gamification/ChallengeStars.vue'
import LeaderboardPanel from '@/components/gamification/LeaderboardPanel.vue'
import { badgeIcon } from '@/components/gamification/badge-icons'

const router = useRouter()
const branding = inject(brandingKey, null)
// Waits for branding: opened directly, the page renders before the school's features are known.
const brandingLoaded = computed(() => branding?.value?.features !== undefined)
const available = computed(() => featureConfirmed(branding?.value, 'gamification'))

const { summary, refresh } = useAchievements()

const PAGE_SIZE = 20
const badges = ref<Badge[]>([])
const history = ref<XpEntry[]>([])
const page = ref(1)
const totalPages = ref(0)
const status = ref<'loading' | 'idle' | 'error' | 'disabled'>('loading')
const loadingMore = ref(false)

const earnedCount = computed(() => badges.value.filter((b) => b.earned).length)
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

const sourceLabels: Record<XpSource, string> = {
  LessonCompleted: 'Completed a lesson',
  ChallengeStar: 'Earned a challenge star',
  AssessmentPassed: 'Passed an assessment',
  CourseCompleted: 'Completed a course',
  PathCompleted: 'Completed a learning path',
  LabSessionAttended: 'Attended a robot lab session',
  ManualAward: 'Bonus from your teacher',
}

async function load() {
  status.value = 'loading'
  page.value = 1
  try {
    const [, loadedBadges, loadedHistory] = await Promise.all([refresh(), getMyBadges(), getMyXpHistory({ page: 1, pageSize: PAGE_SIZE })])
    badges.value = loadedBadges
    history.value = loadedHistory.data
    totalPages.value = loadedHistory.meta.totalPages
    status.value = 'idle'
  } catch (err) {
    status.value = isGamificationDisabled(err) ? 'disabled' : 'error'
  }
}

async function loadMore() {
  loadingMore.value = true
  try {
    const next = await getMyXpHistory({ page: page.value + 1, pageSize: PAGE_SIZE })
    page.value += 1
    history.value = [...history.value, ...next.data]
    totalPages.value = next.meta.totalPages
  } catch {
    // Leave the button in place to try again.
  } finally {
    loadingMore.value = false
  }
}

watch(available, (on) => { if (on) void load() }, { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-6 px-12 pt-12 pb-12 max-w-[1100px] mx-auto w-full max-lg:px-8 max-sm:px-4 max-sm:pt-6 max-sm:pb-8">
    <div class="flex flex-col gap-1.5">
      <h1 class="m-0 text-[28px] font-semibold text-(--heading) tracking-[-0.01em] max-sm:text-2xl">Achievements</h1>
      <p class="m-0 text-sm text-(--fg-3)">Earn XP and badges by completing lessons, passing simulation challenges and assessments, and working with real robots.</p>
    </div>

    <div v-if="!brandingLoaded" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>

    <section v-else-if="!available" class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) flex flex-col items-center gap-3 py-16 px-6 text-center">
      <div class="w-10 h-10 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-3)"><Trophy :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3) max-w-[360px]">Achievements aren't part of your school's plan.</p>
      <RaButton variant="secondary" @click="router.push('/app')">Back to dashboard</RaButton>
    </section>

    <div v-else-if="status === 'loading'" class="flex items-center gap-2 text-[13px] text-(--fg-3)">
      <Loader2 :size="16" class="animate-spin" /> Loading…
    </div>

    <section v-else-if="status === 'disabled'" class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) flex flex-col items-center gap-3 py-16 px-6 text-center">
      <div class="w-10 h-10 rounded-full bg-(--bg-3) flex items-center justify-center text-(--fg-3)"><Trophy :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3) max-w-[360px]">Your school has switched achievements off for now.</p>
    </section>

    <section v-else-if="status === 'error'" class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) flex flex-col items-center gap-3 py-12 text-center">
      <div class="w-10 h-10 rounded-full bg-(--danger-soft) flex items-center justify-center text-(--danger)"><AlertTriangle :size="18" /></div>
      <p class="m-0 text-[13px] text-(--fg-3)">Couldn't load your achievements.</p>
      <RaButton variant="secondary" @click="load()">Try again</RaButton>
    </section>

    <template v-else>
      <LevelCard v-if="summary" :summary="summary" :link="false" />

      <LeaderboardPanel
        v-if="summary?.leaderboardsOn"
        :hide-from-leaderboards="summary.hideFromLeaderboards"
        @hidden-change="(hidden) => { if (summary) summary.hideFromLeaderboards = hidden }"
      />

      <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
        <div class="flex items-baseline justify-between gap-3 mb-5">
          <h2 class="m-0 text-[20px] font-medium text-(--heading)">Badges</h2>
          <span class="text-[13px] text-(--fg-3) tabular-nums">{{ earnedCount }} of {{ badges.length }} earned</span>
        </div>
        <ul class="list-none m-0 p-0 grid gap-4 grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <li
            v-for="badge in badges"
            :key="badge.key"
            class="flex items-start gap-3 rounded-(--ra-lg) border p-4"
            :class="badge.earned ? 'border-(--line-1) bg-(--surface)' : 'border-dashed border-(--line-2) bg-(--bg-1)'"
          >
            <span
              class="w-11 h-11 shrink-0 rounded-full flex items-center justify-center"
              :class="badge.earned ? 'bg-(--brand-blue-soft) text-(--brand-blue)' : 'bg-(--bg-3) text-(--fg-4)'"
            >
              <component :is="badge.earned ? badgeIcon(badge.icon) : Lock" :size="18" aria-hidden="true" />
            </span>
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="text-sm font-semibold" :class="badge.earned ? 'text-(--heading)' : 'text-(--fg-3)'">{{ badge.name }}</span>
              <span class="text-[13px] text-(--fg-3)">{{ badge.description }}</span>
              <span v-if="badge.awardedByHand && badge.note" class="text-xs text-(--fg-2) italic">"{{ badge.note }}"</span>
              <span v-if="badge.earned && badge.earnedAt" class="text-xs text-(--fg-4)">
                {{ badge.awardedByHand ? 'Given by your teacher' : 'Earned' }} {{ dateFormat.format(new Date(badge.earnedAt)) }}
              </span>
              <span v-else-if="badge.custom" class="text-xs text-(--fg-4)">From your school</span>
            </div>
          </li>
        </ul>
      </section>

      <section class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
        <h2 class="m-0 mb-4 text-[20px] font-medium text-(--heading)">XP history</h2>
        <p v-if="!history.length" class="m-0 text-[13px] text-(--fg-3)">No XP yet. Complete a lesson or pass a simulation challenge to start earning.</p>
        <ul v-else class="list-none m-0 p-0 flex flex-col">
          <li v-for="entry in history" :key="entry.id" class="flex items-center gap-4 py-3 border-b border-(--line-1) last:border-b-0">
            <div class="flex flex-col gap-0.5 min-w-0 flex-1">
              <span class="inline-flex items-center gap-2 text-sm text-(--fg-1)">
                {{ sourceLabels[entry.source] ?? entry.source }}
                <ChallengeStars v-if="entry.source === 'ChallengeStar' && entry.stars" :stars="entry.stars" :size="12" />
              </span>
              <span class="text-xs text-(--fg-4) truncate">
                {{ dateFormat.format(new Date(entry.occurredAt)) }}<template v-if="entry.courseTitle"> · {{ entry.courseTitle }}</template>
              </span>
            </div>
            <span class="text-sm font-semibold text-(--success) tabular-nums shrink-0">+{{ entry.points }} XP</span>
          </li>
        </ul>
        <div v-if="page < totalPages" class="mt-4 flex justify-center">
          <RaButton variant="secondary" :disabled="loadingMore" @click="loadMore">
            <template v-if="loadingMore" #icon><Loader2 :size="14" class="animate-spin" /></template>
            Show more
          </RaButton>
        </div>
      </section>
    </template>
  </div>
</template>
