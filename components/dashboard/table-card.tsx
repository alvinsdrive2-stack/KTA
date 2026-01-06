'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LucideIcon, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TableCardProps {
  title: string
  icon?: LucideIcon
  description?: string
  children: React.ReactNode
  action?: {
    label: string
    href: string
  }
  className?: string
  delay?: number
}

export function TableCard({
  title,
  icon: Icon,
  description,
  children,
  action,
  className,
  delay = 0,
}: TableCardProps) {
  return (
    <Card
      className={cn(
        'card-3d overflow-hidden bg-white',
        'opacity-0 animate-fade-in',
        className
      )}
      style={{ animationDelay: delay + 'ms' }}
    >
      <CardHeader className="border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-slate-200 rounded-lg shadow-inner-soft">
                <Icon className="h-4 w-4 text-slate-700" />
              </div>
            )}
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                {title}
              </CardTitle>
              {description && (
                <p className="text-xs text-slate-500 mt-0.5">{description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {action && (
              <Button asChild size="sm" className="bg-slate-800 text-slate-100 hover:bg-slate-700 shadow-md text-xs">
                <a href={action.href}>{action.label}</a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {children}
      </CardContent>
    </Card>
  )
}

// Table Row Component - 3D style
interface TableRowProps {
  cells?: React.ReactNode[]
  hover?: boolean
  className?: string
  children?: React.ReactNode
}

export function TableRow({ cells, hover = true, className, children }: TableRowProps) {
  if (children) {
    return (
      <tr
        className={cn(
          'border-b border-slate-100 transition-colors duration-150',
          hover && 'hover:bg-slate-50 cursor-pointer',
          className
        )}
      >
        {children}
      </tr>
    )
  }

  if (cells && cells.length > 0) {
    return (
      <tr
        className={cn(
          'border-b border-slate-100 transition-colors duration-150',
          hover && 'hover:bg-slate-50 cursor-pointer',
          className
        )}
      >
        {cells.map((cell, index) => (
          <td
            key={index}
            className={cn(
              'px-4 py-3 text-sm',
              index === 0 && 'font-medium text-slate-900',
              index > 0 && 'text-slate-600'
            )}
          >
            {cell}
          </td>
        ))}
      </tr>
    )
  }

  return null
}

// Status Badge - Muted colors
interface StatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed'
  label?: string
}

const statusStyles = {
  pending: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'Menunggu',
  },
  approved: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Disetujui',
  },
  rejected: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    dot: 'bg-red-500',
    label: 'Ditolak',
  },
  processing: {
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    dot: 'bg-sky-500',
    label: 'Diproses',
  },
  completed: {
    bg: 'bg-violet-100',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
    label: 'Selesai',
  },
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const styles = statusStyles[status]

  return (
    <span className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium shadow-sm ' + styles.bg + ' ' + styles.text}>
      <span className={'w-1 h-1 rounded-full ' + styles.dot} />
      {label || styles.label}
    </span>
  )
}

// Loading Skeleton
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-3 bg-slate-200 rounded w-3/4 mb-1.5" />
            <div className="h-2.5 bg-slate-200 rounded w-1/2" />
          </div>
          <div className="w-20 h-6 bg-slate-200 rounded-md" />
        </div>
      ))}
    </div>
  )
}
