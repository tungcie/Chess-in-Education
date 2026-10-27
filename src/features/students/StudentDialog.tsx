import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { Notice } from '../../components/ui/States'
import { todayVN } from '../../lib/format'
import type { StudentInput, StudentProfile } from './studentsApi'
import { GENDER_LABELS } from './studentRules'

const schema = z.object({
  full_name: z.string().trim().min(1, 'Nhập họ tên'),
  birth_date: z.string(),
  gender: z.enum(['', 'male', 'female']),
  address: z.string(),
  school_class: z.string(),
  phone: z.string(),
  email: z.union([z.literal(''), z.email('Email chưa đúng')]),
  level: z.string(),
  start_date: z.string().min(1, 'Chọn ngày bắt đầu học'),
  notes: z.string(),
  g_full_name: z.string(),
  g_relation: z.string(),
  g_phone: z.string(),
  g_zalo_name: z.string(),
})
type FormValues = z.infer<typeof schema>

export type StudentDialogResult = {
  input: StudentInput
  guardian: { full_name: string; relation: string; phone: string; zalo_name: string } | null
}

function toForm(s: StudentProfile | null): FormValues {
  return {
    full_name: s?.full_name ?? '',
    birth_date: s?.birth_date ?? '',
    gender: s?.gender ?? '',
    address: s?.address ?? '',
    school_class: s?.school_class ?? '',
    phone: s?.phone ?? '',
    email: s?.email ?? '',
    level: s?.level ?? '',
    start_date: s?.start_date ?? todayVN(),
    notes: s?.notes ?? '',
    g_full_name: '',
    g_relation: 'Mẹ',
    g_phone: '',
    g_zalo_name: '',
  }
}

/** Thêm / sửa hồ sơ. Thêm mới có kèm ô phụ huynh chính (sửa phụ huynh ở trang hồ sơ).
 *  Nơi dùng chỉ gắn component khi mở ({open && <StudentDialog …/>}) để form luôn bắt đầu sạch. */
export function StudentDialog({
  open,
  student,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
  student: StudentProfile | null
  saving: boolean
  error: Error | null
  onClose: () => void
  onSubmit: (v: StudentDialogResult) => void
}) {
  const isEdit = !!student
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(student) })

  const submit = (v: FormValues) =>
    onSubmit({
      input: {
        full_name: v.full_name,
        birth_date: v.birth_date,
        gender: v.gender,
        address: v.address,
        school_class: v.school_class,
        phone: v.phone,
        email: v.email,
        level: v.level,
        start_date: v.start_date,
        notes: v.notes,
      },
      guardian: !isEdit && v.g_full_name.trim()
        ? { full_name: v.g_full_name, relation: v.g_relation, phone: v.g_phone, zalo_name: v.g_zalo_name }
        : null,
    })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? 'Sửa hồ sơ học viên' : 'Thêm học viên'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" form="student-form" loading={saving}>
            {isEdit ? 'Lưu' : 'Thêm học viên'}
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error.message}</Notice>}
        <Field label="Họ tên" error={errors.full_name?.message}>
          {(id, desc) => <Input id={id} aria-describedby={desc} autoComplete="off" {...register('full_name')} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày sinh">{(id) => <Input id={id} type="date" {...register('birth_date')} />}</Field>
          <Field label="Giới tính">
            {(id) => (
              <Select id={id} {...register('gender')}>
                <option value="">—</option>
                {(Object.keys(GENDER_LABELS) as Array<keyof typeof GENDER_LABELS>).map((g) => (
                  <option key={g} value={g}>
                    {GENDER_LABELS[g]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Lớp ở trường" hint="Vd 3A">
            {(id, desc) => <Input id={id} aria-describedby={desc} {...register('school_class')} />}
          </Field>
          <Field label="Trình độ" hint="Vd Sơ cấp">
            {(id, desc) => <Input id={id} aria-describedby={desc} {...register('level')} />}
          </Field>
          <Field label="Ngày bắt đầu học" error={errors.start_date?.message}>
            {(id, desc) => <Input id={id} type="date" aria-describedby={desc} {...register('start_date')} />}
          </Field>
          <Field label="SĐT của em">{(id) => <Input id={id} type="tel" inputMode="tel" {...register('phone')} />}</Field>
        </div>
        <Field label="Địa chỉ">{(id) => <Input id={id} {...register('address')} />}</Field>
        <Field label="Email của em" error={errors.email?.message}>
          {(id, desc) => <Input id={id} type="email" aria-describedby={desc} {...register('email')} />}
        </Field>

        {!isEdit && (
          <fieldset className="space-y-3 rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-semibold text-ink">Phụ huynh chính (không bắt buộc)</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Họ tên phụ huynh">{(id) => <Input id={id} {...register('g_full_name')} />}</Field>
              <Field label="Quan hệ">
                {(id) => (
                  <Select id={id} {...register('g_relation')}>
                    {['Mẹ', 'Bố', 'Ông', 'Bà', 'Anh', 'Chị', 'Người giám hộ'].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="SĐT phụ huynh">{(id) => <Input id={id} type="tel" inputMode="tel" {...register('g_phone')} />}</Field>
              <Field label="Tên Zalo">{(id) => <Input id={id} {...register('g_zalo_name')} />}</Field>
            </div>
          </fieldset>
        )}

        <Field label="Ghi chú">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              className="block w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
              {...register('notes')}
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
