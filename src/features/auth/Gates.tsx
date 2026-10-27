import type { ReactNode } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { ErrorState, FullPageLoading } from '../../components/ui/States'
import { useAuth } from './AuthProvider'
import { canAccess, type NavKey } from './navigation'

function CenteredMessage({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <img src="/brand/cie-emblem.png" alt="" className="mb-6 h-16 w-auto" />
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      <div className="mt-2 max-w-md text-[15px] text-muted">{children}</div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

function SignOutButton() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await signOut()
        navigate('/dang-nhap', { replace: true })
      }}
    >
      Đăng xuất
    </Button>
  )
}

/** Chặn trang khi chưa đăng nhập / chưa được cấp quyền / chưa có đơn vị. */
export function RequireAuth() {
  const { status, error, reload } = useAuth()
  if (status === 'loading') return <FullPageLoading />
  if (status === 'signedOut') return <Navigate to="/dang-nhap" replace />
  if (status === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <ErrorState error={error} onRetry={reload} />
      </div>
    )
  }
  if (status === 'noAccess') {
    return (
      <CenteredMessage title="Tài khoản chưa được cấp quyền" action={<SignOutButton />}>
        Tài khoản này chưa thuộc đơn vị nào hoặc đã bị khóa. Hãy liên hệ quản lý để được cấp quyền.
      </CenteredMessage>
    )
  }
  if (status === 'noOrg') {
    return (
      <CenteredMessage title="Chưa có đơn vị" action={<SignOutButton />}>
        Hệ thống chưa có đơn vị nào. Chạy file <code>supabase/setup/khoi_tao.sql</code> trong Supabase SQL Editor để tạo
        đơn vị đầu tiên (xem docs/huong-dan-cai-dat.md).
      </CenteredMessage>
    )
  }
  return <Outlet />
}

/** Chặn đường dẫn mà vai trò không có trong menu (giao diện chỉ ẩn — DB vẫn chặn bằng RLS). */
export function RequireNav({ navKey, children }: { navKey: NavKey; children: ReactNode }) {
  const { role } = useAuth()
  if (!role || !canAccess(role, navKey)) {
    return (
      <div className="py-16 text-center">
        <p className="font-semibold text-ink">Bạn không có quyền xem trang này</p>
      </div>
    )
  }
  return <>{children}</>
}

export function NotConfiguredPage() {
  return (
    <CenteredMessage title="Chưa kết nối Supabase">
      Tạo file <code>.env.local</code> (chép từ <code>.env.example</code>) và điền <code>VITE_SUPABASE_URL</code>,{' '}
      <code>VITE_SUPABASE_ANON_KEY</code> của project Supabase, rồi chạy lại. Xem docs/huong-dan-cai-dat.md.
    </CenteredMessage>
  )
}
