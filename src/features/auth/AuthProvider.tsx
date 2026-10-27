import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import type { Actor, OrgRole } from '../../../supabase/functions/_shared/accountRules.ts'

export interface Organization {
  id: string
  name: string
  slug: string
  kind: 'school' | 'club' | 'center'
  status: 'active' | 'suspended'
  address: string | null
  phone: string | null
  logo_url: string | null
}

export interface Profile {
  id: string
  full_name: string
  email: string | null
  username: string | null
  phone: string | null
  is_super_admin: boolean
}

interface MembershipRow {
  role: OrgRole
  status: 'active' | 'disabled'
  created_at: string
  organizations: Organization | null
}

export type AuthStatus = 'loading' | 'signedOut' | 'noAccess' | 'noOrg' | 'ready' | 'error'

interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  profile: Profile | null
  /** Đơn vị đang dùng (hiện tại app chạy 1 đơn vị — CLAUDE.md 4.1). */
  org: Organization | null
  /** Vai trò cho giao diện: quản trị hệ thống được xem như quản lý. */
  role: OrgRole | null
  isSuperAdmin: boolean
  /** Dùng cho quy tắc tài khoản (accountRules). */
  actor: Actor | null
  error: Error | null
  signOut: () => Promise<void>
  reload: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ME_SELECT = 'id, full_name, email, username, phone, is_super_admin'

async function loadMe(userId: string) {
  const { data: profile, error: pErr } = await supabase.from('profiles').select(ME_SELECT).eq('id', userId).maybeSingle()
  if (pErr) throw pErr

  // Số dòng thành viên của 1 người luôn nhỏ (vài đơn vị) — .limit để không vướng bẫy 1.000 dòng.
  const { data: memberships, error: mErr } = await supabase
    .from('org_members')
    .select('role, status, created_at, organizations(id, name, slug, kind, status, address, phone, logo_url)')
    .eq('user_id', userId)
    .order('created_at')
    .limit(50)
  if (mErr) throw mErr

  const rows = (memberships ?? []) as unknown as MembershipRow[]
  const active = rows.find((m) => m.status === 'active' && m.organizations?.status === 'active') ?? null

  let org = active?.organizations ?? null
  if (!org && profile?.is_super_admin) {
    const { data: first, error: oErr } = await supabase
      .from('organizations')
      .select('id, name, slug, kind, status, address, phone, logo_url')
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (oErr) throw oErr
    org = (first as Organization | null) ?? null
  }

  return {
    profile: (profile as Profile | null) ?? null,
    org,
    membershipRole: active?.role ?? null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const lastUserId = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      lastUserId.current = data.session?.user.id ?? null
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // Đổi người dùng / đăng xuất → xóa hết cache để người sau không thấy dữ liệu người trước.
      const nextId = next?.user.id ?? null
      if (event === 'SIGNED_OUT' || nextId !== lastUserId.current) queryClient.clear()
      lastUserId.current = nextId
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null
  const me = useQuery({
    queryKey: ['me', userId],
    queryFn: () => loadMe(userId!),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })

  const signOut = useCallback(async () => {
    queryClient.clear()
    await supabase.auth.signOut()
    queryClient.clear()
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const profile = me.data?.profile ?? null
    const isSuperAdmin = profile?.is_super_admin === true
    const membershipRole = me.data?.membershipRole ?? null
    const org = me.data?.org ?? null
    const role: OrgRole | null = isSuperAdmin ? 'org_admin' : membershipRole

    let status: AuthStatus
    if (!sessionLoaded) status = 'loading'
    else if (!session) status = 'signedOut'
    else if (me.isPending) status = 'loading'
    else if (me.isError) status = 'error'
    else if (!profile || (!isSuperAdmin && !membershipRole)) status = 'noAccess'
    else if (!org) status = 'noOrg'
    else status = 'ready'

    return {
      status,
      session,
      profile,
      org,
      role,
      isSuperAdmin,
      actor: profile ? { userId: profile.id, isSuperAdmin, role: membershipRole } : null,
      error: (me.error as Error | null) ?? null,
      signOut,
      reload: () => void me.refetch(),
    }
  }, [me, session, sessionLoaded, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider')
  return ctx
}

/** Dùng ở trang đã qua RequireAuth: chắc chắn có đơn vị + vai trò. */
// eslint-disable-next-line react-refresh/only-export-components
export function useOrg() {
  const auth = useAuth()
  if (!auth.org || !auth.role || !auth.actor || !auth.profile) throw new Error('Chưa có đơn vị')
  return { org: auth.org, role: auth.role, actor: auth.actor, profile: auth.profile, isSuperAdmin: auth.isSuperAdmin }
}
