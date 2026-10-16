<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RaCard, RaChip, formatPrice, toMinorUnits } from '@roboacademy/ui'
import { ChevronDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import type { CoursePrice, CourseVisibility } from '@/api/learning'

// Payments Phase P1: a priced course is bought before a learner can enrol themselves. Courses
// assigned to a class or by an admin are never charged for.

const props = defineProps<{
  price: CoursePrice | null
  visibility: CourseVisibility
  saving: boolean
  // Shown under the form after a refused save (no provider, out of range, …).
  error: string | null
}>()
const emit = defineEmits<{ save: [amountMinor: number | null] }>()

const open = ref(false)
const paid = ref(props.price !== null)
const amount = ref(props.price ? String(props.price.amountMinor / 100) : '')
watch(() => props.price, (value) => {
  paid.value = value !== null
  amount.value = value ? String(value.amountMinor / 100) : ''
})

const amountMinor = computed(() => toMinorUnits(amount.value))
const unchanged = computed(() =>
  paid.value ? props.price?.amountMinor === amountMinor.value : props.price === null)
const invalid = computed(() => paid.value && (amountMinor.value === null || amountMinor.value <= 0))

function submit() {
  emit('save', paid.value ? amountMinor.value : null)
}
</script>

<template>
  <RaCard id="price" :padding="0" class="scroll-mt-6 overflow-hidden">
    <Collapsible v-model:open="open">
      <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
        <div>
          <h3 class="m-0 text-lg font-bold text-(--fg-1)">Price</h3>
          <p class="m-0 mt-1 text-xs text-(--fg-3)">
            Learners pay before enrolling themselves. Courses you assign to a class or a learner are never charged for.
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <RaChip :tone="price ? 'info' : 'neutral'">{{ price ? formatPrice(price.amountMinor, price.currency) : 'Free' }}</RaChip>
          <ChevronDown :size="16" class="text-(--fg-3) transition-transform duration-200" :class="open && 'rotate-180'" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <form class="flex flex-col gap-4 py-5 px-6" @submit.prevent="submit">
          <div class="flex flex-col gap-2">
            <label class="flex cursor-pointer items-center gap-3 text-sm text-(--fg-1)">
              <input v-model="paid" type="radio" name="course-price" :value="false" class="size-4 accent-(--brand-blue)">
              Free
            </label>
            <label class="flex cursor-pointer items-center gap-3 text-sm text-(--fg-1)">
              <input v-model="paid" type="radio" name="course-price" :value="true" class="size-4 accent-(--brand-blue)">
              Paid
            </label>
          </div>
          <div v-if="paid" class="flex max-w-xs flex-col gap-1.5">
            <Label for="course-price-amount">Price in naira (₦)</Label>
            <Input id="course-price-amount" v-model="amount" inputmode="decimal" placeholder="5000" autocomplete="off" />
            <p class="m-0 text-xs text-(--fg-4)">The payment provider's fee comes out of this amount.</p>
          </div>
          <p v-if="paid && visibility !== 'Public'" class="m-0 text-xs text-(--fg-3)">
            Only courses everyone can see in the catalog can be sold. Set Visibility to Public first.
          </p>
          <p v-if="error" class="m-0 text-xs text-(--danger)">{{ error }}</p>
          <div class="flex justify-end">
            <Button type="submit" :disabled="saving || unchanged || invalid">
              {{ saving ? 'Saving…' : 'Save price' }}
            </Button>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  </RaCard>
</template>
