import { describe, expect, it } from 'vitest'
import { currentMonthVN, formatDate, formatDateTimeVN, formatMoney, todayVN } from './format'

describe('giờ Việt Nam', () => {
  it('23:30 UTC đã là ngày hôm sau ở Việt Nam', () => {
    expect(todayVN(new Date('2026-10-27T23:30:00Z'))).toBe('2026-10-28')
    expect(todayVN(new Date('2026-10-27T16:59:00Z'))).toBe('2026-10-27')
  })

  it('đầu tháng theo giờ Việt Nam', () => {
    expect(currentMonthVN(new Date('2026-10-31T18:00:00Z'))).toBe('2026-11-01')
  })

  it('hiển thị ngày giờ', () => {
    expect(formatDate('2026-10-27')).toBe('27/10/2026')
    expect(formatDate(null)).toBe('')
    expect(formatDateTimeVN('2026-10-27T01:05:00Z')).toBe('27/10/2026 08:05')
  })
})

describe('tiền', () => {
  it('chấm ngăn nghìn, khoảng trắng không ngắt trước ₫', () => {
    expect(formatMoney(250000)).toBe('250.000 ₫')
    expect(formatMoney(1500000)).toBe('1.500.000 ₫')
    expect(formatMoney(0)).toBe('0 ₫')
    expect(formatMoney(-50000)).toBe('-50.000 ₫')
  })
})
