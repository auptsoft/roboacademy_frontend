<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { Plus, ChevronDown, Copy } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import CopyToTenantsDialog from '@/components/CopyToTenantsDialog.vue'
import { useCanCopyCrossTenant } from '@/composables/useCanCopyCrossTenant'
import Input from '@/components/ui/input.vue'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import CourseGeneralCard, { type CourseGeneralFormState } from '@/components/CourseGeneralCard.vue'
import CoursePublishCard from '@/components/CoursePublishCard.vue'
import CourseModuleHeader, { type CourseModuleEditForm } from '@/components/CourseModuleHeader.vue'
import CourseItemRow from '@/components/CourseItemRow.vue'
import LessonFormFields, { type LessonFormState } from '@/components/LessonFormFields.vue'
import AssessmentFormFields, { type AssessmentFormState, type QuestionRow } from '@/components/AssessmentFormFields.vue'
import { ApiError } from '@/api/client'
import {
  getCourse,
  updateCourse,
  publishCourse,
  unpublishCourse,
  addCourseModule,
  updateCourseModule,
  deleteCourseModule,
  addLessonToModule,
  updateLesson,
  deleteLesson,
  getLessonContentUploadUrl,
  setLessonContentReference,
  getLessonContentUrl,
  uploadCourseThumbnail,
  setCourseThumbnail,
  getCourseIntroVideoUploadUrl,
  setCourseIntroVideo,
  getCourseIntroVideoUrl,
  copyCourseToTenants,
  type CourseDetail,
  type CourseModuleItem,
  type LessonItem,
} from '@/api/learning'
import {
  listAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  listQuestionBank,
  type AssessmentListItem,
  type QuestionBankItemSummary,
  type CreateAssessmentRequest,
} from '@/api/assessment'

const route = useRoute()
const router = useRouter()
const courseId = computed(() => String(route.params.courseId))

const sections = [
  { id: 'general', label: 'General' },
  { id: 'modules', label: 'Modules, Lessons & Assessments' },
  { id: 'publish', label: 'Publish' },
]

// Collapsed by default - CourseGeneralCard/CoursePublishCard own their own collapse state
// internally; this section stays inline in the page, so it needs its own here.
const modulesOpen = ref(false)

const course = ref<CourseDetail | null>(null)
const loading = ref(true)
const notFound = ref(false)
const isDraft = computed(() => course.value?.state === 'Draft')

// --- Interleaved lessons + assessments per module ---

export interface OrderedItem {
  kind: 'lesson' | 'assessment'
  id: string
  moduleId: string
  title: string
  order: number
  isRequired: boolean
  typeLabel: string
  lesson?: CourseModuleItem['lessons'][number]
  assessment?: AssessmentListItem
}

const assessmentsByModule = ref<Record<string, AssessmentListItem[]>>({})

async function loadAssessments() {
  const result = await listAssessments({ courseId: courseId.value }, 1, 200)
  const grouped: Record<string, AssessmentListItem[]> = {}
  for (const item of result.items) {
    (grouped[item.moduleId] ??= []).push(item)
  }
  assessmentsByModule.value = grouped
}

function orderedItems(mod: CourseModuleItem): OrderedItem[] {
  const lessonItems: OrderedItem[] = mod.lessons.map((l) => ({
    kind: 'lesson', id: l.id, moduleId: mod.id, title: l.title, order: l.order, isRequired: l.isRequired,
    typeLabel: l.type, lesson: l,
  }))
  const assessmentItems: OrderedItem[] = (assessmentsByModule.value[mod.id] ?? []).map((a) => ({
    kind: 'assessment', id: a.id, moduleId: mod.id, title: a.title, order: a.order, isRequired: a.isRequired,
    typeLabel: a.type, assessment: a,
  }))
  return [...lessonItems, ...assessmentItems].sort((a, b) => a.order - b.order)
}

// Structural preview of the hard lock a learner will see: the nearest earlier required item
// in Order (if any) that must be completed/passed first. No per-learner progress data is
// available in this authoring context, so this shows the gating chain, not a live lock state.
function gatedBy(items: OrderedItem[], index: number): OrderedItem | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (items[i].isRequired) return items[i]
  }
  return null
}

// --- Drag-and-drop reordering, within or across modules (draft courses only, matching
// lessons' own EnsureDraft rule) ---
const draggedModuleId = ref<string | null>(null)
const draggedIndex = ref<number | null>(null)
const dragOverModuleId = ref<string | null>(null)
const dragOverIndex = ref<number | null>(null)
const reordering = ref(false)

function onDragStart(moduleId: string, index: number) {
  draggedModuleId.value = moduleId
  draggedIndex.value = index
}

function onDragOver(moduleId: string, index: number) {
  dragOverModuleId.value = moduleId
  dragOverIndex.value = index
}

function onDragEnd() {
  draggedModuleId.value = null
  draggedIndex.value = null
  dragOverModuleId.value = null
  dragOverIndex.value = null
}

