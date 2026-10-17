<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Plus, Pencil, Trash2, Activity, Cog, ChevronDown } from 'lucide-vue-next'
import { RaAvatar, cn, formatDate } from '@roboacademy/ui'
import { describeAuditEntry, groupByDay, timeLabel, type AuditEntryLike, type AuditTone } from '@/lib/audit-timeline'
import { useUserNames } from '@/composables/useUserNames'

const props = withDefaults(defineProps<{
  items: AuditEntryLike[]
  loading?: boolean
  error?: string | null
  emptyText?: string
  // Lets each row expand to show its field-by-field changes (off for the dashboard preview).
  expandable?: boolean
  // Tighter spacing for cards that only preview a handful of rows.
  compact?: boolean
}>(), {
  loading: false,
  error: null,
  emptyText: 'No activity recorded yet.',
  expandable: true,
  compact: false,
})

const { nameFor, emailFor } = useUserNames(() => props.items.map((item) => item.userId))

const MAX_FIELD_CHIPS = 4

const groups = computed(() => {
  const now = new Date()
  return groupByDay(
    props.items.map((item) => ({ ...item, described: describeAuditEntry(item), time: timeLabel(item.occurredAt, now) })),
    now,
  )
})

const expanded = reactive(new Set<string>())
function toggle(id: string) {
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
}

const toneStyle: Record<AuditTone, { icon: typeof Plus; color: string }> = {
  added: { icon: Plus, color: 'var(--success)' },
  modified: { icon: Pencil, color: 'var(--brand-blue)' },
  deleted: { icon: Trash2, color: 'var(--danger)' },
  other: { icon: Activity, color: 'var(--fg-3)' },
}
</script>

<template>
  <div>
    <p v-if="loading && items.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">Loading activity…</p>
    <p v-else-if="error" class="p-6 text-center text-[13px] text-(--danger)">{{ error }}</p>
    <p v-else-if="items.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">{{ emptyText }}</p>

    <div v-else :class="cn('flex flex-col', compact ? 'gap-4 px-6 py-4' : 'gap-6 px-6 py-5 max-sm:px-4')">
      <section v-for="group in groups" :key="group.label">
        <h4 class="m-0 mb-3 text-xs font-semibold tracking-wide text-(--fg-3) uppercase">{{ group.label }}</h4>

        <ol class="m-0 list-none p-0">
          <li
            v-for="(item, index) in group.items"
            :key="item.id"
            class="relative flex gap-3"
            :class="index < group.items.length - 1 && (compact ? 'pb-4' : 'pb-5')"
          >
            <!-- Rail connecting this row's avatar to the next one's. -->
            <span
              v-if="index < group.items.length - 1"
              class="absolute top-9 bottom-0 left-4 w-px -translate-x-1/2 bg-(--line-2)"
              aria-hidden="true"
            />

            <div class="relative shrink-0">
              <RaAvatar v-if="item.userId" :name="nameFor(item.userId)" :size="32" />
              <span
                v-else
                class="flex size-8 items-center justify-center rounded-full bg-(--bg-3) text-(--fg-3)"
                aria-hidden="true"
              >
                <Cog :size="15" />
              </span>
              <span
                class="absolute -right-1 -bottom-1 flex size-4.5 items-center justify-center rounded-full text-white ring-2 ring-(--bg-2)"
                :style="{ background: toneStyle[item.described.tone].color }"
                aria-hidden="true"
              >
                <component :is="toneStyle[item.described.tone].icon" :size="10" :stroke-width="3" />
              </span>
            </div>

            <div class="min-w-0 flex-1 pt-1">
              <div class="flex items-start justify-between gap-3">
                <p class="m-0 text-sm leading-snug text-(--fg-2)">
                  <span class="font-semibold text-(--fg-1)" :title="emailFor(item.userId) ?? undefined">{{ nameFor(item.userId) }}</span>
                  {{ ' ' }}{{ item.described.verb }}<template v-if="item.described.entityLabel"> {{ item.described.entityLabel }}</template>
                  <span v-if="item.described.subject" class="font-semibold text-(--fg-1)">{{ item.described.subject }}</span>
                </p>
                <time
                  :datetime="item.occurredAt"
                  :title="formatDate(item.occurredAt)"
                  class="shrink-0 pt-0.5 text-xs whitespace-nowrap text-(--fg-4)"
                >{{ item.time }}</time>
              </div>

              <div v-if="item.described.changedFields.length > 0" class="mt-1.5 flex flex-wrap items-center gap-1">
                <span
                  v-for="field in item.described.changedFields.slice(0, MAX_FIELD_CHIPS)"
                  :key="field"
                  class="rounded-md bg-(--bg-3) px-1.5 py-0.5 text-[11px] font-medium text-(--fg-3)"
                >{{ field }}</span>
                <span v-if="item.described.changedFields.length > MAX_FIELD_CHIPS" class="text-[11px] text-(--fg-4)">
                  +{{ item.described.changedFields.length - MAX_FIELD_CHIPS }} more
                </span>
              </div>

              <template v-if="expandable && item.described.details.length > 0">
                <button
                  type="button"
                  class="mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded-md bg-transparent p-0 text-xs font-medium text-(--fg-3) outline-none hover:text-(--fg-1) focus-visible:ring-2 focus-visible:ring-ring/30"
                  :aria-expanded="expanded.has(item.id)"
                  @click="toggle(item.id)"
                >
                  {{ expanded.has(item.id) ? 'Hide details' : 'Show details' }}
                  <ChevronDown :size="12" :class="cn('transition-transform duration-200', expanded.has(item.id) && 'rotate-180')" />
                </button>
                <dl
                  v-if="expanded.has(item.id)"
                  class="mt-2 mb-0 grid grid-cols-[minmax(90px,max-content)_1fr] gap-x-4 gap-y-1.5 rounded-(--ra-md) border border-(--line-1) bg-(--bg-1) px-3 py-2.5 text-xs"
                >
                  <template v-for="detail in item.described.details" :key="detail.field">
                    <dt class="text-(--fg-3)">{{ detail.field }}</dt>
                    <dd class="m-0 min-w-0 font-mono break-words text-(--fg-2)">
                      <template v-if="detail.before !== undefined">
                        <span class="text-(--fg-4) line-through">{{ detail.before }}</span>
                        <span class="px-1 text-(--fg-4)">→</span>
                      </template>
                      {{ detail.after }}
                    </dd>
                  </template>
                </dl>
              </template>
            </div>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>
