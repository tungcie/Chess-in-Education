import { supabase } from '../../lib/supabase'
import { chunk, fetchAll } from '../../lib/fetchAll'
import type { AttendanceStatus, Billing } from '../tuition/billing'
import { topUpMeetings, UPCOMING_BUFFER, type MeetingStatus, type Mode, type NewMeeting, type Slot } from './schedule'

export type ClassKind = 'group' | 'private'
export type ClassStatus = 'active' | 'completed' | 'cancelled'

export interface ClassRow {
  id: string
  org_id: string
  name: string
  kind: ClassKind
  start_date: string
  status: ClassStatus
  location: string | null
  default_fee: number
  notes: string | null
}

export interface SlotRow extends Slot {
  id: string
  class_id: string
}

export interface ClassTeacher {
  id: string
  class_id: string
  teacher_id: string
  profile: { full_name: string } | null
}

export interface ClassSummary extends ClassRow {
  slots: SlotRow[]
  teachers: ClassTeacher[]
  activeMembers: number
}

export interface MemberRow {
  id: string
  class_id: string
  student_id: string
  status: 'active' | 'removed'
  fee_per_session: number
  billing_mode: Billing
  joined_on: string
  left_on: string | null
  full_name: string
}

export interface MeetingRow {
  id: string
  org_id: string
  class_id: string
  meeting_date: string
  start_time: string
  duration_minutes: number
  mode: Mode
  status: MeetingStatus
  taught_by: string | null
  content: string | null
  homework: string | null
  auto_added: boolean
}

export interface AttendanceRow {
  id: string
  meeting_id: string
  member_id: string
  status: AttendanceStatus
  note: string | null
  fee: number
  billing: Billing
}

const CLASS_COLS = 'id, org_id, name, kind, start_date, status, location, default_fee, notes'
const MEETING_COLS =
  'id, org_id, class_id, meeting_date, start_time, duration_minutes, mode, status, taught_by, content, homework, auto_added'

// ---------------------------------------------------------------------------
// Lớp
// ---------------------------------------------------------------------------

export async function listClasses(orgId: string): Promise<ClassSummary[]> {
  const [classes, slots, teachers, members] = await Promise.all([
    fetchAll<ClassRow>((from, to) => supabase.from('classes').select(CLASS_COLS).eq('org_id', orgId).order('id').range(from, to)),
    fetchAll<SlotRow>((from, to) =>
      supabase
        .from('class_schedule_slots')
        .select('id, class_id, weekday, start_time, duration_minutes, mode')
        .eq('org_id', orgId)
        .order('id')
        .range(from, to),
    ),
    fetchAll<ClassTeacher>((from, to) =>
      supabase
        .from('class_teachers')
        .select('id, class_id, teacher_id, profile:profiles(full_name)')
        .eq('org_id', orgId)
        .order('id')
        .range(from, to)
        .then(({ data, error }) => ({ data: data as unknown as ClassTeacher[] | null, error })),
    ),
    fetchAll<{ id: string; class_id: string }>((from, to) =>
      supabase.from('class_members').select('id, class_id').eq('org_id', orgId).eq('status', 'active').order('id').range(from, to),
    ),
  ])
  return classes.map((c) => ({
    ...c,
    slots: slots.filter((s) => s.class_id === c.id),
    teachers: teachers.filter((t) => t.class_id === c.id),
    activeMembers: members.filter((m) => m.class_id === c.id).length,
  }))
}

export async function getClass(id: string): Promise<ClassSummary | null> {
  const { data, error } = await supabase.from('classes').select(CLASS_COLS).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const [slots, teachers] = await Promise.all([
    supabase.from('class_schedule_slots').select('id, class_id, weekday, start_time, duration_minutes, mode').eq('class_id', id).order('weekday').limit(50),
    supabase.from('class_teachers').select('id, class_id, teacher_id, profile:profiles(full_name)').eq('class_id', id).order('created_at').limit(50),
  ])
  if (slots.error) throw slots.error
  if (teachers.error) throw teachers.error
  return {
    ...(data as ClassRow),
    slots: (slots.data ?? []) as SlotRow[],
    teachers: (teachers.data ?? []) as unknown as ClassTeacher[],
    activeMembers: 0,
  }
}

