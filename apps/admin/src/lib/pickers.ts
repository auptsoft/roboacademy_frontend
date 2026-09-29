import type { SearchOption } from '@/components/SearchMultiSelect.vue'
import { listClasses, listUsers } from '@/api/identity'
import { listCourseCatalog, listPaths, visibilityLabel } from '@/api/learning'

// Search functions for SearchMultiSelect, one per entity it picks.

export async function searchUsers(query: string): Promise<SearchOption[]> {
  const result = await listUsers(1, 10, query)
  return result.items.map((u) => ({ id: u.userId, label: u.fullName, sublabel: u.email }))
}

export async function searchCourses(query: string): Promise<SearchOption[]> {
  const result = await listCourseCatalog({ search: query || undefined }, 1, 10)
  return result.items.map((c) => ({
    id: c.id,
    label: c.title,
    sublabel: `${c.state} · ${visibilityLabel(c.visibility)}`,
  }))
}

export async function searchPaths(query: string): Promise<SearchOption[]> {
  const result = await listPaths({ search: query || undefined }, 1, 10)
  return result.items.map((p) => ({ id: p.id, label: p.title, sublabel: `${p.state} · ${p.courseCount} courses` }))
}

// listClasses has no server-side search, so fetch a page and filter client-side.
export async function searchClasses(query: string): Promise<SearchOption[]> {
  const result = await listClasses(1, 100)
  const needle = query.trim().toLowerCase()
  return result.items
    .filter((c) => !needle || c.name.toLowerCase().includes(needle))
    .slice(0, 10)
    .map((c) => ({ id: c.classId, label: c.name, sublabel: `${c.studentCount} students` }))
}

/** `<input type="date">` value (yyyy-mm-dd) -> ISO timestamp at the end of that local day. */
export function dueDateToIso(value: string): string | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59).toISOString()
}

/** ISO timestamp -> `<input type="date">` value in local time. */
export function isoToDueDate(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
