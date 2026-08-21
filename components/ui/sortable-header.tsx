'use client'

import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SortState } from '@/hooks/use-table-sort'

interface SortableHeaderProps {
  label: string
  sortKey: string
  sort: SortState
  onSort: (key: string) => void
  className?: string
  align?: 'left' | 'right' | 'center'
}

export function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
  align = 'left',
}: SortableHeaderProps) {
  const active = sort.key === sortKey
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  return (
    <th className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wider', alignClass, className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-slate-900',
          align === 'right' && 'flex-row-reverse'
        )}
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  )
}
