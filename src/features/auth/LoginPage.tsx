import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate } from 'react-router'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { loginIdToEmail } from '../../../supabase/functions/_shared/accountRules.ts'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Notice } from '../../components/ui/States'
import { useAuth } from './AuthProvider'
import { translateAuthError } from './authErrors'

const schema = z.object({
  loginId: z.string().trim().min(1, 'Nhập email hoặc tên đăng nhập'),
  password: z.string().min(1, 'Nhập mật khẩu'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { status } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (status !== 'signedOut' && status !== 'loading') return <Navigate to="/" replace />

  const onSubmit = async (values: FormValues) => {
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: loginIdToEmail(values.loginId),
      password: values.password,
    })
    if (err) setError(translateAuthError(err.message))
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-white to-brand-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <img src="/brand/cie-logo.png" alt="Chess in Education Vietnam" className="mx-auto mb-8 w-64 max-w-full" />
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm"
          noValidate
        >
          <h1 className="text-xl font-bold text-ink">Đăng nhập</h1>
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label="Email hoặc tên đăng nhập" error={errors.loginId?.message}>
            {(id, desc) => (
              <Input
                id={id}
                aria-describedby={desc}
                aria-invalid={!!errors.loginId}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                {...register('loginId')}
              />
            )}
          </Field>
          <Field label="Mật khẩu" error={errors.password?.message}>
            {(id, desc) => (
              <Input
                id={id}
                type="password"
                aria-describedby={desc}
                aria-invalid={!!errors.password}
                autoComplete="current-password"
                {...register('password')}
              />
            )}
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Đăng nhập
          </Button>
          <p className="text-center text-sm text-muted">Quên mật khẩu? Nhờ giáo viên hoặc quản lý đặt lại.</p>
        </form>
        <p className="mt-6 text-center text-xs text-muted">Phát triển bởi Chess Empire</p>
      </div>
    </div>
  )
}
