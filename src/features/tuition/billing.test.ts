import { describe, expect, it } from 'vitest'
import { buildTuitionRows, lowPackages, packageUsage, type BillAttendance, type BillMember, type BillPackage } from './billing'

const members: BillMember[] = [
  { id: 'm1', student_id: 's1', class_id: 'c1' }, // Em 1 — theo buổi
  { id: 'm2', student_id: 's2', class_id: 'c1' }, // Em 2 — gói
  { id: 'm3', student_id: 's1', class_id: 'c2' }, // Em 1 học thêm lớp 1-1 — theo buổi
]

const att = (member_id: string, meeting_date: string, status: BillAttendance['status'], fee = 0, billing: BillAttendance['billing'] = 'per_session'): BillAttendance => ({
  member_id,
  meeting_date,
  start_time: '17:30',
  status,
  fee,
  billing,
})

const attendance: BillAttendance[] = [
  att('m1', '2026-10-28', 'present', 150000), // tháng trước
  att('m1', '2026-11-03', 'present', 150000),
  att('m1', '2026-11-05', 'excused', 150000), // có phép → không tính
  att('m1', '2026-11-10', 'absent', 150000), // không phép → tính
  att('m3', '2026-11-04', 'present', 300000),
  att('m2', '2026-11-03', 'present', 0, 'package'),
  att('m2', '2026-11-05', 'absent', 0, 'package'),
  att('m2', '2026-11-10', 'excused', 0, 'package'),
]
const packages: BillPackage[] = [{ id: 'p1', member_id: 'm2', sessions: 3, amount: 450000, purchased_on: '2026-11-01' }]

describe('học phí theo tháng', () => {
  const rows = buildTuitionRows({
    month: '2026-11',
    members,
    attendance,
    packages,
    payments: [
      { student_id: 's1', amount: 150000, paid_on: '2026-11-01' }, // trả tiền tháng 10
      { student_id: 's2', amount: 450000, paid_on: '2026-11-01' },
    ],
  })
  const s1 = rows.find((r) => r.student_id === 's1')!
  const s2 = rows.find((r) => r.student_id === 's2')!

  it('theo buổi: có mặt + vắng không phép, gộp mọi lớp của em', () => {
    expect(s1.monthSessions).toBe(3)
    expect(s1.monthAmount).toBe(150000 + 150000 + 300000)
  })
  it('còn nợ tính từ trước tới nay trừ đã đóng', () => {
    expect(s1.totalCharged).toBe(750000)
    expect(s1.totalPaid).toBe(150000)
    expect(s1.balance).toBe(600000)
  })
  it('gói: tiền gói tính vào phải thu, buổi trừ dần vào gói', () => {
    expect(s2.monthAmount).toBe(0)
    expect(s2.monthPackageSessions).toBe(2)
    expect(s2.monthPackagesBought).toBe(450000)
    expect(s2.balance).toBe(0)
    expect(s2.packages).toEqual([{ member_id: 'm2', total: 3, used: 2, remaining: 1, overflow: 0 }])
  })
  it('gói sắp hết (còn ≤ 2 buổi)', () => {
    expect(lowPackages(rows).map((x) => x.student_id)).toEqual(['s2'])
  })
  it('tháng khác chỉ hiện em còn nợ / còn gói', () => {
    const dec = buildTuitionRows({ month: '2026-12', members, attendance, packages, payments: [] })
    expect(dec.map((r) => [r.student_id, r.monthAmount, r.balance])).toEqual([
      ['s1', 0, 750000],
      ['s2', 0, 450000],
    ])
  })
})

describe('gói buổi', () => {
  it('học vượt gói → báo học nợ buổi', () => {
    const many = [1, 2, 3, 4].map((d) => att('m2', `2026-11-0${d}`, 'present', 0, 'package'))
    expect(packageUsage('m2', packages, many)).toEqual({ member_id: 'm2', total: 3, used: 3, remaining: 0, overflow: 1 })
  })
  it('chưa mua gói', () => {
    expect(packageUsage('m2', [], [])).toEqual({ member_id: 'm2', total: 0, used: 0, remaining: 0, overflow: 0 })
  })
})
