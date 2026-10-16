<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import { listClasses, type AdminClass } from '@/api/identity'
import { getCourse, listCourseCatalog, type CourseCatalogItem } from '@/api/learning'
import type { SaveLabSession } from '@/api/roboticsLab'

/**
 * The editable parts of a lab session: who can see it (public, one class, or hidden until
 * someone is assigned), its course, and an optional simulation lesson learners must pass first.
 */
const form = defineModel<SaveLabSession>({ required: true })

const classes = ref<AdminClass[]>([])
const courses = ref<CourseCatalogItem[]>([])
const simulationLessons = ref<{ id: string; title: string }[]>([])

onMounted(async () => {
  try {
    classes.value = (await listClasses(1, 200)).items
    courses.value = (await listCourseCatalog({}, 1, 200)).items
  } catch {
    // The pickers stay empty; the form still works without them.
  }
})

watch(() => form.value.courseId, async (courseId) => {
  simulationLessons.value = []
  if (!courseId) {
    form.value.requiredLessonId = null
    return
  }
  try {
    const course = await getCourse(courseId)
    simulationLessons.value = course.modules.flatMap((m) => m.lessons.filter((l) => l.type === 'Simulation').map((l) => ({ id: l.id, title: l.title })))
    if (form.value.requiredLessonId && !simulationLessons.value.some((l) => l.id === form.value.requiredLessonId)) {
      form.value.requiredLessonId = null
    }
  } catch {
    simulationLessons.value = []
  }
}, { immediate: true })

const selectClass = 'h-9 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none'
</script>

<template>
  <div class="grid gap-3">
    <div class="grid gap-1.5"><Label for="lab-title">Title</Label><Input id="lab-title" v-model="form.title" placeholder="e.g. Drive the line follower" /></div>
    <div class="grid gap-1.5">
      <Label for="lab-description">Description (optional)</Label>
      <textarea id="lab-description" v-model="form.description" rows="2" class="w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) p-2 text-sm text-(--fg-2)" />
    </div>
    <div class="grid gap-1.5">
      <Label for="lab-visibility">Who can see it</Label>
      <select id="lab-visibility" v-model="form.visibility" :class="selectClass">
        <option value="Public">Everyone in the school, who can ask for it</option>
        <option value="Class">One class, whose students can ask for it</option>
        <option value="Hidden">Nobody: staff assign a learner</option>
      </select>
    </div>
    <div v-if="form.visibility === 'Class'" class="grid gap-1.5">
      <Label for="lab-class">Class</Label>
      <select id="lab-class" v-model="form.classId" :class="selectClass">
        <option :value="null" disabled>Choose a class</option>
        <option v-for="c in classes" :key="c.classId" :value="c.classId">{{ c.name }}</option>
      </select>
    </div>
    <div class="grid gap-1.5">
      <Label for="lab-course">Course (optional)</Label>
      <select id="lab-course" v-model="form.courseId" :class="selectClass">
        <option :value="null">None</option>
        <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.title }}</option>
      </select>
    </div>
    <div v-if="form.courseId" class="grid gap-1.5">
      <Label for="lab-required">Must have passed (optional)</Label>
      <select id="lab-required" v-model="form.requiredLessonId" :class="selectClass">
        <option :value="null">No requirement</option>
        <option v-for="lesson in simulationLessons" :key="lesson.id" :value="lesson.id">{{ lesson.title }}</option>
      </select>
      <p class="m-0 text-xs text-(--fg-3)">Learners who haven't passed this simulation lesson can't ask for, or be given, the session.</p>
    </div>
  </div>
</template>
