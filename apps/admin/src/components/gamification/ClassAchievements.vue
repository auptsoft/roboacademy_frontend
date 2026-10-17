<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard } from '@roboacademy/ui'
import { Gift, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import {
  getClassAchievements, giveAward, listCustomBadges, type ClassLearnerAchievements, type CustomBadge,
} from '@/api/gamification'
import { hasTenantFeature } from '@/branding'

// A class's achievements for its staff (Gamification Phase G2): each student's level, XP this
// week, streak and badges, and a way to give a badge or bonus XP by hand.
const props = defineProps<{ classId: string }>()

const canAward = hasTenantFeature('gamification_custom_badges')
const rows = ref<ClassLearnerAchievements[]>([])
const badges = ref<CustomBadge[]>([])
const status = ref<'loading' | 'idle' | 'error'>('loading')

async function load() {
  status.value = 'loading'
  try {
    rows.value = await getClassAchievements(props.classId)
    if (canAward) badges.value = (await listCustomBadges()).filter((b) => b.isActive)
    status.value = 'idle'
  } catch {
    status.value = 'error'
  }
}

const awardFor = ref<ClassLearnerAchievements | null>(null)
const awardForm = reactive({ badgeId: '', points: '' as number | '', note: '' })
const giving = ref(false)

function openAward(row: ClassLearnerAchievements) {
  awardFor.value = row
  Object.assign(awardForm, { badgeId: '', points: '', note: '' })
}

async function submitAward() {
  if (!awardFor.value) return
  giving.value = true
  try {
    await giveAward(awardFor.value.userId, {
      badgeId: awardForm.badgeId || null,
      points: awardForm.points === '' ? null : Number(awardForm.points),
      note: awardForm.note,
    })
    toast.success(`Award given to ${awardFor.value.fullName}.`)
    awardFor.value = null
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to give the award.')
  } finally {
    giving.value = false
  }
}

onMounted(load)

const selectClass = 'h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2 text-sm text-(--fg-1) outline-none'
</script>

<template>
  <RaCard :padding="0" class="overflow-hidden">
    <div class="border-b border-(--line-1) py-5 px-6">
      <h3 class="m-0 text-lg font-bold text-(--fg-1)">Achievements</h3>
      <p class="m-0 mt-1 text-xs text-(--fg-3)">XP and streaks count Monday to Sunday (UTC).</p>
    </div>
    <p v-if="status === 'loading'" class="flex items-center gap-2 px-6 py-5 text-[13px] text-(--fg-3)"><Loader2 :size="16" class="animate-spin" /> Loading…</p>
    <p v-else-if="status === 'error'" class="px-6 py-5 text-[13px] text-(--fg-3)">Couldn't load achievements.</p>
    <p v-else-if="!rows.length" class="px-6 py-5 text-[13px] text-(--fg-3)">No students yet.</p>
    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="text-left text-xs text-(--fg-3)">
            <th class="px-6 py-2 font-medium">Student</th>
            <th class="px-3 py-2 font-medium">Level</th>
            <th class="px-3 py-2 font-medium">XP</th>
            <th class="px-3 py-2 font-medium">This week</th>
            <th v-if="rows.some((r) => r.streak !== null)" class="px-3 py-2 font-medium">Streak</th>
            <th class="px-3 py-2 font-medium">Badges</th>
            <th v-if="canAward" class="px-6 py-2" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.userId" class="border-t border-(--line-1)">
            <td class="px-6 py-2.5 text-(--fg-1)">{{ row.fullName }}</td>
            <td class="px-3 py-2.5 tabular-nums">{{ row.level }}</td>
            <td class="px-3 py-2.5 tabular-nums">{{ row.totalXp.toLocaleString() }}</td>
            <td class="px-3 py-2.5 tabular-nums">{{ row.weekXp.toLocaleString() }}</td>
            <td v-if="rows.some((r) => r.streak !== null)" class="px-3 py-2.5 tabular-nums">{{ row.streak ?? '—' }} wk</td>
            <td class="px-3 py-2.5 tabular-nums">{{ row.badges }}</td>
            <td v-if="canAward" class="px-6 py-2.5 text-right">
              <Button variant="ghost" size="sm" @click="openAward(row)"><Gift :size="14" /> Award</Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Dialog :open="awardFor !== null" @update:open="(open) => { if (!open && !giving) awardFor = null }">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Give {{ awardFor?.fullName }} an award</DialogTitle>
          <DialogDescription>Give one of your school's badges, bonus XP (5–50), or both. The learner sees your note.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitAward">
          <div class="grid gap-1.5">
            <Label for="award-badge">Badge</Label>
            <select id="award-badge" v-model="awardForm.badgeId" :class="selectClass">
              <option value="">No badge</option>
              <option v-for="b in badges" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
            <p v-if="!badges.length" class="m-0 text-xs text-(--fg-3)">Make badges on the Achievements page first.</p>
          </div>
          <div class="grid max-w-40 gap-1.5">
            <Label for="award-points">Bonus XP</Label>
            <Input id="award-points" v-model.number="awardForm.points" type="number" min="5" max="50" placeholder="None" />
          </div>
          <div class="grid gap-1.5">
            <Label for="award-note">What it's for</Label>
            <Input id="award-note" v-model="awardForm.note" maxlength="300" required />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" :disabled="giving" @click="awardFor = null">Cancel</Button>
            <Button type="submit" :disabled="giving || (!awardForm.badgeId && awardForm.points === '')">{{ giving ? 'Giving…' : 'Give award' }}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </RaCard>
</template>
