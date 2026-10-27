import { Link } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/States'
import { KIND_LABELS, TIME_STATUS_LABELS, timeRange } from '../classes/classRules'
import type { MeetingWithClass } from '../classes/classesApi'
import { meetingTimeStatus, type TimeStatus } from '../classes/schedule'

const TONE: Record<TimeStatus, 'ok' | 'warn' | 'muted' | 'brand' | 'accent' | 'danger'> = {
  live: 'accent',
  upcoming: 'brand',
  done: 'ok',
  cancelled: 'muted',
  overdue: 'danger',
}

/** 1 buổi học trên màn Hôm nay / Lịch tuần. */
export function MeetingCard({
  meeting,
  now,
  canTakeAttendance,
}: {
  meeting: MeetingWithClass
  now: { date: string; minutes: number }
  canTakeAttendance: boolean
}) {
  const ts = meetingTimeStatus(meeting, now)
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border bg-surface p-3 ${
        ts === 'live' ? 'border-accent-400 ring-2 ring-accent-100' : 'border-line'
      } ${ts === 'cancelled' ? 'opacity-60' : ''}`}
    >
      <div className="w-16 shrink-0 text-center">
        <p className="text-lg font-bold text-ink">{meeting.start_time.slice(0, 5)}</p>
        <p className="text-xs text-muted">{meeting.duration_minutes} phút</p>
      </div>
      <div className="min-w-0 flex-1">
        <Link to={`/lop-hoc/${meeting.class_id}`} className="font-semibold text-ink hover:underline">
          {meeting.class?.name ?? 'Lớp'}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <Badge tone={TONE[ts]}>{TIME_STATUS_LABELS[ts]}</Badge>
          {meeting.class && <span>{KIND_LABELS[meeting.class.kind]}</span>}
          <span>· {timeRange(meeting.start_time, meeting.duration_minutes)}</span>
          {meeting.mode === 'online' && <span>· Online</span>}
        </div>
      </div>
      {canTakeAttendance && ts !== 'cancelled' && (
        <Link to={`/lop-hoc/${meeting.class_id}/buoi/${meeting.id}`} className="shrink-0">
          <Button size="sm" variant={ts === 'live' || ts === 'overdue' ? 'primary' : 'secondary'}>
            Điểm danh
          </Button>
        </Link>
      )}
    </li>
  )
}
