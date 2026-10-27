import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  generatePassword,
  MIN_PASSWORD_LENGTH,
  ROLE_LABELS,
  suggestUsername,
  validateUsername,
  type OrgRole,
} from '../../../supabase/functions/_shared/accountRules.ts'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { Notice } from '../../components/ui/States'
import type { MemberRow } from './accountsApi'
import { loginMessage } from './memberFilters'
import { useAdminUsers } from './useAccounts'

const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH, `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự`)

/** Khung hiện thông tin đăng nhập + nút Sao chép (dán vào Zalo cho phụ huynh / học sinh). */
function CredentialsBox({ message }: { message: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-3">
      <pre className="rounded-xl bg-brand-50 p-4 font-sans text-[15px] whitespace-pre-wrap text-ink">{message}</pre>
      <Button
        variant="accent"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(message)
            setCopied(true)
          } catch {
            setCopied(false)
          }
        }}
      >
        <Icon name={copied ? 'check' : 'copy'} className="size-4" /> {copied ? 'Đã sao chép' : 'Sao chép'}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tạo tài khoản
// ---------------------------------------------------------------------------

const createSchema = z
  .object({
    role: z.enum(['org_admin', 'teacher', 'student', 'parent']),
    full_name: z.string().trim().min(1, 'Nhập họ tên'),
    login_type: z.enum(['username', 'email']),
    username: z.string().trim().toLowerCase(),
    email: z.string().trim().toLowerCase(),
    password: passwordSchema,
    phone: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.login_type === 'username') {
      const err = validateUsername(v.username)
      if (err) ctx.addIssue({ code: 'custom', path: ['username'], message: err })
    } else if (!z.email().safeParse(v.email).success) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Email chưa đúng' })
    }
  })
type CreateValues = z.infer<typeof createSchema>

