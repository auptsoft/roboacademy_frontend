<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RaKpi, RaCard, RaChip, RaAvatar, RaStatusDot } from '@roboacademy/ui'
import { Filter, MoreVertical, Plus, Upload } from 'lucide-vue-next'
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
import { getCurrentUser } from '@/store/auth'
import { usePagedList } from '@/composables/usePagedList'
import {
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  assignRoles,
  bulkCreateUsers,
  ROBOACADEMY_ROLES,
  type AdminUser,
  type BulkCreateUsersResponse,
} from '@/api/identity'

const currentUserId = getCurrentUser()?.userId

const roleTone: Record<string, 'admin' | 'instructor' | 'student' | 'neutral'> = {
  PlatformAdmin: 'admin',
  SchoolAdmin: 'admin',
  RobotLabAdmin: 'admin',
  PlatformSupport: 'admin',
  Teacher: 'instructor',
  TeachingAssistant: 'instructor',
  Student: 'student',
  Individual: 'neutral',
  Guest: 'neutral',
}

const filterText = ref('')
let searchDebounce: ReturnType<typeof setTimeout> | undefined

const {
  items: users,
  loading,
  page,
  pageSize,
  meta,
  totalPages,
  load,
  goToPage,
  setPageSize,
} = usePagedList(
  (page, pageSize) => listUsers(page, pageSize, filterText.value),
  { initialPageSize: 20, errorMessage: 'Failed to load users.' },
)

watch(filterText, () => {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})

const rowClass =
  'grid grid-cols-[2fr_1.5fr_1fr_1fr_220px] items-center py-3.5 px-6 transition-colors hover:bg-(--bg-3) max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-2 max-md:p-4'

onMounted(load)

// --- Create user ---
const createOpen = ref(false)
const createSubmitting = ref(false)
const createForm = reactive({
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  otherNames: '',
  phoneNumber: '',
  studentId: '',
  roles: [] as string[],
})
const createErrors = ref<Record<string, string[]>>({})

function resetCreateForm() {
  createForm.email = ''
  createForm.password = ''
  createForm.firstName = ''
  createForm.lastName = ''
  createForm.otherNames = ''
  createForm.phoneNumber = ''
  createForm.studentId = ''
  createForm.roles = []
  createErrors.value = {}
}

async function submitCreate() {
  createErrors.value = {}
  createSubmitting.value = true
  try {
    await createUser({
      email: createForm.email,
      password: createForm.password,
      firstName: createForm.firstName,
      lastName: createForm.lastName,
      otherNames: createForm.otherNames || undefined,
      phoneNumber: createForm.phoneNumber || undefined,
      studentId: createForm.studentId || undefined,
      roles: createForm.roles.length > 0 ? createForm.roles : undefined,
    })
    toast.success('User created.')
    createOpen.value = false
    resetCreateForm()
    await load()
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      createErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create user.')
    }
  } finally {
    createSubmitting.value = false
  }
}

// --- Edit profile ---
const editUser = ref<AdminUser | null>(null)
const editSubmitting = ref(false)
const editForm = reactive({
  email: '',
  firstName: '',
  lastName: '',
  otherNames: '',
  phoneNumber: '',
  studentId: '',
})
const editErrors = ref<Record<string, string[]>>({})

function openEdit(user: AdminUser) {
  editUser.value = user
  editForm.email = user.email
  editForm.firstName = user.firstName
  editForm.lastName = user.lastName
  editForm.otherNames = user.otherNames ?? ''
  editForm.phoneNumber = user.phoneNumber ?? ''
  editForm.studentId = user.studentId ?? ''
  editErrors.value = {}
}

function closeEdit() {
  editUser.value = null
}

async function submitEdit() {
  if (!editUser.value) return
  editErrors.value = {}
  editSubmitting.value = true
  try {
    await updateUser(editUser.value.userId, {
      email: editForm.email,
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      otherNames: editForm.otherNames || undefined,
      phoneNumber: editForm.phoneNumber || undefined,
      studentId: editForm.studentId || undefined,
    })
    toast.success('User updated.')
    closeEdit()
    await load()
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      editErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update user.')
    }
  } finally {
    editSubmitting.value = false
  }
}

// --- Roles ---
const rolesUser = ref<AdminUser | null>(null)
const rolesSelection = ref<string[]>([])
const rolesSubmitting = ref(false)
const rolesErrors = ref<Record<string, string[]>>({})

function openRoles(user: AdminUser) {
  rolesUser.value = user
  rolesSelection.value = [...user.roles]
  rolesErrors.value = {}
}

