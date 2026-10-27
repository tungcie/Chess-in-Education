// Edge Function admin-users: tạo / đặt lại mật khẩu / khóa / sửa / đổi vai trò / xóa tài khoản.
// Chạy bằng service_role ở máy chủ; tự kiểm người gọi theo quy tắc ở ../_shared/accountRules.ts.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  canCreateAccount,
  canManageAccount,
  MIN_PASSWORD_LENGTH,
  usernameToEmail,
  validateUsername,
  type Actor,
  type ManageAction,
  type MemberStatus,
  type OrgRole,
  type TargetMember,
} from '../_shared/accountRules.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ROLES: OrgRole[] = ['org_admin', 'teacher', 'student', 'parent']
const STATUSES: MemberStatus[] = ['active', 'disabled']

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new HttpError(400, `Thiếu ${label}`)
  return value.trim()
}

function requirePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự`)
  }
  return value
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

async function loadActor(admin: SupabaseClient, userId: string, orgId: string): Promise<Actor> {
  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userId)
    .maybeSingle()
  if (pErr) throw pErr
  const { data: member, error: mErr } = await admin
    .from('org_members')
    .select('role, status, organizations!inner(status)')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()
  if (mErr) throw mErr
  const org = member?.organizations as unknown as { status: string } | null
  const activeRole = member && member.status === 'active' && org?.status === 'active' ? (member.role as OrgRole) : null
  return { userId, isSuperAdmin: profile?.is_super_admin === true, role: activeRole }
}

async function loadTarget(admin: SupabaseClient, orgId: string, userId: string): Promise<TargetMember> {
  const { data, error } = await admin
    .from('org_members')
    .select('user_id, role, created_by, profiles!org_members_user_id_fkey(is_super_admin)')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(404, 'Không tìm thấy tài khoản trong đơn vị')
  const profile = data.profiles as unknown as { is_super_admin: boolean } | null
  return {
    userId: data.user_id,
    role: data.role as OrgRole,
    createdBy: data.created_by,
    isSuperAdmin: profile?.is_super_admin === true,
  }
}

function check(decision: { ok: true } | { ok: false; reason: string }) {
  if (!decision.ok) throw new HttpError(403, decision.reason)
}

function translateAuthError(message: string): string {
  if (/already (been )?registered|already exists/i.test(message)) {
    return 'Email / tên đăng nhập này đã có tài khoản'
  }
  if (/password/i.test(message)) return 'Mật khẩu chưa đạt yêu cầu (ít nhất 6 ký tự)'
  return message
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST' }, 405)

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !auth.user) throw new HttpError(401, 'Phiên đăng nhập đã hết, hãy đăng nhập lại')

    const body = await req.json().catch(() => {
      throw new HttpError(400, 'Dữ liệu gửi lên không hợp lệ')
    })
    const action = requireString(body.action, 'thao tác')
    const orgId = requireString(body.org_id, 'đơn vị')
    const actor = await loadActor(admin, auth.user.id, orgId)

    if (action === 'create') {
      const role = body.role as OrgRole
      if (!ROLES.includes(role)) throw new HttpError(400, 'Vai trò không hợp lệ')
      check(canCreateAccount(actor, role))

      const fullName = requireString(body.full_name, 'họ tên')
      const password = requirePassword(body.password)
      const email = optionalText(body.email)?.toLowerCase() ?? null
      const username = optionalText(body.username)?.toLowerCase() ?? null
      if (!!email === !!username) throw new HttpError(400, 'Nhập email hoặc tên đăng nhập (chỉ một trong hai)')
      if (username) {
        const invalid = validateUsername(username)
        if (invalid) throw new HttpError(400, invalid)
      }

      // Gắn tài khoản với hồ sơ học viên (không bắt buộc): chỉ học sinh / phụ huynh, hồ sơ cùng đơn vị,
      // người tạo phải xem được hồ sơ đó (quản lý: mọi em; giáo viên: em mình tạo).
      const studentId = optionalText(body.student_id)
      if (studentId) {
        if (role !== 'student' && role !== 'parent') throw new HttpError(400, 'Chỉ tài khoản học sinh / phụ huynh gắn được với hồ sơ')
        const { data: student, error: sErr } = await admin
          .from('students')
          .select('id, created_by')
          .eq('id', studentId)
          .eq('org_id', orgId)
          .maybeSingle()
        if (sErr) throw sErr
        const canLink = actor.isSuperAdmin || actor.role === 'org_admin' || student?.created_by === actor.userId
        if (!student || !canLink) throw new HttpError(403, 'Bạn không có quyền gắn tài khoản với hồ sơ này')
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: email ?? usernameToEmail(username!),
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, username },
      })
      if (createErr || !created.user) throw new HttpError(400, translateAuthError(createErr?.message ?? 'Lỗi tạo tài khoản'))

      const newId = created.user.id
      const phone = optionalText(body.phone)
      if (phone) await admin.from('profiles').update({ phone }).eq('id', newId)

      const { error: memberErr } = await admin
        .from('org_members')
        .insert({ org_id: orgId, user_id: newId, role, created_by: actor.userId })
      if (memberErr) {
        // Không để lại tài khoản mồ côi (có user mà không thuộc đơn vị nào)
        await admin.auth.admin.deleteUser(newId)
        throw memberErr
      }
      if (studentId) {
        const { error: linkErr } = await admin.from('account_students').insert({
          org_id: orgId,
          user_id: newId,
          student_id: studentId,
          relation: role === 'parent' ? 'parent' : 'self',
        })
        if (linkErr) {
          await admin.auth.admin.deleteUser(newId)
          throw linkErr
        }
      }
      return json({ ok: true, user_id: newId })
    }

    const manageActions: ManageAction[] = ['reset_password', 'set_status', 'update_profile', 'change_role', 'delete']
    if (!manageActions.includes(action as ManageAction)) throw new HttpError(400, 'Thao tác không hợp lệ')

    const targetId = requireString(body.user_id, 'tài khoản')
    const target = await loadTarget(admin, orgId, targetId)

    switch (action as ManageAction) {
      case 'reset_password': {
        check(canManageAccount(actor, target, 'reset_password'))
        const { error } = await admin.auth.admin.updateUserById(targetId, { password: requirePassword(body.password) })
        if (error) throw new HttpError(400, translateAuthError(error.message))
        break
      }
      case 'set_status': {
        check(canManageAccount(actor, target, 'set_status'))
        const status = body.status as MemberStatus
        if (!STATUSES.includes(status)) throw new HttpError(400, 'Trạng thái không hợp lệ')
        const { error } = await admin
          .from('org_members')
          .update({ status })
          .eq('org_id', orgId)
          .eq('user_id', targetId)
        if (error) throw error
        break
      }
      case 'update_profile': {
        check(canManageAccount(actor, target, 'update_profile'))
        const { error } = await admin
          .from('profiles')
          .update({ full_name: requireString(body.full_name, 'họ tên'), phone: optionalText(body.phone) })
          .eq('id', targetId)
        if (error) throw error
        break
      }
      case 'change_role': {
        const role = body.role as OrgRole
        if (!ROLES.includes(role)) throw new HttpError(400, 'Vai trò không hợp lệ')
        check(canManageAccount(actor, target, 'change_role', role))
        const { error } = await admin
          .from('org_members')
          .update({ role })
          .eq('org_id', orgId)
          .eq('user_id', targetId)
        if (error) throw error
        break
      }
      case 'delete': {
        check(canManageAccount(actor, target, 'delete'))
        // Còn thuộc đơn vị khác → chỉ gỡ khỏi đơn vị này; không thì xóa hẳn tài khoản.
        const { count, error: countErr } = await admin
          .from('org_members')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', targetId)
          .neq('org_id', orgId)
        if (countErr) throw countErr
        if ((count ?? 0) > 0) {
          const { error } = await admin.from('org_members').delete().eq('org_id', orgId).eq('user_id', targetId)
          if (error) throw error
        } else {
          const { error } = await admin.auth.admin.deleteUser(targetId)
          if (error) throw new HttpError(400, error.message)
        }
        break
      }
    }
    return json({ ok: true })
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status)
    console.error('admin-users', err)
    const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Lỗi không xác định'
    return json({ error: message }, 500)
  }
})
