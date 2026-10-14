import { computed } from 'vue'
import { getAIAvailability, type AIFeature } from '@/api/ai'
import { useCachedQuery } from '@/composables/useCachedQuery'

/** Which AI features the learner's school offers right now (plan, school settings, allowance). */
export function useAIAvailability() {
  const { data, load } = useCachedQuery('ai-availability', getAIAvailability)
  const feature = (name: AIFeature) => data.value?.features.find((f) => f.feature === name)
  const tutorAvailable = computed(() => feature('Tutor')?.available ?? false)
  return { data, load, feature, tutorAvailable }
}
