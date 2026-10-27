import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/fetchAll'
import type { MemberStatus, OrgRole } from '../../../supabase/functions/_shared/accountRules.ts'

export interface MemberRow {
  id: string
  user_id: string
  role: OrgRole
  status: MemberStatus
  created_by: string | null
  created_at: string
  // org_members có 2 khóa ngoại tới profiles (user_id, created_by) → embed phải ghi rõ tên constraint (CLAUDE.md 12)
  profile: { full_name: string; email: string | null; username: string | null; phone: string | null; is_super_admin: boolean } | null
  creator: { full_name: string } | null
}

const MEMBER_SELECT =
  'id, user_id, role, status, created_by, created_at, ' +
  'profile:profiles!org_members_user_id_fkey(full_name, email, username, phone, is_super_admin), ' +
  'creator:profiles!org_members_created_by_fkey(full_name)'

export async function listMembers(orgId: string): Promise<MemberRow[]> {
  return fetchAll<MemberRow>((from, to) =>
    supabase
      .from('org_members')
      .select(MEMBER_SELECT)
      .eq('org_id', orgId)
      .order('id')
      .range(from, to)
      .then(({ data, error }) => ({ data: data as unknown as MemberRow[] | null, error })),
  )
}

export type CreateAccountInput = {
  role: OrgRole
  full_name: string
  password: string
  phone?: string
} & ({ username: string; email?: undefined } | { email: string; username?: undefined })

type AdminUsersBody =
  | ({ action: 'create' } & CreateAccountInput)
  | { action: 'reset_password'; user_id: string; password: string }
  | { action: 'set_status'; user_id: string; status: MemberStatus }
  | { action: 'update_profile'; user_id: string; full_name: string; phone?: string | null }
  | { action: 'change_role'; user_id: string; role: OrgRole }
  | { action: 'delete'; user_id: string }

/** Gọi Edge Function admin-users; lỗi trả về câu tiếng Việt từ máy chủ. */
export async function callAdminUsers(orgId: string, body: AdminUsersBody): Promise<{ ok: true; user_id?: string }> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { ...body, org_id: orgId } })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null)
      throw new Error(payload?.error ?? 'Máy chủ từ chối yêu cầu')
    }
    throw new Error('Không gọi được máy chủ (Edge Function admin-users đã được deploy chưa?)')
  }
  return data
}
