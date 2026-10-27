import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Badge, Notice, PageHeader } from '../../components/ui/States'
import { useOrg } from '../auth/AuthProvider'

const KIND_LABELS = { school: 'Trường học', club: 'CLB', center: 'Trung tâm' } as const

const schema = z.object({
  name: z.string().trim().min(1, 'Nhập tên đơn vị'),
  address: z.string().trim(),
  phone: z.string().trim(),
})
type FormValues = z.infer<typeof schema>

export function OrgPage() {
  const { org } = useOrg()
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: org.name, address: org.address ?? '', phone: org.phone ?? '' },
  })

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const { data, error } = await supabase
        .from('organizations')
        .update({ name: v.name, address: v.address || null, phone: v.phone || null })
        .eq('id', org.id)
        .select('id')
      if (error) throw error
      // RLS lọc còn 0 dòng → báo lỗi thay vì "lưu thành công" giả (CLAUDE.md 4.3)
      if (!data || data.length === 0) throw new Error('Bạn không có quyền sửa đơn vị này')
    },
    onSuccess: (_, v) => {
      setSaved(true)
      reset(v)
      qc.invalidateQueries({ queryKey: ['me'] })
    },
  })

  return (
    <div className="max-w-xl">
      <PageHeader title="Đơn vị" description="Thông tin đơn vị hiển thị trên báo cáo và tin nhắn gửi phụ huynh." />
      <form
        onSubmit={handleSubmit((v) => {
          setSaved(false)
          save.mutate(v)
        })}
        className="space-y-4 rounded-2xl border border-line bg-surface p-5"
        noValidate
      >
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge tone="brand">{KIND_LABELS[org.kind]}</Badge>
          <Badge tone="muted">Mã: {org.slug}</Badge>
          <Badge tone={org.status === 'active' ? 'ok' : 'danger'}>{org.status === 'active' ? 'Đang hoạt động' : 'Tạm khóa'}</Badge>
        </div>
        {save.error && <Notice tone="danger">{save.error.message}</Notice>}
        {saved && <Notice tone="ok">Đã lưu</Notice>}
        <Field label="Tên đơn vị" error={errors.name?.message}>
          {(id, desc) => <Input id={id} aria-describedby={desc} {...register('name')} />}
        </Field>
        <Field label="Địa chỉ">{(id) => <Input id={id} {...register('address')} />}</Field>
        <Field label="Số điện thoại">{(id) => <Input id={id} type="tel" inputMode="tel" {...register('phone')} />}</Field>
        <Button type="submit" loading={save.isPending} disabled={!isDirty}>
          Lưu
        </Button>
      </form>
    </div>
  )
}
