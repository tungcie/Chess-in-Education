import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AppLayout } from './components/layout/AppLayout'
import { AccountsPage } from './features/accounts/AccountsPage'
import { useAuth } from './features/auth/AuthProvider'
import { ChangePasswordPage } from './features/auth/ChangePasswordPage'
import { RequireAuth, RequireNav } from './features/auth/Gates'
import { LoginPage } from './features/auth/LoginPage'
import { homePath, NAV, type NavKey } from './features/auth/navigation'
import { ComingSoonPage } from './features/home/ComingSoonPage'
import { OrgPage } from './features/org/OrgPage'
import { StudentDetailPage } from './features/students/StudentDetailPage'
import { StudentsPage } from './features/students/StudentsPage'

function HomeRedirect() {
  const { role } = useAuth()
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 64rem)').matches
  return <Navigate to={role ? homePath(role, isDesktop) : '/dang-nhap'} replace />
}

const PAGES: Partial<Record<NavKey, React.ReactNode>> = {
  accounts: <AccountsPage />,
  students: <StudentsPage />,
  org: <OrgPage />,
}

const router = createBrowserRouter([
  { path: '/dang-nhap', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: '/doi-mat-khau', element: <ChangePasswordPage /> },
          {
            path: '/hoc-vien/:id',
            element: (
              <RequireNav navKey="students">
                <StudentDetailPage />
              </RequireNav>
            ),
          },
          ...Object.values(NAV).map((item) => ({
            path: item.path,
            element: <RequireNav navKey={item.key}>{PAGES[item.key] ?? <ComingSoonPage item={item} />}</RequireNav>,
          })),
          { path: '*', element: <HomeRedirect /> },
        ],
      },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
