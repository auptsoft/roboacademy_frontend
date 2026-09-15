<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaCard, RaChip } from '@roboacademy/ui'
import { FolderCog, MoreVertical, Plus, Users as UsersIcon, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import Pagination from '@/components/Pagination.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ApiError } from '@/api/client'
import { usePagedList } from '@/composables/usePagedList'
import {
  listClasses,
  createClass,
  updateClass,
  deleteClass,
  getClass,
  addClassStaff,
  removeClassStaff,
  addClassStudent,
  removeClassStudent,
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listUsers,
  type AdminClass,
  type AdminDepartment,
  type ClassDetail,
  type AdminUser,
} from '@/api/identity'

const {
  items: classes,
  loading,
  page,
  pageSize,
  meta,
  totalPages,
  load,
  goToPage,
  setPageSize,
} = usePagedList((page, pageSize) => listClasses(page, pageSize), {
  initialPageSize: 20,
  errorMessage: 'Failed to load classes.',
})

const departments = ref<AdminDepartment[]>([])

async function loadDepartments() {
  const result = await listDepartments(1, 100)
  departments.value = result.items
}

function departmentName(departmentId: string | null): string {
  return departments.value.find((d) => d.departmentId === departmentId)?.name ?? '—'
}

const rowClass =
  'grid grid-cols-[2fr_1.5fr_100px_100px_180px] items-center py-3.5 px-6 transition-colors hover:bg-(--bg-3) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'

onMounted(() => {
  load()
  loadDepartments()
})

// --- Create class ---
const createOpen = ref(false)
const createSubmitting = ref(false)
const createForm = reactive({ name: '', departmentId: '' })
const createErrors = ref<Record<string, string[]>>({})

function openCreate() {
  createForm.name = ''
  createForm.departmentId = ''
  createErrors.value = {}
  createOpen.value = true
}

async function submitCreate() {
  createErrors.value = {}
  createSubmitting.value = true
  try {
    await createClass(createForm.name, createForm.departmentId || undefined)
    toast.success('Class created.')
    createOpen.value = false
    await load()
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      createErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create class.')
    }
  } finally {
    createSubmitting.value = false
  }
}

// --- Edit class ---
const editClassItem = ref<AdminClass | null>(null)
const editSubmitting = ref(false)
const editForm = reactive({ name: '', departmentId: '' })
const editErrors = ref<Record<string, string[]>>({})

function openEdit(cls: AdminClass) {
  editClassItem.value = cls
  editForm.name = cls.name
  editForm.departmentId = cls.departmentId ?? ''
  editErrors.value = {}
}

function closeEdit() {
  editClassItem.value = null
}

async function submitEdit() {
  if (!editClassItem.value) return
  editErrors.value = {}
  editSubmitting.value = true
  try {
    await updateClass(editClassItem.value.classId, editForm.name, editForm.departmentId || undefined)
    toast.success('Class updated.')
    closeEdit()
    await load()
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      editErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update class.')
    }
  } finally {
    editSubmitting.value = false
  }
}

// --- Delete class ---
const deletingClassId = ref<string | null>(null)

async function removeClass(cls: AdminClass) {
  if (!window.confirm(`Delete ${cls.name}? This removes its roster and staff assignments.`)) return
  deletingClassId.value = cls.classId
  try {
    await deleteClass(cls.classId)
    toast.success('Class deleted.')
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to delete class.')
  } finally {
    deletingClassId.value = null
  }
}

// --- Manage departments dialog ---
const departmentsDialogOpen = ref(false)
const newDepartmentName = ref('')
const addingDepartment = ref(false)
const editingDepartmentId = ref<string | null>(null)
const editingDepartmentName = ref('')
const savingDepartmentId = ref<string | null>(null)
const deletingDepartmentId = ref<string | null>(null)

function openDepartmentsDialog() {
  departmentsDialogOpen.value = true
}

async function submitNewDepartment() {
  if (!newDepartmentName.value.trim()) return
  addingDepartment.value = true
  try {
    await createDepartment(newDepartmentName.value.trim())
    newDepartmentName.value = ''
    await loadDepartments()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to create department.')
  } finally {
    addingDepartment.value = false
  }
}

function startEditDepartment(department: AdminDepartment) {
  editingDepartmentId.value = department.departmentId
  editingDepartmentName.value = department.name
}

function cancelEditDepartment() {
  editingDepartmentId.value = null
}

async function submitEditDepartment() {
  if (!editingDepartmentId.value || !editingDepartmentName.value.trim()) return
  savingDepartmentId.value = editingDepartmentId.value
  try {
    await updateDepartment(editingDepartmentId.value, editingDepartmentName.value.trim())
    editingDepartmentId.value = null
    await loadDepartments()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to update department.')
  } finally {
    savingDepartmentId.value = null
  }
}