// Persists an item at its (possibly new) order, moving it to targetModuleId if that differs
// from the module it's currently stored under.
function persistItemOrder(item: OrderedItem, newOrder: number, targetModuleId?: string) {
  const moved = targetModuleId !== undefined && targetModuleId !== item.moduleId
  if (item.kind === 'lesson') {
    const lesson = item.lesson!
    return updateLesson(courseId.value, item.moduleId, lesson.id, {
      title: lesson.title, type: lesson.type, isRequired: lesson.isRequired,
      allowUnenrolled: lesson.allowUnenrolled, context: lesson.context,
      order: newOrder, targetModuleId: moved ? targetModuleId : undefined,
    })
  }
  const assessment = item.assessment!
  return updateAssessment(item.id, {
    title: item.title, isRequired: item.isRequired, order: newOrder,
    allowUnenrolled: assessment.allowUnenrolled,
    preText: assessment.preText, postText: assessment.postText,
    moduleId: moved ? targetModuleId : undefined,
  })
}

async function onDrop(targetMod: CourseModuleItem, targetIndex: number) {
  const fromIndex = draggedIndex.value
  const fromModuleId = draggedModuleId.value
  onDragEnd()
  if (fromModuleId === null || fromIndex === null || !course.value) return
  if (fromModuleId === targetMod.id && fromIndex === targetIndex) return

  const fromMod = course.value.modules.find((m) => m.id === fromModuleId)
  if (!fromMod) return

  const calls: Promise<unknown>[] = []

  if (fromModuleId === targetMod.id) {
    const items = orderedItems(targetMod)
    const [moved] = items.splice(fromIndex, 1)
    items.splice(targetIndex, 0, moved)
    // Renumber densely 1..N and only persist the items whose order actually moved.
    items.forEach((item, i) => {
      const newOrder = i + 1
      if (item.order !== newOrder) calls.push(persistItemOrder(item, newOrder))
    })
  } else {
    const sourceItems = orderedItems(fromMod)
    const [moved] = sourceItems.splice(fromIndex, 1)
    sourceItems.forEach((item, i) => {
      const newOrder = i + 1
      if (item.order !== newOrder) calls.push(persistItemOrder(item, newOrder))
    })

    const destItems = orderedItems(targetMod)
    destItems.splice(targetIndex, 0, moved)
    destItems.forEach((item, i) => {
      const newOrder = i + 1
      if (item === moved) {
        calls.push(persistItemOrder(item, newOrder, targetMod.id))
      } else if (item.order !== newOrder) {
        calls.push(persistItemOrder(item, newOrder))
      }
    })
  }

  if (calls.length === 0) return

  reordering.value = true
  try {
    await Promise.all(calls)
    toast.success('Order updated.')
    await loadCourse()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to reorder items.')
  } finally {
    reordering.value = false
  }
}

// --- Drag-and-drop reordering of modules themselves (draft courses only) ---
const draggedModuleIndex = ref<number | null>(null)
const dragOverModuleIndex = ref<number | null>(null)
const reorderingModules = ref(false)

function onModuleDragStart(index: number) {
  draggedModuleIndex.value = index
}

function onModuleDragOver(index: number) {
  dragOverModuleIndex.value = index
}

function onModuleDragEnd() {
  draggedModuleIndex.value = null
  dragOverModuleIndex.value = null
}

async function onModuleDrop(targetIndex: number) {
  const fromIndex = draggedModuleIndex.value
  onModuleDragEnd()
  if (fromIndex === null || !course.value || fromIndex === targetIndex) return

  const modules = [...course.value.modules]
  const [moved] = modules.splice(fromIndex, 1)
  modules.splice(targetIndex, 0, moved)

  // Renumber densely 1..N and only persist the modules whose order actually moved.
  const changed = modules
    .map((mod, i) => ({ mod, newOrder: i + 1 }))
    .filter(({ mod, newOrder }) => mod.order !== newOrder)
  if (changed.length === 0) return

  reorderingModules.value = true
  try {
    await Promise.all(changed.map(({ mod, newOrder }) =>
      updateCourseModule(courseId.value, mod.id, {
        title: mod.title, description: mod.description ?? undefined, order: newOrder,
      }),
    ))
    toast.success('Module order updated.')
    await loadCourse()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to reorder modules.')
  } finally {
    reorderingModules.value = false
  }
}

async function loadCourse() {
  loading.value = true
  notFound.value = false
  try {
    course.value = await getCourse(courseId.value)
    generalForm.value = {
      title: course.value.title, description: course.value.description ?? '',
      longDescription: course.value.longDescription ?? '', level: course.value.level ?? '',
      category: course.value.category ?? '',
      // Coerced to string - the editor is string-only for now (see KeyValueEditor), even
      // though the underlying jsonb column could technically hold richer values.
      extraProperties: Object.fromEntries(
        Object.entries(course.value.extraProperties).map(([key, value]) => [key, String(value)]),
      ),
    }
    await loadAssessments()
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load course.')
    }
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadCourse()
  loadQuestionBank()
})
watch(courseId, loadCourse)

// --- General (title / description) ---
const generalForm = ref<CourseGeneralFormState>({
  title: '', description: '', longDescription: '', level: '', category: '', extraProperties: {},
})
const generalSubmitting = ref(false)
const generalErrors = ref<Record<string, string[]>>({})

