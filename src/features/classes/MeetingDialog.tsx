import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { Notice } from '../../components/ui/States'
import { todayVN } from '../../lib/format'
import { MEETING_STATUS_LABELS, MODE_LABELS } from './classRules'
import { addMeeting, updateMeeting, type MeetingRow } from './classesApi'
import type { MeetingStatus, Mode } from './schedule'
import { useTeacherOptions } from './useClasses'

const TEXTAREA =
  'block w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none'

/** Sửa 1 buổi (ngày giờ, trạng thái, người dạy, nội dung, bài tập) hoặc thêm buổi học bù / ngoài lịch. */
export function MeetingDialog({
  orgId,
  classId,
  meeting,
  defaults,
  onClose,
  onSaved,
}: {
  orgId: string
  classId: string
  meeting: MeetingRow | null
  defaults: { start_time: string; duration_minutes: number; mode: Mode }
  onClose: () => void
  onSaved: () => void
}) {
  const teachers = useTeacherOptions(orgId)
  const [date, setDate] = useState(meeting?.meeting_date ?? todayVN())
  const [time, setTime] = useState((meeting?.start_time ?? defaults.start_time).slice(0, 5))
  const [minutes, setMinutes] = useState(meeting?.duration_minutes ?? defaults.duration_minutes)
  const [mode, setMode] = useState<Mode>(meeting?.mode ?? defaults.mode)
  const [status, setStatus] = useState<MeetingStatus>(meeting?.status ?? 'scheduled')
  const [taughtBy, setTaughtBy] = useState(meeting?.taught_by ?? '')
  const [content, setContent] = useState(meeting?.content ?? '')
  const [homework, setHomework] = useState(meeting?.homework ?? '')

  const save = useMutation({
    mutationFn: async () => {
      if (!date || !time || minutes < 15) throw new Error('Nhập ngày, giờ và thời lượng (≥ 15 phút)')
      if (meeting) {
        await updateMeeting(meeting.id, {
          meeting_date: date,
          start_time: time,
          duration_minutes: minutes,
          mode,
          status,
          taught_by: taughtBy || null,
          content: content.trim() || null,
          homework: homework.trim() || null,
        })
      } else {
        await addMeeting(orgId, classId, { meeting_date: date, start_time: time, duration_minutes: minutes, mode })
      }
    },
    onSuccess: onSaved,
  })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={meeting ? 'Sửa buổi học' : 'Thêm buổi học'}
      description={meeting ? undefined : 'Buổi học bù / ngoài lịch. Số buổi tự sắp lại theo ngày.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && <Notice tone="danger">{save.error.message}</Notice>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Giờ bắt đầu">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          <Field label="Thời lượng (phút)">
            {(id) => (
              <Input id={id} type="number" inputMode="numeric" min={15} step={15} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
            )}
          </Field>
          <Field label="Hình thức">
            {(id) => (
              <Select id={id} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {meeting && (
            <>
              <Field label="Trạng thái">
                {(id) => (
                  <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as MeetingStatus)}>
                    {(Object.keys(MEETING_STATUS_LABELS) as MeetingStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {MEETING_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Giáo viên dạy">
                {(id) => (
                  <Select id={id} value={taughtBy} onChange={(e) => setTaughtBy(e.target.value)}>
                    <option value="">—</option>
                    {(teachers.data ?? []).map((t) => (
                      <option key={t.user_id} value={t.user_id}>
                        {t.full_name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </>
          )}
        </div>
        {meeting && (
          <>
            <Field label="Nội dung buổi học" hint="Mỗi bài 1 dòng">
              {(id, desc) => (
                <textarea id={id} aria-describedby={desc} rows={3} className={TEXTAREA} value={content} onChange={(e) => setContent(e.target.value)} />
              )}
            </Field>
            <Field label="Bài tập về nhà">
              {(id) => <textarea id={id} rows={2} className={TEXTAREA} value={homework} onChange={(e) => setHomework(e.target.value)} />}
            </Field>
          </>
        )}
      </div>
    </Dialog>
  )
}