async function removeDepartment(department: AdminDepartment) {
  if (!window.confirm(`Delete department "${department.name}"?`)) return
  deletingDepartmentId.value = department.departmentId
  try {
    await deleteDepartment(department.departmentId)
    await loadDepartments()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to delete department.')
  } finally {
    deletingDepartmentId.value = null
  }
}

// --- Manage roster dialog ---
const rosterClass = ref<AdminClass | null>(null)
const rosterDetail = ref<ClassDetail | null>(null)
const rosterLoading = ref(false)

async function refreshRoster() {
  if (!rosterClass.value) return
  rosterDetail.value = await getClass(rosterClass.value.classId)
}

async function openRoster(cls: AdminClass) {
  rosterClass.value = cls
  rosterDetail.value = null
  rosterLoading.value = true
  try {
    await refreshRoster()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to load class roster.')
  } finally {
    rosterLoading.value = false
  }
}

function closeRoster() {
  rosterClass.value = null
  rosterDetail.value = null
  studentQuery.value = ''
  studentResults.value = []
  selectedStudent.value = null
  staffQuery.value = ''
  staffResults.value = []
  selectedStaff.value = null
  staffRole.value = 'Teacher'
}

// Student picker
const studentQuery = ref('')
const studentResults = ref<AdminUser[]>([])
const selectedStudent = ref<AdminUser | null>(null)
const addingStudent = ref(false)
let studentSearchDebounce: ReturnType<typeof setTimeout> | undefined

watch(studentQuery, (value) => {
  // Picking a result sets studentQuery to the picked user's name — skip re-searching that.
  if (selectedStudent.value && value === selectedStudent.value.fullName) return
  clearTimeout(studentSearchDebounce)
  selectedStudent.value = null
  if (value.trim().length < 2) {
    studentResults.value = []
    return
  }
  studentSearchDebounce = setTimeout(async () => {
    const result = await listUsers(1, 8, value)
    studentResults.value = result.items
  }, 300)
})

function pickStudent(user: AdminUser) {
  selectedStudent.value = user
  studentQuery.value = user.fullName
  studentResults.value = []
}

async function submitAddStudent() {
  if (!rosterClass.value || !selectedStudent.value) return
  addingStudent.value = true
  try {
    await addClassStudent(rosterClass.value.classId, selectedStudent.value.userId)
    studentQuery.value = ''
    selectedStudent.value = null
    await refreshRoster()
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to add student.')
  } finally {
    addingStudent.value = false
  }
}

async function removeStudent(userId: string) {
  if (!rosterClass.value) return
  try {
    await removeClassStudent(rosterClass.value.classId, userId)
    await refreshRoster()
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to remove student.')
  }
}

// Staff picker
const staffQuery = ref('')
const staffResults = ref<AdminUser[]>([])
const selectedStaff = ref<AdminUser | null>(null)
const staffRole = ref<'Teacher' | 'TeachingAssistant'>('Teacher')
const addingStaff = ref(false)
let staffSearchDebounce: ReturnType<typeof setTimeout> | undefined

watch(staffQuery, (value) => {
  // Picking a result sets staffQuery to the picked user's name — skip re-searching that.
  if (selectedStaff.value && value === selectedStaff.value.fullName) return
  clearTimeout(staffSearchDebounce)
  selectedStaff.value = null
  if (value.trim().length < 2) {
    staffResults.value = []
    return
  }
  staffSearchDebounce = setTimeout(async () => {
    const result = await listUsers(1, 8, value)
    staffResults.value = result.items
  }, 300)
})

function pickStaff(user: AdminUser) {
  selectedStaff.value = user
  staffQuery.value = user.fullName
  staffResults.value = []
}

async function submitAddStaff() {
  if (!rosterClass.value || !selectedStaff.value) return
  addingStaff.value = true
  try {
    await addClassStaff(rosterClass.value.classId, selectedStaff.value.userId, staffRole.value)
    staffQuery.value = ''
    selectedStaff.value = null
    await refreshRoster()
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to add staff member.')
  } finally {
    addingStaff.value = false
  }
}

