import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from '../../components/ui/Menu'
import { Badge, EmptyState, ErrorState, LoadingRows, Notice } from '../../components/ui/States'
import { monthLabel, monthOf, weekdayOf } from '../../lib/dates'
import { formatDate, todayVN, WEEKDAY_SHORT } from '../../lib/format'
import { MEETING_STATUS_LABELS, timeRange } from './classRules'
import {
  deleteMeeting,
  ensureUpcoming,
  trimAutoAdded,
  updateMeeting,
  type AttendanceRow,
  type ClassSummary,
  type MeetingRow,
  type MemberRow,
} from './classesApi'
import { MeetingDialog } from './MeetingDialog'
import { numberMeetings } from './schedule'

type Numbered = MeetingRow & { number: number }

const STATUS_TONE = { scheduled: 'muted', completed: 'ok', cancelled: 'warn' } as const

export function MeetingsTab({
  cls,
  meetings,
  members,
  attendance,
  canEdit,
  isAdmin,
  userId,
  onChanged,
}: {
  cls: ClassSummary
  meetings: { data?: MeetingRow[]; isPending: boolean; isError: boolean; error: unknown; refetch: () => void }
  members: MemberRow[]
  attendance: AttendanceRow[]
  canEdit: boolean
  isAdmin: boolean
  userId: string
  onChanged: () => void
}) {
  const today = todayVN()
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set([monthOf(today)]))
  const [editing, setEditing] = useState<MeetingRow | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Numbered | null>(null)

  const act = useMutation({
    mutationFn: async (v: { m: MeetingRow; to: 'completed' | 'scheduled' | 'cancelled' }) => {
      await updateMeeting(v.m.id, { status: v.to, taught_by: v.to === 'completed' ? (v.m.taught_by ?? userId) : v.m.taught_by })
      if (v.to === 'scheduled' && v.m.status === 'completed') await trimAutoAdded(cls.id)
      else if (cls.status === 'active') await ensureUpcoming(cls.org_id, cls.id, cls.slots, today)
    },
    onSuccess: onChanged,
  })
  const remove = useMutation({ mutationFn: (id: string) => deleteMeeting(id), onSuccess: () => { setConfirmDelete(null); onChanged() } })

  const numbered = useMemo(() => numberMeetings(meetings.data ?? []), [meetings.data])
  const activeMembers = members.filter((m) => m.status === 'active').length
  const attendanceByMeeting = useMemo(() => {
    const map = new Map<string, { present: number; marked: number }>()
    for (const a of attendance) {
      const v = map.get(a.meeting_id) ?? { present: 0, marked: 0 }
      v.marked++
      if (a.status === 'present') v.present++
      map.set(a.meeting_id, v)
    }
    return map
  }, [attendance])

  if (meetings.isPending) return <LoadingRows />
  if (meetings.isError) return <ErrorState error={meetings.error} onRetry={meetings.refetch} />

  const overdue = numbered.filter((m) => m.status === 'scheduled' && m.meeting_date < today)
  const upcoming = numbered.filter((m) => m.status === 'scheduled' && m.meeting_date >= today)
  const past = numbered.filter((m) => m.status !== 'scheduled').reverse()
  const pastByMonth = new Map<string, Numbered[]>()
  for (const m of past) pastByMonth.set(monthOf(m.meeting_date), [...(pastByMonth.get(monthOf(m.meeting_date)) ?? []), m])

  const month = monthOf(today)
  const inMonth = numbered.filter((m) => monthOf(m.meeting_date) === month && m.status !== 'cancelled')
  const taughtInMonth = inMonth.filter((m) => m.status === 'completed').length
  const taughtTotal = numbered.filter((m) => m.status === 'completed').length

  const firstSlot = cls.slots[0]
  const row = (m: Numbered) => {
    const att = attendanceByMeeting.get(m.id)
    return (
      <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="w-10 shrink-0 text-center">
          <p className="text-xs text-muted">Buổi</p>
          <p className="font-bold text-ink">{m.number}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">
            {WEEKDAY_SHORT[weekdayOf(m.meeting_date)]} {formatDate(m.meeting_date)}
            <span className="font-normal text-muted"> · {timeRange(m.start_time, m.duration_minutes)}</span>
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={STATUS_TONE[m.status]}>{MEETING_STATUS_LABELS[m.status]}</Badge>
            {m.mode === 'online' && <Badge tone="brand">Online</Badge>}
            {att && (
              <span>
                Có mặt {att.present}/{activeMembers}
                {att.marked < activeMembers && ` · chưa điểm danh ${activeMembers - att.marked}`}
              </span>
            )}
            {m.content && <span className="truncate">· {m.content.split('\n')[0]}</span>}
          </div>
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            {m.status !== 'cancelled' && (
              <Link to={`/lop-hoc/${cls.id}/buoi/${m.id}`}>
                <Button variant={m.status === 'scheduled' && m.meeting_date <= today ? 'primary' : 'secondary'} size="sm">
                  Điểm danh
                </Button>
              </Link>
            )}
            {m.status === 'scheduled' && (
              <Button variant="accent" size="sm" loading={act.isPending && act.variables?.m.id === m.id} onClick={() => act.mutate({ m, to: 'completed' })}>
                <Icon name="check" className="size-4" /> Đã dạy
              </Button>
            )}
            <MenuRoot>
              <MenuTrigger asChild>
                <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={`Thao tác buổi ${m.number}`}>
                  <Icon name="more" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => setEditing(m)}>Sửa buổi / nội dung</MenuItem>
                {m.status === 'completed' && <MenuItem onSelect={() => act.mutate({ m, to: 'scheduled' })}>Bỏ “Đã dạy” (bấm nhầm)</MenuItem>}
                {m.status === 'scheduled' && <MenuItem onSelect={() => act.mutate({ m, to: 'cancelled' })}>Báo nghỉ buổi này</MenuItem>}
                {m.status === 'cancelled' && <MenuItem onSelect={() => act.mutate({ m, to: 'scheduled' })}>Bỏ nghỉ</MenuItem>}
                {m.status === 'scheduled' && (
                  <>
                    <MenuSeparator />
                    <MenuItem danger onSelect={() => setConfirmDelete(m)}>
                      Xóa buổi
                    </MenuItem>
                  </>
                )}
              </MenuContent>
            </MenuRoot>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">{monthLabel(month)}</p>
          <p className="mt-1 text-2xl font-bold text-ink">
            {taughtInMonth}/{inMonth.length} <span className="text-base font-medium text-muted">buổi</span>
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Đã dạy</p>
          <p className="mt-1 text-2xl font-bold text-ink">
            {taughtTotal} <span className="text-base font-medium text-muted">buổi</span>
          </p>
        </div>
        <div className="col-span-2 rounded-2xl border border-line bg-surface p-4 sm:col-span-1">
          <p className="text-sm text-muted">Học viên</p>
          <p className="mt-1 text-2xl font-bold text-ink">{activeMembers}</p>
        </div>
      </div>

      {act.error && <Notice tone="danger">{act.error.message}</Notice>}

      {canEdit && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => setEditing('new')}>
            <Icon name="plus" className="size-4" /> Thêm buổi học
          </Button>
        </div>
      )}

      {numbered.length === 0 && (
        <EmptyState title="Chưa có buổi học">
          {cls.slots.length === 0 ? 'Lớp chưa có lịch tuần — thêm ở tab Thông tin, hoặc thêm buổi tay.' : 'Buổi sẽ tự thêm theo lịch tuần.'}
        </EmptyState>
      )}

      {overdue.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-warn-600">Đã qua giờ mà chưa bấm “Đã dạy” ({overdue.length})</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-warn-600/30 bg-surface">{overdue.map(row)}</ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Sắp tới</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {(showAllUpcoming ? upcoming : upcoming.slice(0, 6)).map(row)}
          </ul>
          {upcoming.length > 6 && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAllUpcoming((v) => !v)}>
              {showAllUpcoming ? 'Thu gọn' : `Xem cả ${upcoming.length} buổi sắp tới`}
            </Button>
          )}
        </section>
      )}

      {pastByMonth.size > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Các buổi đã qua</h3>
          <div className="space-y-2">
            {[...pastByMonth.entries()].map(([mo, items]) => {
              const open = openMonths.has(mo)
              return (
                <div key={mo} className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-ink hover:bg-brand-50"
                    aria-expanded={open}
                    onClick={() =>
                      setOpenMonths((s) => {
                        const n = new Set(s)
                        if (open) n.delete(mo)
                        else n.add(mo)
                        return n
                      })
                    }
                  >
                    <span>
                      {monthLabel(mo)} ·{' '}
                      <span className="font-normal text-muted">
                        {items.filter((m) => m.status === 'completed').length} buổi đã dạy
                        {items.some((m) => m.status === 'cancelled') && `, ${items.filter((m) => m.status === 'cancelled').length} buổi nghỉ`}
                      </span>
                    </span>
                    <Icon name={open ? 'chevronLeft' : 'chevronRight'} className={`size-4 transition-transform ${open ? '-rotate-90' : ''}`} />
                  </button>
                  {open && <ul className="divide-y divide-line border-t border-line">{items.map(row)}</ul>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {editing && (
        <MeetingDialog
          orgId={cls.org_id}
          classId={cls.id}
          meeting={editing === 'new' ? null : editing}
          defaults={{
            start_time: firstSlot?.start_time ?? '17:30',
            duration_minutes: firstSlot?.duration_minutes ?? 90,
            mode: firstSlot?.mode ?? 'offline',
          }}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmDelete(null)
            remove.reset()
          }
        }}
        title="Xóa buổi học?"
        confirmLabel="Xóa"
        danger
        loading={remove.isPending}
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
      >
        {remove.error && <Notice tone="danger">{remove.error.message}</Notice>}
        <p>
          Xóa buổi {confirmDelete?.number} ({confirmDelete && formatDate(confirmDelete.meeting_date)})? Các buổi sau tự đánh số lại.
          {!isAdmin && ' Chỉ xóa được buổi chưa dạy, chưa điểm danh.'}
        </p>
        <p className="text-muted">Nghỉ học thì nên dùng “Báo nghỉ” để giữ lịch sử.</p>
      </ConfirmDialog>
    </div>
  )
}
