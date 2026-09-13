import { cn } from '@/lib/utils'
import {
  getJenjangCategory,
  JENJANG_LABEL,
  type JenjangCategory,
} from '@/lib/kta-upgrade'

interface JenjangBadgeProps {
  jenjang: string | number
  className?: string
}

// Re-export biar pemanggil lama (mis. app/dashboard/payments/pusat) nggak putus.
export { getJenjangCategory }

export function getJenjangColor(category: JenjangCategory): string {
  switch (category) {
    case 'OPERATOR':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
    case 'TEKNISI':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
    case 'AHLI':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  }
}

export function JenjangBadge({ jenjang, className }: JenjangBadgeProps) {
  const category = getJenjangCategory(jenjang)
  const colorClass = getJenjangColor(category)

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
      colorClass,
      className
    )}>
      {JENJANG_LABEL[category]}
    </span>
  )
}
