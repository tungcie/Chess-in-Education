import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ErrorState, LoadingRows, PageHeader } from '../../components/ui/States'
import { addDays, nowVN, startOfWeek } from '../../lib/dates'
import { formatDate, WEEKDAY_LABELS } from '../../lib/format'
import { useOrg } from '../auth/AuthProvider'
import { useMeetingsBetween } from '../classes/useClasses'
import { MeetingCard } from './MeetingCard'

/** Lịch tuần: mọi buổi trong tuần, gộp theo ngày (RLS tự lọc theo quyền). */
export function CalendarPage() {
  const { org, role } = useOrg()
  const now = nowVN()
  const [weekStart, setWeekStart] = useState(startOfWeek(now.date))
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const meetings = useMeetingsBetween(org.id, days[0], days[6])
  const staff = role === 'org_admin' || role === 'teacher'

  return (
    <div>
      <PageHeader
        title="Lịch tuần"
        description={`${formatDate(days[0])} – ${formatDate(days[6])}`}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" className="size-9 px-0" aria-label="Tuần trước" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <Icon name="chevronLeft" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(now.date))}>
              Tuần này
            </Button>
            <Button variant="secondary" size="sm" className="size-9 px-0" aria-label="Tuần sau" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <Icon name="chevronRight" />
            </Button>
          </div>
        }
      />
      {meetings.isPending ? (
        <LoadingRows rows={5} />
      ) : meetings.isError ? (
        <ErrorState error={meetings.error} onRetry={() => meetings.refetch()} />
      ) : (
        <div className="space-y-4">
          {days.map((d, i) => {
            const list = (meetings.data ?? []).filter((m) => m.meeting_date === d).sort((a, b) => a.start_time.localeCompare(b.start_time))
            return (
              <section key={d}>
                <h2 className={`mb-2 text-sm font-semibold ${d === now.date ? 'text-accent-600' : 'text-ink'}`}>
                  {WEEKDAY_LABELS[i]} · {formatDate(d)}
                  {d === now.date && ' · Hôm nay'}
                </h2>
                {list.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted">Không có buổi học</p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((m) => (
                      <MeetingCard key={m.id} meeting={m} now={now} canTakeAttendance={staff} />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
