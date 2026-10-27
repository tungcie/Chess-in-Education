// Menu theo vai trò (CLAUDE.md mục 11). Hàm thuần — có test, dùng cho menu trái, thanh dưới và chặn đường dẫn.
import type { OrgRole } from '../../../supabase/functions/_shared/accountRules.ts'

export type NavKey =
  | 'overview'
  | 'today'
  | 'calendar'
  | 'students'
  | 'classes'
  | 'curriculum'
  | 'tuition'
  | 'teachers'
  | 'progress'
  | 'accounts'
  | 'org'

export type IconName =
  | 'dashboard'
  | 'sun'
  | 'calendar'
  | 'users'
  | 'school'
  | 'book'
  | 'wallet'
  | 'badge'
  | 'chart'
  | 'key'
  | 'building'

export interface NavItem {
  key: NavKey
  label: string
  /** Nhãn ngắn cho thanh dưới điện thoại */
  shortLabel: string
  path: string
  icon: IconName
  /** Giai đoạn làm chức năng này (CLAUDE.md mục 13) — trang tạm hiện "Sắp có". */
  phase?: number
}

export const NAV: Record<NavKey, NavItem> = {
  overview: { key: 'overview', label: 'Tổng quan', shortLabel: 'Tổng quan', path: '/tong-quan', icon: 'dashboard', phase: 7 },
  today: { key: 'today', label: 'Hôm nay', shortLabel: 'Hôm nay', path: '/hom-nay', icon: 'sun' },
  calendar: { key: 'calendar', label: 'Lịch tuần', shortLabel: 'Lịch', path: '/lich', icon: 'calendar' },
  students: { key: 'students', label: 'Học viên', shortLabel: 'Học viên', path: '/hoc-vien', icon: 'users' },
  classes: { key: 'classes', label: 'Lớp học', shortLabel: 'Lớp học', path: '/lop-hoc', icon: 'school' },
  curriculum: { key: 'curriculum', label: 'Giáo trình', shortLabel: 'Giáo trình', path: '/giao-trinh', icon: 'book', phase: 5 },
  tuition: { key: 'tuition', label: 'Học phí', shortLabel: 'Học phí', path: '/hoc-phi', icon: 'wallet' },
  teachers: { key: 'teachers', label: 'Giáo viên', shortLabel: 'Giáo viên', path: '/giao-vien', icon: 'badge', phase: 7 },
  progress: { key: 'progress', label: 'Tiến độ', shortLabel: 'Tiến độ', path: '/tien-do', icon: 'chart', phase: 5 },
  accounts: { key: 'accounts', label: 'Tài khoản', shortLabel: 'Tài khoản', path: '/tai-khoan', icon: 'key' },
  org: { key: 'org', label: 'Đơn vị', shortLabel: 'Đơn vị', path: '/don-vi', icon: 'building' },
}

/** Vai trò dùng cho giao diện: quản trị hệ thống được xem như quản lý đơn vị. */
export type UiRole = OrgRole

const SIDEBAR: Record<UiRole, NavKey[]> = {
  org_admin: ['overview', 'today', 'calendar', 'students', 'classes', 'curriculum', 'tuition', 'teachers', 'accounts', 'org'],
  teacher: ['today', 'calendar', 'classes', 'students', 'accounts'],
  student: ['today', 'calendar', 'classes', 'progress'],
  parent: ['today', 'calendar', 'classes', 'progress'],
}

const BOTTOM: Record<UiRole, NavKey[]> = {
  org_admin: ['today', 'calendar', 'classes', 'students', 'tuition'],
  teacher: ['today', 'calendar', 'classes', 'students'],
  student: ['today', 'calendar', 'progress'],
  parent: ['today', 'calendar', 'progress'],
}

export function sidebarItems(role: UiRole): NavItem[] {
  return SIDEBAR[role].map((k) => NAV[k])
}

export function bottomNavItems(role: UiRole): NavItem[] {
  return BOTTOM[role].map((k) => NAV[k])
}

/** Mục không có ở thanh dưới → đưa vào menu tài khoản trên điện thoại. */
export function overflowItems(role: UiRole): NavItem[] {
  const bottom = new Set(BOTTOM[role])
  return SIDEBAR[role].filter((k) => !bottom.has(k)).map((k) => NAV[k])
}

export function canAccess(role: UiRole, key: NavKey): boolean {
  return SIDEBAR[role].includes(key)
}

/** Trang mở đầu: máy tính của quản lý → Tổng quan; còn lại → Hôm nay. */
export function homePath(role: UiRole, isDesktop: boolean): string {
  return isDesktop && role === 'org_admin' ? NAV.overview.path : NAV.today.path
}

export function navItemForPath(pathname: string): NavItem | undefined {
  return Object.values(NAV).find((item) => pathname === item.path || pathname.startsWith(item.path + '/'))
}
