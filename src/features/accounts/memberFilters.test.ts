import { describe, expect, it } from 'vitest'
import type { MemberRow } from './accountsApi'
import { countByRole, filterMembers, loginMessage } from './memberFilters'

const row = (id: string, role: MemberRow['role'], full_name: string, username: string | null = null): MemberRow => ({
  id,
  user_id: id,
  role,
  status: 'active',
  created_by: null,
  created_at: '2026-10-27T00:00:00Z',
  profile: { full_name, email: null, username, phone: null, is_super_admin: false },
  creator: null,
})

const rows = [
  row('1', 'student', 'Trần Bảo Anh', 'baoanh'),
  row('2', 'teacher', 'Lê Văn Đức'),
  row('3', 'org_admin', 'Nguyễn Thị Hà'),
  row('4', 'student', 'Phạm Minh Đức', 'minhduc'),
]

describe('lọc tài khoản', () => {
  it('xếp quản lý → giáo viên → học sinh, trong nhóm theo tên', () => {
    expect(filterMembers(rows, 'all', '').map((r) => r.id)).toEqual(['3', '2', '4', '1'])
  })

  it('tìm không cần gõ dấu', () => {
    expect(filterMembers(rows, 'all', 'duc').map((r) => r.id)).toEqual(['2', '4'])
    expect(filterMembers(rows, 'student', 'Đức').map((r) => r.id)).toEqual(['4'])
    expect(filterMembers(rows, 'all', 'baoanh').map((r) => r.id)).toEqual(['1'])
  })

  it('đếm theo vai trò', () => {
    expect(countByRole(rows)).toEqual({ all: 4, org_admin: 1, teacher: 1, student: 2, parent: 0 })
  })

  it('tin nhắn thông tin đăng nhập', () => {
    const text = loginMessage({ fullName: 'Bảo Anh', loginId: 'baoanh', password: 'vua2345', siteUrl: 'https://app.vn' })
    expect(text).toContain('Tên đăng nhập: baoanh')
    expect(text).toContain('Mật khẩu: vua2345')
  })
})