function closeRoles() {
  rolesUser.value = null
}

async function submitRoles() {
  if (!rolesUser.value) return
  rolesErrors.value = {}
  rolesSubmitting.value = true
  try {
    await assignRoles(rolesUser.value.userId, rolesSelection.value)
    toast.success('Roles updated.')
    closeRoles()
    await load()
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors) {
      rolesErrors.value = error.fieldErrors
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update roles.')
    }
  } finally {
    rolesSubmitting.value = false
  }
}

// --- Deactivate / reactivate ---
const togglingUserId = ref<string | null>(null)

async function toggleActive(user: AdminUser) {
  if (user.isActive && !window.confirm(`Deactivate ${user.fullName}? They will no longer be able to sign in.`)) {
    return
  }
  togglingUserId.value = user.userId
  try {
    if (user.isActive) {
      await deactivateUser(user.userId)
      toast.success('User deactivated.')
    } else {
      await reactivateUser(user.userId)
      toast.success('User reactivated.')
    }
    await load()
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to update user.')
  } finally {
    togglingUserId.value = null
  }
}

// --- Bulk CSV import ---
const bulkImportOpen = ref(false)
const bulkImportFile = ref<File | null>(null)
const bulkImportSubmitting = ref(false)
const bulkImportResult = ref<BulkCreateUsersResponse | null>(null)

function onBulkImportFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  bulkImportFile.value = input.files?.[0] ?? null
}

function resetBulkImportForm() {
  bulkImportFile.value = null
  bulkImportResult.value = null
}

async function submitBulkImport() {
  if (!bulkImportFile.value) return
  bulkImportSubmitting.value = true
  try {
    bulkImportResult.value = await bulkCreateUsers(bulkImportFile.value)
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to import users.')
  } finally {
    bulkImportSubmitting.value = false
  }
}

async function onBulkImportOpenChange(open: boolean) {
  bulkImportOpen.value = open
  if (!open) {
    const hadResult = bulkImportResult.value !== null
    resetBulkImportForm()
    if (hadResult) await load()
  }
}
</script>

