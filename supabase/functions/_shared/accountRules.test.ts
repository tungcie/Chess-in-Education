import { describe, expect, it } from 'vitest'
import {
  allowedActions,
  canCreateAccount,
  canManageAccount,
  generatePassword,
  isInternalEmail,
  loginIdToEmail,
  rolesCreatableBy,
  suggestUsername,
  validateUsername,
  type Actor,
  type TargetMember,
} from './accountRules.ts'

const superAdmin: Actor = { userId: 's', isSuperAdmin: true, role: null }
const admin: Actor = { userId: 'a', isSuperAdmin: false, role: 'org_admin' }
const teacher: Actor = { userId: 't', isSuperAdmin: false, role: 'teacher' }
const student: Actor = { userId: 'h', isSuperAdmin: false, role: 'student' }
const outsider: Actor = { userId: 'x', isSuperAdmin: false, role: null }

const member = (over: Partial<TargetMember>): TargetMember => ({
  userId: 'm',
  role: 'student',
  createdBy: null,
  isSuperAdmin: false,
  ...over,
})

describe('tạo tài khoản', () => {
  it('mỗi vai trò tạo được đúng các vai trò', () => {
    expect(rolesCreatableBy(superAdmin)).toEqual(['org_admin', 'teacher', 'student', 'parent'])
    expect(rolesCreatableBy(admin)).toEqual(['teacher', 'student', 'parent'])
    expect(rolesCreatableBy(teacher)).toEqual(['student'])
    expect(rolesCreatableBy(student)).toEqual([])
    expect(rolesCreatableBy(outsider)).toEqual([])
  })

  it('giáo viên tạo học sinh được, tạo giáo viên thì bị từ chối kèm lý do', () => {
    expect(canCreateAccount(teacher, 'student')).toEqual({ ok: true })
    expect(canCreateAccount(teacher, 'teacher')).toEqual({
      ok: false,
      reason: 'Giáo viên chỉ tạo được tài khoản học sinh',
    })
  })

  it('quản lý đơn vị không tạo được quản lý khác', () => {
    expect(canCreateAccount(admin, 'org_admin').ok).toBe(false)
    expect(canCreateAccount(superAdmin, 'org_admin').ok).toBe(true)
  })
})

describe('thao tác trên tài khoản có sẵn', () => {
  it('không ai tự khóa / xóa / đổi vai trò chính mình', () => {
    expect(allowedActions(admin, member({ userId: 'a', role: 'org_admin' }))).toEqual([])
    expect(canManageAccount(superAdmin, member({ userId: 's' }), 'delete').ok).toBe(false)
  })

  it('giáo viên chỉ đặt lại mật khẩu / sửa tên học sinh do mình tạo', () => {
    const mine = member({ createdBy: 't' })
    const others = member({ createdBy: 'a' })
    expect(allowedActions(teacher, mine)).toEqual(['reset_password', 'update_profile'])
    expect(allowedActions(teacher, others)).toEqual([])
    expect(canManageAccount(teacher, mine, 'delete').ok).toBe(false)
    expect(allowedActions(teacher, member({ role: 'teacher', createdBy: 't' }))).toEqual([])
  })

  it('quản lý đơn vị không đụng tới quản lý khác hay quản trị hệ thống', () => {
    expect(allowedActions(admin, member({ role: 'org_admin' }))).toEqual([])
    expect(allowedActions(admin, member({ role: 'teacher', isSuperAdmin: true }))).toEqual([])
    expect(allowedActions(admin, member({ role: 'teacher' }))).toContain('delete')
  })

  it('đổi vai trò chỉ sang vai trò mình được cấp', () => {
    const t = member({ role: 'teacher' })
    expect(canManageAccount(admin, t, 'change_role', 'student').ok).toBe(true)
    expect(canManageAccount(admin, t, 'change_role', 'org_admin').ok).toBe(false)
    expect(canManageAccount(admin, t, 'change_role').ok).toBe(false)
    expect(canManageAccount(superAdmin, t, 'change_role', 'org_admin').ok).toBe(true)
  })

  it('học sinh và người ngoài không làm được gì', () => {
    expect(allowedActions(student, member({}))).toEqual([])
    expect(allowedActions(outsider, member({}))).toEqual([])
  })
})

describe('tên đăng nhập', () => {
  it('gợi ý từ họ tên tiếng Việt', () => {
    expect(suggestUsername('Nguyễn Văn Đức')).toBe('nguyenvanduc')
    expect(suggestUsername('  Trần Thị Ánh-Dương 2 ')).toBe('tranthianhduong2')
  })

  it('kiểm tra hợp lệ', () => {
    expect(validateUsername('an.nguyen_2')).toBeNull()
    expect(validateUsername('ab')).toMatch(/ít nhất 3/)
    expect(validateUsername('Nguyen')).toMatch(/chữ thường/)
    expect(validateUsername('đức')).toMatch(/chữ thường/)
  })

  it('ô đăng nhập nhận email hoặc tên đăng nhập', () => {
    expect(loginIdToEmail(' Co.Giao@Gmail.com ')).toBe('co.giao@gmail.com')
    expect(loginIdToEmail('NguyenVanAn')).toBe('nguyenvanan@hs.chessineducation.invalid')
    expect(isInternalEmail('nguyenvanan@hs.chessineducation.invalid')).toBe(true)
    expect(isInternalEmail('a@gmail.com')).toBe(false)
    expect(isInternalEmail(null)).toBe(false)
  })

  it('mật khẩu gợi ý dễ đọc, đủ dài', () => {
    const pw = generatePassword(() => 0)
    expect(pw).toBe('vua2222')
    for (let i = 0; i < 50; i++) expect(generatePassword()).toMatch(/^[a-z]{2,5}[2-9]{4}$/)
  })
})
