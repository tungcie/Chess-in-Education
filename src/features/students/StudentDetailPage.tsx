import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useParams } from 'react-router'
import { rolesCreatableBy } from '../../../supabase/functions/_shared/accountRules.ts'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog'
import { Field, Input } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from '../../components/ui/Menu'
import { Badge, EmptyState, ErrorState, LoadingRows, Notice } from '../../components/ui/States'
import { formatDate, todayVN } from '../../lib/format'
import { CreateAccountDialog } from '../accounts/AccountDialogs'
import { useOrg } from '../auth/AuthProvider'
import { StudentDialog } from './StudentDialog'
import type { Guardian } from './studentsApi'
import { ageOn, GENDER_LABELS, STATUS_LABELS, STATUS_TONE, type StudentStatus } from './studentRules'
import { useGuardians, useLinkedAccounts, useStudent, useStudentMutations } from './useStudents'

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-[15px] sm:block">
      <dt className="text-muted sm:text-xs sm:uppercase">{label}</dt>
      <dd className="text-right font-medium text-ink sm:mt-0.5 sm:text-left">{children || '—'}</dd>
    </div>
  )
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="font-semibold text-ink">{title}</h2>
        {action}
      </div>
      <div className="px-4 py-2">{children}</div>
    </section>
  )
}

