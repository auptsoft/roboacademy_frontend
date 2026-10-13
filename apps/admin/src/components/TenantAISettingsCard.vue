<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip, formatDate } from '@roboacademy/ui'
import { ChevronDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { ApiError } from '@/api/client'
import {
  acceptAITerms,
  getAISettings,
  getAIUsage,
  updateAISettings,
  type AIFeature,
  type AISettings,
  type AIUsage,
} from '@/api/ai'
import { aiUsageBarClass, usesNoun } from '@/lib/ai'

// The school's own AI settings and usage. Always about the caller's active tenant (the API
// resolves it from the request), so the setup page only mounts this for that tenant.
const open = defineModel<boolean>('open', { default: false })

const settings = ref<AISettings | null>(null)
const usage = ref<AIUsage | null>(null)
const notInPlan = ref(false)
const loading = ref(true)

const thisMonth = new Date().toISOString().slice(0, 7)
const month = ref(thisMonth)

const form = reactive({
  enabled: false,
  // cap: '' when blank; a number once typed (v-model on a type="number" input casts).
  features: {} as Record<string, { enabled: boolean; cap: string | number }>,
})

function fillForm(loaded: AISettings) {
  form.enabled = loaded.enabled
  for (const feature of loaded.features) {
    form.features[feature.feature] = {
      enabled: feature.enabledBySchool,
      cap: feature.capPercent === null ? '' : String(feature.capPercent),
    }
  }
}

async function load() {
  loading.value = true
  notInPlan.value = false
  try {
    const [loadedSettings, loadedUsage] = await Promise.all([getAISettings(), getAIUsage(month.value)])
    settings.value = loadedSettings
    usage.value = loadedUsage
    fillForm(loadedSettings)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      notInPlan.value = true
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load AI settings.')
    }
  } finally {
    loading.value = false
  }
}

async function loadUsage() {
  try {
    usage.value = await getAIUsage(month.value)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load AI usage.')
  }
}

onMounted(load)
watch(month, loadUsage)

const status = computed(() => {
  if (!settings.value) return null
  if (!settings.value.termsAccepted) return { label: 'Terms not accepted', tone: 'neutral' as const }
  return settings.value.enabled ? { label: 'On', tone: 'info' as const } : { label: 'Off', tone: 'neutral' as const }
})

// --- Terms ---
const accepting = ref(false)

async function submitAccept() {
  if (!settings.value) return
  accepting.value = true
  try {
    await acceptAITerms(settings.value.currentTermsVersion)
    const updated = await updateAISettings({ enabled: true, features: featurePayload() })
    settings.value = updated
    fillForm(updated)
    toast.success('AI terms accepted. AI features are on.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to accept the AI terms.')
  } finally {
    accepting.value = false
  }
}

// --- Settings ---
const saving = ref(false)

function featurePayload() {
  return (settings.value?.features ?? []).map((f) => {
    const entry = form.features[f.feature]
    const raw = String(entry?.cap ?? '').trim()
    const cap = raw ? Number.parseInt(raw, 10) : null
    return { feature: f.feature, enabled: entry?.enabled ?? false, capPercent: Number.isNaN(cap) ? null : cap }
  })
}

async function submitSettings() {
  const features = featurePayload()
  if (features.some((f) => f.capPercent !== null && (f.capPercent < 1 || f.capPercent > 100))) {
    toast.error('Each cap must be a percentage between 1 and 100, or blank for no cap.')
    return
  }
  saving.value = true
  try {
    const updated = await updateAISettings({ enabled: form.enabled, features })
    settings.value = updated
    fillForm(updated)
    toast.success('AI settings saved.')
    await loadUsage()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to save AI settings.')
  } finally {
    saving.value = false
  }
}

// --- Usage ---
function usesLeftText(entries: { feature: AIFeature; estimate: number }[]): string {
  return entries.map((e) => `≈ ${e.estimate.toLocaleString()} ${usesNoun(e.feature, e.estimate)}`).join(' or ')
}

function shareText(tokens: number, tierUsed: number): string {
  if (tierUsed <= 0) return '0%'
  return `${Math.round((tokens / tierUsed) * 100)}%`
}

const shownTiers = computed(() => (usage.value?.tiers ?? []).filter((t) => t.limit !== 0 || t.used > 0))
</script>

