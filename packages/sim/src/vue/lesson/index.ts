import { defineAsyncComponent } from 'vue'
import type { LessonBlockRenderers } from '@roboacademy/ui'

/**
 * Players for the Interactive lesson blocks that need this package's heavy libraries: CodeMirror
 * (code, program), Three.js (model3d) and the program runtimes. Each loads only when a lesson
 * actually has that block. Pass to RaInteractiveLesson's `renderers` prop.
 */
export const lessonBlockRenderers: LessonBlockRenderers = {
  code: defineAsyncComponent(() => import('./CodeSnippet.vue')),
  model3d: defineAsyncComponent(() => import('./ModelViewer.vue')),
  program: defineAsyncComponent(() => import('./ProgramChallenge.vue')),
}
