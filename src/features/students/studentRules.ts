// Hàm thuần cho hồ sơ học viên: nhãn, tuổi, lọc / tìm.
import { stripVietnamese } from '../../../supabase/functions/_shared/accountRules.ts'

export type StudentStatus = 'active' | 'paused' | 'inactive'
export type Gender = 'male' | 'female'

export const STATUS_LABELS: Record<StudentStatus, string> = {
  active: 'Đang học',
  paused: 'Tạm nghỉ',
  inactive: 'Đã nghỉ',
}

export const STATUS_TONE: Record<StudentStatus, 'ok' | 'warn' | 'muted'> = { active: 'ok', paused: 'warn', inactive: 'muted' }

export const GENDER_LABELS: Record<Gender, string> = { male: 'Nam', female: 'Nữ' }

export interface StudentListItem {
  id: string
  full_name: string
  birth_date: string | null
  school_class: string | null
  level: string | null
  status: StudentStatus
  primaryGuardianPhone: string | null
  primaryGuardianName: string | null
  hasAccount: boolean
}

/** Tuổi tròn tại ngày `today` (yyyy-mm-dd). Không có ngày sinh → null. */
export function ageOn(birthDate: string | null, today: string): number | null {
  if (!birthDate) return null
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  let age = ty - by
  if (tm < bm || (tm === bm && td < bd)) age--
  return age >= 0 ? age : null
}

const fold = (s: string) => stripVietnamese(s).toLowerCase()

export type StatusFilter = 'all' | StudentStatus

/** Lọc theo trạng thái + tìm theo tên / lớp ở trường / trình độ / SĐT phụ huynh (không cần dấu); xếp theo tên (tên gọi trước). */
export function filterStudents(rows: StudentListItem[], status: StatusFilter, search: string): StudentListItem[] {
  const q = fold(search.trim())
  return rows
    .filter((r) => status === 'all' || r.status === status)
    .filter((r) => {
      if (!q) return true
      return [r.full_name, r.school_class, r.level, r.primaryGuardianPhone, r.primaryGuardianName].some(
        (v) => v && fold(v).includes(q),
      )
    })
    .sort((a, b) => compareVietnameseNames(a.full_name, b.full_name))
}

/** Người Việt xếp theo tên gọi (chữ cuối), rồi họ đệm: "Trần Văn An" trước "Lê Thị Bình". */
export function compareVietnameseNames(a: string, b: string): number {
  const key = (name: string) => {
    const parts = name.trim().split(/\s+/)
    return [parts[parts.length - 1] ?? '', parts.slice(0, -1).join(' ')]
  }
  const [ga, ra] = key(a)
  const [gb, rb] = key(b)
  return ga.localeCompare(gb, 'vi') || ra.localeCompare(rb, 'vi')
}

export function countByStatus(rows: StudentListItem[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { all: rows.length, active: 0, paused: 0, inactive: 0 }
  for (const r of rows) counts[r.status]++
  return counts
}
