import { describe, expect, it } from 'vitest'
import { addDays, addMonths, monthLabel, nowVN, startOfWeek, timeToMinutes, weekdayOf } from './dates'

describe('ngày', () => {
  it('cộng ngày qua tháng / năm', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('thứ: 0 = Thứ 2 … 6 = Chủ nhật', () => {
    expect(weekdayOf('2026-10-26')).toBe(0) // Thứ 2
    expect(weekdayOf('2026-11-01')).toBe(6) // Chủ nhật
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26')
  })
  it('tháng', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(monthLabel('2026-11')).toBe('Tháng 11/2026')
  })
  it('giờ', () => {
    expect(timeToMinutes('17:30:00')).toBe(1050)
    expect(nowVN(new Date('2026-10-27T10:05:00Z'))).toEqual({ date: '2026-10-27', minutes: 17 * 60 + 5 })
    expect(nowVN(new Date('2026-10-27T18:00:00Z'))).toEqual({ date: '2026-10-28', minutes: 60 })
  })
})
