import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useOrg, useAuth } from '../../features/auth/AuthProvider'
import { bottomNavItems, navItemForPath, overflowItems, sidebarItems, type NavItem } from '../../features/auth/navigation'
import { ROLE_LABELS } from '../../../supabase/functions/_shared/accountRules.ts'
import { Icon } from '../ui/Icon'
import { MenuContent, MenuItem, MenuLabel, MenuRoot, MenuSeparator, MenuTrigger } from '../ui/Menu'

const COLLAPSE_KEY = 'cie.sidebarCollapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0')
  } catch {
    // Trình duyệt chặn lưu trữ: chỉ mất phần "nhớ lựa chọn"
  }
}

export function AppLayout() {
  const { role, org } = useOrg()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const current = navItemForPath(pathname)
  const pageTitle = current?.label ?? (pathname === '/doi-mat-khau' ? 'Đổi mật khẩu' : '')

  const toggle = () => {
    setCollapsed((c) => {
      writeCollapsed(!c)
      return !c
    })
  }

  return (
    <div className="min-h-dvh lg:flex">
      {/* Menu trái — máy tính */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] lg:flex ${
          collapsed ? 'w-[4.5rem]' : 'w-64'
        }`}
      >
        <Link to="/" className="flex items-center gap-3 px-4 py-4">
          <img src="/brand/cie-emblem.png" alt="" className="h-10 w-10 shrink-0 object-contain" />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="font-bold text-brand-800">Chess in Education</p>
              <p className="text-[11px] font-semibold tracking-[0.25em] text-accent-600">VIETNAM</p>
            </div>
          )}
        </Link>
        {!collapsed && <p className="mx-4 mb-2 truncate rounded-lg bg-brand-50 px-3 py-1.5 text-sm text-brand-700">{org.name}</p>}

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Menu chính">
          {sidebarItems(role).map((item) => (
            <SideLink key={item.key} item={item} collapsed={collapsed} />
          ))}
        </nav>

        <div className="border-t border-line px-3 py-3">
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-brand-50"
            aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} />
            {!collapsed && 'Thu gọn'}
          </button>
          {!collapsed && <p className="px-3 pt-2 text-xs text-muted">Phát triển bởi Chess Empire</p>}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:px-8">
          <img src="/brand/cie-emblem.png" alt="" className="h-8 w-8 object-contain lg:hidden" />
          <p className="min-w-0 flex-1 truncate font-semibold text-ink">{pageTitle}</p>
          <AccountMenu />
        </header>

        <main className="pb-bottom-nav mx-auto w-full max-w-6xl px-4 pt-5 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Thanh dưới — điện thoại */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Điều hướng"
      >
        <ul className="flex">
          {bottomNavItems(role).map((item) => (
            <li key={item.key} className="flex-1">
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                    isActive ? 'text-brand-800' : 'text-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`rounded-full px-3 py-1 ${isActive ? 'bg-accent-100' : ''}`}>
                      <Icon name={item.icon} />
                    </span>
                    {item.shortLabel}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function SideLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${
          isActive ? 'bg-brand-800 text-white' : 'text-ink hover:bg-brand-50'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} className={`size-5 shrink-0 ${isActive ? 'text-accent-400' : 'text-brand-500'}`} />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  )
}

function AccountMenu() {
  const { profile, role, isSuperAdmin } = useOrg()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const initials =
    profile.full_name
      .split(/\s+/)
      .filter(Boolean)
      .slice(-1)[0]
      ?.charAt(0)
      .toUpperCase() ?? '?'

  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-full bg-brand-800 font-semibold text-accent-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
          aria-label="Tài khoản"
        >
          {initials}
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>
          <span className="block text-sm font-semibold text-ink">{profile.full_name || 'Chưa đặt tên'}</span>
          <span className="block">
            {isSuperAdmin ? 'Quản trị hệ thống' : ROLE_LABELS[role]} · {profile.username ?? profile.email}
          </span>
        </MenuLabel>
        <MenuSeparator />
        <div className="lg:hidden">
          {overflowItems(role).map((item) => (
            <MenuItem key={item.key} onSelect={() => navigate(item.path)}>
              <Icon name={item.icon} className="size-5 text-brand-500" /> {item.label}
            </MenuItem>
          ))}
          {overflowItems(role).length > 0 && <MenuSeparator />}
        </div>
        <MenuItem onSelect={() => navigate('/doi-mat-khau')}>
          <Icon name="lock" className="size-5 text-brand-500" /> Đổi mật khẩu
        </MenuItem>
        <MenuItem
          danger
          onSelect={async () => {
            await signOut()
            navigate('/dang-nhap', { replace: true })
          }}
        >
          <Icon name="logout" className="size-5" /> Đăng xuất
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  )
}