async function submitGeneral() {
  generalErrors.value = {}
  generalSubmitting.value = true
  try {
    const updated = await updateCourse(courseId.value, {
      title: generalForm.value.title,
      description: generalForm.value.description || undefined,
      longDescription: generalForm.value.longDescription || null,
      level: generalForm.value.level || null,
      category: generalForm.value.category || null,
      extraProperties: generalForm.value.extraProperties,
    })
    if (course.value) {
      course.value = {
        ...course.value, title: updated.title, description: updated.description,
        longDescription: updated.longDescription, level: updated.level, category: updated.category,
        extraProperties: updated.extraProperties,
      }
    }
    toast.success('Course updated.')
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      generalErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update course.')
    }
  } finally {
    generalSubmitting.value = false
  }
}

// --- Add module ---
const newModule = reactive({ title: '', description: '' })
const addingModule = ref(false)

async function submitAddModule() {
  if (!newModule.title.trim()) return
  addingModule.value = true
  try {
    await addCourseModule(courseId.value, {
      title: newModule.title.trim(),
      description: newModule.description.trim() || undefined,
    })
    newModule.title = ''
    newModule.description = ''
    await loadCourse()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to add module.')
  } finally {
    addingModule.value = false
  }
}

// --- Edit / delete module ---
const editingModuleId = ref<string | null>(null)
const editModuleForm = ref<CourseModuleEditForm>({ title: '', description: '' })
const savingModuleId = ref<string | null>(null)
const deletingModuleId = ref<string | null>(null)

function startEditModule(moduleId: string, title: string, description: string | null) {
  editingModuleId.value = moduleId
  editModuleForm.value = { title, description: description ?? '' }
}

function cancelEditModule() {
  editingModuleId.value = null
}

async function submitEditModule(order: number) {
  if (!editingModuleId.value || !editModuleForm.value.title.trim()) return
  savingModuleId.value = editingModuleId.value
  try {
    await updateCourseModule(courseId.value, editingModuleId.value, {
      title: editModuleForm.value.title.trim(),
      description: editModuleForm.value.description.trim() || undefined,
      order,
    })
    editingModuleId.value = null
    await loadCourse()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to update module.')
  } finally {
    savingModuleId.value = null
  }
}

async function removeModule(moduleId: string, title: string) {
  if (!window.confirm(`Delete module "${title}" and all its lessons?`)) return
  deletingModuleId.value = moduleId
  try {
    await deleteCourseModule(courseId.value, moduleId)
    toast.success('Module deleted.')
    await loadCourse()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to delete module.')
  } finally {
    deletingModuleId.value = null
  }
}

// --- Add / Edit lesson (one dialog for both, mirroring the Add Assessment dialog's
// completeness - see openAddAssessment/submitAddAssessment) ---
const lessonDialogTarget = ref<{ moduleId: string; lesson: LessonItem | null } | null>(null)
const lessonSubmitting = ref(false)
const lessonErrors = ref<Record<string, string[]>>({})
const lessonForm = ref<LessonFormState>({
  title: '', type: 'Video', isRequired: true, allowUnenrolled: false, order: 1, context: '',
  sceneReference: '',
})

function openAddLesson(mod: CourseModuleItem) {
  lessonDialogTarget.value = { moduleId: mod.id, lesson: null }
  lessonForm.value = {
    title: '', type: 'Video', isRequired: true, allowUnenrolled: false,
    order: orderedItems(mod).length + 1, context: '', sceneReference: '',
  }
  lessonErrors.value = {}
}

function openEditLesson(moduleId: string, lesson: LessonItem) {
  lessonDialogTarget.value = { moduleId, lesson }
  lessonForm.value = {
    title: lesson.title, type: lesson.type, isRequired: lesson.isRequired,
    allowUnenrolled: lesson.allowUnenrolled, order: lesson.order, context: lesson.context ?? '',
    // contentReference is type-agnostic on the backend; only Simulation's form shows it, but
    // prefilling regardless means it's not lost if the admin flips the type dropdown back and forth.
    sceneReference: lesson.contentReference ?? '',
  }
  lessonErrors.value = {}
}

function closeLessonDialog() {
  lessonDialogTarget.value = null
}

async function submitLessonDialog() {
  if (!lessonDialogTarget.value) return
  const { moduleId, lesson } = lessonDialogTarget.value
  lessonErrors.value = {}
  lessonSubmitting.value = true
  try {
    // addLessonToModule only accepts title/type (the backend always creates with
    // isRequired=true, order=Count+1, no context) - the follow-up updateLesson applies the
    // rest of the form in the same submit, so the dialog still behaves as one create step.
    const lessonId = lesson?.id ?? (await addLessonToModule(
      courseId.value, moduleId, { title: lessonForm.value.title, type: lessonForm.value.type },
    )).id
    await updateLesson(courseId.value, moduleId, lessonId, {
      title: lessonForm.value.title, type: lessonForm.value.type, isRequired: lessonForm.value.isRequired,
      allowUnenrolled: lessonForm.value.allowUnenrolled,
      context: lessonForm.value.context || null, order: Number(lessonForm.value.order),
    })
    // Simulation has no upload step (unlike Video/Pdf's openUpload), so its reference is saved
    // here with the rest of the form rather than as its own immediate action.
    if (lessonForm.value.type === 'Simulation') {
      await setLessonContentReference(
        courseId.value, moduleId, lessonId, lessonForm.value.sceneReference.trim() || null,
      )
    }
    toast.success(lesson ? 'Lesson updated.' : 'Lesson added.')
    closeLessonDialog()
    await loadCourse()
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      lessonErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to save lesson.')
    }
  } finally {
    lessonSubmitting.value = false
  }
}

