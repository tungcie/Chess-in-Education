import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/fetchAll'
import type { Gender, StudentListItem, StudentStatus } from './studentRules'

/** Hồ sơ đọc qua view student_profiles (mọi vai trò; DB tự lọc theo quyền). */
export interface StudentProfile {
  id: string
  org_id: string
  full_name: string
  birth_date: string | null
  gender: Gender | null
  address: string | null
  school_class: string | null
  phone: string | null
  email: string | null
  level: string | null
  start_date: string
  status: StudentStatus
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface Guardian {
  id: string
  org_id: string
  student_id: string
  full_name: string
  relation: string | null
  phone: string | null
  zalo_name: string | null
  is_primary: boolean
}

export interface LinkedAccount {
  id: string
  user_id: string
  relation: 'self' | 'parent'
  profile: { full_name: string; username: string | null; email: string | null } | null
}

const PROFILE_COLS =
  'id, org_id, full_name, birth_date, gender, address, school_class, phone, email, level, start_date, status, notes, created_by, created_at'

export async function listStudents(orgId: string): Promise<StudentListItem[]> {
  const [profiles, guardians, links] = await Promise.all([
    fetchAll<StudentProfile>((from, to) =>
      supabase.from('student_profiles').select(PROFILE_COLS).eq('org_id', orgId).order('id').range(from, to),
    ),
    fetchAll<Guardian>((from, to) =>
      supabase.from('guardians').select('id, student_id, full_name, phone, is_primary').eq('org_id', orgId).order('id').range(from, to)
        .then(({ data, error }) => ({ data: data as Guardian[] | null, error })),
    ),
    fetchAll<{ id: string; student_id: string }>((from, to) =>
      supabase.from('account_students').select('id, student_id').eq('org_id', orgId).order('id').range(from, to),
    ),
  ])

  const primary = new Map<string, Guardian>()
  for (const g of guardians) {
    if (g.is_primary || !primary.has(g.student_id)) primary.set(g.student_id, g)
  }
  const withAccount = new Set(links.map((l) => l.student_id))

  return profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    birth_date: p.birth_date,
    school_class: p.school_class,
    level: p.level,
    status: p.status,
    primaryGuardianName: primary.get(p.id)?.full_name ?? null,
    primaryGuardianPhone: primary.get(p.id)?.phone ?? null,
    hasAccount: withAccount.has(p.id),
  }))
}

export async function getStudent(id: string): Promise<StudentProfile | null> {
  const { data, error } = await supabase.from('student_profiles').select(PROFILE_COLS).eq('id', id).maybeSingle()
  if (error) throw error
  return data as StudentProfile | null
}

export async function listGuardians(studentId: string): Promise<Guardian[]> {
  // 1 em chỉ có vài phụ huynh
  const { data, error } = await supabase
    .from('guardians')
    .select('id, org_id, student_id, full_name, relation, phone, zalo_name, is_primary')
    .eq('student_id', studentId)
    .order('is_primary', { ascending: false })
    .order('created_at')
    .limit(20)
  if (error) throw error
  return (data ?? []) as Guardian[]
}

export async function listLinkedAccounts(studentId: string): Promise<LinkedAccount[]> {
  const { data, error } = await supabase
    .from('account_students')
    .select('id, user_id, relation, profile:profiles(full_name, username, email)')
    .eq('student_id', studentId)
    .order('created_at')
    .limit(20)
  if (error) throw error
  return (data ?? []) as unknown as LinkedAccount[]
}

/** Dữ liệu form hồ sơ (chuỗi rỗng = để trống). */
export interface StudentInput {
  full_name: string
  birth_date: string
  gender: '' | Gender
  address: string
  school_class: string
  phone: string
  email: string
  level: string
  start_date: string
  notes: string
}

export interface GuardianInput {
  full_name: string
  relation: string
  phone: string
  zalo_name: string
}

const blankToNull = (v: string) => (v.trim() === '' ? null : v.trim())

/** Tạo hồ sơ qua RPC (quản lý + giáo viên); trả id hồ sơ mới. */
export async function createStudent(orgId: string, input: StudentInput, guardian: GuardianInput | null): Promise<string> {
  const { data, error } = await supabase.rpc('create_student', {
    p_org_id: orgId,
    p_student: input,
    p_guardian: guardian && guardian.full_name.trim() ? guardian : null,
  })
  if (error) throw error
  return data as string
}

/** Sửa hồ sơ (chỉ quản lý — RLS chặn người khác; 0 dòng → báo lỗi). */
export async function updateStudent(id: string, input: StudentInput): Promise<void> {
  const { data, error } = await supabase
    .from('students')
    .update({
      full_name: input.full_name.trim(),
      birth_date: blankToNull(input.birth_date),
      gender: input.gender || null,
      address: blankToNull(input.address),
      school_class: blankToNull(input.school_class),
      phone: blankToNull(input.phone),
      email: blankToNull(input.email.toLowerCase()),
      level: blankToNull(input.level),
      start_date: input.start_date || undefined,
      notes: blankToNull(input.notes),
    })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Bạn không có quyền sửa hồ sơ này')
}

export async function setStudentStatus(id: string, status: StudentStatus): Promise<void> {
  const { data, error } = await supabase.from('students').update({ status }).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Bạn không có quyền đổi trạng thái')
}

export async function deleteStudent(id: string): Promise<void> {
  const { data, error } = await supabase.from('students').delete().eq('id', id).select('id')
  if (error) {
    if (error.code === '23503') throw new Error('Em đã có điểm danh / học phí — chuyển “Đã nghỉ” thay vì xóa để giữ lịch sử')
    throw error
  }
  if (!data?.length) throw new Error('Bạn không có quyền xóa hồ sơ này')
}

export async function saveGuardian(
  orgId: string,
  studentId: string,
  input: GuardianInput & { is_primary: boolean },
  id?: string,
): Promise<void> {
  const row = {
    full_name: input.full_name.trim(),
    relation: blankToNull(input.relation),
    phone: blankToNull(input.phone),
    zalo_name: blankToNull(input.zalo_name),
    is_primary: input.is_primary,
  }
  if (input.is_primary) {
    // Mỗi em 1 phụ huynh chính
    let others = supabase.from('guardians').update({ is_primary: false }).eq('student_id', studentId)
    if (id) others = others.neq('id', id)
    const { error } = await others
    if (error) throw error
  }
  const { data, error } = id
    ? await supabase.from('guardians').update(row).eq('id', id).select('id')
    : await supabase.from('guardians').insert({ ...row, org_id: orgId, student_id: studentId }).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Bạn không có quyền sửa phụ huynh')
}

export async function deleteGuardian(id: string): Promise<void> {
  const { data, error } = await supabase.from('guardians').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Bạn không có quyền xóa phụ huynh')
}

export async function unlinkAccount(linkId: string): Promise<void> {
  const { data, error } = await supabase.from('account_students').delete().eq('id', linkId).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Bạn không có quyền gỡ tài khoản')
}

export interface StudentClass {
  id: string
  status: 'active' | 'removed'
  class: { id: string; name: string; kind: 'group' | 'private'; status: string } | null
}

/** Các lớp em đang / đã học (1 em chỉ vài lớp). */
export async function listStudentClasses(studentId: string): Promise<StudentClass[]> {
  const { data, error } = await supabase
    .from('class_members')
    .select('id, status, class:classes(id, name, kind, status)')
    .eq('student_id', studentId)
    .order('created_at')
    .limit(50)
  if (error) throw error
  return (data ?? []) as unknown as StudentClass[]
}
