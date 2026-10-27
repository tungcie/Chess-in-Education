import { EmptyState, PageHeader } from '../../components/ui/States'
import type { NavItem } from '../auth/navigation'

/** Trang tạm cho chức năng chưa làm — để mỗi vai trò thấy đúng menu ngay từ giai đoạn 1. */
export function ComingSoonPage({ item }: { item: NavItem }) {
  return (
    <div>
      <PageHeader title={item.label} />
      <EmptyState title="Sắp có">
        Chức năng này làm ở giai đoạn {item.phase} (xem CLAUDE.md mục 13).
      </EmptyState>
    </div>
  )
}
