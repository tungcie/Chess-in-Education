// Tính học phí (CLAUDE.md mục 15, bản gọn): hàm thuần, không lưu kết quả vào DB.
//  - Buổi tính tiền = Có mặt hoặc Vắng không phép (Vắng có phép không tính; chưa điểm danh không tính).
//  - Thu theo buổi: cộng `fee` đã chụp ở từng dòng điểm danh.
//  - Gói N buổi: các buổi tính tiền thu theo gói trừ dần vào gói mua sớm nhất còn buổi (cùng học viên-trong-lớp).
//  - Còn nợ = tiền theo buổi + tiền các gói − tổng đã đóng (lần đóng không gắn tháng).
import { monthOf } from '../../lib/dates'

export type AttendanceStatus = 'present' | 'excused' | 'absent'
export type Billing = 'per_session' | 'package'

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: 'Có mặt',
  excused: 'Vắng có phép',
  absent: 'Vắng không phép',
}

export const BILLING_LABELS: Record<Billing, string> = { per_session: 'Theo buổi', package: 'Gói buổi' }

export interface BillAttendance {
  member_id: string
  meeting_date: string
  start_time: string
  status: AttendanceStatus
  fee: number
  billing: Billing
}

export interface BillMember {
  id: string
  student_id: string
  class_id: string
}

export interface BillPackage {
  id: string
  member_id: string
  sessions: number
  amount: number
  purchased_on: string
}

export interface BillPayment {
  student_id: string
  amount: number
  paid_on: string
}

export const isBillable = (status: AttendanceStatus) => status === 'present' || status === 'absent'

export interface PackageUsage {
  member_id: string
  total: number
  used: number
  remaining: number
  /** Buổi tính tiền vượt quá các gói đã mua (học nợ buổi) */
  overflow: number
}

/** Số buổi gói đã dùng / còn lại của 1 học viên-trong-lớp. */
export function packageUsage(memberId: string, packages: BillPackage[], attendance: BillAttendance[]): PackageUsage {
  const total = packages.filter((p) => p.member_id === memberId).reduce((s, p) => s + p.sessions, 0)
  const consumed = attendance.filter((a) => a.member_id === memberId && a.billing === 'package' && isBillable(a.status)).length
  return {
    member_id: memberId,
    total,
    used: Math.min(consumed, total),
    remaining: Math.max(total - consumed, 0),
    overflow: Math.max(consumed - total, 0),
  }
}

export interface StudentTuitionRow {
  student_id: string
  /** Trong tháng đang xem */
  monthSessions: number
  monthAmount: number
  monthPackageSessions: number
  monthPackagesBought: number
  monthPaid: number
  /** Từ trước tới nay */
  totalCharged: number
  totalPaid: number
  balance: number
  packages: PackageUsage[]
}

/**
 * Bảng học phí theo học sinh cho tháng `month` ('yyyy-mm').
 * Chỉ trả học sinh có phát sinh (buổi tính tiền, gói, lần đóng) — ở tháng này hoặc còn nợ / còn gói.
 */
export function buildTuitionRows(input: {
  month: string
  members: BillMember[]
  attendance: BillAttendance[]
  packages: BillPackage[]
  payments: BillPayment[]
}): StudentTuitionRow[] {
  const { month, members, attendance, packages, payments } = input
  const memberById = new Map(members.map((m) => [m.id, m]))
  const rows = new Map<string, StudentTuitionRow>()
  const row = (studentId: string) => {
    let r = rows.get(studentId)
    if (!r) {
      r = {
        student_id: studentId,
        monthSessions: 0,
        monthAmount: 0,
        monthPackageSessions: 0,
        monthPackagesBought: 0,
        monthPaid: 0,
        totalCharged: 0,
        totalPaid: 0,
        balance: 0,
        packages: [],
      }
      rows.set(studentId, r)
    }
    return r
  }

  for (const a of attendance) {
    const member = memberById.get(a.member_id)
    if (!member || !isBillable(a.status)) continue
    const r = row(member.student_id)
    const inMonth = monthOf(a.meeting_date) === month
    if (a.billing === 'per_session') {
      r.totalCharged += a.fee
      if (inMonth) {
        r.monthSessions++
        r.monthAmount += a.fee
      }
    } else if (inMonth) {
      r.monthPackageSessions++
    }
  }

  for (const p of packages) {
    const member = memberById.get(p.member_id)
    if (!member) continue
    const r = row(member.student_id)
    r.totalCharged += p.amount
    if (monthOf(p.purchased_on) === month) r.monthPackagesBought += p.amount
  }

  for (const p of payments) {
    const r = row(p.student_id)
    r.totalPaid += p.amount
    if (monthOf(p.paid_on) === month) r.monthPaid += p.amount
  }

  const packageMembers = new Set([
    ...packages.map((p) => p.member_id),
    ...attendance.filter((a) => a.billing === 'package').map((a) => a.member_id),
  ])
  for (const memberId of packageMembers) {
    const member = memberById.get(memberId)
    if (member) row(member.student_id).packages.push(packageUsage(memberId, packages, attendance))
  }

  for (const r of rows.values()) r.balance = r.totalCharged - r.totalPaid

  return [...rows.values()].filter(
    (r) =>
      r.monthSessions > 0 ||
      r.monthPackageSessions > 0 ||
      r.monthPackagesBought > 0 ||
      r.monthPaid !== 0 ||
      r.balance !== 0 ||
      r.packages.some((p) => p.remaining > 0 || p.overflow > 0),
  )
}

/** Gói sắp hết: còn ≤ `threshold` buổi, hoặc đang học nợ buổi. */
export function lowPackages(rows: StudentTuitionRow[], threshold = 2): Array<{ student_id: string; usage: PackageUsage }> {
  return rows.flatMap((r) =>
    r.packages.filter((p) => p.overflow > 0 || p.remaining <= threshold).map((usage) => ({ student_id: r.student_id, usage })),
  )
}
