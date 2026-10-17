<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { Loader2, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import {
  BADGE_ICONS, BADGE_METRICS, createCustomBadge, getGamificationSettings, listCustomBadges, saveGamificationSettings,
  updateCustomBadge, type BadgeMetric, type CustomBadge, type GamificationSettings, type LeaderboardMode,
} from '@/api/gamification'
import { hasPermission } from '@/store/auth'
import { badgeIcon } from '@/components/gamification/badge-icons'

// A school's achievements (Gamification Phase G2): its settings, under what the plan allows,
// and the badges it makes itself. Badges are retired, never deleted: learners keep them.

const canManageSettings = hasPermission('gamification:settings:manage')
const canManageBadges = hasPermission('gamification:badges:manage')

const settings = ref<GamificationSettings | null>(null)
const form = reactive({ enabled: true, streaksEnabled: true, weeklyGoal: 3, leaderboardMode: 'Off' as LeaderboardMode })
const badges = ref<CustomBadge[]>([])
const loading = ref(true)
const savingSettings = ref(false)

const atBadgeLimit = computed(() =>
  settings.value?.customBadgeLimit != null && settings.value.customBadgeCount >= settings.value.customBadgeLimit)

async function load() {
  loading.value = true
  try {
    settings.value = await getGamificationSettings()
    Object.assign(form, {
      enabled: settings.value.enabled, streaksEnabled: settings.value.streaksEnabled,
      weeklyGoal: settings.value.weeklyGoal, leaderboardMode: settings.value.leaderboardMode,
    })
    if (settings.value.customBadgesIncluded && canManageBadges) badges.value = await listCustomBadges()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load achievements settings.')
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  savingSettings.value = true
  try {
    settings.value = await saveGamificationSettings({ ...form })
    toast.success('Settings saved.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to save settings.')
  } finally {
    savingSettings.value = false
  }
}

// --- Badge editor ---
const editorOpen = ref(false)
const editing = ref<CustomBadge | null>(null)
const badgeForm = reactive({
  name: '', description: '', icon: 'award', byRule: true, metric: 'LessonsCompleted' as BadgeMetric, threshold: 5, isActive: true,
})
const savingBadge = ref(false)

function openEditor(badge: CustomBadge | null) {
  editing.value = badge
  Object.assign(badgeForm, badge
    ? {
        name: badge.name, description: badge.description, icon: badge.icon, byRule: badge.metric !== null,
        metric: badge.metric ?? 'LessonsCompleted', threshold: badge.threshold ?? 5, isActive: badge.isActive,
      }
    : { name: '', description: '', icon: 'award', byRule: true, metric: 'LessonsCompleted', threshold: 5, isActive: true })
  editorOpen.value = true
}

async function saveBadge() {
  savingBadge.value = true
  const request = {
    name: badgeForm.name, description: badgeForm.description, icon: badgeForm.icon,
    metric: badgeForm.byRule ? badgeForm.metric : null, threshold: badgeForm.byRule ? badgeForm.threshold : null,
    isActive: badgeForm.isActive,
  }
  try {
    const saved = editing.value ? await updateCustomBadge(editing.value.id, request) : await createCustomBadge(request)
    badges.value = editing.value ? badges.value.map((b) => (b.id === saved.id ? saved : b)) : [...badges.value, saved]
    if (!editing.value && settings.value) settings.value.customBadgeCount += 1
    toast.success(saved.earnedCount > 0 ? `Badge saved. ${saved.earnedCount} learner${saved.earnedCount === 1 ? ' holds' : 's hold'} it.` : 'Badge saved.')
    editorOpen.value = false
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to save the badge.')
  } finally {
    savingBadge.value = false
  }
}

function ruleLabel(badge: CustomBadge) {
  if (!badge.metric) return 'Given by hand'
  const metric = BADGE_METRICS.find((m) => m.value === badge.metric)?.label ?? badge.metric
  return `${metric}: ${badge.threshold}`
}

onMounted(load)

const selectClass = 'h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2 text-sm text-(--fg-1) outline-none'
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <div>
      <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Achievements</h1>
      <p class="mt-1.5 text-sm text-(--fg-3)">XP, levels, weekly streaks, leaderboards and badges for your learners.</p>
    </div>

    <p v-if="loading" class="flex items-center gap-2 text-[13px] text-(--fg-3)"><Loader2 :size="16" class="animate-spin" /> Loading…</p>

    <template v-else-if="settings">
      <RaCard v-if="canManageSettings" :padding="24" class="flex flex-col gap-5">
        <h2 class="m-0 text-lg font-bold text-(--fg-1)">Settings</h2>
        <label class="flex items-start gap-3 text-sm text-(--fg-1)">
          <input v-model="form.enabled" type="checkbox" class="mt-1" />
          <span>Show achievements to learners
            <span class="block text-xs text-(--fg-3)">Progress is still recorded while this is off, so nothing is lost.</span>
          </span>
        </label>
        <label class="flex items-start gap-3 text-sm text-(--fg-1)">
          <input v-model="form.streaksEnabled" type="checkbox" class="mt-1" :disabled="!form.enabled" />
          <span>Weekly goals and streaks
            <span class="block text-xs text-(--fg-3)">A week counts when a learner reaches the goal. Missing one week every so often doesn't break a streak.</span>
          </span>
        </label>
        <div class="grid max-w-60 gap-1.5">
          <Label for="weekly-goal">Weekly goal (activities)</Label>
          <Input id="weekly-goal" v-model.number="form.weeklyGoal" type="number" min="1" max="10" :disabled="!form.enabled || !form.streaksEnabled" />
        </div>
        <div class="grid max-w-80 gap-1.5">
          <Label for="leaderboards">Leaderboards</Label>
          <select id="leaderboards" v-model="form.leaderboardMode" :class="selectClass" :disabled="!form.enabled || !settings.leaderboardsIncluded">
            <option value="Off">Off</option>
            <option value="Anonymised">On, without other learners' names</option>
            <option value="Named">On, with names</option>
          </select>
          <p class="m-0 text-xs text-(--fg-3)">
            <template v-if="!settings.leaderboardsIncluded">Leaderboards aren't included in your school's plan.</template>
            <template v-else>Learners see boards for their own classes and courses only, and can always hide their own name.</template>
          </p>
        </div>
        <div>
          <Button :disabled="savingSettings" @click="saveSettings">{{ savingSettings ? 'Saving…' : 'Save settings' }}</Button>
        </div>
      </RaCard>

      <RaCard v-if="canManageBadges" :padding="24" class="flex flex-col gap-4">
        <div class="flex items-start justify-between gap-3 max-sm:flex-col">
          <div>
            <h2 class="m-0 text-lg font-bold text-(--fg-1)">Your school's badges</h2>
            <p class="m-0 mt-1 text-xs text-(--fg-3)">
              Awarded automatically when a learner reaches a target, or given by a teacher from a class's Achievements tab.
              <template v-if="settings.customBadgeLimit != null"> {{ settings.customBadgeCount }} of {{ settings.customBadgeLimit }} used.</template>
            </p>
          </div>
          <Button v-if="settings.customBadgesIncluded" :disabled="atBadgeLimit" @click="openEditor(null)"><Plus :size="14" /> New badge</Button>
        </div>
        <p v-if="!settings.customBadgesIncluded" class="m-0 text-sm text-(--fg-3)">Custom badges aren't included in your school's plan.</p>
        <p v-else-if="!badges.length" class="m-0 text-sm text-(--fg-3)">No badges yet.</p>
        <div v-else class="flex flex-col">
          <div v-for="badge in badges" :key="badge.id" class="flex items-center gap-4 border-b border-(--line-1) py-3 last:border-b-0">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--brand-blue-soft) text-(--brand-blue)">
              <component :is="badgeIcon(badge.icon)" :size="18" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-semibold text-(--fg-1)">{{ badge.name }}</span>
                <RaChip v-if="!badge.isActive" tone="neutral">Retired</RaChip>
              </div>
              <p class="m-0 text-xs text-(--fg-3)">{{ badge.description }} · {{ ruleLabel(badge) }} · {{ badge.earnedCount }} earned</p>
            </div>
            <Button variant="ghost" size="sm" @click="openEditor(badge)">Edit</Button>
          </div>
        </div>
      </RaCard>
    </template>

    <Dialog :open="editorOpen" @update:open="(open) => { if (!savingBadge) editorOpen = open }">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editing ? 'Edit badge' : 'New badge' }}</DialogTitle>
          <DialogDescription>Learners who already reach the target get it as soon as you save.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="saveBadge">
          <div class="grid gap-1.5"><Label for="badge-name">Name</Label><Input id="badge-name" v-model="badgeForm.name" maxlength="60" required /></div>
          <div class="grid gap-1.5"><Label for="badge-description">What it's for</Label><Input id="badge-description" v-model="badgeForm.description" maxlength="200" required /></div>
          <div class="grid gap-1.5">
            <span class="text-sm font-medium text-(--fg-1)">Icon</span>
            <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icon">
              <button
                v-for="icon in BADGE_ICONS"
                :key="icon"
                type="button"
                role="radio"
                :aria-checked="badgeForm.icon === icon"
                :aria-label="icon"
                class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-(--ra-md) border"
                :class="badgeForm.icon === icon ? 'border-(--brand-blue) bg-(--brand-blue-soft) text-(--brand-blue)' : 'border-(--line-2) bg-transparent text-(--fg-3)'"
                @click="badgeForm.icon = icon"
              >
                <component :is="badgeIcon(icon)" :size="16" />
              </button>
            </div>
          </div>
          <label class="flex items-center gap-2 text-sm text-(--fg-1)"><input v-model="badgeForm.byRule" type="checkbox" /> Award automatically</label>
          <div v-if="badgeForm.byRule" class="grid grid-cols-[1fr_120px] gap-2">
            <select v-model="badgeForm.metric" :class="selectClass" aria-label="What to count">
              <option v-for="m in BADGE_METRICS" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
            <Input v-model.number="badgeForm.threshold" type="number" min="1" max="10000" aria-label="Target" />
          </div>
          <label v-if="editing" class="flex items-center gap-2 text-sm text-(--fg-1)">
            <input v-model="badgeForm.isActive" type="checkbox" /> Active (retired badges stay with learners who earned them)
          </label>
          <DialogFooter>
            <Button variant="outline" type="button" :disabled="savingBadge" @click="editorOpen = false">Cancel</Button>
            <Button type="submit" :disabled="savingBadge">{{ savingBadge ? 'Saving…' : 'Save badge' }}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
