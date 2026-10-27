import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { Notice } from '../../components/ui/States'
import { formatDate, formatMoney, todayVN, WEEKDAY_LABELS } from '../../lib/format'
import { CLASS_STATUS_LABELS, KIND_LABELS, MODE_LABELS } from './classRules'
import {
  createClass,
  setClassSlots,
  setClassTeachers,
  updateClass,
  type ClassKind,
  type ClassStatus,
  type ClassSummary,
} from './classesApi'
import { generateMeetings, UPCOMING_BUFFER, type Mode, type Slot } from './schedule'
import { useTeacherOptions } from './useClasses'

interface SlotDraft {
  weekday: number
  start_time: string
  duration_minutes: number
  mode: Mode
}

const emptySlot = (): SlotDraft => ({ weekday: 0, start_time: '17:30', duration_minutes: 90, mode: 'offline' })

/**
 * Tạo / sửa lớp: thông tin, giá 1 buổi mặc định, lịch tuần, giáo viên phụ trách.
 * Tạo mới: sinh sẵn 16 buổi theo lịch tuần (xem trước trước khi lưu). Sửa lịch tuần: chỉ áp cho buổi app tự thêm về sau.
 * Nơi dùng chỉ gắn component khi mở để form luôn bắt đầu sạch.
 */
export function ClassFormDialog({
  orgId,
  existing,
  onClose,
  onSaved,
}: {
  orgId: string
  existing: ClassSummary | null
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const teachers = useTeacherOptions(orgId)
  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState<ClassKind>(existing?.kind ?? 'group')
  const [status, setStatus] = useState<ClassStatus>(existing?.status ?? 'active')
  const [startDate, setStartDate] = useState(existing?.start_date ?? todayVN())
  const [location, setLocation] = useState(existing?.location ?? '')
  const [fee, setFee] = useState(String(existing?.default_fee ?? ''))
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [teacherIds, setTeacherIds] = useState<string[]>(existing?.teachers.map((t) => t.teacher_id) ?? [])
  const [slots, setSlots] = useState<SlotDraft[]>(
    existing?.slots.length
      ? existing.slots.map((s) => ({ ...s, start_time: s.start_time.slice(0, 5) }))
      : [emptySlot()],
  )
  const [error, setError] = useState<string | null>(null)

  const feeNumber = Number(fee || 0)
  const preview = existing ? [] : generateMeetings(slots as Slot[], startDate, UPCOMING_BUFFER)

  const save = useMutation({
    mutationFn: async () => {
      const input = { name, kind, start_date: startDate, location, default_fee: feeNumber, notes }
      if (!existing) return createClass(orgId, input, slots, teacherIds, preview)
      await updateClass(existing.id, { ...input, status })
      await setClassSlots(existing.id, slots)
      await setClassTeachers(orgId, existing.id, existing.teachers, teacherIds)
      return existing.id
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  })

  const submit = () => {
    setError(null)
    if (!name.trim()) return setError('Nhập tên lớp')
    if (!startDate) return setError('Chọn ngày bắt đầu')
    if (!Number.isInteger(feeNumber) || feeNumber < 0) return setError('Giá 1 buổi phải là số tiền (đồng), không âm')
    if (slots.some((s) => !s.start_time || s.duration_minutes < 15)) return setError('Lịch tuần: nhập giờ học và thời lượng ≥ 15 phút')
    save.mutate()
  }

  const updateSlot = (i: number, patch: Partial<SlotDraft>) => setSlots((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? 'Sửa lớp' : 'Tạo lớp'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {existing ? 'Lưu' : 'Tạo lớp'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Tên lớp" hint="Vd: Cơ bản T3-T5 17h30, Kèm riêng Bảo Anh">
          {(id, desc) => <Input id={id} aria-describedby={desc} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hình thức">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as ClassKind)}>
                {(Object.keys(KIND_LABELS) as ClassKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Ngày bắt đầu">
            {(id) => <Input id={id} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
          </Field>
          <Field label="Giá 1 buổi mặc định (đồng)" hint={feeNumber > 0 ? formatMoney(feeNumber) : 'Điền sẵn khi thêm học viên'}>
            {(id, desc) => (
              <Input
                id={id}
                aria-describedby={desc}
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            )}
          </Field>
          <Field label="Địa điểm / phòng">
            {(id) => <Input id={id} value={location} onChange={(e) => setLocation(e.target.value)} />}
          </Field>
          {existing && (
            <Field label="Trạng thái">
              {(id) => (
                <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as ClassStatus)}>
                  {(Object.keys(CLASS_STATUS_LABELS) as ClassStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {CLASS_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Lịch tuần</legend>
          {slots.map((s, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-line p-2">
              <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                <Select aria-label="Thứ" value={s.weekday} onChange={(e) => updateSlot(i, { weekday: Number(e.target.value) })}>
                  {WEEKDAY_LABELS.map((l, d) => (
                    <option key={d} value={d}>
                      {l}
                    </option>
                  ))}
                </Select>
                <Input aria-label="Giờ bắt đầu" type="time" value={s.start_time} onChange={(e) => updateSlot(i, { start_time: e.target.value })} />
                <Input
                  aria-label="Thời lượng (phút)"
                  type="number"
                  inputMode="numeric"
                  min={15}
                  step={15}
                  value={s.duration_minutes}
                  onChange={(e) => updateSlot(i, { duration_minutes: Number(e.target.value) })}
                />
                <Select aria-label="Hình thức học" value={s.mode} onChange={(e) => updateSlot(i, { mode: e.target.value as Mode })}>
                  {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABELS[m]}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="size-10 shrink-0 px-0"
                aria-label="Xóa ca này"
                disabled={slots.length === 1}
                onClick={() => setSlots((all) => all.filter((_, j) => j !== i))}
              >
                <Icon name="x" />
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setSlots((all) => [...all, emptySlot()])}>
            <Icon name="plus" className="size-4" /> Thêm ca học
          </Button>
          <p className="text-xs text-muted">Mỗi ca: thứ · giờ bắt đầu · số phút · hình thức.</p>
          {existing && (
            <p className="text-sm text-muted">Đổi lịch tuần không dời các buổi đã có; buổi app tự thêm về sau theo lịch mới.</p>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Giáo viên phụ trách</legend>
          {teachers.isPending ? (
            <p className="text-sm text-muted">Đang tải…</p>
          ) : (teachers.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">Chưa có tài khoản giáo viên — tạo ở trang Tài khoản.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {teachers.data!.map((t) => {
                const on = teacherIds.includes(t.user_id)
                return (
                  <label
                    key={t.user_id}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${on ? 'border-brand-800 bg-brand-50 font-medium' : 'border-line'}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() => setTeacherIds((ids) => (on ? ids.filter((x) => x !== t.user_id) : [...ids, t.user_id]))}
                    />
                    {t.full_name}
                  </label>
                )
              })}
            </div>
          )}
        </fieldset>

        <Field label="Ghi chú">
          {(id) => <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>

        {!existing && preview.length > 0 && (
          <div className="rounded-xl bg-brand-50 p-3 text-sm">
            <p className="font-medium text-ink">Sẽ tạo sẵn {preview.length} buổi</p>
            <p className="text-muted">
              Buổi 1: {formatDate(preview[0].meeting_date)} · Buổi {preview.length}: {formatDate(preview[preview.length - 1].meeting_date)}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
