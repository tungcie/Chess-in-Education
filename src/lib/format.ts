// Định dạng ngày / tiền và mốc thời gian theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè).
// Không gọi new Date() rải rác để lấy "hôm nay" — dùng todayVN().

const VN_OFFSET_MS = 7 * 60 * 60 * 1000

/** Ngày hôm nay ở Việt Nam, dạng yyyy-mm-dd. */
export function todayVN(now: Date = new Date()): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
}

/** Tháng hiện tại ở Việt Nam, dạng yyyy-mm-01. */
export function currentMonthVN(now: Date = new Date()): string {
  return todayVN(now).slice(0, 8) + '01'
}

/** '2026-10-27' → '27/10/2026'. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Mốc thời gian (timestamptz) → 'dd/mm/yyyy hh:mm' giờ Việt Nam. */
export function formatDateTimeVN(ts: string | null | undefined): string {
  if (!ts) return ''
  const shifted = new Date(new Date(ts).getTime() + VN_OFFSET_MS).toISOString()
  return `${formatDate(shifted)} ${shifted.slice(11, 16)}`
}

/** 250000 → '250.000 ₫' (khoảng trắng không ngắt trước ₫). */
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const digits = Math.abs(Math.round(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${digits}\u00a0₫`
}

/** 0 = Thứ 2 … 6 = Chủ nhật. */
export const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'] as const
export const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const
