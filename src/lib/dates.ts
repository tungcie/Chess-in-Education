// Tiện ích ngày dạng 'yyyy-mm-dd' (không múi giờ) và giờ 'HH:MM' — tính toán thuần, không phụ thuộc giờ máy.

const VN_OFFSET_MS = 7 * 60 * 60 * 1000

function toUtc(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`)
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Thứ trong tuần theo quy ước app: 0 = Thứ 2 … 6 = Chủ nhật. */
export function weekdayOf(iso: string): number {
  return (toUtc(iso).getUTCDay() + 6) % 7
}

/** Thứ 2 của tuần chứa ngày này. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayOf(iso))
}

/** 'yyyy-mm' */
export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** 'HH:MM' hoặc 'HH:MM:SS' → số phút từ 0h. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** 'HH:MM:SS' → 'HH:MM' */
export function shortTime(time: string): string {
  return time.slice(0, 5)
}

/** Ngày + số phút hiện tại theo giờ Việt Nam. */
export function nowVN(now: Date = new Date()): { date: string; minutes: number } {
  const shifted = new Date(now.getTime() + VN_OFFSET_MS)
  return { date: shifted.toISOString().slice(0, 10), minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() }
}

/** 'Tháng 11/2026' */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `Tháng ${Number(m)}/${y}`
}
