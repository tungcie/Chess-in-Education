import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { MIN_PASSWORD_LENGTH } from '../../../supabase/functions/_shared/accountRules.ts'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Notice, PageHeader } from '../../components/ui/States'
import { useAuth } from './AuthProvider'

const schema = z
  .object({
    current: z.string().min(1, 'Nhập mật khẩu hiện tại'),
    next: z.string().min(MIN_PASSWORD_LENGTH, `Mật khẩu mới cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự`),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ['confirm'], message: 'Hai lần nhập không khớp' })
  .refine((v) => v.next !== v.current, { path: ['next'], message: 'Mật khẩu mới phải khác mật khẩu cũ' })
type FormValues = z.infer<typeof schema>

export function ChangePasswordPage() {
  const { session } = useAuth()
  const [result, setResult] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setResult(null)
    const email = session?.user.email
    if (!email) return
    // Xác minh mật khẩu cũ bằng cách đăng nhập lại trước khi đổi (CLAUDE.md 4.1).
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: values.current })
    if (verifyErr) {
      setResult({ tone: 'danger', text: 'Mật khẩu hiện tại không đúng' })
      return
    }
    const { error } = await supabase.auth.updateUser({ password: values.next })
    if (error) {
      setResult({ tone: 'danger', text: error.message })
      return
    }
    reset()
    setResult({ tone: 'ok', text: 'Đã đổi mật khẩu' })
  }

  return (
    <div className="max-w-md">
      <PageHeader title="Đổi mật khẩu" />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-line bg-surface p-5" noValidate>
        {result && <Notice tone={result.tone}>{result.text}</Notice>}
        <Field label="Mật khẩu hiện tại" error={errors.current?.message}>
          {(id, desc) => (
            <Input id={id} type="password" autoComplete="current-password" aria-describedby={desc} {...register('current')} />
          )}
        </Field>
        <Field label="Mật khẩu mới" error={errors.next?.message}>
          {(id, desc) => (
            <Input id={id} type="password" autoComplete="new-password" aria-describedby={desc} {...register('next')} />
          )}
        </Field>
        <Field label="Nhập lại mật khẩu mới" error={errors.confirm?.message}>
          {(id, desc) => (
            <Input id={id} type="password" autoComplete="new-password" aria-describedby={desc} {...register('confirm')} />
          )}
        </Field>
        <Button type="submit" loading={isSubmitting}>
          Đổi mật khẩu
        </Button>
      </form>
    </div>
  )
}
