import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Badge, EmptyState, ErrorState, LoadingRows, PageHeader } from '../../components/ui/States'
import { formatMoney } from '../../lib/format'
import { useOrg } from '../auth/AuthProvider'
import { CLASS_STATUS_LABELS, KIND_LABELS, scheduleSummary } from './classRules'
import { ClassFormDialog } from './ClassFormDialog'
import type { ClassStatus } from './classesApi'
import { useClassList, useInvalidateClasses } from './useClasses'

export function ClassesPage() {
  const { org, role } = useOrg()
  const list = useClassList(org.id)
  const invalidate = useInvalidateClasses(org.id)
  const navigate = useNavigate()
  const [tab, setTab] = useState<ClassStatus>('active')
  const [creating, setCreating] = useState(false)
  const isAdmin = role === 'org_admin'

  const rows = useMemo(
    () => (list.data ?? []).filter((c) => c.status === tab).sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true })),
    [list.data, tab],
  )

  return (
    <div>
      <PageHeader
        title="Lớp học"
        description={
          role === 'teacher' ? 'Các lớp bạn được phân công.' : role === 'org_admin' ? 'Lớp nhóm và lớp kèm 1-1 của đơn vị.' : 'Lớp em đang học.'
        }
        actions={
          isAdmin && (
            <Button onClick={() => setCreating(true)}>
              <Icon name="plus" className="size-4" /> Tạo lớp
            </Button>
          )
        }
      />

      <div className="mb-4 flex gap-1" role="tablist" aria-label="Trạng thái lớp">
        {(['active', 'completed', 'cancelled'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              tab === t ? 'bg-brand-800 text-white' : 'bg-surface text-ink ring-1 ring-line hover:bg-brand-50'
            }`}
          >
            {CLASS_STATUS_LABELS[t]} <span className="opacity-70">{(list.data ?? []).filter((c) => c.status === t).length}</span>
          </button>
        ))}
      </div>

      {list.isPending ? (
        <LoadingRows />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? 'Chưa có lớp đang học' : 'Không có lớp nào'}
          action={
            isAdmin &&
            tab === 'active' && (
              <Button onClick={() => setCreating(true)}>
                <Icon name="plus" className="size-4" /> Tạo lớp đầu tiên
              </Button>
            )
          }
        >
          {!isAdmin && tab === 'active' && 'Quản lý sẽ phân công lớp cho bạn.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                to={`/lop-hoc/${c.id}`}
                className="block h-full rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-ink">{c.name}</p>
                  <Badge tone={c.kind === 'group' ? 'brand' : 'accent'}>{KIND_LABELS[c.kind]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{scheduleSummary(c.slots)}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="users" className="size-4" /> {c.activeMembers} học viên
                  </span>
                  {c.teachers.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="badge" className="size-4" /> {c.teachers.map((t) => t.profile?.full_name ?? '').join(', ')}
                    </span>
                  )}
                  {isAdmin && c.default_fee > 0 && <span>{formatMoney(c.default_fee)} / buổi</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <ClassFormDialog
          orgId={org.id}
          existing={null}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false)
            invalidate()
            navigate(`/lop-hoc/${id}`)
          }}
        />
      )}
    </div>
  )
}
