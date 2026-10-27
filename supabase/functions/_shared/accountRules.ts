// Quy tắc tài khoản dùng chung cho giao diện (src/) và Edge Function admin-users (Deno).
// Hàm thuần, không import gì — chạy được ở cả trình duyệt, Deno và Vitest.

export type OrgRole = 'org_admin' | 'teacher' | 'student' | 'parent'
export type MemberStatus = 'active' | 'disabled'
export type ManageAction = 'reset_password' | 'set_status' | 'update_profile' | 'change_role' | 'delete'

export const ROLE_LABELS: Record<OrgRole, string> = {
  org_admin: 'Quản lý',
  teacher: 'Giáo viên',
  student: 'Học sinh',
  parent: 'Phụ huynh',
}

/** Tài khoản không có email thật dùng email nội bộ này (không bao giờ gửi thư). */
export const INTERNAL_EMAIL_DOMAIN = 'hs.chessineducation.invalid'
export const USERNAME_PATTERN = /^[a-z0-9._]{3,32}$/
export const MIN_PASSWORD_LENGTH = 6

export interface Actor {
  userId: string
  isSuperAdmin: boolean
  /** Vai trò đang hoạt động của người thao tác trong đơn vị đích (null = không thuộc đơn vị). */
  role: OrgRole | null
}

export interface TargetMember {
  userId: string
  role: OrgRole
  createdBy: string | null
  isSuperAdmin: boolean
}

export type Decision = { ok: true } | { ok: false; reason: string }

const allow: Decision = { ok: true }
const deny = (reason: string): Decision => ({ ok: false, reason })

/** Vai trò mà người thao tác được phép tạo tài khoản mới. */
export function rolesCreatableBy(actor: Actor): OrgRole[] {
  if (actor.isSuperAdmin) return ['org_admin', 'teacher', 'student', 'parent']
  if (actor.role === 'org_admin') return ['teacher', 'student', 'parent']
  if (actor.role === 'teacher') return ['student']
  return []
}

export function canCreateAccount(actor: Actor, role: OrgRole): Decision {
  if (rolesCreatableBy(actor).includes(role)) return allow
  if (actor.role === 'teacher') return deny('Giáo viên chỉ tạo được tài khoản học sinh')
  return deny('Bạn không có quyền tạo tài khoản này')
}

/** Các thao tác người thao tác được làm trên một tài khoản có sẵn trong đơn vị. */
export function allowedActions(actor: Actor, target: TargetMember): ManageAction[] {
  if (target.userId === actor.userId) return []
  if (actor.isSuperAdmin) return ['reset_password', 'set_status', 'update_profile', 'change_role', 'delete']
  if (target.isSuperAdmin) return []
  if (actor.role === 'org_admin') {
    if (target.role === 'org_admin') return []
    return ['reset_password', 'set_status', 'update_profile', 'change_role', 'delete']
  }
  if (actor.role === 'teacher' && target.role === 'student' && target.createdBy === actor.userId) {
    return ['reset_password', 'update_profile']
  }
  return []
}

export function canManageAccount(
  actor: Actor,
  target: TargetMember,
  action: ManageAction,
  newRole?: OrgRole,
): Decision {
  if (target.userId === actor.userId) {
    return deny('Không tự thao tác trên tài khoản của chính mình ở đây (đổi mật khẩu ở menu tài khoản)')
  }
  if (!allowedActions(actor, target).includes(action)) {
    return deny('Bạn không có quyền thao tác trên tài khoản này')
  }
  if (action === 'change_role') {
    if (!newRole) return deny('Thiếu vai trò mới')
    if (!rolesCreatableBy(actor).includes(newRole)) return deny('Bạn không có quyền cấp vai trò này')
  }
  return allow
}

// ---------------------------------------------------------------------------
// Tên đăng nhập
// ---------------------------------------------------------------------------

/** Bỏ dấu tiếng Việt: "Nguyễn Văn Đức" → "Nguyen Van Duc". */
export function stripVietnamese(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

/** Gợi ý tên đăng nhập từ họ tên: "Nguyễn Văn An" → "nguyenvanan". */
export function suggestUsername(fullName: string): string {
  return stripVietnamese(fullName)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 32)
}

export function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Tên đăng nhập cần ít nhất 3 ký tự'
  if (username.length > 32) return 'Tên đăng nhập tối đa 32 ký tự'
  if (!USERNAME_PATTERN.test(username)) {
    return 'Tên đăng nhập chỉ gồm chữ thường không dấu, số, dấu chấm và gạch dưới'
  }
  return null
}

export function usernameToEmail(username: string): string {
  return `${username}@${INTERNAL_EMAIL_DOMAIN}`
}

export function isInternalEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`)
}

/** Ô đăng nhập nhận email hoặc tên đăng nhập → email để gửi cho Supabase Auth. */
export function loginIdToEmail(input: string): string {
  const value = input.trim().toLowerCase()
  return value.includes('@') ? value : usernameToEmail(value)
}

/** Mật khẩu dễ đọc cho học sinh nhỏ, vd "vua4827". Không có chữ dễ nhầm (l, o, 0, 1). */
export function generatePassword(random: () => number = Math.random): string {
  const words = ['vua', 'hau', 'xe', 'ma', 'tuong', 'tot', 'co', 'nuoc']
  const digits = '23456789'
  const word = words[Math.floor(random() * words.length)]
  let tail = ''
  for (let i = 0; i < 4; i++) tail += digits[Math.floor(random() * digits.length)]
  return word + tail
}