async function removeStaffMember(userId: string) {
  if (!rosterClass.value) return
  try {
    await removeClassStaff(rosterClass.value.classId, userId)
    await refreshRoster()
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to remove staff member.')
  }
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex items-start justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">Classes</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Organize students and staff into classes and departments.</p>
      </div>
      <div class="flex gap-2.5 max-sm:flex-col">
        <Button variant="outline" @click="openDepartmentsDialog">
          <FolderCog :size="14" /> Manage Departments
        </Button>
        <Button @click="openCreate">
          <Plus :size="14" /> Add Class
        </Button>
      </div>
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div class="border-b border-(--line-1) py-5 px-6">
        <h3 class="m-0 text-lg font-bold text-(--fg-1)">Class Database</h3>
      </div>

      <div class="grid grid-cols-[2fr_1.5fr_100px_100px_180px] border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden">
        <span>Name</span>
        <span>Department</span>
        <span>Students</span>
        <span>Staff</span>
        <span class="text-right">Actions</span>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading classes…</p>
      <p v-else-if="classes.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">
        No classes yet — add one to get started.
      </p>

      <div
        v-for="(cls, i) in classes"
        :key="cls.classId"
        :class="[rowClass, i < classes.length - 1 && 'border-b border-(--line-1)']"
      >
        <div class="text-sm font-semibold text-(--fg-1)">{{ cls.name }}</div>
        <div class="text-sm text-(--fg-3)">{{ departmentName(cls.departmentId) }}</div>
        <div class="text-sm text-(--fg-2)">{{ cls.studentCount }}</div>
        <div class="text-sm text-(--fg-2)">{{ cls.staffCount }}</div>
        <div class="flex justify-end max-md:w-full max-md:justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger
              class="inline-flex size-9 items-center justify-center rounded-none border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <MoreVertical :size="16" />
              <span class="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem @select="openEdit(cls)">Edit</DropdownMenuItem>
              <DropdownMenuItem @select="openRoster(cls)">Manage Roster</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" :disabled="deletingClassId === cls.classId" @select="removeClass(cls)">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Pagination
        :page="page"
        :page-size="pageSize"
        :total-pages="totalPages"
        :total-count="meta?.totalCount ?? 0"
        @update:page="goToPage"
        @update:page-size="setPageSize"
      />
    </RaCard>

    <!-- Create class dialog -->
    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Class</DialogTitle>
          <DialogDescription>Create a new class, optionally within a department.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitCreate">
          <div class="flex flex-col gap-1.5">
            <Label for="class-name">Name</Label>
            <Input id="class-name" v-model="createForm.name" required />
            <p v-for="msg in createErrors.Name" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="class-department">Department (optional)</Label>
            <select
              id="class-department"
              v-model="createForm.departmentId"
              class="h-10 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
            >
              <option value="">No department</option>
              <option v-for="d in departments" :key="d.departmentId" :value="d.departmentId">{{ d.name }}</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="createOpen = false">Cancel</Button>
            <Button type="submit" :disabled="createSubmitting">
              {{ createSubmitting ? 'Creating…' : 'Add Class' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Edit class dialog -->
    <Dialog :open="editClassItem !== null" @update:open="(open) => { if (!open) closeEdit() }">
      <DialogContent v-if="editClassItem">
        <DialogHeader>
          <DialogTitle>Edit {{ editClassItem.name }}</DialogTitle>
          <DialogDescription>Rename this class or move it to a different department.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitEdit">
          <div class="flex flex-col gap-1.5">
            <Label for="edit-class-name">Name</Label>
            <Input id="edit-class-name" v-model="editForm.name" required />
            <p v-for="msg in editErrors.Name" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="edit-class-department">Department (optional)</Label>
            <select
              id="edit-class-department"
              v-model="editForm.departmentId"
              class="h-10 w-full rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2.5 text-sm text-(--fg-2) outline-none"
            >
              <option value="">No department</option>
              <option v-for="d in departments" :key="d.departmentId" :value="d.departmentId">{{ d.name }}</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="closeEdit">Cancel</Button>
            <Button type="submit" :disabled="editSubmitting">
              {{ editSubmitting ? 'Saving…' : 'Save Changes' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Manage departments dialog -->
    <Dialog v-model:open="departmentsDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Departments</DialogTitle>
          <DialogDescription>Departments group classes together. A department can't be deleted while it still has classes.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-2">
          <p v-if="departments.length === 0" class="m-0 text-[13px] text-(--fg-3)">No departments yet.</p>
          <div
            v-for="d in departments"
            :key="d.departmentId"
            class="flex items-center gap-2 border-b border-(--line-1) py-2 last:border-b-0"
          >
            <template v-if="editingDepartmentId === d.departmentId">
              <Input v-model="editingDepartmentName" class="h-9" />
              <Button size="sm" :disabled="savingDepartmentId === d.departmentId" @click="submitEditDepartment">Save</Button>
              <Button variant="ghost" size="icon-sm" aria-label="Cancel" @click="cancelEditDepartment">
                <X :size="14" />
              </Button>
            </template>
            <template v-else>
              <span class="flex-1 text-sm text-(--fg-1)">{{ d.name }}</span>
              <Button variant="outline" size="sm" @click="startEditDepartment(d)">Rename</Button>
              <Button
                variant="destructive"
                size="sm"
                :disabled="deletingDepartmentId === d.departmentId"
                @click="removeDepartment(d)"
              >
                Delete
              </Button>
            </template>
          </div>
        </div>
        <form class="flex items-center gap-2" @submit.prevent="submitNewDepartment">
          <Input v-model="newDepartmentName" placeholder="New department name" class="h-9" />
          <Button type="submit" size="sm" :disabled="addingDepartment || !newDepartmentName.trim()">Add</Button>
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" @click="departmentsDialogOpen = false">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Manage roster dialog -->
    <Dialog :open="rosterClass !== null" @update:open="(open) => { if (!open) closeRoster() }">
      <DialogContent v-if="rosterClass" class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Roster — {{ rosterClass.name }}</DialogTitle>
          <DialogDescription>Add or remove staff and students for this class.</DialogDescription>
        </DialogHeader>

        <p v-if="rosterLoading" class="m-0 text-[13px] text-(--fg-3)">Loading roster…</p>
        <div v-else-if="rosterDetail" class="flex flex-col gap-6">
          <div class="flex flex-col gap-2">
            <h4 class="m-0 flex items-center gap-1.5 text-sm font-bold text-(--fg-1)">
              <UsersIcon :size="14" /> Staff
            </h4>
            <p v-if="rosterDetail.staff.length === 0" class="m-0 text-xs text-(--fg-3)">No staff assigned.</p>
            <div v-for="s in rosterDetail.staff" :key="s.userId" class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-sm text-(--fg-1)">{{ s.fullName }}</span>
                <RaChip tone="instructor">{{ s.role }}</RaChip>
              </div>
              <Button variant="ghost" size="sm" @click="removeStaffMember(s.userId)">Remove</Button>
            </div>
            <div class="relative mt-1.5 flex items-center gap-2">
              <div class="relative flex-1">
                <Input v-model="staffQuery" placeholder="Search by name or email…" class="h-9" />
                <div
                  v-if="staffResults.length > 0"
                  class="absolute top-full right-0 left-0 z-10 mt-1 max-h-40 overflow-y-auto rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) shadow-md"
                >
                  <button
                    v-for="u in staffResults"
                    :key="u.userId"
                    type="button"
                    class="block w-full px-2.5 py-1.5 text-left text-[13px] text-(--fg-2) hover:bg-(--bg-3)"
                    @click="pickStaff(u)"
                  >
                    {{ u.fullName }} <span class="text-(--fg-4)">{{ u.email }}</span>
                  </button>
                </div>
              </div>
              <select
                v-model="staffRole"
                class="h-9 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) px-2 text-xs text-(--fg-2) outline-none"
              >
                <option value="Teacher">Teacher</option>
                <option value="TeachingAssistant">Teaching Assistant</option>
              </select>
              <Button size="sm" :disabled="!selectedStaff || addingStaff" @click="submitAddStaff">Add</Button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <h4 class="m-0 text-sm font-bold text-(--fg-1)">Students</h4>
            <p v-if="rosterDetail.students.length === 0" class="m-0 text-xs text-(--fg-3)">No students enrolled.</p>
            <div v-for="s in rosterDetail.students" :key="s.userId" class="flex items-center justify-between gap-2">
              <span class="text-sm text-(--fg-1)">{{ s.fullName }}</span>
              <Button variant="ghost" size="sm" @click="removeStudent(s.userId)">Remove</Button>
            </div>
            <div class="relative mt-1.5 flex items-center gap-2">
              <div class="relative flex-1">
                <Input v-model="studentQuery" placeholder="Search by name or email…" class="h-9" />
                <div
                  v-if="studentResults.length > 0"
                  class="absolute top-full right-0 left-0 z-10 mt-1 max-h-40 overflow-y-auto rounded-(--ra-md) border border-(--line-2) bg-(--bg-2) shadow-md"
                >
                  <button
                    v-for="u in studentResults"
                    :key="u.userId"
                    type="button"
                    class="block w-full px-2.5 py-1.5 text-left text-[13px] text-(--fg-2) hover:bg-(--bg-3)"
                    @click="pickStudent(u)"
                  >
                    {{ u.fullName }} <span class="text-(--fg-4)">{{ u.email }}</span>
                  </button>
                </div>
              </div>
              <Button size="sm" :disabled="!selectedStudent || addingStudent" @click="submitAddStudent">Add</Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" @click="closeRoster">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
