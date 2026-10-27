import { supabase } from '../../lib/supabase'
import { chunk, fetchAll } from '../../lib/fetchAll'
import type { AttendanceStatus, BillAttendance, BillMember, BillPackage, BillPayment, Billing } from './billing'

export interface TuitionMember extends BillMember {
  billing_mode: Billing
  fee_per_session: number
  status: 'active' | 'removed'
}

export interface TuitionPayment extends BillPayment {
  id: string
  method: 'cash' | 'transfer' | 'other'
  note: string | null
  created_at: string
  collector: { full_name: string } | null
}

export interface TuitionPackage extends BillPackage {
  note: string | null
}

export interface TuitionData {
  members: TuitionMember[]
  attendance: BillAttendance[]
  packages: TuitionPackage[]
  payments: TuitionPayment[]
  classNames: Map<string, string>
  studentNames: Map<string, string>
}

/** Đọc toàn bộ dữ liệu học phí của đơn vị (chỉ quản lý — RLS chặn người khác). */
export async function loadTuition(orgId: string): Promise<TuitionData> {
  const [members, attendance, packages, payments, classes] = await Promise.all([
    fetchAll<TuitionMember>((from, to) =>
      supabase
        .from('class_members')
        .select('id, student_id, class_id, billing_mode, fee_per_session, status')
        .eq('org_id', orgId)
        .order('id')
        .range(from, to),
    ),
    fetchAll<{ member_id: string; status: AttendanceStatus; fee: number; billing: Billing; meeting: { meeting_date: string; start_time: string } | null }>(
      (from, to) =>
        supabase
          .from('class_attendance')
          .select('member_id, status, fee, billing, meeting:class_meetings(meeting_date, start_time)')
          .eq('org_id', orgId)
          .order('id')
          .range(from, to)
          .then(({ data, error }) => ({
            data: data as unknown as Array<{ member_id: string; status: AttendanceStatus; fee: number; billing: Billing; meeting: { meeting_date: string; start_time: string } | null }> | null,
            error,
          })),
    ),
    fetchAll<TuitionPackage>((from, to) =>
      supabase
        .from('tuition_packages')
        .select('id, member_id, sessions, amount, purchased_on, note')
        .eq('org_id', orgId)
        .order('id')
        .range(from, to),
    ),
    fetchAll<TuitionPayment>((from, to) =>
      supabase
        .from('tuition_payments')
        .select('id, student_id, amount, paid_on, method, note, created_at, collector:profiles(full_name)')
        .eq('org_id', orgId)
        .order('id')
        .range(from, to)
        .then(({ data, error }) => ({ data: data as unknown as TuitionPayment[] | null, error })),
    ),
    fetchAll<{ id: string; name: string }>((from, to) =>
      supabase.from('classes').select('id, name').eq('org_id', orgId).order('id').range(from, to),
    ),
  ])

  const studentIds = [...new Set([...members.map((m) => m.student_id), ...payments.map((p) => p.student_id)])]
  const studentNames = new Map<string, string>()
  for (const part of chunk(studentIds)) {
    const { data, error } = await supabase.from('student_names').select('id, full_name').in('id', part).limit(part.length)
    if (error) throw error
    for (const r of data ?? []) studentNames.set(r.id, r.full_name)
  }

  return {
    members,
    attendance: attendance
      .filter((a) => a.meeting)
      .map((a) => ({
        member_id: a.member_id,
        status: a.status,
        fee: a.fee,
        billing: a.billing,
        meeting_date: a.meeting!.meeting_date,
        start_time: a.meeting!.start_time,
      })),
    packages,
    payments,
    classNames: new Map(classes.map((c) => [c.id, c.name])),
    studentNames,
  }
}

export async function addPayment(
  orgId: string,
  input: { student_id: string; amount: number; paid_on: string; method: 'cash' | 'transfer' | 'other'; note: string },
): Promise<void> {
  const { error } = await supabase.from('tuition_payments').insert({ org_id: orgId, ...input, note: input.note.trim() || null })
  if (error) throw error
}

export async function addPackage(
  orgId: string,
  input: { member_id: string; sessions: number; amount: number; purchased_on: string; note: string },
): Promise<void> {
  const { error } = await supabase.from('tuition_packages').insert({ org_id: orgId, ...input, note: input.note.trim() || null })
  if (error) throw error
}
