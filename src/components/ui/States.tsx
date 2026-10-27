import type { ReactNode } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'

/** Khung xám khi đang tải. */
export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-brand-50" />
      ))}
    </div>
  )
}

export function FullPageLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <img src="/brand/cie-emblem.png" alt="" className="h-16 w-auto animate-pulse" />
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Lỗi không xác định'
  return (
    <div className="rounded-2xl border border-danger-600/30 bg-danger-50 px-5 py-4" role="alert">
      <p className="font-semibold text-danger-600">Không tải được dữ liệu</p>
      <p className="mt-1 text-sm text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          <Icon name="refresh" className="size-4" /> Thử lại
        </Button>
      )}
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const BADGE_TONES = {
  brand: 'bg-brand-50 text-brand-700',
  accent: 'bg-accent-100 text-accent-600',
  ok: 'bg-ok-50 text-ok-600',
  warn: 'bg-warn-50 text-warn-600',
  danger: 'bg-danger-50 text-danger-600',
  muted: 'bg-page text-muted',
} as const

export function Badge({ tone = 'brand', children }: { tone?: keyof typeof BADGE_TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  )
}

/** Thông báo ngắn trong trang (thành công / lỗi). */
export function Notice({ tone, children }: { tone: 'ok' | 'danger' | 'warn'; children: ReactNode }) {
  const tones = {
    ok: 'border-ok-600/30 bg-ok-50 text-ok-600',
    danger: 'border-danger-600/30 bg-danger-50 text-danger-600',
    warn: 'border-warn-600/30 bg-warn-50 text-warn-600',
  }
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
