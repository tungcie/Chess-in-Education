// Sinh buổi học theo lịch tuần, giữ đủ buổi chưa dạy phía trước, đánh số buổi, trạng thái theo giờ (CLAUDE.md mục 6).
import { addDays, timeToMinutes, weekdayOf } from '../../lib/dates'

export const UPCOMING_BUFFER = 16

export type Mode = 'offline' | 'online'
export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled'

export interface Slot {
  weekday: number
  start_time: string
  duration_minutes: number
  mode: Mode
}

export interface NewMeeting {
  meeting_date: string
  start_time: string
  duration_minutes: number
  mode: Mode
}

export interface MeetingLike {
  id: string
  meeting_date: string
  start_time: string
  status: MeetingStatus
}

const key = (date: string, time: string) => `${date} ${time.slice(0, 5)}`

/**
 * Sinh `count` buổi theo lịch tuần, bắt đầu từ ngày `from` (tính cả ngày đó), bỏ các (ngày, giờ) đã có.
 * Trong một ngày xếp theo giờ. Không có lịch tuần → [].
 */
export function generateMeetings(slots: Slot[], from: string, count: number, existing: Set<string> = new Set()): NewMeeting[] {
  if (slots.length === 0 || count <= 0) return []
  const out: NewMeeting[] = []
  const bySlotTime = [...slots].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
  // Giới hạn an toàn: tối đa ~10 năm
  for (let day = from, i = 0; out.length < count && i < 3700; day = addDays(day, 1), i++) {
    const wd = weekdayOf(day)
    for (const s of bySlotTime) {
      if (s.weekday !== wd || existing.has(key(day, s.start_time))) continue
      out.push({ meeting_date: day, start_time: s.start_time.slice(0, 5), duration_minutes: s.duration_minutes, mode: s.mode })
      if (out.length === count) break
    }
  }
  return out
}

/**
 * Buổi cần thêm để luôn còn `buffer` buổi chưa dạy: thêm sau buổi muộn nhất (không sinh buổi trong quá khứ).
 */
export function topUpMeetings(
  slots: Slot[],
  meetings: MeetingLike[],
  today: string,
  buffer = UPCOMING_BUFFER,
): NewMeeting[] {
  const scheduled = meetings.filter((m) => m.status === 'scheduled').length
  const need = buffer - scheduled
  if (need <= 0) return []
  const last = meetings.reduce<string | null>((max, m) => (max === null || m.meeting_date > max ? m.meeting_date : max), null)
  const afterLast = last ? addDays(last, 1) : today
  const from = afterLast > today ? afterLast : today
  return generateMeetings(slots, from, need, new Set(meetings.map((m) => key(m.meeting_date, m.start_time))))
}

/** Xếp buổi theo (ngày, giờ) và đánh số 1, 2, 3… — số buổi luôn đúng thứ tự ngày. */
export function numberMeetings<T extends MeetingLike>(meetings: T[]): Array<T & { number: number }> {
  return [...meetings]
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date) || a.start_time.localeCompare(b.start_time))
    .map((m, i) => ({ ...m, number: i + 1 }))
}

export type TimeStatus = 'live' | 'upcoming' | 'done' | 'cancelled' | 'overdue'

/** Trạng thái theo giờ cho màn Hôm nay: Đang học từ 15 phút trước giờ học tới hết giờ; qua giờ chưa bấm Đã dạy = overdue. */
export function meetingTimeStatus(
  m: { meeting_date: string; start_time: string; duration_minutes: number; status: MeetingStatus },
  now: { date: string; minutes: number },
): TimeStatus {
  if (m.status === 'cancelled') return 'cancelled'
  if (m.status === 'completed') return 'done'
  if (m.meeting_date < now.date) return 'overdue'
  if (m.meeting_date > now.date) return 'upcoming'
  const start = timeToMinutes(m.start_time)
  const end = start + m.duration_minutes
  if (now.minutes > end) return 'overdue'
  if (now.minutes >= start - 15) return 'live'
  return 'upcoming'
}