export interface ClassInput {
  name: string
  kind: ClassKind
  start_date: string
  location: string
  default_fee: number
  notes: string
}

export async function createClass(
  orgId: string,
  input: ClassInput,
  slots: Slot[],
  teacherIds: string[],
  meetings: NewMeeting[],
): Promise<string> {
  const { data, error } = await supabase.rpc('create_class', {
    p_org_id: orgId,
    p_class: input,
    p_slots: slots,
    p_teacher_ids: teacherIds,
    p_meetings: meetings,
  })
  if (error) throw error
  return data as string
}

export async function updateClass(id: string, input: ClassInput & { status: ClassStatus }): Promise<void> {
  const { data, error } = await supabase
    .from('classes')
    .update({
      name: input.name.trim(),
      kind: input.kind,
      start_date: input.start_date,
      location: input.location.trim() || null,
      default_fee: input.default_fee,
      notes: input.notes.trim() || null,
      status: input.status,
    })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Bạn không có quyền sửa lớp này')
}

export async function setClassSlots(classId: string, slots: Slot[]): Promise<void> {
  const { error } = await supabase.rpc('set_class_slots', { p_class_id: classId, p_slots: slots })
  if (error) throw error
}

export async function setClassTeachers(orgId: string, classId: string, current: ClassTeacher[], teacherIds: string[]): Promise<void> {
  const remove = current.filter((t) => !teacherIds.includes(t.teacher_id)).map((t) => t.id)
  const add = teacherIds.filter((id) => !current.some((t) => t.teacher_id === id))
  if (remove.length) {
    const { error } = await supabase.from('class_teachers').delete().in('id', remove)
    if (error) throw error
  }
  if (add.length) {
    const { error } = await supabase
      .from('class_teachers')
      .insert(add.map((teacher_id) => ({ org_id: orgId, class_id: classId, teacher_id })))
    if (error) throw error
  }
}

export async function deleteClass(id: string): Promise<void> {
  const { data, error } = await supabase.from('classes').delete().eq('id', id).select('id')
  if (error) {
    if (error.code === '23503') throw new Error('Lớp đã có điểm danh / học phí — chuyển "Đã kết thúc" thay vì xóa')
    throw error
  }
  if (!data?.length) throw new Error('Bạn không có quyền xóa lớp này')
}

