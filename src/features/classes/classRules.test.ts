import { describe, expect, it } from 'vitest'
import { scheduleSummary, timeRange } from './classRules'

describe('hiển thị lịch', () => {
  it('gộp các ngày cùng giờ', () => {
    expect(
      scheduleSummary([
        { weekday: 3, start_time: '17:30:00', duration_minutes: 90, mode: 'offline' },
        { weekday: 1, start_time: '17:30', duration_minutes: 90, mode: 'offline' },
        { weekday: 5, start_time: '08:00', duration_minutes: 60, mode: 'online' },
      ]),
    ).toBe('T3, T5 · 17:30 · 90 phút | T7 · 08:00 · 60 phút')
    expect(scheduleSummary([])).toBe('Chưa có lịch tuần')
  })
  it('giờ bắt đầu – kết thúc', () => {
    expect(timeRange('17:30:00', 90)).toBe('17:30–19:00')
    expect(timeRange('23:30', 60)).toBe('23:30–00:30')
  })
})
