import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { Badge, EmptyState, ErrorState, LoadingRows, PageHeader } from '../../components/ui/States'
import { todayVN } from '../../lib/format'
import { useOrg } from '../auth/AuthProvider'
import { StudentDialog } from './StudentDialog'
import { ageOn, countByStatus, filterStudents, STATUS_LABELS, STATUS_TONE, type StatusFilter } from './studentRules'
import { useStudentList, useStudentMutations } from './useStudents'

export function StudentsPage() {
  const { org, role } = useOrg()
  const list = useStudentList(org.id)
  const { create } = useStudentMutations(org.id)
  const navigate = useNavigate()
  const [status, setStatus] = useState<StatusFilter>('active')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const today = todayVN()

  const rows = useMemo(() => list.data ?? [], [list.data])
  const visible = useMemo(() => filterStudents(rows, status, search), [rows, status, search])
  const counts = useMemo(() => countByStatus(rows), [rows])
  const tabs: StatusFilter[] = ['active', 'paused', 'inactive', 'all']

  return (
    <div>
      <PageHeader
        title="Học viên"
        description={
          role === 'teacher'
            ? 'Học viên bạn tạo (giai đoạn sau: thêm học viên các lớp bạn dạy). Chỉ quản lý sửa được hồ sơ.'
            : 'Hồ sơ học viên và liên hệ phụ huynh.'
        }
        actions={
          <Button onClick={() => setAdding(true)}>
            <Icon name="plus" className="size-4" /> Thêm học viên
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Lọc theo trạng thái">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={status === t}
              onClick={() => setStatus(t)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
                status === t ? 'bg-brand-800 text-white' : 'bg-surface text-ink ring-1 ring-line hover:bg-brand-50'
              }`}
            >
              {t === 'all' ? 'Tất cả' : STATUS_LABELS[t]} <span className="opacity-70">{counts[t]}</span>
            </button>
          ))}
        </div>
        <div className="relative md:w-80">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            placeholder="Tìm tên, lớp, trình độ, SĐT phụ huynh"
            aria-label="Tìm học viên"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {list.isPending ? (
        <LoadingRows />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={search ? 'Không tìm thấy học viên' : rows.length === 0 ? 'Chưa có học viên' : 'Không có học viên ở mục này'}
          action={
            rows.length === 0 && (
              <Button onClick={() => setAdding(true)}>
                <Icon name="plus" className="size-4" /> Thêm học viên đầu tiên
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-page text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Họ tên</th>
                <th className="px-4 py-3 font-medium">Tuổi</th>
                <th className="px-4 py-3 font-medium">Lớp ở trường</th>
                <th className="px-4 py-3 font-medium">Trình độ</th>
                <th className="px-4 py-3 font-medium">Phụ huynh</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer hover:bg-brand-50/60"
                  onClick={() => navigate(`/hoc-vien/${s.id}`)}
                >
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/hoc-vien/${s.id}`} className="text-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                      {s.full_name}
                    </Link>
                    {s.hasAccount && (
                      <span className="ml-2 align-middle">
                        <Badge tone="brand">Có tài khoản</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{ageOn(s.birth_date, today) ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{s.school_class ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{s.level ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">
                    {s.primaryGuardianName ? `${s.primaryGuardianName}${s.primaryGuardianPhone ? ` · ${s.primaryGuardianPhone}` : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABELS[s.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="divide-y divide-line md:hidden">
            {visible.map((s) => {
              const age = ageOn(s.birth_date, today)
              return (
                <li key={s.id}>
                  <Link to={`/hoc-vien/${s.id}`} className="flex items-start gap-3 px-4 py-3 active:bg-brand-50">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{s.full_name}</p>
                      <p className="truncate text-sm text-muted">
                        {[age !== null && `${age} tuổi`, s.school_class && `Lớp ${s.school_class}`, s.level].filter(Boolean).join(' · ') ||
                          '—'}
                      </p>
                      {s.primaryGuardianPhone && (
                        <p className="truncate text-sm text-muted">
                          PH: {s.primaryGuardianName} · {s.primaryGuardianPhone}
                        </p>
                      )}
                    </div>
                    <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABELS[s.status]}</Badge>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {adding && (
        <StudentDialog
          open
          student={null}
          saving={create.isPending}
          error={create.error}
          onClose={() => {
            setAdding(false)
            create.reset()
          }}
          onSubmit={(v) =>
            create.mutate(v, {
              onSuccess: (id) => {
                setAdding(false)
                navigate(`/hoc-vien/${id}`)
              },
            })
          }
        />
      )}
    </div>
  )
}
