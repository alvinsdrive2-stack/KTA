'use client'

import { useState } from 'react'

export interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

export function useTableSort(initialKey = '', initialDir: 'asc' | 'desc' = 'desc') {
  const [sort, setSort] = useState<SortState>({ key: initialKey, dir: initialDir })

  const toggleSort = (key: string) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
  }

  // Client-side sorting (untuk data yang sudah di-load semua)
  const applyClientSort = <T,>(data: T[], getValue: (item: T) => unknown): T[] => {
    if (!sort.key) return data
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...data].sort((a, b) => {
      const av = getValue(a)
      const bv = getValue(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir
      }
      return String(av).localeCompare(String(bv), 'id', { numeric: true }) * dir
    })
  }

  // Query string untuk server-side sorting
  const sortQuery = sort.key ? `sortBy=${encodeURIComponent(sort.key)}&sortDir=${sort.dir}` : ''

  return { sort, toggleSort, applyClientSort, sortQuery }
}
