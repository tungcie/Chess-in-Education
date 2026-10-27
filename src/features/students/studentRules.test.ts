import { describe, expect, it } from 'vitest'
import { ageOn, compareVietnameseNames, countByStatus, filterStudents, type StudentListItem } from './studentRules'

const s = (id: string, full_name: string, extra: Partial<StudentListItem> = {}): StudentListItem => ({
  id,
  full_name,
  birth_date: null,
  school_class: null,
  level: null,
  status: 'active',
  primaryGuardianPhone: null,
  primaryGuardianName: null,
  hasAccount: false,
  ...extra,
})

describe('tuổi', () => {
  it('chưa tới sinh nhật trong năm thì chưa tính thêm tuổi', () => {
    expect(ageOn('2017-11-05', '2026-10-27')).toBe(8)
    expect(ageOn('2017-10-27', '2026-10-27')).toBe(9)
    expect(ageOn('2017-01-31', '2026-10-27')).toBe(9)
  })
  it('không có ngày sinh / ngày sinh sau hôm nay', () => {
    expect(ageOn(null, '2026-10-27')).toBeNull()
    expect(ageOn('2027-01-01', '2026-10-27')).toBeNull()
  })
})

describe('xếp tên kiểu Việt Nam', () => {
  it('theo tên gọi rồi họ đệm', () => {
    const names = ['Lê Thị Bình', 'Trần Văn An', 'Nguyễn Minh An', 'Phạm Đức']
    expect([...names].sort(compareVietnameseNames)).toEqual(['Nguyễn Minh An', 'Trần Văn An', 'Lê Thị Bình', 'Phạm Đức'])
  })
})

describe('lọc học viên', () => {
  const rows = [
    s('1', 'Trần Bảo Anh', { school_class: '3A', primaryGuardianPhone: '0912345678' }),
    s('2', 'Lê Minh Đức', { status: 'paused', level: 'Sơ cấp' }),
    s('3', 'Phạm Đức Huy', { status: 'inactive' }),
  ]
  it('theo trạng thái', () => {
    expect(filterStudents(rows, 'active', '').map((r) => r.id)).toEqual(['1'])
    expect(filterStudents(rows, 'all', '').map((r) => r.id)).toEqual(['1', '2', '3'])
  })
  it('tìm không dấu theo tên, lớp, trình độ, SĐT phụ huynh', () => {
    expect(filterStudents(rows, 'all', 'duc').map((r) => r.id)).toEqual(['2', '3'])
    expect(filterStudents(rows, 'all', '3a').map((r) => r.id)).toEqual(['1'])
    expect(filterStudents(rows, 'all', 'so cap').map((r) => r.id)).toEqual(['2'])
    expect(filterStudents(rows, 'all', '0912').map((r) => r.id)).toEqual(['1'])
  })
  it('đếm theo trạng thái', () => {
    expect(countByStatus(rows)).toEqual({ all: 3, active: 1, paused: 1, inactive: 1 })
  })
})
