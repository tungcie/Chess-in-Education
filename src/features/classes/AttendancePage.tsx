import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Badge, EmptyState, ErrorState, LoadingRows, Notice } from '../../components/ui/States'
import { weekdayOf } from '../../lib/dates'
import { formatDate, todayVN, WEEKDAY_LABELS } from '../../lib/format'
import { useOrg } from '../auth/AuthProvider'
import { ATTENDANCE_LABELS, type AttendanceStatus } from '../tuition/billing'
import { MEETING_STATUS_LABELS, timeRange } from './classRules'
import { clearAttendance, ensureUpcoming, markAttendance, updateMeeting, type MemberRow } from './classesApi'
import { MeetingDialog } from './MeetingDialog'
import { useClass, useClassMembers, useInvalidateClasses, useMeeting, useMeetingAttendance } from './useClasses'

const BUTTONS: Array<{ status: AttendanceStatus; short: string; on: string }> = [
  { status: 'present', short: 'Có mặt', on: 'bg-ok-600 text-white border-ok-600' },
  { status: 'excused', short: 'Có phép', on: 'bg-accent-400 text-brand-900 border-accent-400' },
  { status: 'absent', short: 'Không phép', on: 'bg-danger-600 text-white border-danger-600' },
]

/**
 * Điểm danh nhanh (CLAUDE.md 6.3): mỗi em 3 nút lớn, lưu ngay mỗi lần bấm (đổi màu ngay, lỗi thì trả lại),
 * bấm lại nút đang chọn = bỏ điểm danh; "Tất cả có mặt" chỉ áp cho em chưa điểm danh; nút "Đã dạy" dính dưới đáy.
 */
