<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard } from '@roboacademy/ui'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/api/client'
import {
  getClassCommunitySettings, PRESET_LABELS, saveClassCommunitySettings,
  type ClassCommunitySettings, type SafetyPreset,
} from '@/api/community'

// A class's community safety level: the school's default, or stricter. Levels looser than the
// school's are shown but can't be chosen.

const props = defineProps<{ classId: string }>()

const ORDER: SafetyPreset[] = ['Open', 'Standard', 'Restricted']
const settings = ref<ClassCommunitySettings | null>(null)
const choice = ref<SafetyPreset>('Standard')
const loading = ref(true)
const saving = ref(false)

async function load() {
  loading.value = true
  try {
    settings.value = await getClassCommunitySettings(props.classId)
    choice.value = settings.value.effective
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load the class settings.')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!settings.value) return
  saving.value = true
  try {
    settings.value = await saveClassCommunitySettings(
      props.classId, choice.value === settings.value.schoolDefault ? null : choice.value)
    toast.success('Safety level saved.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to save.')
  } finally {
    saving.value = false
  }
}

const looserThanSchool = (preset: SafetyPreset) =>
  !!settings.value && ORDER.indexOf(preset) < ORDER.indexOf(settings.value.schoolDefault)

onMounted(load)
</script>

<template>
  <RaCard :padding="24" class="flex flex-col gap-4">
    <div>
      <h2 class="m-0 text-lg font-bold text-(--fg-1)">Community safety level</h2>
      <p class="m-0 mt-1 text-xs text-(--fg-3)">
        How much this class's learners can do on boards and in course questions.
        <template v-if="settings">The school's default is {{ settings.schoolDefault }}.</template>
        A learner in several classes gets the strictest of them.
      </p>
    </div>

    <p v-if="loading" class="flex items-center gap-2 text-[13px] text-(--fg-3)"><Loader2 :size="16" class="animate-spin" /> Loading…</p>
    <template v-else-if="settings">
      <div class="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Safety level">
        <label
          v-for="preset in ORDER"
          :key="preset"
          class="flex flex-col gap-1.5 rounded-(--ra-lg) border p-4"
          :class="[
            choice === preset ? 'border-(--brand-blue) bg-(--brand-blue-soft)' : 'border-(--line-2)',
            looserThanSchool(preset) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          ]"
        >
          <span class="flex items-center gap-2 text-sm font-semibold text-(--fg-1)">
            <input v-model="choice" type="radio" :name="`preset-${classId}`" :value="preset" :disabled="looserThanSchool(preset)" />
            {{ PRESET_LABELS[preset].label }}
            <span v-if="preset === settings.schoolDefault" class="text-xs font-normal text-(--fg-3)">(school default)</span>
          </span>
          <span class="text-xs leading-relaxed text-(--fg-3)">{{ PRESET_LABELS[preset].description }}</span>
        </label>
      </div>
      <div>
        <Button :disabled="saving || choice === settings.effective" @click="save">{{ saving ? 'Saving…' : 'Save' }}</Button>
      </div>
    </template>
  </RaCard>
</template>