<template>
  <div class="flex max-w-(--content-max) mx-auto flex-col gap-7 pt-8 px-8 pb-12 max-sm:gap-5 max-sm:pt-5 max-sm:px-4 max-sm:pb-8">
    <div class="flex items-start justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
      <div>
        <h1 class="m-0 text-[32px] font-bold tracking-[-0.01em] text-(--fg-1)">User Management</h1>
        <p class="mt-1.5 text-sm text-(--fg-3)">Create, edit, and manage access for platform users.</p>
      </div>
      <div class="flex gap-2.5 max-sm:flex-col">
        <Button variant="outline" @click="bulkImportOpen = true">
          <Upload :size="14" />
          Import CSV
        </Button>
        <Button @click="createOpen = true">
          <Plus :size="14" />
          Add User
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
      <RaKpi label="Total Users" :value="String(meta?.totalCount ?? 0)" />
    </div>

    <RaCard :padding="0" class="overflow-hidden">
      <div
        class="flex items-center justify-between border-b border-(--line-1) py-5 px-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-2.5 max-sm:p-4"
      >
        <h3 class="m-0 text-lg font-bold text-(--fg-1)">User Database</h3>
        <div class="relative">
          <Filter :size="13" class="absolute top-1/2 left-2.5 -translate-y-1/2 text-(--fg-4)" />
          <input
            v-model="filterText"
            class="w-55 rounded-(--ra-md) border border-(--line-2) bg-(--bg-3) py-1.75 pr-2.5 pl-7.5 font-sans text-[13px] text-(--fg-2) outline-none placeholder:text-(--fg-4) max-sm:w-full max-sm:box-border"
            placeholder="Search by name or email..."
          >
        </div>
      </div>

      <div
        class="grid grid-cols-[2fr_1.5fr_1fr_1fr_220px] border-b border-(--line-1) py-3.5 px-6 text-xs text-(--fg-3) max-md:hidden"
      >
        <span>User</span>
        <span>Roles</span>
        <span>Status</span>
        <span>Student ID</span>
        <span class="text-right">Actions</span>
      </div>

      <p v-if="loading" class="p-6 text-center text-[13px] text-(--fg-3)">Loading users…</p>
      <p v-else-if="users.length === 0" class="p-6 text-center text-[13px] text-(--fg-3)">
        {{ filterText ? 'No users match your search.' : 'No users yet — add one to get started.' }}
      </p>

      <div
        v-for="(user, i) in users"
        :key="user.userId"
        :class="[rowClass, i < users.length - 1 && 'border-b border-(--line-1)']"
      >
        <div class="flex items-center gap-3 max-md:w-full">
          <RaAvatar :name="user.fullName" :size="36" :status="user.isActive ? 'active' : 'offline'" />
          <div>
            <div class="text-sm font-semibold text-(--fg-1)">{{ user.fullName }}</div>
            <div class="text-xs text-(--fg-3)">{{ user.email }}</div>
          </div>
        </div>
        <div class="flex flex-wrap gap-1">
          <RaChip v-for="role in user.roles" :key="role" :tone="roleTone[role] ?? 'neutral'">{{ role }}</RaChip>
        </div>
        <div>
          <RaStatusDot :status="user.isActive ? 'active' : 'offline'" :label="user.isActive ? 'Active' : 'Inactive'" />
        </div>
        <div class="font-mono text-[13px] text-(--fg-3)">{{ user.studentId ?? '—' }}</div>
        <div class="flex justify-end max-md:w-full max-md:justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger
              class="inline-flex size-9 items-center justify-center rounded-none border border-transparent bg-transparent text-(--fg-3) outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <MoreVertical :size="16" />
              <span class="sr-only">Open actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem @select="openEdit(user)">Edit</DropdownMenuItem>
              <DropdownMenuItem @select="openRoles(user)">Roles</DropdownMenuItem>
              <template v-if="user.userId !== currentUserId">
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  :variant="user.isActive ? 'destructive' : 'default'"
                  :disabled="togglingUserId === user.userId"
                  @select="toggleActive(user)"
                >
                  {{ user.isActive ? 'Deactivate' : 'Reactivate' }}
                </DropdownMenuItem>
              </template>
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

    <!-- Create user dialog -->
    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>Create a new platform user. They'll be required to change their password on first sign-in.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitCreate">
          <div class="flex flex-col gap-1.5">
            <Label for="user-email">Email</Label>
            <Input id="user-email" v-model="createForm.email" type="email" placeholder="jane.doe@school.edu" required />
            <p v-for="msg in createErrors.Email" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="user-password">Password</Label>
            <Input id="user-password" v-model="createForm.password" type="password" required />
            <p class="m-0 text-xs text-(--fg-4)">Min. 8 characters.</p>
            <p v-for="msg in createErrors.Password" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="user-first-name">First Name</Label>
              <Input id="user-first-name" v-model="createForm.firstName" required />
              <p v-for="msg in createErrors.FirstName" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="user-last-name">Last Name</Label>
              <Input id="user-last-name" v-model="createForm.lastName" required />
              <p v-for="msg in createErrors.LastName" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="user-other-names">Other Names (optional)</Label>
            <Input id="user-other-names" v-model="createForm.otherNames" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="user-phone">Phone (optional)</Label>
              <Input id="user-phone" v-model="createForm.phoneNumber" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="user-student-id">Student ID (optional)</Label>
              <Input id="user-student-id" v-model="createForm.studentId" />
              <p class="m-0 text-xs text-(--fg-4)">Auto-generated if left blank.</p>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Roles (optional)</Label>
            <p class="m-0 text-xs text-(--fg-4)">Defaults to Individual if none selected.</p>
            <div class="grid grid-cols-2 gap-2">
              <label
                v-for="role in ROBOACADEMY_ROLES"
                :key="role"
                class="flex items-center gap-2 text-sm text-(--fg-2)"
              >
                <input v-model="createForm.roles" type="checkbox" :value="role" class="accent-(--brand-blue)">
                {{ role }}
              </label>
            </div>
            <p v-for="msg in createErrors.Roles" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="createOpen = false">Cancel</Button>
            <Button type="submit" :disabled="createSubmitting">
              {{ createSubmitting ? 'Creating…' : 'Add User' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Edit profile dialog -->
    <Dialog :open="editUser !== null" @update:open="(open) => { if (!open) closeEdit() }">
      <DialogContent v-if="editUser">
        <DialogHeader>
          <DialogTitle>Edit {{ editUser.fullName }}</DialogTitle>
          <DialogDescription>Update this user's profile details.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitEdit">
          <div class="flex flex-col gap-1.5">
            <Label for="edit-email">Email</Label>
            <Input id="edit-email" v-model="editForm.email" type="email" required />
            <p v-for="msg in editErrors.Email" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="edit-first-name">First Name</Label>
              <Input id="edit-first-name" v-model="editForm.firstName" required />
              <p v-for="msg in editErrors.FirstName" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="edit-last-name">Last Name</Label>
              <Input id="edit-last-name" v-model="editForm.lastName" required />
              <p v-for="msg in editErrors.LastName" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="edit-other-names">Other Names (optional)</Label>
            <Input id="edit-other-names" v-model="editForm.otherNames" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="edit-phone">Phone (optional)</Label>
              <Input id="edit-phone" v-model="editForm.phoneNumber" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="edit-student-id">Student ID (optional)</Label>
              <Input id="edit-student-id" v-model="editForm.studentId" />
            </div>
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

    <!-- Roles dialog -->
    <Dialog :open="rolesUser !== null" @update:open="(open) => { if (!open) closeRoles() }">
      <DialogContent v-if="rolesUser">
        <DialogHeader>
          <DialogTitle>Roles — {{ rolesUser.fullName }}</DialogTitle>
          <DialogDescription>Select at least one role. This replaces the user's current roles.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submitRoles">
          <div class="grid grid-cols-2 gap-2">
            <label
              v-for="role in ROBOACADEMY_ROLES"
              :key="role"
              class="flex items-center gap-2 text-sm text-(--fg-2)"
            >
              <input v-model="rolesSelection" type="checkbox" :value="role" class="accent-(--brand-blue)">
              {{ role }}
            </label>
          </div>
          <p v-for="msg in rolesErrors.Roles" :key="msg" class="m-0 text-xs text-(--danger)">{{ msg }}</p>
          <DialogFooter>
            <Button variant="outline" type="button" @click="closeRoles">Cancel</Button>
            <Button type="submit" :disabled="rolesSubmitting || rolesSelection.length === 0">
              {{ rolesSubmitting ? 'Saving…' : 'Save Roles' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Bulk CSV import dialog -->
    <Dialog :open="bulkImportOpen" @update:open="onBulkImportOpenChange">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Users from CSV</DialogTitle>
          <DialogDescription>
            Required columns: Email, FirstName, LastName. Optional: Password, PhoneNumber, OtherNames, StudentId,
            Roles (semicolon-separated, e.g. "Student;TeachingAssistant"). Rows without a Password or StudentId get one generated.
          </DialogDescription>
        </DialogHeader>

        <div v-if="!bulkImportResult" class="flex flex-col gap-4">
          <input type="file" accept=".csv" class="text-sm text-(--fg-2)" @change="onBulkImportFileSelected">
          <DialogFooter>
            <Button variant="outline" type="button" @click="onBulkImportOpenChange(false)">Cancel</Button>
            <Button :disabled="!bulkImportFile || bulkImportSubmitting" @click="submitBulkImport">
              {{ bulkImportSubmitting ? 'Uploading…' : 'Upload' }}
            </Button>
          </DialogFooter>
        </div>

        <div v-else class="flex flex-col gap-4">
          <p class="m-0 text-sm text-(--fg-1)">
            {{ bulkImportResult.created.length }} of {{ bulkImportResult.totalRows }} row(s) created.
          </p>

          <div
            v-if="bulkImportResult.created.some((u) => u.passwordWasGenerated || u.studentIdWasGenerated)"
            class="flex flex-col gap-1.5"
          >
            <p class="m-0 text-xs font-semibold tracking-wide text-(--fg-2) uppercase">Generated credentials — record these now</p>
            <div
              v-for="u in bulkImportResult.created.filter((c) => c.passwordWasGenerated || c.studentIdWasGenerated)"
              :key="u.userId"
              class="rounded-(--ra-md) border border-(--line-2) p-2.5 font-mono text-xs text-(--fg-2)"
            >
              <div>{{ u.email }}</div>
              <div v-if="u.passwordWasGenerated">password: {{ u.firstName.toLowerCase() }}.{{ u.lastName.toLowerCase() }}</div>
              <div v-if="u.studentIdWasGenerated">student ID: {{ u.studentId }}</div>
            </div>
          </div>

          <div v-if="bulkImportResult.errors.length > 0" class="flex flex-col gap-1.5">
            <p class="m-0 text-xs font-semibold tracking-wide text-(--danger) uppercase">Row errors</p>
            <p v-for="e in bulkImportResult.errors" :key="e.rowNumber" class="m-0 text-xs text-(--danger)">
              Row {{ e.rowNumber }} ({{ e.email ?? 'no email' }}): {{ e.reason }}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" @click="onBulkImportOpenChange(false)">Done</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