// --- Toggle Required (lessons: draft-course only, per backend's EnsureDraft; assessments: any state) ---
const togglingItemId = ref<string | null>(null)

async function toggleLessonRequired(moduleId: string, lesson: CourseModuleItem['lessons'][number]) {
  togglingItemId.value = lesson.id
  try {
    await updateLesson(courseId.value, moduleId, lesson.id, {
      title: lesson.title, type: lesson.type, isRequired: !lesson.isRequired,
      allowUnenrolled: lesson.allowUnenrolled, context: lesson.context,
    })
    await loadCourse()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to update lesson.')
  } finally {
    togglingItemId.value = null
  }
}

async function toggleAssessmentRequired(assessment: AssessmentListItem) {
  togglingItemId.value = assessment.id
  try {
    await updateAssessment(assessment.id, {
      title: assessment.title, isRequired: !assessment.isRequired, order: assessment.order,
      allowUnenrolled: assessment.allowUnenrolled,
      preText: assessment.preText, postText: assessment.postText,
    })
    await loadAssessments()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to update assessment.')
  } finally {
    togglingItemId.value = null
  }
}

// --- Delete lesson / assessment ---
const deletingItemId = ref<string | null>(null)

async function removeLesson(moduleId: string, lesson: CourseModuleItem['lessons'][number]) {
  if (!window.confirm(`Delete lesson "${lesson.title}"?`)) return
  deletingItemId.value = lesson.id
  try {
    await deleteLesson(courseId.value, moduleId, lesson.id)
    toast.success('Lesson deleted.')
    await loadCourse()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to delete lesson.')
  } finally {
    deletingItemId.value = null
  }
}

async function removeAssessment(assessment: AssessmentListItem) {
  if (!window.confirm(`Delete assessment "${assessment.title}"?`)) return
  deletingItemId.value = assessment.id
  try {
    await deleteAssessment(assessment.id)
    toast.success('Assessment deleted.')
    await loadAssessments()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to delete assessment.')
  } finally {
    deletingItemId.value = null
  }
}

// --- Lesson content (video/PDF) upload/playback via presigned R2 URLs ---
const fileInputEl = ref<HTMLInputElement | null>(null)
const uploadTarget = ref<{ moduleId: string; lessonId: string } | null>(null)
const uploadingLessonId = ref<string | null>(null)

function openUpload(moduleId: string, lessonId: string) {
  uploadTarget.value = { moduleId, lessonId }
  fileInputEl.value?.click()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const target = uploadTarget.value
  input.value = ''
  uploadTarget.value = null
  if (!file || !target) return

  uploadingLessonId.value = target.lessonId
  try {
    const { uploadUrl, objectKey } = await getLessonContentUploadUrl(
      courseId.value, target.moduleId, target.lessonId, { contentType: file.type, fileName: file.name },
    )
    // Direct to R2, not through apiFetch - this is R2's endpoint, not our API.
    const putResponse = await fetch(uploadUrl, { method: 'PUT', body: file })
    if (!putResponse.ok) throw new Error('Upload to storage failed.')

    await setLessonContentReference(courseId.value, target.moduleId, target.lessonId, objectKey)
    // Keep the open Lesson dialog's Content section in sync - loadCourse() below replaces
    // course.value.modules with fresh objects, but lessonDialogTarget.value.lesson is a
    // snapshot reference to the old one and wouldn't otherwise pick up the new reference.
    if (lessonDialogTarget.value?.lesson?.id === target.lessonId) {
      lessonDialogTarget.value.lesson.contentReference = objectKey
    }
    toast.success('Content uploaded.')
    await loadCourse()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to upload content.')
  } finally {
    uploadingLessonId.value = null
  }
}

const playingLesson = ref<{ moduleId: string; lesson: LessonItem } | null>(null)
const playbackUrl = ref<string | null>(null)
const playbackLoading = ref(false)

// Video plays in an inline dialog; a Pdf opens in a new tab (browsers render PDFs natively).
async function viewLessonContent(moduleId: string, lesson: LessonItem) {
  if (lesson.type === 'Pdf') {
    try {
      const { url } = await getLessonContentUrl(courseId.value, moduleId, lesson.id)
      window.open(url, '_blank', 'noopener')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load PDF.')
    }
    return
  }

  playingLesson.value = { moduleId, lesson }
  playbackUrl.value = null
  playbackLoading.value = true
  try {
    const { url } = await getLessonContentUrl(courseId.value, moduleId, lesson.id)
    playbackUrl.value = url
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load video.')
    playingLesson.value = null
  } finally {
    playbackLoading.value = false
  }
}

