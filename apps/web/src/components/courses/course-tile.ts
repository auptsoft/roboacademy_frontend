import type { CourseCatalogItem, EnrolledCourseSummary } from '@/api/learning'
import type { CourseTileStatus } from './CourseTile.vue'

export function enrolledCourseStatus(c: EnrolledCourseSummary): CourseTileStatus {
  if (c.courseCompleted) return 'Completed'
  if (c.completedLessons === 0) return 'New'
  return 'In Progress'
}

// Maps an enrolment onto CourseTile's slots: ribbon = category, meta = level + lesson progress,
// grey tag = overall progress, coloured chip = status.
export function enrolledTileProps(c: EnrolledCourseSummary) {
  return {
    title: c.title,
    thumbnailUrl: c.thumbnailUrl,
    ribbon: c.category,
    metaLeft: c.level,
    metaRight: `${c.completedLessons}/${c.totalLessons} Lessons`,
    tag: `${c.progressPercent}%`,
    status: enrolledCourseStatus(c),
  }
}

export function catalogTileProps(c: CourseCatalogItem) {
  return {
    title: c.title,
    thumbnailUrl: c.thumbnailUrl,
    ribbon: c.category,
    metaLeft: c.description,
    metaRight: `${c.lessonCount} Lessons`,
    tag: c.level,
  }
}
