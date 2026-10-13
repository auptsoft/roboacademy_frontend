// Shared AI helpers. Mirrors the backend's PlanFeatureKeys / PlanLimitKeys AI entries and the
// usage estimator's seeded defaults (RoboAcademy.AI's UsageEstimator).

import type { AIFeature } from '@/api/ai'

export interface AIPlanFeature {
  feature: AIFeature
  label: string
  // Plan key that includes the feature.
  key: string
  // Plan key that moves the feature onto the Enhanced tier.
  enhancedKey: string
  // What one use is called, for "≈ N … left" hints.
  useNoun: [singular: string, plural: string]
  // Typical tokens per use before a school has its own history.
  defaultTokensPerUse: number
}

export const AI_FEATURES: AIPlanFeature[] = [
  {
    feature: 'FeedbackDrafts',
    label: 'Feedback drafts',
    key: 'ai_feedback_drafts',
    enhancedKey: 'ai_feedback_drafts_enhanced',
    useNoun: ['feedback draft', 'feedback drafts'],
    defaultTokensPerUse: 2_400,
  },
  {
    feature: 'Authoring',
    label: 'Authoring help',
    key: 'ai_authoring',
    enhancedKey: 'ai_authoring_enhanced',
    useNoun: ['authoring request', 'authoring requests'],
    defaultTokensPerUse: 12_000,
  },
]

export const AI_BASIC_TOKENS_KEY = 'max_ai_basic_tokens_per_month'
export const AI_ENHANCED_TOKENS_KEY = 'max_ai_enhanced_tokens_per_month'
export const AI_TOKEN_KEYS = [AI_BASIC_TOKENS_KEY, AI_ENHANCED_TOKENS_KEY]

const AI_PLAN_KEYS = new Set([...AI_FEATURES.flatMap((f) => [f.key, f.enhancedKey]), ...AI_TOKEN_KEYS])

// True for every plan feature or limit key that belongs to AI. Generic plan screens leave these
// out and show them in their AI-specific sections instead, so schools never see raw token counts.
export function isAIPlanKey(key: string): boolean {
  return AI_PLAN_KEYS.has(key)
}

// Same rounding as the backend's UsageEstimator.UsesLeft: no false precision.
export function roundUses(exact: number): number {
  if (exact <= 0) return 0
  if (exact < 20) return Math.floor(exact)
  if (exact < 200) return Math.floor(exact / 10) * 10
  if (exact < 2_000) return Math.floor(exact / 50) * 50
  return Math.floor(exact / 100) * 100
}

export function usesNoun(feature: AIFeature, count: number): string {
  const [singular, plural] = AI_FEATURES.find((f) => f.feature === feature)?.useNoun ?? ['use', 'uses']
  return count === 1 ? singular : plural
}

// "≈ 4,100 feedback drafts or ≈ 800 authoring requests" for a token allowance.
export function allowanceHint(tokens: number, features: AIPlanFeature[] = AI_FEATURES): string {
  return features
    .map((f) => {
      const uses = roundUses(tokens / f.defaultTokensPerUse)
      return `≈ ${uses.toLocaleString()} ${usesNoun(f.feature, uses)}`
    })
    .join(' or ')
}

export function aiUsageBarClass(percent: number | null): string {
  if (percent === null) return 'bg-(--primary)'
  if (percent >= 100) return 'bg-(--danger)'
  if (percent >= 90) return 'bg-(--warning)'
  return 'bg-(--primary)'
}
