import { cn } from '@/lib/utils'

interface JenjangBadgeProps {
  jenjang: string | number
  className?: string
}

export function getJenjangCategory(jenjang: number | string): 'Operator' | 'Teknisi/Analis' | 'Ahli' {
  const jenjangNum = typeof jenjang === 'string' ? parseInt(jenjang, 10) : jenjang
  if (jenjangNum <= 3) return 'Operator'
  if (jenjangNum <= 6) return 'Teknisi/Analis'
  return 'Ahli'
}

export function getJenjangColor(category: 'Operator' | 'Teknisi/Analis' | 'Ahli'): string {
  switch (category) {
    case 'Operator':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
    case 'Teknisi/Analis':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
    case 'Ahli':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  }
}

export function JenjangBadge({ jenjang, className }: JenjangBadgeProps) {
  const jenjangNum = typeof jenjang === 'string' ? parseInt(jenjang, 10) : jenjang
  const category = getJenjangCategory(jenjangNum)
  const colorClass = getJenjangColor(category)

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
      colorClass,
      className
    )}>
      {category}
    </span>
  )
}