function closePlayback() {
  playingLesson.value = null
  playbackUrl.value = null
}

// --- Course thumbnail (local-disk storage, permanent public URL) ---
const thumbnailFileInputEl = ref<HTMLInputElement | null>(null)
const uploadingThumbnail = ref(false)

function openThumbnailUpload() {
  thumbnailFileInputEl.value?.click()
}

async function onThumbnailFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !course.value) return

  uploadingThumbnail.value = true
  try {
    const { thumbnailUrl } = await uploadCourseThumbnail(courseId.value, file)
    await setCourseThumbnail(courseId.value, thumbnailUrl)
    course.value.thumbnailUrl = thumbnailUrl
    toast.success('Thumbnail uploaded.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to upload thumbnail.')
  } finally {
    uploadingThumbnail.value = false
  }
}

// --- Course intro video (R2 presigned URLs, same shape as lesson content upload/playback) ---
const introVideoFileInputEl = ref<HTMLInputElement | null>(null)
const uploadingIntroVideo = ref(false)
const playingIntroVideo = ref(false)
const introVideoPlaybackUrl = ref<string | null>(null)
const introVideoPlaybackLoading = ref(false)

function openIntroVideoUpload() {
  introVideoFileInputEl.value?.click()
}

async function onIntroVideoFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !course.value) return

  uploadingIntroVideo.value = true
  try {
    const { uploadUrl, objectKey } = await getCourseIntroVideoUploadUrl(
      courseId.value, { contentType: file.type, fileName: file.name },
    )
    // Direct to R2, not through apiFetch - this is R2's endpoint, not our API.
    const putResponse = await fetch(uploadUrl, { method: 'PUT', body: file })
    if (!putResponse.ok) throw new Error('Upload to storage failed.')

    await setCourseIntroVideo(courseId.value, objectKey)
    course.value.introVideoReference = objectKey
    toast.success('Intro video uploaded.')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to upload intro video.')
  } finally {
    uploadingIntroVideo.value = false
  }
}

async function viewIntroVideo() {
  playingIntroVideo.value = true
  introVideoPlaybackUrl.value = null
  introVideoPlaybackLoading.value = true
  try {
    const { url } = await getCourseIntroVideoUrl(courseId.value)
    introVideoPlaybackUrl.value = url
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load intro video.')
    playingIntroVideo.value = false
  } finally {
    introVideoPlaybackLoading.value = false
  }
}

function closeIntroVideoPlayback() {
  playingIntroVideo.value = false
  introVideoPlaybackUrl.value = null
}

function openAssessment(assessmentId: string) {
  router.push(`/assessment/assessments/${assessmentId}`)
}

// --- Add assessment ---
const questionBank = ref<QuestionBankItemSummary[]>([])

async function loadQuestionBank() {
  const result = await listQuestionBank(undefined, 1, 100)
  questionBank.value = result.items
}

function newQuestionRow(): QuestionRow {
  return { source: 'inline', bankItemId: '', text: '', options: ['', ''], correctOptionIndex: 0 }
}

const addAssessmentModuleId = ref<string | null>(null)
const assessmentCreating = ref(false)
const assessmentErrors = ref<Record<string, string[]>>({})
const assessmentForm = ref<AssessmentFormState>({
  type: 'Quiz', title: '', isRequired: true, allowUnenrolled: false, order: 1,
  maxAttempts: '', timeLimitMinutes: '', passMark: 50, prompt: '',
  acceptedContentTypes: '', maxFileSizeBytes: '',
  questions: [newQuestionRow()],
})

function openAddAssessment(mod: CourseModuleItem) {
  addAssessmentModuleId.value = mod.id
  assessmentForm.value = {
    type: 'Quiz', title: '', isRequired: true, allowUnenrolled: false, order: orderedItems(mod).length + 1,
    maxAttempts: '', timeLimitMinutes: '', passMark: 50, prompt: '',
    acceptedContentTypes: '', maxFileSizeBytes: '',
    questions: [newQuestionRow()],
  }
  assessmentErrors.value = {}
}

