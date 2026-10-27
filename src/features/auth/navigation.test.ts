import { describe, expect, it } from 'vitest'
import { bottomNavItems, canAccess, homePath, navItemForPath, overflowItems, sidebarItems } from './navigation'

const keys = (items: { key: string }[]) => items.map((i) => i.key)

describe('menu theo vai trò', () => {
  it('quản lý thấy đủ mục, có Tài khoản và Đơn vị', () => {
    expect(keys(sidebarItems('org_admin'))).toEqual([
      'overview', 'today', 'calendar', 'students', 'classes', 'curriculum', 'tuition', 'teachers', 'accounts', 'org',
    ])
  })

  it('giáo viên không có Tổng quan, Giáo trình, Đơn vị, Giáo viên, Học phí', () => {
    const items = keys(sidebarItems('teacher'))
    for (const k of ['overview', 'curriculum', 'org', 'teachers', 'tuition']) expect(items).not.toContain(k)
    expect(items).toContain('accounts') // tạo tài khoản học sinh
  })

  it('học sinh / phụ huynh chỉ xem: không có Học viên, Học phí, Tài khoản', () => {
    for (const role of ['student', 'parent'] as const) {
      const items = keys(sidebarItems(role))
      expect(items).toEqual(['today', 'calendar', 'classes', 'progress'])
      expect(canAccess(role, 'accounts')).toBe(false)
      expect(canAccess(role, 'tuition')).toBe(false)
    }
  })

  it('thanh dưới điện thoại', () => {
    expect(keys(bottomNavItems('org_admin'))).toEqual(['today', 'calendar', 'classes', 'students', 'tuition'])
    expect(keys(bottomNavItems('student'))).toEqual(['today', 'calendar', 'progress'])
  })

  it('mục không có ở thanh dưới vào menu tài khoản', () => {
    expect(keys(overflowItems('org_admin'))).toEqual(['overview', 'curriculum', 'teachers', 'accounts', 'org'])
    expect(keys(overflowItems('student'))).toEqual(['classes'])
  })

  it('trang mở đầu', () => {
    expect(homePath('org_admin', true)).toBe('/tong-quan')
    expect(homePath('org_admin', false)).toBe('/hom-nay')
    expect(homePath('teacher', true)).toBe('/hom-nay')
  })

  it('tìm mục theo đường dẫn', () => {
    expect(navItemForPath('/lop-hoc/abc')?.key).toBe('classes')
    expect(navItemForPath('/khong-co')).toBeUndefined()
  })
})
