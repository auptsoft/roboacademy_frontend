import { computed, ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import { ApiError, type PageMeta } from '@/api/client'

export function usePagedList<T>(
  fetcher: (page: number, pageSize: number) => Promise<{ items: T[]; meta: PageMeta }>,
  options: { initialPageSize?: number; errorMessage?: string } = {},
) {
  const items = ref([]) as Ref<T[]>
  const loading = ref(true)
  const page = ref(1)
  const pageSize = ref(options.initialPageSize ?? 20)
  const meta = ref<PageMeta | null>(null)

  async function load() {
    loading.value = true
    try {
      const result = await fetcher(page.value, pageSize.value)
      items.value = result.items
      meta.value = result.meta
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : (options.errorMessage ?? 'Failed to load.'))
    } finally {
      loading.value = false
    }
  }

  function goToPage(nextPage: number) {
    page.value = nextPage
    return load()
  }

  function setPageSize(size: number) {
    pageSize.value = size
    page.value = 1
    return load()
  }

  const totalPages = computed(() => meta.value?.totalPages ?? 0)

  return { items, loading, page, pageSize, meta, totalPages, load, goToPage, setPageSize }
}
