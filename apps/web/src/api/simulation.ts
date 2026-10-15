import { apiFetch } from '@/api/client'
import type { ObjectiveSet, ProgramLanguage, RunSummary, SceneDefinition } from '@roboacademy/sim'

/** The in-house simulator (`@roboacademy/sim`): lessons, runs and draft programs. */

export interface SimulationScene {
  id: string
  name: string
  robotType: string
  definition: SceneDefinition
  objectives: ObjectiveSet
}

export interface SimulationBestResult {
  score: number
  passed: boolean
  submittedAt: string
}

export interface SimulationLesson {
  lessonId: string
  courseId: string
  scene: SimulationScene
  /** The author's setting: Blocks, JavaScript, Python, or Any (the learner chooses). */
  languageSetting: 'Blocks' | 'JavaScript' | 'Python' | 'Any'
  /** The languages the learner may use here. */
  languages: ProgramLanguage[]
  /** Per language: the learner's draft, or their last submitted program (Blockly JSON or `{ source }`). */
  programs: Partial<Record<ProgramLanguage, object>>
  /** The language the learner worked in most recently. */
  lastLanguage: ProgramLanguage | null
  best: SimulationBestResult | null
}

export type SimulationRunMode = 'practice' | 'graded'

export interface SubmitRunPayload {
  program: object
  generatedCode: string
  outcome: string
  objectiveResults: { id: string; everSatisfied: boolean; firstSatisfiedAtMs: number | null }[]
  summary: RunSummary
}

export interface SubmitRunResult {
  runId: string
  score: number
  passed: boolean
}

export function getSimulationLesson(lessonId: string): Promise<SimulationLesson> {
  return apiFetch<SimulationLesson>(`/api/roboticslab/simulation/lessons/${lessonId}`)
}

export function saveSimulationProgram(
  lessonId: string, language: ProgramLanguage, program: object, generatedCode: string | null,
): Promise<void> {
  return apiFetch<void>(`/api/roboticslab/simulation/lessons/${lessonId}/program`, {
    method: 'PUT',
    body: JSON.stringify({ program, generatedCode, language }),
  })
}

export async function startSimulationRun(lessonId: string, mode: SimulationRunMode, language: ProgramLanguage): Promise<string> {
  const { runId } = await apiFetch<{ runId: string }>('/api/roboticslab/simulation/runs', {
    method: 'POST',
    body: JSON.stringify({ lessonId, mode, language }),
  })
  return runId
}

/** Submits a run once. The server computes the score from the objective statuses. */
export function submitSimulationRun(runId: string, payload: SubmitRunPayload): Promise<SubmitRunResult> {
  return apiFetch<SubmitRunResult>(`/api/roboticslab/simulation/runs/${runId}/result`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export interface SimulationHint {
  /** 1 (a nudge) up to `maxLevel` (3 in graded lessons, 4 in practice ones). */
  level: number
  maxLevel: number
  hint: string
  relatedLessons: { lessonId: string; title: string }[]
  hintsUsed: number
}

/** The next hint for the learner's latest attempt. The server reads the attempt from its own records. */
export function requestSimulationHint(lessonId: string): Promise<SimulationHint> {
  return apiFetch<SimulationHint>('/api/ai/sim-hints', { method: 'POST', body: JSON.stringify({ lessonId }) })
}
