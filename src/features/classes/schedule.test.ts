import { describe, expect, it } from 'vitest'
import { generateMeetings, meetingTimeStatus, numberMeetings, topUpMeetings, type Slot } from './schedule'

// T3 (1) và T5 (3) 17:30, 90 phút
const slots: Slot[] = [
  { weekday: 3, start_time: '17:30:00', duration_minutes: 90, mode: 'offline' },
  { weekday: 1, start_time: '17:30', duration_minutes: 90, mode: 'offline' },
]

describe('sinh buổi', () => {
  it('16 buổi từ ngày bắt đầu, đúng thứ, đúng thứ tự', () => {
    const ms = generateMeetings(slots, '2026-11-03', 16) // 03/11/2026 là Thứ 3
    expect(ms).toHaveLength(16)
    expect(ms.slice(0, 4).map((m) => m.meeting_date)).toEqual(['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12'])
    expect(ms[0]).toEqual({ meeting_date: '2026-11-03', start_time: '17:30', duration_minutes: 90, mode: 'offline' })
    expect(ms[15].meeting_date).toBe('2026-12-24')
  })
  it('ngày bắt đầu không trùng thứ học thì lấy buổi kế tiếp', () => {
    expect(generateMeetings(slots, '2026-11-04', 1)[0].meeting_date).toBe('2026-11-05')
  })
  it('2 ca trong 1 ngày xếp theo giờ', () => {
    const two: Slot[] = [
      { weekday: 5, start_time: '15:00', duration_minutes: 60, mode: 'offline' },
      { weekday: 5, start_time: '08:00', duration_minutes: 60, mode: 'online' },
    ]
    expect(generateMeetings(two, '2026-10-31', 3).map((m) => `${m.meeting_date} ${m.start_time}`)).toEqual([
      '2026-10-31 08:00',
      '2026-10-31 15:00',
      '2026-11-07 08:00',
    ])
  })
  it('không lịch tuần → không sinh', () => {
    expect(generateMeetings([], '2026-11-03', 16)).toEqual([])
  })
})

describe('giữ đủ buổi phía trước', () => {
  const m = (id: string, date: string, status: 'scheduled' | 'completed' | 'cancelled' = 'scheduled') => ({
    id,
    meeting_date: date,
    start_time: '17:30:00',
    status,
  })
  it('bấm Đã dạy 1 buổi → thêm đúng 1 buổi sau buổi cuối', () => {
    const existing = generateMeetings(slots, '2026-11-03', 16).map((x, i) => m(String(i), x.meeting_date))
    existing[0].status = 'completed'
    const add = topUpMeetings(slots, existing, '2026-11-03')
    expect(add.map((a) => a.meeting_date)).toEqual(['2026-12-29'])
  })
  it('buổi nghỉ không tính là buổi chưa dạy', () => {
    const existing = [m('a', '2026-11-03', 'cancelled')]
    expect(topUpMeetings(slots, existing, '2026-11-03', 2).map((a) => a.meeting_date)).toEqual(['2026-11-05', '2026-11-10'])
  })
  it('lớp lâu không học: không sinh buổi trong quá khứ', () => {
    const existing = [m('a', '2026-01-06', 'completed')]
    expect(topUpMeetings(slots, existing, '2026-11-04', 1)[0].meeting_date).toBe('2026-11-05')
  })
  it('đủ rồi thì không thêm', () => {
    const existing = generateMeetings(slots, '2026-11-03', 16).map((x, i) => m(String(i), x.meeting_date))
    expect(topUpMeetings(slots, existing, '2026-11-03')).toEqual([])
  })
})

describe('đánh số + trạng thái theo giờ', () => {
  it('số buổi theo thứ tự ngày giờ, buổi thêm chen giữa tự đánh lại', () => {
    const list = numberMeetings([
      { id: 'b', meeting_date: '2026-11-05', start_time: '17:30', status: 'scheduled' as const },
      { id: 'a', meeting_date: '2026-11-03', start_time: '17:30', status: 'completed' as const },
      { id: 'bu', meeting_date: '2026-11-04', start_time: '09:00', status: 'scheduled' as const },
    ])
    expect(list.map((x) => `${x.number}:${x.id}`)).toEqual(['1:a', '2:bu', '3:b'])
  })
  it('đang học / sắp tới / quên bấm Đã dạy', () => {
    const base = { meeting_date: '2026-11-03', start_time: '17:30', duration_minutes: 90, status: 'scheduled' as const }
    expect(meetingTimeStatus(base, { date: '2026-11-03', minutes: 17 * 60 + 15 })).toBe('live')
    expect(meetingTimeStatus(base, { date: '2026-11-03', minutes: 17 * 60 + 14 })).toBe('upcoming')
    expect(meetingTimeStatus(base, { date: '2026-11-03', minutes: 19 * 60 + 1 })).toBe('overdue')
    expect(meetingTimeStatus(base, { date: '2026-11-04', minutes: 0 })).toBe('overdue')
    expect(meetingTimeStatus({ ...base, status: 'completed' }, { date: '2026-11-04', minutes: 0 })).toBe('done')
  })
})
