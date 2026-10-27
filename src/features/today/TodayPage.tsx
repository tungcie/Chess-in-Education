import { useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { EmptyState, ErrorState, LoadingRows, PageHeader } from '../../components/ui/States'
import { addDays, nowVN, startOfWeek, weekdayOf } from '../../lib/dates'
import { formatDate, WEEKDAY_LABELS, WEEKDAY_SHORT } from '../../lib/format'
import { useOrg } from '../auth/AuthProvider'
import { useMeetingsBetween } from '../classes/useClasses'
import { MeetingCard } from './MeetingCard'

/** Hôm nay (CLAUDE.md 6.4): dải 7 ngày có chấm, danh sách buổi ngày chọn, trạng thái theo giờ, nút Điểm danh. */
export function TodayPage() {
  const { org, role } = useOrg()
  const now = nowVN()
  const [selected, setSelected] = useState(now.date)
  const weekStart = startOfWeek(selected)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const meetings = useMeetingsBetween(org.id, days[0], days[6])
  const staff = role === 'org_admin' || role === 'teacher'

  const byDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of meetings.data ?? []) if (m.status !== 'cancelled') map.set(m.meeting_date, (map.get(m.meeting_date) ?? 0) + 1)
    return map
  }, [meetings.data])
  const list = (meetings.data ?? [])
    .filter((m) => m.meeting_date === selected)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  return (
    <div>
      <PageHeader
        title={selected === now.date ? 'Hôm nay' : `${WEEKDAY_LABELS[weekdayOf(selected)]} ${formatDate(selected)}`}
        description={selected === now.date ? `${WEEKDAY_LABELS[weekdayOf(selected)]}, ${formatDate(selected)}` : undefined}
      />
      <div className="mb-4 flex items-center gap-1">
        <Button variant="ghost" size="sm" className="size-9 shrink-0 px-0" aria-label="Tuần trước" onClick={() => setSelected(addDays(selected, -7))}>
          <Icon name="chevronLeft" />
        </Button>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {days.map((d) => {
            const isSel = d === selected
            const count = byDay.get(d) ?? 0
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelected(d)}
                aria-pressed={isSel}
                aria-label={`${WEEKDAY_LABELS[weekdayOf(d)]} ${formatDate(d)}, ${count} buổi`}
                className={`flex flex-col items-center rounded-xl py-2 text-sm ${
                  isSel ? 'bg-brand-800 text-white' : d === now.date ? 'bg-accent-100 text-ink' : 'bg-surface text-ink ring-1 ring-line'
                }`}
              >
                <span className="text-xs opacity-80">{WEEKDAY_SHORT[weekdayOf(d)]}</span>
                <span className="font-semibold">{d.slice(8)}</span>
                <span className={`mt-1 size-1.5 rounded-full ${count ? (isSel ? 'bg-accent-400' : 'bg-brand-500') : 'bg-transparent'}`} />
              </button>
            )
          })}
        </div>
        <Button variant="ghost" size="sm" className="size-9 shrink-0 px-0" aria-label="Tuần sau" onClick={() => setSelected(addDays(selected, 7))}>
          <Icon name="chevronRight" />
        </Button>
      </div>
      {selected !== now.date && (
        <Button variant="ghost" size="sm" className="mb-3" onClick={() => setSelected(now.date)}>
          Về hôm nay
        </Button>
      )}

      {meetings.isPending ? (
        <LoadingRows rows={3} />
      ) : meetings.isError ? (
        <ErrorState error={meetings.error} onRetry={() => meetings.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title="Không có buổi học">
          {role === 'org_admin' && (meetings.data ?? []).length === 0 && 'Tạo lớp ở menu Lớp học — buổi học sẽ hiện ở đây.'}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {list.map((m) => (
            <MeetingCard key={m.id} meeting={m} now={now} canTakeAttendance={staff} />
          ))}
        </ul>
      )}
    </div>
  )
}
