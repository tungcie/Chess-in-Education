// Nhãn + tóm tắt hiển thị cho lớp / buổi (hàm thuần).
import { WEEKDAY_SHORT } from '../../lib/format'
import { shortTime } from '../../lib/dates'
import type { MeetingStatus, Slot, TimeStatus } from './schedule'

export const KIND_LABELS = { group: 'Lớp nhóm', private: 'Kèm 1-1' } as const
export const CLASS_STATUS_LABELS = { active: 'Đang học', completed: 'Đã kết thúc', cancelled: 'Đã hủy' } as const
export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Chưa dạy',
  completed: 'Đã dạy',
  cancelled: 'Đã nghỉ',
}
export const TIME_STATUS_LABELS: Record<TimeStatus, string> = {
  live: 'Đang học',
  upcoming: 'Sắp tới',
  done: 'Đã dạy',
  cancelled: 'Nghỉ',
  overdue: 'Chưa bấm Đã dạy',
}
export const MODE_LABELS = { offline: 'Trực tiếp', online: 'Online' } as const

/** "T3, T5 · 17:30 · 90 phút" — gộp các ca cùng giờ + thời lượng. */
export function scheduleSummary(slots: Slot[]): string {
  if (slots.length === 0) return 'Chưa có lịch tuần'
  const groups = new Map<string, number[]>()
  for (const s of slots) {
    const k = `${shortTime(s.start_time)} · ${s.duration_minutes} phút`
    groups.set(k, [...(groups.get(k) ?? []), s.weekday])
  }
  return [...groups.entries()]
    .map(([k, days]) => `${[...days].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).join(', ')} · ${k}`)
    .join(' | ')
}

/** "17:30–19:00" */
export function timeRange(start: string, minutes: number): string {
  const [h, m] = start.split(':').map(Number)
  const end = h * 60 + m + minutes
  return `${shortTime(start)}–${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
}