async function submitAddAssessment() {
  if (!addAssessmentModuleId.value) return
  assessmentErrors.value = {}
  assessmentCreating.value = true
  try {
    const request: CreateAssessmentRequest = {
      type: assessmentForm.value.type,
      title: assessmentForm.value.title,
      isRequired: assessmentForm.value.isRequired,
      allowUnenrolled: assessmentForm.value.allowUnenrolled,
      order: Number(assessmentForm.value.order),
      maxAttempts: assessmentForm.value.maxAttempts ? Number(assessmentForm.value.maxAttempts) : undefined,
      timeLimitMinutes: assessmentForm.value.timeLimitMinutes ? Number(assessmentForm.value.timeLimitMinutes) : undefined,
    }

    if (assessmentForm.value.type === 'Quiz') {
      request.passMark = Number(assessmentForm.value.passMark)
      request.questions = assessmentForm.value.questions.map((row) =>
        row.source === 'bank'
          ? { bankItemId: row.bankItemId }
          : { text: row.text, options: row.options, correctOptionIndex: row.correctOptionIndex },
      )
    } else if (assessmentForm.value.type === 'Written') {
      request.prompt = assessmentForm.value.prompt
    } else {
      request.acceptedContentTypes = assessmentForm.value.acceptedContentTypes
        ? assessmentForm.value.acceptedContentTypes.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined
      request.maxFileSizeBytes = assessmentForm.value.maxFileSizeBytes ? Number(assessmentForm.value.maxFileSizeBytes) : undefined
    }

    await createAssessment(addAssessmentModuleId.value, request)
    toast.success('Assessment added.')
    addAssessmentModuleId.value = null
    await loadAssessments()
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      assessmentErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to add assessment.')
    }
  } finally {
    assessmentCreating.value = false
  }
}

// --- Publish ---
const publishing = ref(false)
const canPublish = computed(
  () => course.value?.modules.some((m) => m.lessons.length > 0) ?? false,
)

async function submitPublish() {
  publishing.value = true
  try {
    await publishCourse(courseId.value)
    toast.success('Course published.')
    await loadCourse()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to publish course.')
  } finally {
    publishing.value = false
  }
}

const unpublishing = ref(false)

async function submitUnpublish() {
  if (!window.confirm('Unpublish this course? It will return to Draft and can be edited again.')) return
  unpublishing.value = true
  try {
    await unpublishCourse(courseId.value)
    toast.success('Course unpublished.')
    await loadCourse()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to unpublish course.')
  } finally {
    unpublishing.value = false
  }
}

// --- Copy to tenants ---
const canCopyCrossTenant = useCanCopyCrossTenant()
const copyDialogOpen = ref(false)

