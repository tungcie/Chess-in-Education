import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '../../components/ui/Menu'
import { Badge, EmptyState, Notice } from '../../components/ui/States'
import { monthOf } from '../../lib/dates'
import { formatDate, formatMoney, todayVN } from '../../lib/format'
import { createStudent } from '../students/studentsApi'
import { filterStudents } from '../students/studentRules'
import { useStudentList } from '../students/useStudents'
import { BILLING_LABELS, isBillable, type Billing } from '../tuition/billing'
import { addMember, removeMember, updateMemberFee, type AttendanceRow, type ClassSummary, type MeetingRow, type MemberRow } from './classesApi'

export function MembersTab({
  cls,
  members,
  meetings,
  attendance,
  canEdit,
  isAdmin,
  onChanged,
}: {
  cls: ClassSummary
  members: MemberRow[]
  meetings: MeetingRow[]
  attendance: AttendanceRow[]
  canEdit: boolean
  isAdmin: boolean
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [feeFor, setFeeFor] = useState<MemberRow | null>(null)
  const [removing, setRemoving] = useState<MemberRow | null>(null)
  const [showRemoved, setShowRemoved] = useState(false)
  const remove = useMutation({
    mutationFn: (m: MemberRow) => removeMember(m.id, todayVN()),
    onSuccess: () => {
      setRemoving(null)
      onChanged()
    },
  })

  const month = monthOf(todayVN())
  const meetingDate = useMemo(() => new Map(meetings.map((m) => [m.id, m.meeting_date])), [meetings])
  const monthBillable = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of attendance) {
      if (isBillable(a.status) && monthOf(meetingDate.get(a.meeting_id) ?? '') === month) map.set(a.member_id, (map.get(a.member_id) ?? 0) + 1)
    }
    return map
  }, [attendance, meetingDate, month])

  const active = members.filter((m) => m.status === 'active').sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'))
  const removed = members.filter((m) => m.status === 'removed')

  const item = (m: MemberRow) => (
    <li key={m.id} className={`flex items-center gap-3 px-4 py-3 ${m.status === 'removed' ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <Link to={`/hoc-vien/${m.student_id}`} className="font-medium text-ink hover:underline">
          {m.full_name}
        </Link>
        <p className="text-sm text-muted">
          {BILLING_LABELS[m.billing_mode]}
          {m.billing_mode === 'per_session' && ` · ${formatMoney(m.fee_per_session)}/buổi`}
          {` · tháng này ${monthBillable.get(m.id) ?? 0} buổi tính tiền`}
          {m.status === 'removed' && m.left_on && ` · rời lớp ${formatDate(m.left_on)}`}
        </p>
      </div>
      {canEdit && m.status === 'active' && (
        <MenuRoot>
          <MenuTrigger asChild>
            <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={`Thao tác với ${m.full_name}`}>
              <Icon name="more" />
            </Button>
          </MenuTrigger>
          <MenuContent>
            {isAdmin && <MenuItem onSelect={() => setFeeFor(m)}>Sửa học phí</MenuItem>}
            <MenuItem danger onSelect={() => setRemoving(m)}>
              Cho rời lớp
            </MenuItem>
          </MenuContent>
        </MenuRoot>
      )}
    </li>
  )

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => setAdding(true)}>
            <Icon name="plus" className="size-4" /> Thêm học viên
          </Button>
        </div>
      )}
      {active.length === 0 ? (
        <EmptyState title="Lớp chưa có học viên">{canEdit && 'Bấm “Thêm học viên”.'}</EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{active.map(item)}</ul>
      )}
      {removed.length > 0 && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setShowRemoved((v) => !v)}>
            {showRemoved ? 'Ẩn' : 'Xem'} {removed.length} học viên đã rời lớp
          </Button>
          {showRemoved && <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{removed.map(item)}</ul>}
        </div>
      )}

      {adding && (
        <AddMemberDialog
          cls={cls}
          members={members}
          isAdmin={isAdmin}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false)
            onChanged()
          }}
        />
      )}
      {feeFor && (
        <FeeDialog
          member={feeFor}
          onClose={() => setFeeFor(null)}
          onSaved={() => {
            setFeeFor(null)
            onChanged()
          }}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => {
          if (!o) {
            setRemoving(null)
            remove.reset()
          }
        }}
        title="Cho rời lớp?"
        confirmLabel="Cho rời lớp"
        danger
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      >
        {remove.error && <Notice tone="danger">{remove.error.message}</Notice>}
        <p>
          <strong>{removing?.full_name}</strong> rời lớp từ hôm nay. Điểm danh và học phí đã có vẫn giữ; thêm lại vào lớp được.
        </p>
      </ConfirmDialog>
    </div>
  )
}

function AddMemberDialog({
  cls,
  members,
  isAdmin,
  onClose,
  onAdded,
}: {
  cls: ClassSummary
  members: MemberRow[]
  isAdmin: boolean
  onClose: () => void
  onAdded: () => void
}) {
  const students = useStudentList(cls.org_id)
  const [search, setSearch] = useState('')
  const [studentId, setStudentId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [fee, setFee] = useState(String(cls.default_fee))
  const [billing, setBilling] = useState<Billing>('per_session')

  const activeIds = new Set(members.filter((m) => m.status === 'active').map((m) => m.student_id))
  const candidates = filterStudents(students.data ?? [], 'active', search).filter((s) => !activeIds.has(s.id))
  const feeNumber = Number(fee || 0)

  const add = useMutation({
    mutationFn: async () => {
      if (!Number.isInteger(feeNumber) || feeNumber < 0) throw new Error('Giá 1 buổi phải là số tiền (đồng), không âm')
      let id = studentId
      if (!id) {
        if (!newName.trim()) throw new Error('Chọn học viên, hoặc nhập tên để tạo hồ sơ mới')
        id = await createStudent(
          cls.org_id,
          { full_name: newName, birth_date: '', gender: '', address: '', school_class: '', phone: '', email: '', level: '', start_date: todayVN(), notes: '' },
          null,
        )
      }
      await addMember(cls.org_id, cls.id, id, feeNumber, billing, members.find((m) => m.student_id === id))
    },
    onSuccess: onAdded,
  })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Thêm học viên vào lớp"
      description={cls.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={() => add.mutate()} loading={add.isPending}>
            Thêm vào lớp
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {add.error && <Notice tone="danger">{add.error.message}</Notice>}
        <Field label="Tìm học viên">
          {(id) => (
            <Input id={id} type="search" placeholder="Gõ tên (không cần dấu)" value={search} onChange={(e) => setSearch(e.target.value)} />
          )}
        </Field>
        <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line" role="listbox" aria-label="Học viên">
          {students.isPending ? (
            <li className="px-3 py-2 text-sm text-muted">Đang tải…</li>
          ) : candidates.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">Không có học viên phù hợp — tạo hồ sơ mới bên dưới.</li>
          ) : (
            candidates.slice(0, 50).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={studentId === s.id}
                  onClick={() => {
                    setStudentId(s.id)
                    setNewName('')
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-[15px] ${studentId === s.id ? 'bg-brand-50 font-medium' : 'hover:bg-page'}`}
                >
                  <span>{s.full_name}</span>
                  <span className="text-sm text-muted">{s.school_class ? `Lớp ${s.school_class}` : ''}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <Field label="Hoặc tạo hồ sơ mới" hint="Bổ sung thông tin sau ở trang Học viên">
          {(id, desc) => (
            <Input
              id={id}
              aria-describedby={desc}
              placeholder="Họ tên học viên mới"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                if (e.target.value) setStudentId(null)
              }}
            />
          )}
        </Field>
        {isAdmin ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Thu học phí">
              {(id) => (
                <Select id={id} value={billing} onChange={(e) => setBilling(e.target.value as Billing)}>
                  {(Object.keys(BILLING_LABELS) as Billing[]).map((b) => (
                    <option key={b} value={b}>
                      {BILLING_LABELS[b]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {billing === 'per_session' && (
              <Field label="Giá 1 buổi (đồng)" hint={formatMoney(feeNumber)}>
                {(id, desc) => (
                  <Input id={id} aria-describedby={desc} type="number" inputMode="numeric" min={0} step={1000} value={fee} onChange={(e) => setFee(e.target.value)} />
                )}
              </Field>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Học phí theo giá mặc định của lớp; quản lý sửa riêng nếu cần.</p>
        )}
        {billing === 'package' && <p className="text-sm text-muted">Thêm gói (số buổi + số tiền) ở trang Học phí.</p>}
      </div>
    </Dialog>
  )
}

function FeeDialog({ member, onClose, onSaved }: { member: MemberRow; onClose: () => void; onSaved: () => void }) {
  const [fee, setFee] = useState(String(member.fee_per_session))
  const [billing, setBilling] = useState<Billing>(member.billing_mode)
  const feeNumber = Number(fee || 0)
  const save = useMutation({
    mutationFn: () => {
      if (!Number.isInteger(feeNumber) || feeNumber < 0) throw new Error('Giá 1 buổi phải là số tiền (đồng), không âm')
      return updateMemberFee(member.id, feeNumber, billing)
    },
    onSuccess: onSaved,
  })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Sửa học phí"
      description={member.full_name}
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
        <Field label="Thu học phí">
          {(id) => (
            <Select id={id} value={billing} onChange={(e) => setBilling(e.target.value as Billing)}>
              {(Object.keys(BILLING_LABELS) as Billing[]).map((b) => (
                <option key={b} value={b}>
                  {BILLING_LABELS[b]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {billing === 'per_session' && (
          <Field label="Giá 1 buổi (đồng)" hint={formatMoney(feeNumber)}>
            {(id, desc) => (
              <Input id={id} aria-describedby={desc} type="number" inputMode="numeric" min={0} step={1000} value={fee} onChange={(e) => setFee(e.target.value)} />
            )}
          </Field>
        )}
        <p className="text-sm text-muted">
          <Badge tone="warn">Lưu ý</Badge> Áp dụng cho các buổi điểm danh từ nay; buổi đã điểm danh giữ giá cũ.
        </p>
      </div>
    </Dialog>
  )
}