/** Giáo viên / quản lý của đơn vị để phân công (danh sách nhỏ). */
export async function listTeacherOptions(orgId: string): Promise<Array<{ user_id: string; full_name: string; role: string }>> {
  const rows = await fetchAll<{ user_id: string; role: string; profile: { full_name: string } | null }>((from, to) =>
    supabase
      .from('org_members')
      .select('user_id, role, profile:profiles!org_members_user_id_fkey(full_name)')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .in('role', ['teacher', 'org_admin'])
      .order('id')
      .range(from, to)
      .then(({ data, error }) => ({ data: data as unknown as Array<{ user_id: string; role: string; profile: { full_name: string } | null }> | null, error })),
  )
  return rows
    .map((r) => ({ user_id: r.user_id, role: r.role, full_name: r.profile?.full_name || '(chưa đặt tên)' }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'))
}

// ---------------------------------------------------------------------------
// Học viên trong lớp
// ---------------------------------------------------------------------------

/** Tên học viên lấy qua view student_names (CLAUDE.md 12: không embed students). */
async function studentNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  for (const part of chunk([...new Set(ids)])) {
    const { data, error } = await supabase.from('student_names').select('id, full_name').in('id', part).limit(part.length)
    if (error) throw error
    for (const r of data ?? []) names.set(r.id, r.full_name)
  }
  return names
}

export async function listMembers(classId: string): Promise<MemberRow[]> {
  const rows = await fetchAll<Omit<MemberRow, 'full_name'>>((from, to) =>
    supabase
      .from('class_members')
      .select('id, class_id, student_id, status, fee_per_session, billing_mode, joined_on, left_on')
      .eq('class_id', classId)
      .order('id')
      .range(from, to),
  )
  const names = await studentNames(rows.map((r) => r.student_id))
  return rows.map((r) => ({ ...r, full_name: names.get(r.student_id) ?? '(không xem được)' }))
}

export async function addMember(
  orgId: string,
  classId: string,
  studentId: string,
  fee: number,
  billing: Billing,
  existing?: MemberRow,
): Promise<void> {
  // Em từng rời lớp → cho học lại (giữ lịch sử điểm danh)
  const { error } = existing
    ? await supabase
        .from('class_members')
        .update({ status: 'active', left_on: null, fee_per_session: fee, billing_mode: billing })
        .eq('id', existing.id)
    : await supabase
        .from('class_members')
        .insert({ org_id: orgId, class_id: classId, student_id: studentId, fee_per_session: fee, billing_mode: billing })
  if (error) {
    if (error.code === '23505') throw new Error('Em này đã có trong lớp')
    throw error
  }
}

export async function updateMemberFee(id: string, fee: number, billing: Billing): Promise<void> {
  const { data, error } = await supabase
    .from('class_members')
    .update({ fee_per_session: fee, billing_mode: billing })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Bạn không có quyền sửa học phí')
}

export async function removeMember(id: string, today: string): Promise<void> {
  const { data, error } = await supabase
    .from('class_members')
    .update({ status: 'removed', left_on: today })
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Bạn không có quyền cho em rời lớp')
}

// ---------------------------------------------------------------------------
// Buổi học
// ---------------------------------------------------------------------------

export async function listMeetings(classId: string): Promise<MeetingRow[]> {
  return fetchAll<MeetingRow>((from, to) =>
    supabase.from('class_meetings').select(MEETING_COLS).eq('class_id', classId).order('id').range(from, to),
  )
}

export interface MeetingWithClass extends MeetingRow {
  class: { name: string; kind: ClassKind } | null
}

/** Buổi học trong khoảng ngày (Hôm nay, Lịch tuần) — RLS tự lọc theo quyền. */
export async function listMeetingsBetween(orgId: string, from: string, to: string): Promise<MeetingWithClass[]> {
  return fetchAll<MeetingWithClass>((a, b) =>
    supabase
      .from('class_meetings')
      .select(`${MEETING_COLS}, class:classes(name, kind)`)
      .eq('org_id', orgId)
      .gte('meeting_date', from)
      .lte('meeting_date', to)
      .order('id')
      .range(a, b)
      .then(({ data, error }) => ({ data: data as unknown as MeetingWithClass[] | null, error })),
  )
}

export async function getMeeting(id: string): Promise<MeetingWithClass | null> {
  const { data, error } = await supabase.from('class_meetings').select(`${MEETING_COLS}, class:classes(name, kind)`).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as MeetingWithClass | null
}

export type MeetingPatch = Partial<
  Pick<MeetingRow, 'meeting_date' | 'start_time' | 'duration_minutes' | 'mode' | 'status' | 'taught_by' | 'content' | 'homework'>
>

export async function updateMeeting(id: string, patch: MeetingPatch): Promise<void> {
  const { data, error } = await supabase.from('class_meetings').update(patch).eq('id', id).select('id')
  if (error) {
    if (error.code === '23505') throw new Error('Lớp đã có buổi khác đúng ngày giờ này')
    throw error
  }
  if (!data?.length) throw new Error('Bạn không có quyền sửa buổi này')
}

export async function addMeeting(orgId: string, classId: string, m: NewMeeting, status: MeetingStatus = 'scheduled'): Promise<void> {
  const { error } = await supabase.from('class_meetings').insert({ org_id: orgId, class_id: classId, ...m, status })
  if (error) {
    if (error.code === '23505') throw new Error('Lớp đã có buổi đúng ngày giờ này')
    throw error
  }
}

export async function deleteMeeting(id: string): Promise<void> {
  const { data, error } = await supabase.from('class_meetings').delete().eq('id', id).select('id')
  if (error) {
    if (error.code === '23503') throw new Error('Buổi đã có điểm danh — bỏ điểm danh trước khi xóa')
    throw error
  }
  if (!data?.length) throw new Error('Chỉ xóa được buổi chưa dạy')
}

/**
 * Giữ đủ buổi chưa dạy phía trước (CLAUDE.md 6.1). Gọi khi mở trang lớp và sau khi bấm Đã dạy.
 * Trùng (ngày, giờ) do 2 người cùng bấm → DB bỏ qua nhờ unique.
 */
export async function ensureUpcoming(orgId: string, classId: string, slots: Slot[], today: string): Promise<number> {
  const meetings = await listMeetings(classId)
  const add = topUpMeetings(slots, meetings, today)
  if (add.length === 0) return 0
  const { error } = await supabase
    .from('class_meetings')
    .upsert(
      add.map((m) => ({ org_id: orgId, class_id: classId, ...m, status: 'scheduled', auto_added: true })),
      { onConflict: 'class_id,meeting_date,start_time', ignoreDuplicates: true },
    )
  if (error) throw error
  return add.length
}

/** Bỏ "Đã dạy" nhầm: nếu thừa buổi so với mức giữ, xóa buổi tự thêm cuối cùng chưa ai sửa. */
export async function trimAutoAdded(classId: string): Promise<void> {
  const meetings = await listMeetings(classId)
  const scheduled = meetings.filter((m) => m.status === 'scheduled')
  if (scheduled.length <= UPCOMING_BUFFER) return
  const last = scheduled
    .filter((m) => m.auto_added && !m.content && !m.homework)
    .sort((a, b) => b.meeting_date.localeCompare(a.meeting_date) || b.start_time.localeCompare(a.start_time))[0]
  if (last) await supabase.from('class_meetings').delete().eq('id', last.id).eq('status', 'scheduled')
}

// ---------------------------------------------------------------------------
// Điểm danh
// ---------------------------------------------------------------------------

export async function listAttendance(classId: string): Promise<AttendanceRow[]> {
  return fetchAll<AttendanceRow>((from, to) =>
    supabase
      .from('class_attendance')
      .select('id, meeting_id, member_id, status, note, fee, billing')
      .eq('class_id', classId)
      .order('id')
      .range(from, to),
  )
}

export async function listMeetingAttendance(meetingId: string): Promise<AttendanceRow[]> {
  return fetchAll<AttendanceRow>((from, to) =>
    supabase
      .from('class_attendance')
      .select('id, meeting_id, member_id, status, note, fee, billing')
      .eq('meeting_id', meetingId)
      .order('id')
      .range(from, to),
  )
}

/** Chấm / đổi điểm danh (giá + hình thức thu do DB tự chụp). */
export async function markAttendance(
  meeting: { id: string; org_id: string; class_id: string },
  memberId: string,
  status: AttendanceStatus,
  note: string | null,
): Promise<void> {
  const { error } = await supabase.from('class_attendance').upsert(
    { org_id: meeting.org_id, class_id: meeting.class_id, meeting_id: meeting.id, member_id: memberId, status, note },
    { onConflict: 'meeting_id,member_id' },
  )
  if (error) throw error
}

export async function clearAttendance(meetingId: string, memberId: string): Promise<void> {
  const { error } = await supabase.from('class_attendance').delete().eq('meeting_id', meetingId).eq('member_id', memberId)
  if (error) throw error
}