async function copyToTenants(targetTenantIds: string[]) {
  const result = await copyCourseToTenants(courseId.value, { targetTenantIds })
  return result.results
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-6 pt-8 px-8 pb-16 max-md:gap-5 max-md:pt-5 max-md:px-4 max-md:pb-8">
    <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading course…</p>

    <template v-else-if="notFound">
      <RaCard class="p-10 text-center">
        <p class="m-0 text-sm text-(--fg-3)">Course not found.</p>
      </RaCard>
    </template>

    <template v-else-if="course">
      <div class="flex items-start justify-between max-md:flex-col max-md:items-stretch max-md:gap-3">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">{{ course.title }}</h1>
            <RaChip :tone="course.state === 'Published' ? 'info' : 'neutral'">{{ course.state }}</RaChip>
          </div>
          <p v-if="course.description" class="mt-1.5 text-sm text-(--fg-3)">{{ course.description }}</p>
        </div>
        <Button v-if="canCopyCrossTenant" variant="outline" @click="copyDialogOpen = true">
          <Copy :size="14" /> Copy to tenants…
        </Button>
      </div>

      <CopyToTenantsDialog
        v-model:open="copyDialogOpen"
        title="Copy course to tenants"
        description="Copies the course, its modules, lessons, and assessments into each selected tenant as a new draft."
        :copy-fn="copyToTenants"
      />

      <div class="grid grid-cols-[180px_1fr] gap-8 max-xl:grid-cols-1 max-xl:gap-6">
        <nav class="sticky top-0 flex h-fit flex-col gap-1 max-xl:hidden">
          <a
            v-for="section in sections"
            :key="section.id"
            :href="`#${section.id}`"
            class="rounded-(--ra-md) px-3 py-2 text-sm text-(--fg-3) transition-colors hover:bg-(--bg-3) hover:text-(--fg-1)"
          >
            {{ section.label }}
          </a>
        </nav>

        <div class="flex flex-col gap-6">
          <CourseGeneralCard
            v-model="generalForm"
            :course-id="course.id"
            :submitting="generalSubmitting"
            :errors="generalErrors"
            :thumbnail-url="course.thumbnailUrl"
            :intro-video-reference="course.introVideoReference"
            :uploading-thumbnail="uploadingThumbnail"
            :uploading-intro-video="uploadingIntroVideo"
            @submit="submitGeneral"
            @upload-thumbnail="openThumbnailUpload"
            @upload-intro-video="openIntroVideoUpload"
            @view-intro-video="viewIntroVideo"
          />

          <!-- Modules, Lessons & Assessments -->
          <RaCard id="modules" :padding="0" class="scroll-mt-6 overflow-hidden">
            <Collapsible v-model:open="modulesOpen">
              <CollapsibleTrigger class="flex w-full items-center justify-between gap-3 border-b border-(--line-1) py-5 px-6 text-left">
                <div>
                  <h3 class="m-0 text-lg font-bold text-(--fg-1)">Modules, Lessons & Assessments</h3>
                  <p class="m-0 mt-1 text-xs text-(--fg-3)">
                    Lessons and assessments share one ordering per module. A "Required" item blocks every later item in the
                    module for a learner until it's completed or passed.
                  </p>
                </div>
                <ChevronDown :size="16" class="shrink-0 text-(--fg-3) transition-transform duration-200" :class="modulesOpen && 'rotate-180'" />
              </CollapsibleTrigger>
              <CollapsibleContent>
              <div class="py-5 px-6">
                <p v-if="!isDraft" class="m-0 mb-4 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) p-3 text-[13px] text-(--fg-3)">
                  This course is published. Lessons can no longer be changed, but assessments can still be added or updated.
                </p>

                <p v-if="course.modules.length === 0" class="m-0 mb-4 text-[13px] text-(--fg-3)">No modules yet.</p>
                <p v-else-if="isDraft" class="m-0 mb-3 text-[11px] text-(--fg-4)">
                  Drag a module by its grip handle to reorder it relative to other modules.
                </p>

                <div class="flex flex-col gap-4">
                  <div
                    v-for="(mod, modIndex) in course.modules"
                    :key="mod.id"
                    :draggable="isDraft && !reorderingModules && editingModuleId === null"
                    class="rounded-(--ra-md) border border-(--line-2) p-4 transition-colors"
                    :class="[
                      draggedModuleIndex === modIndex && 'opacity-40',
                      dragOverModuleIndex === modIndex && draggedModuleIndex !== modIndex && 'ring-2 ring-inset ring-(--brand-blue)',
                    ]"
                    @dragstart="onModuleDragStart(modIndex)"
                    @dragover.prevent="onModuleDragOver(modIndex)"
                    @drop="onModuleDrop(modIndex)"
                    @dragend="onModuleDragEnd"
                  >
                    <CourseModuleHeader
                      v-model="editModuleForm"
                      :mod="mod"
                      :is-draft="isDraft"
                      :editing="editingModuleId === mod.id"
                      :saving="savingModuleId === mod.id"
                      :deleting="deletingModuleId === mod.id"
                      :reordering-modules="reorderingModules"
                      @edit="startEditModule(mod.id, mod.title, mod.description)"
                      @cancel="cancelEditModule"
                      @save="submitEditModule(mod.order)"
                      @delete="removeModule(mod.id, mod.title)"
                    />

                    <p v-if="isDraft" class="m-0 mt-3 text-[11px] text-(--fg-4)">
                      Drag the grip handle to reorder lessons and assessments, or drop them into a different module.
                    </p>
                    <ul class="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
                      <li
                        v-for="(item, index) in orderedItems(mod)"
                        :key="`${item.kind}-${item.id}`"
                        :draggable="isDraft && !reordering"
                        class="flex flex-wrap items-center gap-2 rounded-(--ra-sm) border-t border-(--line-1) py-2 first:border-t-0 transition-colors"
                        :class="[
                          draggedModuleId === mod.id && draggedIndex === index && 'opacity-40',
                          dragOverModuleId === mod.id && dragOverIndex === index
                            && !(draggedModuleId === mod.id && draggedIndex === index) && 'ring-2 ring-inset ring-(--brand-blue)',
                        ]"
                        @dragstart="onDragStart(mod.id, index)"
                        @dragover.prevent="onDragOver(mod.id, index)"
                        @drop="onDrop(mod, index)"
                        @dragend="onDragEnd"
                      >
                        <CourseItemRow
                          :item="item"
                          :is-draft="isDraft"
                          :toggling="togglingItemId === item.id"
                          :deleting="deletingItemId === item.id"
                          :reordering="reordering"
                          :gated-by-title="gatedBy(orderedItems(mod), index)?.title ?? null"
                          @edit="openEditLesson(mod.id, item.lesson!)"
                          @open="openAssessment(item.id)"
                          @toggle-required="item.kind === 'lesson' ? toggleLessonRequired(mod.id, item.lesson!) : toggleAssessmentRequired(item.assessment!)"
                          @delete="item.kind === 'lesson' ? removeLesson(mod.id, item.lesson!) : removeAssessment(item.assessment!)"
                        />
                      </li>
                      <li v-if="orderedItems(mod).length === 0" class="py-2 text-xs text-(--fg-4)">No lessons or assessments yet.</li>
                    </ul>

                    <!-- Drop target for "append at the end of this module" - also what makes an
                         empty module a valid cross-module drop destination. -->
                    <div
                      v-if="isDraft"
                      class="h-2.5 rounded-(--ra-sm) transition-colors"
                      :class="dragOverModuleId === mod.id && dragOverIndex === orderedItems(mod).length && 'ring-2 ring-inset ring-(--brand-blue)'"
                      @dragover.prevent="onDragOver(mod.id, orderedItems(mod).length)"
                      @drop="onDrop(mod, orderedItems(mod).length)"
                    />

                    <div class="mt-3 flex flex-wrap items-center gap-2">
                      <Button v-if="isDraft" size="sm" variant="outline" @click="openAddLesson(mod)">
                        <Plus :size="14" /> Add Lesson
                      </Button>

                      <Button size="sm" variant="outline" @click="openAddAssessment(mod)">
                        <Plus :size="14" /> Add Assessment
                      </Button>
                    </div>
                  </div>

                  <!-- Drop target for "move this module to the end of the list". -->
                  <div
                    v-if="isDraft && course.modules.length > 0"
                    class="h-2.5 rounded-(--ra-sm) transition-colors"
                    :class="dragOverModuleIndex === course.modules.length && 'ring-2 ring-inset ring-(--brand-blue)'"
                    @dragover.prevent="onModuleDragOver(course.modules.length)"
                    @drop="onModuleDrop(course.modules.length)"
                  />
                </div>

                <form v-if="isDraft" class="mt-4 flex items-center gap-2" @submit.prevent="submitAddModule">
                  <Input v-model="newModule.title" placeholder="New module title" class="h-9 flex-1" />
                  <Input v-model="newModule.description" placeholder="Description (optional)" class="h-9 flex-1" />
                  <Button type="submit" size="sm" :disabled="addingModule || !newModule.title.trim()">
                    <Plus :size="14" /> Add Module
                  </Button>
                </form>
              </div>
              </CollapsibleContent>
            </Collapsible>
          </RaCard>

          <CoursePublishCard
            :state="course.state"
            :is-draft="isDraft"
            :can-publish="canPublish"
            :publishing="publishing"
            :unpublishing="unpublishing"
            @publish="submitPublish"
            @unpublish="submitUnpublish"
          />
        </div>
      </div>
    </template>

    <!-- Add assessment dialog -->
    <Dialog :open="addAssessmentModuleId !== null" @update:open="(v) => !v && (addAssessmentModuleId = null)">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Assessment</DialogTitle>
          <DialogDescription>Quiz, Written, and File Submission assessments can all be ordered and marked required alongside lessons.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitAddAssessment">
          <AssessmentFormFields
            v-model="assessmentForm"
            :question-bank="questionBank"
            :errors="assessmentErrors"
          />
          <DialogFooter>
            <Button variant="outline" type="button" @click="addAssessmentModuleId = null">Cancel</Button>
            <Button type="submit" :disabled="assessmentCreating">
              {{ assessmentCreating ? 'Adding…' : 'Add Assessment' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <input ref="fileInputEl" type="file" accept="video/*,application/pdf" class="hidden" @change="onFileSelected">
    <input ref="thumbnailFileInputEl" type="file" accept="image/*" class="hidden" @change="onThumbnailFileSelected">
    <input ref="introVideoFileInputEl" type="file" accept="video/*" class="hidden" @change="onIntroVideoFileSelected">

   

    <!-- Course intro video playback -->
    <Dialog :open="playingIntroVideo" @update:open="(v) => !v && closeIntroVideoPlayback()">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Intro Video</DialogTitle>
        </DialogHeader>
        <p v-if="introVideoPlaybackLoading" class="m-0 py-8 text-center text-[13px] text-(--fg-3)">Loading video…</p>
        <video v-else-if="introVideoPlaybackUrl" :src="introVideoPlaybackUrl" controls autoplay class="w-full rounded-(--ra-md)" />
      </DialogContent>
    </Dialog>

    <!-- Add/Edit lesson dialog -->
    <Dialog :open="lessonDialogTarget !== null" @update:open="(v) => !v && closeLessonDialog()">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ lessonDialogTarget?.lesson ? 'Edit Lesson' : 'Add Lesson' }}</DialogTitle>
          <DialogDescription>Title, type, required flag, order, and context can all be changed here while the course is a draft.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitLessonDialog">
          <LessonFormFields
            v-model="lessonForm"
            :errors="lessonErrors"
            :has-lesson="!!lessonDialogTarget?.lesson"
            :content-reference="lessonDialogTarget?.lesson?.contentReference ?? null"
            :uploading="uploadingLessonId === lessonDialogTarget?.lesson?.id"
            @view="viewLessonContent(lessonDialogTarget!.moduleId, lessonDialogTarget!.lesson!)"
            @upload="openUpload(lessonDialogTarget!.moduleId, lessonDialogTarget!.lesson!.id)"
          />
          <DialogFooter>
            <Button variant="outline" type="button" @click="closeLessonDialog">Cancel</Button>
            <Button type="submit" :disabled="lessonSubmitting">
              {{ lessonSubmitting ? 'Saving…' : (lessonDialogTarget?.lesson ? 'Save Changes' : 'Add Lesson') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

     <!-- Lesson video playback (Pdf opens in a new tab instead - see viewLessonContent) -->
    <Dialog :open="playingLesson !== null" @update:open="(v) => !v && closePlayback()">
      <DialogContent class="max-w-2xl">
        <DialogHeader class="flex flex-row items-center justify-between gap-4">
          <DialogTitle>{{ playingLesson?.lesson.title }}</DialogTitle>
          <Button variant="outline" size="sm" @click="closePlayback">Close</Button>
        </DialogHeader>
        <p v-if="playbackLoading" class="m-0 py-8 text-center text-[13px] text-(--fg-3)">Loading video…</p>
        <video v-else-if="playbackUrl" :src="playbackUrl" controls autoplay class="w-full rounded-(--ra-md)" />
      </DialogContent>
    </Dialog>
  </div>
</template>