<template>
  <RaCard id="ai" :padding="0" class="scroll-mt-6 overflow-hidden">
    <Collapsible v-model:open="open">
      <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="m-0 text-lg font-bold text-(--fg-1)">AI</h3>
            <RaChip v-if="status" :tone="status.tone">{{ status.label }}</RaChip>
          </div>
          <p class="m-0 mt-1 text-xs text-(--fg-3)">AI features for your school, and this month's AI allowance.</p>
        </div>
        <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="open && 'rotate-180'" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p v-if="loading" class="m-0 p-6 text-center text-[13px] text-(--fg-3)">Loading AI settings…</p>

        <p v-else-if="notInPlan" class="m-0 py-5 px-6 text-sm text-(--fg-3)">
          Your plan doesn't include AI features. Contact RoboAcademy to add them.
        </p>

        <div v-else-if="settings" class="flex flex-col">
          <!-- Terms -->
          <div v-if="!settings.termsAccepted" class="flex flex-col gap-4 border-b border-(--line-1) py-5 px-6">
            <div>
              <h4 class="m-0 text-sm font-semibold text-(--fg-1)">AI data terms</h4>
              <p class="m-0 mt-1 text-xs text-(--fg-3)">Read and accept these before any AI feature runs for your school.</p>
            </div>
            <p class="m-0 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) p-4 text-sm leading-relaxed text-(--fg-2)">
              {{ settings.termsText }}
            </p>
            <div class="flex justify-end">
              <Button :disabled="accepting" @click="submitAccept">{{ accepting ? 'Accepting…' : 'Accept and turn on AI' }}</Button>
            </div>
          </div>

          <!-- Settings -->
          <form v-else class="flex flex-col gap-4 border-b border-(--line-1) py-5 px-6" @submit.prevent="submitSettings">
            <label class="flex cursor-pointer items-center gap-3">
              <input v-model="form.enabled" type="checkbox" class="size-4 cursor-pointer accent-(--primary)">
              <span>
                <span class="block text-sm font-semibold text-(--fg-1)">AI features on for this school</span>
                <span class="block text-xs text-(--fg-3)">Switching this off stops every AI feature straight away.</span>
              </span>
            </label>

            <div class="flex flex-col">
              <div
                v-for="feature in settings.features"
                :key="feature.feature"
                class="flex items-center gap-4 border-t border-(--line-1) py-3 max-md:flex-wrap"
              >
                <label
                  class="flex flex-1 items-center gap-3"
                  :class="feature.includedInPlan && form.enabled ? 'cursor-pointer' : 'opacity-60'"
                >
                  <input
                    v-if="form.features[feature.feature]"
                    v-model="form.features[feature.feature].enabled"
                    type="checkbox"
                    class="size-4 cursor-pointer accent-(--primary)"
                    :disabled="!feature.includedInPlan || !form.enabled"
                  >
                  <span class="text-sm font-semibold text-(--fg-1)">{{ feature.label }}</span>
                  <RaChip v-if="!feature.includedInPlan" tone="neutral">Not in your plan</RaChip>
                  <RaChip v-else-if="feature.tier === 'Enhanced'" tone="info">Enhanced</RaChip>
                </label>
                <div v-if="feature.includedInPlan && form.features[feature.feature]" class="flex items-center gap-2">
                  <Label :for="`ai-cap-${feature.feature}`" class="text-xs text-(--fg-3)">Use at most</Label>
                  <Input
                    :id="`ai-cap-${feature.feature}`"
                    v-model="form.features[feature.feature].cap"
                    type="number"
                    min="1"
                    max="100"
                    placeholder="—"
                    class="h-8 w-20"
                    :disabled="!form.enabled"
                  />
                  <span class="text-xs text-(--fg-3)">% of the allowance</span>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
              <p class="m-0 text-xs text-(--fg-3)">
                Terms accepted{{ settings.termsAcceptedAt ? ` on ${formatDate(settings.termsAcceptedAt)}` : '' }}.
                A cap stops one feature using up the allowance the others need; leave it blank for no cap.
              </p>
              <Button type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save AI Settings' }}</Button>
            </div>
          </form>

          <!-- Usage -->
          <div v-if="usage" class="flex flex-col gap-4 py-5 px-6">
            <div class="flex items-center justify-between gap-3">
              <h4 class="m-0 text-sm font-semibold text-(--fg-1)">Usage</h4>
              <Input v-model="month" type="month" :max="thisMonth" class="h-8 w-40" aria-label="Month" />
            </div>

            <p v-if="shownTiers.length === 0" class="m-0 text-sm text-(--fg-3)">No AI allowance on your plan.</p>

            <div v-for="tier in shownTiers" :key="tier.tier" class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between text-sm">
                <span class="font-semibold text-(--fg-1)">{{ tier.tier }}</span>
                <span class="text-(--fg-1)">
                  <template v-if="tier.percent !== null">{{ tier.percent }}% used</template>
                  <template v-else>No limit</template>
                </span>
              </div>
              <div v-if="tier.percent !== null" class="h-1.5 overflow-hidden rounded-(--ra-pill) bg-(--bg-3)">
                <div class="h-full rounded-(--ra-pill) transition-[width]" :class="aiUsageBarClass(tier.percent)" :style="{ width: `${tier.percent}%` }" />
              </div>
              <p v-if="tier.usesLeft.length > 0" class="m-0 text-xs text-(--fg-3)">
                Enough for {{ usesLeftText(tier.usesLeft) }} this month.
              </p>
              <p v-if="tier.used > 0" class="m-0 text-xs text-(--fg-3)">
                Used by:
                <template v-for="(share, index) in tier.features.filter((f) => f.tokens > 0)" :key="share.feature">
                  <span v-if="index > 0">, </span>{{ share.label }} {{ shareText(share.tokens, tier.used) }}
                </template>
              </p>
            </div>

            <p v-if="usage.tierFallbacks > 0" class="m-0 text-xs text-(--fg-3)">
              {{ usage.tierFallbacks.toLocaleString() }} request{{ usage.tierFallbacks === 1 ? '' : 's' }} ran on Basic because the Enhanced allowance was used up.
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </RaCard>
</template>
