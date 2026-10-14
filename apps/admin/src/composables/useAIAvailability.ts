import { computed } from 'vue'
import { getAIAvailability, type AIFeature, type AIFeatureAvailability } from '@/api/ai'
import { useCachedQuery } from '@/composables/useCachedQuery'

/**
 * Which AI features the active school can use right now, from the same decision the API applies
 * to real calls (plan, school settings, monthly allowance, configured model). AI entry points use
 * this to hide themselves rather than offer something the API would refuse. Call `load()` after
 * an AI call that may have used up the allowance.
 */
export function useAIAvailability() {
  const { data, load } = useCachedQuery('ai-availability', getAIAvailability)

  function feature(name: AIFeature): AIFeatureAvailability | undefined {
    return data.value?.features.find((f) => f.feature === name)
  }

  const anyAvailable = computed(() => data.value?.features.some((f) => f.available) ?? false)

  return { data, load, feature, anyAvailable }
}