export function AttendancePage() {
  const { id: classId = '', meetingId = '' } = useParams()
  const { org, role, actor } = useOrg()
  const navigate = useNavigate()
  const cls = useClass(org.id, classId)
  const meeting = useMeeting(org.id, meetingId)
  const members = useClassMembers(org.id, classId)
  const attendance = useMeetingAttendance(org.id, meetingId)
  const invalidate = useInvalidateClasses(org.id)

  // Lựa chọn tạm (lạc quan) — null = đã bỏ điểm danh; undefined = theo dữ liệu máy chủ
  const [pending, setPending] = useState<Record<string, AttendanceStatus | null>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [openNote, setOpenNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const saved = useMemo(() => new Map((attendance.data ?? []).map((a) => [a.member_id, a])), [attendance.data])
  const statusOf = (memberId: string): AttendanceStatus | null =>
    memberId in pending ? pending[memberId] : (saved.get(memberId)?.status ?? null)

  const roster: MemberRow[] = useMemo(
    () =>
      (members.data ?? [])
        .filter((m) => m.status === 'active' || saved.has(m.id))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi')),
    [members.data, saved],
  )

  const m = meeting.data
  const set = async (member: MemberRow, next: AttendanceStatus | null) => {
    if (!m) return
    const before = statusOf(member.id)
    setPending((p) => ({ ...p, [member.id]: next }))
    setError(null)
    try {
      const note = notes[member.id] ?? saved.get(member.id)?.note ?? null
      if (next === null) await clearAttendance(m.id, member.id)
      else await markAttendance(m, member.id, next, note || null)
      invalidate()
    } catch (e) {
      setPending((p) => ({ ...p, [member.id]: before }))
      setError(`Chưa lưu được điểm danh của ${member.full_name}: ${(e as Error).message}`)
    }
  }

  const allPresent = useMutation({
    mutationFn: async () => {
      for (const member of roster.filter((x) => x.status === 'active' && statusOf(x.id) === null)) await set(member, 'present')
    },
  })

  const complete = useMutation({
    mutationFn: async () => {
      if (!m || !cls.data) return
      await updateMeeting(m.id, { status: 'completed', taught_by: m.taught_by ?? actor.userId })
      if (cls.data.status === 'active') await ensureUpcoming(org.id, cls.data.id, cls.data.slots, todayVN())
    },
    onSuccess: () => {
      invalidate()
      navigate(`/lop-hoc/${classId}`)
    },
  })

  const saveNote = async (member: MemberRow) => {
    setOpenNote(null)
    const status = statusOf(member.id)
    if (!m || !status) return
    try {
      await markAttendance(m, member.id, status, notes[member.id]?.trim() || null)
    } catch (e) {
      setError(`Chưa lưu được nhận xét: ${(e as Error).message}`)
    }
  }

  if (meeting.isPending || members.isPending || attendance.isPending || cls.isPending) return <LoadingRows rows={6} />
  const err = meeting.error ?? members.error ?? attendance.error ?? cls.error
  if (err) return <ErrorState error={err} onRetry={() => invalidate()} />
  if (!m || !cls.data) return <EmptyState title="Không tìm thấy buổi học" />

  const canEdit = role === 'org_admin' || cls.data.teachers.some((t) => t.teacher_id === actor.userId)
  const counts = { present: 0, excused: 0, absent: 0, none: 0 }
  for (const member of roster) {
    const st = statusOf(member.id)
    counts[st ?? 'none']++
  }

  return (
    <div>
      <Link to={`/lop-hoc/${classId}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <Icon name="chevronLeft" className="size-4" /> {cls.data.name}
      </Link>
      <div className="mt-2 mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">
            Điểm danh · {WEEKDAY_LABELS[weekdayOf(m.meeting_date)]} {formatDate(m.meeting_date)}
          </h1>
          <p className="text-sm text-muted">
            {timeRange(m.start_time, m.duration_minutes)} · <Badge tone={m.status === 'completed' ? 'ok' : 'muted'}>{MEETING_STATUS_LABELS[m.status]}</Badge>
          </p>
        </div>
        {canEdit && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Nội dung / bài tập
          </Button>
        )}
      </div>

      {m.status === 'cancelled' && <Notice tone="warn">Buổi này đã nghỉ — không điểm danh được.</Notice>}
      {error && (
        <div className="mb-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted">
          Có mặt <strong className="text-ink">{counts.present}</strong> · Có phép <strong className="text-ink">{counts.excused}</strong> ·
          Không phép <strong className="text-ink">{counts.absent}</strong> · Chưa điểm danh <strong className="text-ink">{counts.none}</strong>
        </p>
        {canEdit && m.status !== 'cancelled' && counts.none > 0 && (
          <Button variant="secondary" size="sm" loading={allPresent.isPending} onClick={() => allPresent.mutate()}>
            <Icon name="check" className="size-4" /> Tất cả có mặt ({counts.none})
          </Button>
        )}
      </div>

      {roster.length === 0 ? (
        <EmptyState title="Lớp chưa có học viên" action={<Link to={`/lop-hoc/${classId}?tab=hoc-vien`} className="text-brand-700 underline">Thêm học viên</Link>} />
      ) : (
        <ul className="space-y-2">
          {roster.map((member) => {
            const st = statusOf(member.id)
            const note = notes[member.id] ?? saved.get(member.id)?.note ?? ''
            return (
              <li key={member.id} className="rounded-2xl border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-ink">
                    {member.full_name}
                    {member.status === 'removed' && <span className="ml-2 text-sm text-muted">(đã rời lớp)</span>}
                  </p>
                  {canEdit && st && (
                    <button type="button" className="text-sm text-brand-700 underline" onClick={() => setOpenNote(openNote === member.id ? null : member.id)}>
                      {note ? 'Sửa nhận xét' : '+ Nhận xét'}
                    </button>
                  )}
                </div>
                {note && openNote !== member.id && <p className="mt-1 text-sm text-muted">“{note}”</p>}
                <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label={`Điểm danh ${member.full_name}`}>
                  {BUTTONS.map((b) => {
                    const on = st === b.status
                    return (
                      <button
                        key={b.status}
                        type="button"
                        aria-pressed={on}
                        title={ATTENDANCE_LABELS[b.status]}
                        disabled={!canEdit || m.status === 'cancelled'}
                        onClick={() => set(member, on ? null : b.status)}
                        className={`h-12 rounded-xl border text-[15px] font-semibold transition-colors disabled:opacity-50 ${
                          on ? b.on : 'border-line bg-page text-ink hover:bg-brand-50'
                        }`}
                      >
                        {b.status === 'present' && on && '✓ '}
                        {b.short}
                      </button>
                    )
                  })}
                </div>
                {openNote === member.id && (
                  <div className="mt-2 flex gap-2">
                    <input
                      className="h-10 flex-1 rounded-lg border border-line px-3 text-[15px] focus:border-brand-500 focus:outline-none"
                      placeholder="Nhận xét ngắn về em ở buổi này"
                      value={note}
                      autoFocus
                      onChange={(e) => setNotes((n) => ({ ...n, [member.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && saveNote(member)}
                    />
                    <Button size="sm" className="h-10" onClick={() => saveNote(member)}>
                      Lưu
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canEdit && m.status === 'scheduled' && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">{counts.none > 0 ? `Còn ${counts.none} em chưa điểm danh` : 'Đã điểm danh đủ'}</p>
            <Button variant="accent" size="lg" loading={complete.isPending} onClick={() => complete.mutate()}>
              <Icon name="check" /> Đã dạy
            </Button>
          </div>
          {complete.error && <p className="mt-1 text-sm text-danger-600">{complete.error.message}</p>}
        </div>
      )}

      {editing && (
        <MeetingDialog
          orgId={org.id}
          classId={classId}
          meeting={m}
          defaults={{ start_time: m.start_time, duration_minutes: m.duration_minutes, mode: m.mode }}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            invalidate()
          }}
        />
      )}
    </div>
  )
}