export function CreateAccountDialog({
  open,
  onOpenChange,
  orgId,
  roles,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  /** Vai trò được tạo (đã lọc theo quyền) — không dùng ô disabled vì react-hook-form bỏ giá trị ô disabled */
  roles: OrgRole[]
}) {
  const mutation = useAdminUsers(orgId)
  const [created, setCreated] = useState<string | null>(null)
  const defaults = (): CreateValues => ({
    role: roles.includes('student') ? 'student' : roles[0],
    full_name: '',
    login_type: 'username',
    username: '',
    email: '',
    password: generatePassword(),
    phone: '',
  })
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, dirtyFields },
  } = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: defaults() })

  const loginType = watch('login_type')
  const fullName = watch('full_name')

  // Gợi ý tên đăng nhập theo họ tên cho tới khi người dùng tự sửa ô tên đăng nhập.
  useEffect(() => {
    if (!dirtyFields.username) setValue('username', suggestUsername(fullName ?? ''))
  }, [fullName, dirtyFields.username, setValue])

  const close = (next: boolean) => {
    if (!next) {
      reset(defaults())
      setCreated(null)
      mutation.reset()
    }
    onOpenChange(next)
  }

  const onSubmit = (v: CreateValues) => {
    const base = { role: v.role, full_name: v.full_name, password: v.password, phone: v.phone || undefined }
    const input = v.login_type === 'username' ? { ...base, username: v.username } : { ...base, email: v.email }
    mutation.mutate(
      { action: 'create', ...input },
      {
        onSuccess: () =>
          setCreated(
            loginMessage({
              fullName: v.full_name,
              loginId: v.login_type === 'username' ? v.username : v.email,
              password: v.password,
              siteUrl: window.location.origin,
            }),
          ),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={created ? 'Đã tạo tài khoản' : 'Tạo tài khoản'}
      description={created ? 'Gửi thông tin này cho người dùng. Mật khẩu chỉ hiện một lần.' : undefined}
      footer={
        created ? (
          <Button onClick={() => close(false)}>Xong</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Hủy
            </Button>
            <Button type="submit" form="create-account" loading={mutation.isPending}>
              Tạo tài khoản
            </Button>
          </>
        )
      }
    >
      {created ? (
        <CredentialsBox message={created} />
      ) : (
        <form id="create-account" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {mutation.error && <Notice tone="danger">{mutation.error.message}</Notice>}
          <Field label="Vai trò">
            {(id) => (
              <Select id={id} {...register('role')}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Họ tên" error={errors.full_name?.message}>
            {(id, desc) => <Input id={id} aria-describedby={desc} autoComplete="off" {...register('full_name')} />}
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">Đăng nhập bằng</legend>
            <div className="flex gap-2">
              {(
                [
                  ['username', 'Tên đăng nhập (không cần email)'],
                  ['email', 'Email'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                    loginType === value ? 'border-brand-800 bg-brand-50 font-medium' : 'border-line'
                  }`}
                >
                  <input type="radio" value={value} className="sr-only" {...register('login_type')} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {loginType === 'username' ? (
            <Field
              label="Tên đăng nhập"
              error={errors.username?.message}
              hint="Chữ thường không dấu, số, dấu chấm hoặc gạch dưới. Tự gợi ý theo họ tên."
            >
              {(id, desc) => (
                <Input
                  id={id}
                  aria-describedby={desc}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  {...register('username')}
                />
              )}
            </Field>
          ) : (
            <Field label="Email" error={errors.email?.message}>
              {(id, desc) => <Input id={id} type="email" aria-describedby={desc} {...register('email')} />}
            </Field>
          )}

          <Field label="Mật khẩu" error={errors.password?.message}>
            {(id, desc) => (
              <div className="flex gap-2">
                <Input id={id} aria-describedby={desc} autoComplete="off" spellCheck={false} {...register('password')} />
                <Button variant="secondary" onClick={() => setValue('password', generatePassword())}>
                  Đổi
                </Button>
              </div>
            )}
          </Field>
          <Field label="Số điện thoại (không bắt buộc)">
            {(id) => <Input id={id} type="tel" inputMode="tel" {...register('phone')} />}
          </Field>
        </form>
      )}
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Đặt lại mật khẩu
// ---------------------------------------------------------------------------

export function ResetPasswordDialog({
  member,
  orgId,
  onClose,
}: {
  member: MemberRow | null
  orgId: string
  onClose: () => void
}) {
  const mutation = useAdminUsers(orgId)
  const [password, setPassword] = useState(generatePassword)
  const [done, setDone] = useState<string | null>(null)
  const error = password.length < MIN_PASSWORD_LENGTH ? `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự` : undefined

  const close = () => {
    setDone(null)
    setPassword(generatePassword())
    mutation.reset()
    onClose()
  }

  const loginId = member?.profile?.username ?? member?.profile?.email ?? ''
  return (
    <Dialog
      open={!!member}
      onOpenChange={(o) => !o && close()}
      title={done ? 'Đã đặt lại mật khẩu' : 'Đặt lại mật khẩu'}
      description={done ? undefined : member?.profile?.full_name}
      footer={
        done ? (
          <Button onClick={close}>Xong</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Hủy
            </Button>
            <Button
              loading={mutation.isPending}
              disabled={!!error}
              onClick={() =>
                member &&
                mutation.mutate(
                  { action: 'reset_password', user_id: member.user_id, password },
                  {
                    onSuccess: () =>
                      setDone(
                        loginMessage({
                          fullName: member.profile?.full_name ?? '',
                          loginId,
                          password,
                          siteUrl: window.location.origin,
                        }),
                      ),
                  },
                )
              }
            >
              Đặt lại
            </Button>
          </>
        )
      }
    >
      {done ? (
        <CredentialsBox message={done} />
      ) : (
        <div className="space-y-4">
          {mutation.error && <Notice tone="danger">{mutation.error.message}</Notice>}
          <Field label="Mật khẩu mới" error={error}>
            {(id, desc) => (
              <div className="flex gap-2">
                <Input id={id} aria-describedby={desc} value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button variant="secondary" onClick={() => setPassword(generatePassword())}>
                  Đổi
                </Button>
              </div>
            )}
          </Field>
        </div>
      )}
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Sửa thông tin + đổi vai trò
// ---------------------------------------------------------------------------

const editSchema = z.object({
  full_name: z.string().trim().min(1, 'Nhập họ tên'),
  phone: z.string().trim(),
  role: z.enum(['org_admin', 'teacher', 'student', 'parent']),
})
type EditValues = z.infer<typeof editSchema>

export function EditAccountDialog({
  member,
  orgId,
  canChangeRole,
  roles,
  onClose,
}: {
  member: MemberRow
  orgId: string
  canChangeRole: boolean
  roles: OrgRole[]
  onClose: () => void
}) {
  const mutation = useAdminUsers(orgId)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { full_name: member.profile?.full_name ?? '', phone: member.profile?.phone ?? '', role: member.role },
  })
  const roleOptions = roles.includes(member.role) ? roles : [member.role, ...roles]

  const onSubmit = async (v: EditValues) => {
    await mutation.mutateAsync({ action: 'update_profile', user_id: member.user_id, full_name: v.full_name, phone: v.phone || null })
    if (canChangeRole && v.role !== member.role) {
      await mutation.mutateAsync({ action: 'change_role', user_id: member.user_id, role: v.role })
    }
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Sửa thông tin"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" form="edit-account" loading={isSubmitting}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="edit-account" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {mutation.error && <Notice tone="danger">{mutation.error.message}</Notice>}
        <Field label="Họ tên" error={errors.full_name?.message}>
          {(id, desc) => <Input id={id} aria-describedby={desc} {...register('full_name')} />}
        </Field>
        <Field label="Số điện thoại">
          {(id) => <Input id={id} type="tel" inputMode="tel" {...register('phone')} />}
        </Field>
        {canChangeRole && (
          <Field label="Vai trò">
            {(id) => (
              <Select id={id} {...register('role')}>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </form>
    </Dialog>
  )
}
