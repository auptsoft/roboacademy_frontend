<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatMoney } from '@roboacademy/ui'
import { listMyOrders, type MyOrder } from '@/api/payments'

// The learner's paid courses (Payments Phase P1). Hidden when there are none - most schools never
// sell courses, and their learners shouldn't see an empty purchases list.

const router = useRouter()
const orders = ref<MyOrder[]>([])

onMounted(async () => {
  try {
    orders.value = await listMyOrders()
  } catch {
    // Paid courses aren't available here (or the list failed): show nothing.
  }
})
</script>

<template>
  <section v-if="orders.length" class="bg-(--surface) rounded-(--ra-xl) shadow-(--surface-shadow) p-6 max-sm:p-4">
    <h2 class="m-0 text-[22px] font-medium text-(--heading)">Purchases</h2>
    <p class="m-0 mt-1 mb-5 text-[13px] text-(--fg-3)">Courses you've bought. Receipts were sent to your email.</p>
    <ul class="m-0 flex list-none flex-col p-0">
      <li
        v-for="order in orders"
        :key="order.id"
        class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 items-center border-b border-(--line-1) py-3 last:border-b-0"
      >
        <button
          type="button"
          class="min-w-0 truncate border-0 bg-transparent p-0 text-left text-sm font-medium text-(--heading) cursor-pointer hover:underline"
          @click="router.push(`/app/courses/${order.courseId}`)"
        >{{ order.courseTitle }}</button>
        <span class="text-sm text-(--fg-1)">{{ formatMoney(order.amountMinor, order.currency) }}</span>
        <span class="text-xs text-(--fg-3)">{{ order.paidAt ? new Date(order.paidAt).toLocaleDateString() : '' }}</span>
        <span class="font-mono text-[11px] text-(--fg-4)">{{ order.reference }}</span>
      </li>
    </ul>
  </section>
</template>
