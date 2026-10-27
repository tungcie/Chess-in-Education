import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import { Badge, EmptyState, ErrorState, LoadingRows, Notice } from '../../components/ui/States'
import { formatDate, formatMoney, todayVN, WEEKDAY_LABELS } from '../../lib/format'
import { useOrg } from '../auth/AuthProvider'
import { CLASS_STATUS_LABELS, KIND_LABELS, MODE_LABELS, scheduleSummary, timeRange } from './classRules'
import { ClassFormDialog } from './ClassFormDialog'
import { deleteClass, ensureUpcoming } from './classesApi'
import { MeetingsTab } from './MeetingsTab'
import { MembersTab } from './MembersTab'
import { useClass, useClassAttendance, useClassMeetings, useClassMembers, useInvalidateClasses } from './useClasses'

type Tab = 'buoi' | 'hoc-vien' | 'thong-tin'
const TABS: Array<[Tab, string]> = [
  ['buoi', 'Buổi học'],
  ['hoc-vien', 'Học viên'],
  ['thong-tin', 'Thông tin'],
]

export function ClassDetailPage() {
  const { id = '' } = useParams()
  const { org, role, actor } = useOrg()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find(([t]) => t === params.get('tab'))?.[0] ?? 'buoi') as Tab

  const cls = useClass(org.id, id)
  const meetings = useClassMeetings(org.id, id)
  const members = useClassMembers(org.id, id)
  const attendance = useClassAttendance(org.id, id)
  const invalidate = useInvalidateClasses(org.id)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const remove = useMutation({ mutationFn: () => deleteClass(id), onSuccess: () => navigate('/lop-hoc', { replace: true }) })

  const isAdmin = role === 'org_admin'
  const canEdit = isAdmin || (role === 'teacher' && !!cls.data?.teachers.some((t) => t.teacher_id === actor.userId))

  // Mở trang lớp (người sửa được, lớp đang học, có lịch tuần) → bù đủ buổi chưa dạy phía trước (CLAUDE.md 6.1)
  const toppedUp = useRef(false)
  useEffect(() => {
    const c = cls.data
    if (!c || !canEdit || c.status !== 'active' || c.slots.length === 0 || !meetings.data || toppedUp.current) return
    toppedUp.current = true
    ensureUpcoming(org.id, c.id, c.slots, todayVN())
      .then((added) => {
        if (added > 0) invalidate()
      })
      .catch(() => {
        // Không chặn trang; lần mở sau thử lại
        toppedUp.current = false
      })
  }, [cls.data, canEdit, meetings.data, org.id, invalidate])

  if (cls.isPending) return <LoadingRows rows={5} />
  if (cls.isError) return <ErrorState error={cls.error} onRetry={() => cls.refetch()} />
  const c = cls.data
  if (!c) {
    return (
      <EmptyState title="Không tìm thấy lớp" action={<Link to="/lop-hoc" className="text-brand-700 underline">Về danh sách lớp</Link>}>
        Lớp không tồn tại hoặc bạn không được phân công.
      </EmptyState>
    )
  }

  return (
    <div className="space-y-4">
      <Link to="/lop-hoc" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <Icon name="chevronLeft" className="size-4" /> Lớp học
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-ink">{c.name}</h1>
          <Badge tone={c.kind === 'group' ? 'brand' : 'accent'}>{KIND_LABELS[c.kind]}</Badge>
          {c.status !== 'active' && <Badge tone="muted">{CLASS_STATUS_LABELS[c.status]}</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {scheduleSummary(c.slots)}
          {c.teachers.length > 0 && ` · GV: ${c.teachers.map((t) => t.profile?.full_name ?? '').join(', ')}`}
        </p>
      </div>

      <div className="flex gap-1 border-b border-line" role="tablist">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setParams({ tab: t }, { replace: true })}
            className={`-mb-px border-b-2 px-3 py-2 text-[15px] font-medium ${
              tab === t ? 'border-accent-400 text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'buoi' && (
        <MeetingsTab
          cls={c}
          meetings={meetings}
          members={members.data ?? []}
          attendance={attendance.data ?? []}
          canEdit={canEdit}
          isAdmin={isAdmin}
          userId={actor.userId}
          onChanged={invalidate}
        />
      )}

      {tab === 'hoc-vien' &&
        (members.isPending ? (
          <LoadingRows />
        ) : members.isError ? (
          <ErrorState error={members.error} onRetry={() => members.refetch()} />
        ) : (
          <MembersTab
            cls={c}
            members={members.data}
            meetings={meetings.data ?? []}
            attendance={attendance.data ?? []}
            canEdit={canEdit}
            isAdmin={isAdmin}
            onChanged={invalidate}
          />
        ))}

      {tab === 'thong-tin' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-line bg-surface p-4">
            <dl className="grid gap-3 text-[15px] sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted uppercase">Ngày bắt đầu</dt>
                <dd className="font-medium">{formatDate(c.start_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase">Địa điểm</dt>
                <dd className="font-medium">{c.location || '—'}</dd>
              </div>
              {isAdmin && (
                <div>
                  <dt className="text-xs text-muted uppercase">Giá 1 buổi mặc định</dt>
                  <dd className="font-medium">{formatMoney(c.default_fee)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted uppercase">Giáo viên</dt>
                <dd className="font-medium">{c.teachers.map((t) => t.profile?.full_name ?? '').join(', ') || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted uppercase">Lịch tuần</dt>
                <dd>
                  {c.slots.length === 0
                    ? '—'
                    : [...c.slots]
                        .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
                        .map((s) => (
                          <p key={s.id} className="font-medium">
                            {WEEKDAY_LABELS[s.weekday]} · {timeRange(s.start_time, s.duration_minutes)} · {MODE_LABELS[s.mode]}
                          </p>
                        ))}
                </dd>
              </div>
              {c.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted uppercase">Ghi chú</dt>
                  <dd className="whitespace-pre-wrap">{c.notes}</dd>
                </div>
              )}
            </dl>
          </section>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Sửa lớp, lịch tuần, giáo viên
              </Button>
              <Button variant="ghost" className="text-danger-600" onClick={() => setConfirmDelete(true)}>
                Xóa lớp
              </Button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <ClassFormDialog
          orgId={org.id}
          existing={c}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            toppedUp.current = false
            invalidate()
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(o) => {
          setConfirmDelete(o)
          if (!o) remove.reset()
        }}
        title="Xóa lớp?"
        confirmLabel="Xóa lớp"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      >
        {remove.error && <Notice tone="danger">{remove.error.message}</Notice>}
        <p>
          Xóa <strong>{c.name}</strong> cùng lịch tuần, các buổi và danh sách học viên. Chỉ xóa được lớp chưa có điểm danh.
        </p>
        <p className="text-muted">Lớp đã học xong thì nên chuyển “Đã kết thúc” để giữ lịch sử.</p>
      </ConfirmDialog>
    </div>
  )
}
