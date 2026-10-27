import { stripVietnamese, type OrgRole } from '../../../supabase/functions/_shared/accountRules.ts'
import type { MemberRow } from './accountsApi'

export type RoleFilter = 'all' | OrgRole

const ROLE_ORDER: Record<OrgRole, number> = { org_admin: 0, teacher: 1, student: 2, parent: 3 }

const fold = (s: string) => stripVietnamese(s).toLowerCase()

/** Lọc theo vai trò + tìm theo tên / tên đăng nhập / email (không phân biệt dấu); xếp theo vai trò rồi tên. */
export function filterMembers(rows: MemberRow[], role: RoleFilter, search: string): MemberRow[] {
  const q = fold(search.trim())
  return rows
    .filter((r) => role === 'all' || r.role === role)
    .filter((r) => {
      if (!q) return true
      const p = r.profile
      return [p?.full_name, p?.username, p?.email].some((v) => v && fold(v).includes(q))
    })
    .sort(
      (a, b) =>
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        (a.profile?.full_name ?? '').localeCompare(b.profile?.full_name ?? '', 'vi'),
    )
}

export function countByRole(rows: MemberRow[]): Record<RoleFilter, number> {
  const counts: Record<RoleFilter, number> = { all: rows.length, org_admin: 0, teacher: 0, student: 0, parent: 0 }
  for (const r of rows) counts[r.role]++
  return counts
}

/** Tin gửi cho học sinh / phụ huynh sau khi tạo tài khoản. */
export function loginMessage(opts: { fullName: string; loginId: string; password: string; siteUrl: string }): string {
  return [
    `Tài khoản Chess in Education Vietnam của ${opts.fullName}:`,
    `- Địa chỉ: ${opts.siteUrl}`,
    `- Tên đăng nhập: ${opts.loginId}`,
    `- Mật khẩu: ${opts.password}`,
    'Đăng nhập xong nên đổi mật khẩu (menu tài khoản → Đổi mật khẩu).',
  ].join('\n')
}