export function StudentDetailPage() {
  const { id = '' } = useParams()
  const { org, role, actor } = useOrg()
  const navigate = useNavigate()
  const student = useStudent(org.id, id)
  const guardians = useGuardians(org.id, id)
  const accounts = useLinkedAccounts(org.id, id)
  const m = useStudentMutations(org.id)
  const isAdmin = role === 'org_admin'

  const [editing, setEditing] = useState(false)
  const [guardianEdit, setGuardianEdit] = useState<Guardian | 'new' | null>(null)
  const [confirm, setConfirm] = useState<
    { kind: 'delete' } | { kind: 'deleteGuardian'; guardian: Guardian } | { kind: 'unlink'; linkId: string; name: string } | null
  >(null)
  const [accountOpen, setAccountOpen] = useState(false)

  if (student.isPending) return <LoadingRows rows={5} />
  if (student.isError) return <ErrorState error={student.error} onRetry={() => student.refetch()} />
  const s = student.data
  if (!s) {
    return (
      <EmptyState title="Không tìm thấy học viên" action={<Link to="/hoc-vien" className="text-brand-700 underline">Về danh sách</Link>}>
        Hồ sơ không tồn tại hoặc bạn không có quyền xem.
      </EmptyState>
    )
  }

  const age = ageOn(s.birth_date, todayVN())
  // Giáo viên tạo tài khoản cho em mình tạo (Edge Function kiểm lại)
  const canCreateAccount =
    rolesCreatableBy(actor).some((r) => r === 'student' || r === 'parent') && (isAdmin || s.created_by === actor.userId)

  const changeStatus = (status: StudentStatus) => m.setStatus.mutate({ id: s.id, status })

  return (
    <div className="space-y-4">
      <Link to="/hoc-vien" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <Icon name="chevronLeft" className="size-4" /> Học viên
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{s.full_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABELS[s.status]}</Badge>
            {age !== null && <span>{age} tuổi</span>}
            {s.school_class && <span>· Lớp {s.school_class}</span>}
            {s.level && <span>· {s.level}</span>}
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Sửa hồ sơ
            </Button>
            <MenuRoot>
              <MenuTrigger asChild>
                <Button variant="secondary" className="w-10 px-0" aria-label="Thao tác khác">
                  <Icon name="more" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                {(['active', 'paused', 'inactive'] as const)
                  .filter((st) => st !== s.status)
                  .map((st) => (
                    <MenuItem key={st} onSelect={() => changeStatus(st)}>
                      Chuyển sang “{STATUS_LABELS[st]}”
                    </MenuItem>
                  ))}
                <MenuSeparator />
                <MenuItem danger onSelect={() => setConfirm({ kind: 'delete' })}>
                  Xóa hồ sơ
                </MenuItem>
              </MenuContent>
            </MenuRoot>
          </div>
        )}
      </div>

      {m.setStatus.error && <Notice tone="danger">{m.setStatus.error.message}</Notice>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Thông tin">
            <dl className="divide-y divide-line sm:grid sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
              <InfoRow label="Ngày sinh">{formatDate(s.birth_date)}</InfoRow>
              <InfoRow label="Giới tính">{s.gender ? GENDER_LABELS[s.gender] : ''}</InfoRow>
              <InfoRow label="Lớp ở trường">{s.school_class}</InfoRow>
              <InfoRow label="Trình độ">{s.level}</InfoRow>
              <InfoRow label="Ngày bắt đầu học">{formatDate(s.start_date)}</InfoRow>
              <InfoRow label="SĐT của em">{s.phone}</InfoRow>
              <InfoRow label="Email">{s.email}</InfoRow>
              <InfoRow label="Địa chỉ">{s.address}</InfoRow>
            </dl>
            {s.notes && <p className="border-t border-line py-3 text-[15px] whitespace-pre-wrap text-ink">{s.notes}</p>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card
            title="Phụ huynh"
            action={
              isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => setGuardianEdit('new')}>
                  <Icon name="plus" className="size-4" /> Thêm
                </Button>
              )
            }
          >
            {guardians.isPending ? (
              <LoadingRows rows={1} />
            ) : guardians.isError ? (
              <ErrorState error={guardians.error} onRetry={() => guardians.refetch()} />
            ) : guardians.data.length === 0 ? (
              <p className="py-2 text-sm text-muted">Chưa có liên hệ phụ huynh.</p>
            ) : (
              <ul className="divide-y divide-line">
                {guardians.data.map((g) => (
                  <li key={g.id} className="flex items-start gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">
                        {g.full_name}
                        {g.relation && <span className="font-normal text-muted"> · {g.relation}</span>}
                        {g.is_primary && (
                          <span className="ml-2 align-middle">
                            <Badge tone="accent">Chính</Badge>
                          </span>
                        )}
                      </p>
                      {g.phone && (
                        <a href={`tel:${g.phone}`} className="text-sm text-brand-700 underline">
                          {g.phone}
                        </a>
                      )}
                      {g.zalo_name && <p className="text-sm text-muted">Zalo: {g.zalo_name}</p>}
                    </div>
                    {isAdmin && (
                      <MenuRoot>
                        <MenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="size-8 px-0" aria-label={`Thao tác với ${g.full_name}`}>
                            <Icon name="more" />
                          </Button>
                        </MenuTrigger>
                        <MenuContent>
                          <MenuItem onSelect={() => setGuardianEdit(g)}>Sửa</MenuItem>
                          <MenuItem danger onSelect={() => setConfirm({ kind: 'deleteGuardian', guardian: g })}>
                            Xóa
                          </MenuItem>
                        </MenuContent>
                      </MenuRoot>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Tài khoản đăng nhập"
            action={
              canCreateAccount && (
                <Button variant="ghost" size="sm" onClick={() => setAccountOpen(true)}>
                  <Icon name="plus" className="size-4" /> Tạo
                </Button>
              )
            }
          >
            {accounts.isPending ? (
              <LoadingRows rows={1} />
            ) : accounts.isError ? (
              <ErrorState error={accounts.error} onRetry={() => accounts.refetch()} />
            ) : accounts.data.length === 0 ? (
              <p className="py-2 text-sm text-muted">Chưa có tài khoản. Tạo tài khoản để em / phụ huynh xem lịch và tiến độ.</p>
            ) : (
              <ul className="divide-y divide-line">
                {accounts.data.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{a.profile?.full_name ?? '—'}</p>
                      <p className="truncate text-sm text-muted">
                        {a.relation === 'parent' ? 'Phụ huynh' : 'Học sinh'} · {a.profile?.username ?? a.profile?.email ?? ''}
                      </p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirm({ kind: 'unlink', linkId: a.id, name: a.profile?.full_name ?? '' })}
                      >
                        Gỡ
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {editing && (
        <StudentDialog
          open
          student={s}
          saving={m.update.isPending}
          error={m.update.error}
          onClose={() => {
            setEditing(false)
            m.update.reset()
          }}
          onSubmit={(v) => m.update.mutate({ id: s.id, input: v.input }, { onSuccess: () => setEditing(false) })}
        />
      )}

      {guardianEdit && (
        <GuardianDialog
          guardian={guardianEdit === 'new' ? null : guardianEdit}
          isFirst={(guardians.data?.length ?? 0) === 0}
          saving={m.saveGuardian.isPending}
          error={m.saveGuardian.error}
          onClose={() => {
            setGuardianEdit(null)
            m.saveGuardian.reset()
          }}
          onSubmit={(input) =>
            m.saveGuardian.mutate(
              { studentId: s.id, input, id: guardianEdit === 'new' ? undefined : guardianEdit.id },
              { onSuccess: () => setGuardianEdit(null) },
            )
          }
        />
      )}

      <CreateAccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        orgId={org.id}
        roles={rolesCreatableBy(actor)}
        student={{ id: s.id, full_name: s.full_name }}
        onCreated={() => accounts.refetch()}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (!o) {
            setConfirm(null)
            m.remove.reset()
            m.deleteGuardian.reset()
            m.unlink.reset()
          }
        }}
        title={
          confirm?.kind === 'delete' ? 'Xóa hồ sơ học viên?' : confirm?.kind === 'deleteGuardian' ? 'Xóa phụ huynh?' : 'Gỡ tài khoản?'
        }
        confirmLabel={confirm?.kind === 'unlink' ? 'Gỡ' : 'Xóa'}
        danger
        loading={m.remove.isPending || m.deleteGuardian.isPending || m.unlink.isPending}
        onConfirm={() => {
          if (!confirm) return
          if (confirm.kind === 'delete') {
            m.remove.mutate(s.id, { onSuccess: () => navigate('/hoc-vien', { replace: true }) })
          } else if (confirm.kind === 'deleteGuardian') {
            m.deleteGuardian.mutate(confirm.guardian.id, { onSuccess: () => setConfirm(null) })
          } else {
            m.unlink.mutate(confirm.linkId, { onSuccess: () => setConfirm(null) })
          }
        }}
      >
        {(m.remove.error || m.deleteGuardian.error || m.unlink.error) && (
          <Notice tone="danger">{(m.remove.error ?? m.deleteGuardian.error ?? m.unlink.error)?.message}</Notice>
        )}
        {confirm?.kind === 'delete' && (
          <>
            <p>
              Xóa hồ sơ <strong>{s.full_name}</strong> sẽ mất luôn:
            </p>
            <ul className="list-disc pl-5">
              <li>thông tin phụ huynh ({guardians.data?.length ?? 0})</li>
              <li>liên kết với tài khoản đăng nhập ({accounts.data?.length ?? 0}) — tài khoản vẫn còn, xóa ở trang Tài khoản</li>
            </ul>
            <p>Không hoàn tác được. Em chỉ nghỉ học thì nên chuyển “Đã nghỉ” thay vì xóa.</p>
          </>
        )}
        {confirm?.kind === 'deleteGuardian' && (
          <p>
            Xóa liên hệ <strong>{confirm.guardian.full_name}</strong>?
          </p>
        )}
        {confirm?.kind === 'unlink' && (
          <p>
            Gỡ tài khoản <strong>{confirm.name}</strong> khỏi hồ sơ này? Tài khoản vẫn còn, chỉ không xem được hồ sơ em nữa.
          </p>
        )}
      </ConfirmDialog>
    </div>
  )
}

const guardianSchema = z.object({
  full_name: z.string().trim().min(1, 'Nhập họ tên'),
  relation: z.string(),
  phone: z.string(),
  zalo_name: z.string(),
  is_primary: z.boolean(),
})
type GuardianValues = z.infer<typeof guardianSchema>

function GuardianDialog({
  guardian,
  isFirst,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  guardian: Guardian | null
  isFirst: boolean
  saving: boolean
  error: Error | null
  onClose: () => void
  onSubmit: (v: GuardianValues) => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GuardianValues>({
    resolver: zodResolver(guardianSchema),
    defaultValues: {
      full_name: guardian?.full_name ?? '',
      relation: guardian?.relation ?? '',
      phone: guardian?.phone ?? '',
      zalo_name: guardian?.zalo_name ?? '',
      is_primary: guardian?.is_primary ?? isFirst,
    },
  })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={guardian ? 'Sửa phụ huynh' : 'Thêm phụ huynh'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" form="guardian-form" loading={saving}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="guardian-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <Notice tone="danger">{error.message}</Notice>}
        <Field label="Họ tên" error={errors.full_name?.message}>
          {(id, desc) => <Input id={id} aria-describedby={desc} {...register('full_name')} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quan hệ" hint="Mẹ, Bố, Bà…">
            {(id, desc) => <Input id={id} aria-describedby={desc} {...register('relation')} />}
          </Field>
          <Field label="Số điện thoại">{(id) => <Input id={id} type="tel" inputMode="tel" {...register('phone')} />}</Field>
        </div>
        <Field label="Tên Zalo">{(id) => <Input id={id} {...register('zalo_name')} />}</Field>
        <label className="flex items-center gap-2 text-[15px]">
          <input type="checkbox" className="size-4 accent-brand-800" {...register('is_primary')} />
          Liên hệ chính (nhận tin học phí, báo cáo)
        </label>
      </form>
    </Dialog>
  )
}
