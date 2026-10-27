import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '../../components/ui/Menu'
import { Badge, EmptyState, ErrorState, LoadingRows, Notice, PageHeader } from '../../components/ui/States'
import { addMonths, monthLabel, monthOf } from '../../lib/dates'
import { formatDate, formatDateTimeVN, formatMoney, todayVN } from '../../lib/format'
import { compareVietnameseNames } from '../students/studentRules'
import { useOrg } from '../auth/AuthProvider'
import { buildTuitionRows, isBillable, lowPackages, packageUsage, type StudentTuitionRow } from './billing'
import { addPackage, addPayment, loadTuition, type TuitionData } from './tuitionApi'

type Filter = 'all' | 'owing' | 'low'

const emptyRow = (student_id: string): StudentTuitionRow => ({
  student_id,
  monthSessions: 0,
  monthAmount: 0,
  monthPackageSessions: 0,
  monthPackagesBought: 0,
  monthPaid: 0,
  totalCharged: 0,
  totalPaid: 0,
  balance: 0,
  packages: [],
})
const METHOD_LABELS = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', other: 'Khác' } as const

export function TuitionPage() {
  const { org } = useOrg()
  const qc = useQueryClient()
  const data = useQuery({ queryKey: [org.id, 'tuition'], queryFn: () => loadTuition(org.id) })
  const [month, setMonth] = useState(monthOf(todayVN()))
  const [filter, setFilter] = useState<Filter>('all')
  const [payFor, setPayFor] = useState<StudentTuitionRow | null>(null)
  const [packageFor, setPackageFor] = useState<StudentTuitionRow | null>(null)
  const [historyFor, setHistoryFor] = useState<StudentTuitionRow | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: [org.id, 'tuition'] })

  const rows = useMemo(() => {
    if (!data.data) return []
    const built = buildTuitionRows({ month, ...data.data })
    // Em vừa chuyển sang "Gói buổi" mà chưa mua gói / chưa học buổi nào vẫn phải hiện để còn thêm gói
    const present = new Set(built.map((r) => r.student_id))
    for (const m of data.data.members) {
      if (m.status !== 'active' || m.billing_mode !== 'package' || present.has(m.student_id)) continue
      present.add(m.student_id)
      built.push({
        ...emptyRow(m.student_id),
        packages: [packageUsage(m.id, data.data.packages, data.data.attendance)],
      })
    }
    return built.sort((a, b) =>
      compareVietnameseNames(data.data.studentNames.get(a.student_id) ?? '', data.data.studentNames.get(b.student_id) ?? ''),
    )
  }, [data.data, month])
  const low = useMemo(() => new Set(lowPackages(rows).map((x) => x.student_id)), [rows])
  const visible = rows.filter((r) => filter === 'all' || (filter === 'owing' ? r.balance > 0 : low.has(r.student_id)))

  const totals = rows.reduce(
    (t, r) => ({
      due: t.due + r.monthAmount + r.monthPackagesBought,
      paid: t.paid + r.monthPaid,
      owing: t.owing + Math.max(r.balance, 0),
    }),
    { due: 0, paid: 0, owing: 0 },
  )

  const name = (id: string) => data.data?.studentNames.get(id) ?? '(không rõ tên)'
  const className = (memberId: string) => {
    const m = data.data?.members.find((x) => x.id === memberId)
    return m ? (data.data?.classNames.get(m.class_id) ?? '') : ''
  }

  return (
    <div>
      <PageHeader
        title="Học phí"
        description="Theo buổi: Có mặt + Vắng không phép × giá 1 buổi. Vắng có phép không tính. Gói: trừ dần theo buổi."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" className="size-9 px-0" aria-label="Tháng trước" onClick={() => setMonth(addMonths(month, -1))}>
              <Icon name="chevronLeft" />
            </Button>
            <span className="min-w-32 text-center font-semibold text-ink">{monthLabel(month)}</span>
            <Button variant="secondary" size="sm" className="size-9 px-0" aria-label="Tháng sau" onClick={() => setMonth(addMonths(month, 1))}>
              <Icon name="chevronRight" />
            </Button>
          </div>
        }
      />

      {data.isPending ? (
        <LoadingRows rows={5} />
      ) : data.isError ? (
        <ErrorState error={data.error} onRetry={() => data.refetch()} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              ['Phải thu tháng này', totals.due],
              ['Đã thu tháng này', totals.paid],
              ['Tổng còn nợ', totals.owing],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
                <p className="text-xs text-muted sm:text-sm">{label}</p>
                <p className="mt-1 text-base font-bold text-ink sm:text-2xl">{formatMoney(value as number)}</p>
              </div>
            ))}
          </div>

          <div className="mb-4 flex gap-1 overflow-x-auto" role="tablist">
            {(
              [
                ['all', `Tất cả ${rows.length}`],
                ['owing', `Còn nợ ${rows.filter((r) => r.balance > 0).length}`],
                ['low', `Gói sắp hết ${low.size}`],
              ] as Array<[Filter, string]>
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
                  filter === f ? 'bg-brand-800 text-white' : 'bg-surface text-ink ring-1 ring-line hover:bg-brand-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState title="Không có học phí ở mục này">
              Học phí tự tính khi điểm danh (Có mặt / Vắng không phép) hoặc khi thêm gói buổi.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {visible.map((r) => (
                <li key={r.student_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <Link to={`/hoc-vien/${r.student_id}`} className="font-medium text-ink hover:underline">
                      {name(r.student_id)}
                    </Link>
                    <p className="text-sm text-muted">
                      {r.monthSessions > 0 && `${r.monthSessions} buổi · ${formatMoney(r.monthAmount)}`}
                      {r.monthSessions > 0 && r.monthPackageSessions > 0 && ' · '}
                      {r.monthPackageSessions > 0 && `${r.monthPackageSessions} buổi trừ gói`}
                      {r.monthPackagesBought > 0 && ` · mua gói ${formatMoney(r.monthPackagesBought)}`}
                      {r.monthSessions === 0 && r.monthPackageSessions === 0 && r.monthPackagesBought === 0 && 'Không có buổi tính tiền tháng này'}
                    </p>
                    {r.packages.map((p) => (
                      <p key={p.member_id} className="text-sm">
                        <span className="text-muted">Gói {className(p.member_id)}: </span>
                        {p.overflow > 0 ? (
                          <Badge tone="danger">Học nợ {p.overflow} buổi</Badge>
                        ) : (
                          <Badge tone={p.remaining <= 2 ? 'warn' : 'ok'}>
                            Còn {p.remaining}/{p.total} buổi
                          </Badge>
                        )}
                      </p>
                    ))}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">Còn nợ</p>
                    <p className={`font-bold ${r.balance > 0 ? 'text-danger-600' : r.balance < 0 ? 'text-ok-600' : 'text-ink'}`}>
                      {r.balance < 0 ? `Dư ${formatMoney(-r.balance)}` : formatMoney(r.balance)}
                    </p>
                    {r.monthPaid !== 0 && <p className="text-xs text-muted">Tháng này đã đóng {formatMoney(r.monthPaid)}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" onClick={() => setPayFor(r)}>
                      Ghi đóng tiền
                    </Button>
                    <MenuRoot>
                      <MenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={`Thao tác học phí ${name(r.student_id)}`}>
                          <Icon name="more" />
                        </Button>
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem onSelect={() => setHistoryFor(r)}>Lịch sử học phí</MenuItem>
                        <MenuItem onSelect={() => setPackageFor(r)}>Thêm gói buổi</MenuItem>
                      </MenuContent>
                    </MenuRoot>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-muted">
            Học viên chưa có ở đây? Thêm em vào lớp (tab Học viên của lớp) và điểm danh — học phí tự tính.
          </p>
        </>
      )}

      {payFor && data.data && (
        <PaymentDialog
          orgId={org.id}
          row={payFor}
          studentName={name(payFor.student_id)}
          onClose={() => setPayFor(null)}
          onSaved={() => {
            setPayFor(null)
            refresh()
          }}
        />
      )}
      {packageFor && data.data && (
        <PackageDialog
          orgId={org.id}
          studentId={packageFor.student_id}
          studentName={name(packageFor.student_id)}
          data={data.data}
          onClose={() => setPackageFor(null)}
          onSaved={() => {
            setPackageFor(null)
            refresh()
          }}
        />
      )}
      {historyFor && data.data && (
        <HistoryDialog studentId={historyFor.student_id} studentName={name(historyFor.student_id)} data={data.data} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  )
}

function PaymentDialog({
  orgId,
  row,
  studentName,
  onClose,
  onSaved,
}: {
  orgId: string
  row: StudentTuitionRow
  studentName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState(row.balance > 0 ? String(row.balance) : '')
  const [paidOn, setPaidOn] = useState(todayVN())
  const [method, setMethod] = useState<'cash' | 'transfer' | 'other'>('transfer')
  const [note, setNote] = useState('')
  const [adjust, setAdjust] = useState(false)
  const value = Number(amount || 0)
  const save = useMutation({
    mutationFn: () => {
      if (!Number.isInteger(value) || value <= 0) throw new Error('Nhập số tiền (đồng) lớn hơn 0')
      if (adjust && !note.trim()) throw new Error('Ghi lý do điều chỉnh')
      return addPayment(orgId, { student_id: row.student_id, amount: adjust ? -value : value, paid_on: paidOn, method, note })
    },
    onSuccess: onSaved,
  })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={adjust ? 'Ghi điều chỉnh (trừ bớt)' : 'Ghi đóng tiền'}
      description={`${studentName} · còn nợ ${formatMoney(row.balance)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button variant={adjust ? 'danger' : 'primary'} onClick={() => save.mutate()} loading={save.isPending}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && <Notice tone="danger">{save.error.message}</Notice>}
        <Field label="Số tiền (đồng)" hint={formatMoney(value)}>
          {(id, desc) => (
            <Input id={id} aria-describedby={desc} type="number" inputMode="numeric" min={0} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày đóng">{(id) => <Input id={id} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />}</Field>
          <Field label="Hình thức">
            {(id) => (
              <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                {(Object.keys(METHOD_LABELS) as Array<keyof typeof METHOD_LABELS>).map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label={adjust ? 'Lý do điều chỉnh (bắt buộc)' : 'Ghi chú'}>
          {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder={adjust ? 'Vd: ghi nhầm 500.000 ngày 03/11' : ''} />}
        </Field>
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand-800" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} />
          Đây là khoản điều chỉnh vì đã ghi nhầm trước đó (trừ bớt số đã đóng). Lần đóng tiền không xóa / sửa được.
        </label>
      </div>
    </Dialog>
  )
}

function PackageDialog({
  orgId,
  studentId,
  studentName,
  data,
  onClose,
  onSaved,
}: {
  orgId: string
  studentId: string
  studentName: string
  data: TuitionData
  onClose: () => void
  onSaved: () => void
}) {
  const options = data.members.filter((m) => m.student_id === studentId && m.status === 'active' && m.billing_mode === 'package')
  const [memberId, setMemberId] = useState(options[0]?.id ?? '')
  const [sessions, setSessions] = useState('8')
  const [amount, setAmount] = useState('')
  const [purchasedOn, setPurchasedOn] = useState(todayVN())
  const [note, setNote] = useState('')
  const save = useMutation({
    mutationFn: () => {
      const s = Number(sessions)
      const a = Number(amount || 0)
      if (!memberId) throw new Error('Chọn lớp')
      if (!Number.isInteger(s) || s <= 0) throw new Error('Số buổi phải lớn hơn 0')
      if (!Number.isInteger(a) || a < 0) throw new Error('Số tiền gói không hợp lệ')
      return addPackage(orgId, { member_id: memberId, sessions: s, amount: a, purchased_on: purchasedOn, note })
    },
    onSuccess: onSaved,
  })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Thêm gói buổi"
      description={studentName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={options.length === 0}>
            Thêm gói
          </Button>
        </>
      }
    >
      {options.length === 0 ? (
        <Notice tone="warn">
          Em chưa có lớp nào thu theo <strong>Gói buổi</strong>. Vào lớp → tab Học viên → ⋯ → Sửa học phí → chọn “Gói buổi”.
        </Notice>
      ) : (
        <div className="space-y-4">
          {save.error && <Notice tone="danger">{save.error.message}</Notice>}
          <Field label="Lớp">
            {(id) => (
              <Select id={id} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                {options.map((m) => (
                  <option key={m.id} value={m.id}>
                    {data.classNames.get(m.class_id)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Số buổi">
              {(id) => <Input id={id} type="number" inputMode="numeric" min={1} value={sessions} onChange={(e) => setSessions(e.target.value)} />}
            </Field>
            <Field label="Tiền gói (đồng)" hint={formatMoney(Number(amount || 0))}>
              {(id, desc) => (
                <Input id={id} aria-describedby={desc} type="number" inputMode="numeric" min={0} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} />
              )}
            </Field>
            <Field label="Ngày mua">{(id) => <Input id={id} type="date" value={purchasedOn} onChange={(e) => setPurchasedOn(e.target.value)} />}</Field>
            <Field label="Ghi chú">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          </div>
          <p className="text-sm text-muted">Tiền gói cộng vào “còn nợ” cho tới khi ghi đóng tiền. Buổi học tự trừ dần vào gói.</p>
        </div>
      )}
    </Dialog>
  )
}

function HistoryDialog({ studentId, studentName, data, onClose }: { studentId: string; studentName: string; data: TuitionData; onClose: () => void }) {
  const memberIds = new Set(data.members.filter((m) => m.student_id === studentId).map((m) => m.id))
  const months = new Map<string, { sessions: number; amount: number }>()
  for (const a of data.attendance) {
    if (!memberIds.has(a.member_id) || !isBillable(a.status) || a.billing !== 'per_session') continue
    const mo = monthOf(a.meeting_date)
    const v = months.get(mo) ?? { sessions: 0, amount: 0 }
    months.set(mo, { sessions: v.sessions + 1, amount: v.amount + a.fee })
  }
  type Line = { date: string; label: string; amount: number; kind: 'charge' | 'payment' }
  const lines: Line[] = [
    ...[...months.entries()].map(([mo, v]) => ({
      date: `${mo}-99`,
      label: `${monthLabel(mo)}: ${v.sessions} buổi`,
      amount: v.amount,
      kind: 'charge' as const,
    })),
    ...data.packages
      .filter((p) => memberIds.has(p.member_id))
      .map((p) => {
        const m = data.members.find((x) => x.id === p.member_id)
        return {
          date: p.purchased_on,
          label: `Gói ${p.sessions} buổi · ${m ? data.classNames.get(m.class_id) : ''} (${formatDate(p.purchased_on)})`,
          amount: p.amount,
          kind: 'charge' as const,
        }
      }),
    ...data.payments
      .filter((p) => p.student_id === studentId)
      .map((p) => ({
        date: p.paid_on,
        label: `${p.amount < 0 ? 'Điều chỉnh' : 'Đóng'} ${formatDate(p.paid_on)} · ${METHOD_LABELS[p.method]}${p.collector ? ` · thu bởi ${p.collector.full_name}` : ''}${p.note ? ` · ${p.note}` : ''} (ghi lúc ${formatDateTimeVN(p.created_at)})`,
        amount: p.amount,
        kind: 'payment' as const,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Lịch sử học phí" description={studentName}>
      {lines.length === 0 ? (
        <p className="text-sm text-muted">Chưa có phát sinh.</p>
      ) : (
        <ul className="divide-y divide-line">
          {lines.map((l, i) => (
            <li key={i} className="flex items-start justify-between gap-3 py-2 text-[15px]">
              <span className="text-ink">{l.label}</span>
              <span className={`shrink-0 font-semibold ${l.kind === 'payment' ? 'text-ok-600' : 'text-ink'}`}>
                {l.kind === 'payment' && l.amount > 0 ? '−' : '+'}
                {formatMoney(Math.abs(l.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
