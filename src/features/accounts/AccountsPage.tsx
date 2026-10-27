import { useMemo, useState } from 'react'
import {
  allowedActions,
  isInternalEmail,
  ROLE_LABELS,
  rolesCreatableBy,
  type Actor,
  type ManageAction,
} from '../../../supabase/functions/_shared/accountRules.ts'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '../../components/ui/Menu'
import { Badge, EmptyState, ErrorState, LoadingRows, Notice, PageHeader } from '../../components/ui/States'
import { formatDate } from '../../lib/format'
import { useOrg } from '../auth/AuthProvider'
import type { MemberRow } from './accountsApi'
import { CreateAccountDialog, EditAccountDialog, ResetPasswordDialog } from './AccountDialogs'
import { countByRole, filterMembers, type RoleFilter } from './memberFilters'
import { useAdminUsers, useMembers } from './useAccounts'

const ROLE_TONE = { org_admin: 'accent', teacher: 'brand', student: 'ok', parent: 'muted' } as const

function actionsFor(actor: Actor, m: MemberRow): ManageAction[] {
  return allowedActions(actor, {
    userId: m.user_id,
    role: m.role,
    createdBy: m.created_by,
    isSuperAdmin: m.profile?.is_super_admin === true,
  })
}

export function AccountsPage() {
  const { org, actor, role } = useOrg()
  const members = useMembers(org.id)
  const adminUsers = useAdminUsers(org.id)
  const creatable = rolesCreatableBy(actor)

  const [roleFilter, setRoleFilter] = useState<RoleFilter>(role === 'teacher' ? 'student' : 'all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [resetFor, setResetFor] = useState<MemberRow | null>(null)
  const [editFor, setEditFor] = useState<MemberRow | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'lock' | 'unlock' | 'delete'; member: MemberRow } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const rows = useMemo(() => members.data ?? [], [members.data])
  const visible = useMemo(() => filterMembers(rows, roleFilter, search), [rows, roleFilter, search])
  const counts = useMemo(() => countByRole(rows), [rows])

  const runConfirm = () => {
    if (!confirm) return
    const { kind, member } = confirm
    const body =
      kind === 'delete'
        ? ({ action: 'delete', user_id: member.user_id } as const)
        : ({ action: 'set_status', user_id: member.user_id, status: kind === 'lock' ? 'disabled' : 'active' } as const)
    adminUsers.mutate(body, {
      onSuccess: () => {
        const name = member.profile?.full_name ?? ''
        setNotice(kind === 'delete' ? `Đã xóa tài khoản ${name}` : kind === 'lock' ? `Đã khóa ${name}` : `Đã mở khóa ${name}`)
        setConfirm(null)
      },
    })
  }

  const tabs: RoleFilter[] = role === 'teacher' ? ['student', 'all'] : ['all', 'org_admin', 'teacher', 'student', 'parent']

  return (
    <div>
      <PageHeader
        title="Tài khoản"
        description={
          role === 'teacher'
            ? 'Tạo tài khoản cho học sinh chưa có email; đặt lại mật khẩu cho tài khoản bạn đã tạo.'
            : 'Tài khoản đăng nhập của quản lý, giáo viên, học sinh và phụ huynh.'
        }
        actions={
          creatable.length > 0 && (
            <Button onClick={() => setCreateOpen(true)}>
              <Icon name="plus" className="size-4" /> Tạo tài khoản
            </Button>
          )
        }
      />

      {notice && (
        <div className="mb-4">
          <Notice tone="ok">{notice}</Notice>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Lọc theo vai trò">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={roleFilter === t}
              onClick={() => setRoleFilter(t)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
                roleFilter === t ? 'bg-brand-800 text-white' : 'bg-surface text-ink ring-1 ring-line hover:bg-brand-50'
              }`}
            >
              {t === 'all' ? 'Tất cả' : ROLE_LABELS[t]} <span className="opacity-70">{counts[t]}</span>
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            placeholder="Tìm theo tên, tên đăng nhập"
            aria-label="Tìm tài khoản"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {members.isPending ? (
        <LoadingRows />
      ) : members.isError ? (
        <ErrorState error={members.error} onRetry={() => members.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState title={search ? 'Không tìm thấy tài khoản' : 'Chưa có tài khoản'}>
          {!search && creatable.length > 0 && 'Bấm "Tạo tài khoản" để thêm.'}
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {/* Máy tính: bảng. Điện thoại: thẻ (CLAUDE.md 11) */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-page text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Họ tên</th>
                <th className="px-4 py-3 font-medium">Đăng nhập</th>
                <th className="px-4 py-3 font-medium">Vai trò</th>
                <th className="px-4 py-3 font-medium">Người tạo</th>
                <th className="px-4 py-3 font-medium">Ngày tạo</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((m) => (
                <tr key={m.id} className={m.status === 'disabled' ? 'opacity-60' : ''}>
                  <td className="px-4 py-3 font-medium text-ink">
                    {m.profile?.full_name || '—'} {m.status === 'disabled' && <Badge tone="danger">Đã khóa</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted">{loginIdOf(m)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONE[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{m.creator?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(m.created_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <RowMenu member={m} actions={actionsFor(actor, m)} onReset={setResetFor} onEdit={setEditFor} onConfirm={setConfirm} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="divide-y divide-line md:hidden">
            {visible.map((m) => (
              <li key={m.id} className={`flex items-start gap-3 px-4 py-3 ${m.status === 'disabled' ? 'opacity-60' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{m.profile?.full_name || '—'}</p>
                  <p className="truncate text-sm text-muted">{loginIdOf(m)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone={ROLE_TONE[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                    {m.status === 'disabled' && <Badge tone="danger">Đã khóa</Badge>}
                  </div>
                </div>
                <RowMenu member={m} actions={actionsFor(actor, m)} onReset={setResetFor} onEdit={setEditFor} onConfirm={setConfirm} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <CreateAccountDialog open={createOpen} onOpenChange={setCreateOpen} orgId={org.id} roles={creatable} />
      <ResetPasswordDialog member={resetFor} orgId={org.id} onClose={() => setResetFor(null)} />
      {editFor && (
        <EditAccountDialog
          member={editFor}
          orgId={org.id}
          roles={creatable}
          canChangeRole={actionsFor(actor, editFor).includes('change_role')}
          onClose={() => setEditFor(null)}
        />
      )}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (!o) {
            setConfirm(null)
            adminUsers.reset()
          }
        }}
        title={confirm?.kind === 'delete' ? 'Xóa tài khoản?' : confirm?.kind === 'lock' ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?'}
        confirmLabel={confirm?.kind === 'delete' ? 'Xóa' : confirm?.kind === 'lock' ? 'Khóa' : 'Mở khóa'}
        danger={confirm?.kind !== 'unlock'}
        loading={adminUsers.isPending}
        onConfirm={runConfirm}
      >
        {adminUsers.error && <Notice tone="danger">{adminUsers.error.message}</Notice>}
        <p>
          <strong>{confirm?.member.profile?.full_name}</strong> ({confirm && loginIdOf(confirm.member)})
        </p>
        {confirm?.kind === 'delete' && <p>Người này không đăng nhập được nữa. Thao tác không hoàn tác được.</p>}
        {confirm?.kind === 'lock' && <p>Người này tạm thời không đăng nhập vào đơn vị được. Có thể mở khóa lại sau.</p>}
      </ConfirmDialog>
    </div>
  )
}

function loginIdOf(m: MemberRow): string {
  const p = m.profile
  if (!p) return '—'
  if (p.username) return p.username
  return p.email && !isInternalEmail(p.email) ? p.email : '—'
}

function RowMenu({
  member,
  actions,
  onReset,
  onEdit,
  onConfirm,
}: {
  member: MemberRow
  actions: ManageAction[]
  onReset: (m: MemberRow) => void
  onEdit: (m: MemberRow) => void
  onConfirm: (c: { kind: 'lock' | 'unlock' | 'delete'; member: MemberRow }) => void
}) {
  if (actions.length === 0) return <span className="inline-block size-9" />
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={`Thao tác với ${member.profile?.full_name ?? ''}`}>
          <Icon name="more" />
        </Button>
      </MenuTrigger>
      <MenuContent>
        {actions.includes('reset_password') && <MenuItem onSelect={() => onReset(member)}>Đặt lại mật khẩu</MenuItem>}
        {actions.includes('update_profile') && <MenuItem onSelect={() => onEdit(member)}>Sửa thông tin</MenuItem>}
        {actions.includes('set_status') &&
          (member.status === 'active' ? (
            <MenuItem onSelect={() => onConfirm({ kind: 'lock', member })}>Khóa tài khoản</MenuItem>
          ) : (
            <MenuItem onSelect={() => onConfirm({ kind: 'unlock', member })}>Mở khóa</MenuItem>
          ))}
        {actions.includes('delete') && (
          <MenuItem danger onSelect={() => onConfirm({ kind: 'delete', member })}>
            Xóa tài khoản
          </MenuItem>
        )}
      </MenuContent>
    </MenuRoot>
  )
}
