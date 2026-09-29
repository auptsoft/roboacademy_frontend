import type { CourseCatalogItem, EnrolledCourseSummary, EnrolledPathSummary, LearningPathItem } from '@/api/learning'
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
    assigned: c.assigned,
    dueAt: c.courseCompleted ? null : c.dueAt,
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

// Learning paths reuse the same tile: a "PATH" ribbon distinguishes them from courses.
export function enrolledPathTileProps(p: EnrolledPathSummary) {
  const status: CourseTileStatus = p.courseCount > 0 && p.completedCourses >= p.courseCount
    ? 'Completed'
    : p.progressPercent === 0 ? 'New' : 'In Progress'
  return {
    title: p.title,
    thumbnailUrl: p.thumbnailUrl,
    ribbon: 'PATH',
    metaLeft: p.description,
    metaRight: `${p.completedCourses}/${p.courseCount} Courses`,
    tag: `${p.progressPercent}%`,
    status,
  }
}

export function catalogPathTileProps(p: LearningPathItem) {
  return {
    title: p.title,
    thumbnailUrl: p.thumbnailUrl,
    ribbon: 'PATH',
    metaLeft: p.description,
    metaRight: `${p.courseCount} ${p.courseCount === 1 ? 'Course' : 'Courses'}`,
  }
}
