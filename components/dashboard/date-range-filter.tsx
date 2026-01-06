'use client'

import { Button } from '@/components/ui/button'
import { Calendar, ChevronDown, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

type PresetRange = '7d' | '30d' | '90d' | '1y' | 'all'

interface DateRangeFilterProps {
  onRangeChange?: (start: Date, end: Date) => void
  className?: string
}

const presetRanges = [
  { value: '7d' as PresetRange, label: '7 Hari Terakhir' },
  { value: '30d' as PresetRange, label: '30 Hari Terakhir' },
  { value: '90d' as PresetRange, label: '3 Bulan Terakhir' },
  { value: '1y' as PresetRange, label: '1 Tahun Terakhir' },
  { value: 'all' as PresetRange, label: 'Semua Waktu' },
]

export function DateRangeFilter({ onRangeChange, className }: DateRangeFilterProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetRange>('30d')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePresetClick = (preset: PresetRange) => {
    setSelectedPreset(preset)
    setIsOpen(false)

    const now = new Date()
    let startDate = new Date()

    switch (preset) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      case 'all':
        startDate = new Date(2020, 0, 1)
        break
    }

    onRangeChange?.(startDate, now)
  }

  const getSelectedLabel = () => {
    return presetRanges.find(r => r.value === selectedPreset)?.label || 'Pilih Rentang Waktu'
  }

  const formatDateRange = () => {
    const now = new Date()
    let startDate = new Date()

    switch (selectedPreset) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      case 'all':
        return null
    }

    const formatter = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })

    return `${formatter.format(startDate)} - ${formatter.format(now)}}`
  }

  return (
    <div className={'flex items-center gap-3 ' + (className || '')}>
      {/* Preset Selector */}
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="border-slate-300 text-slate-700 hover:bg-slate-100 min-w-[200px] justify-between"
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <span className="text-xs">{getSelectedLabel()}</span>
          </div>
          <ChevronDown className={'h-4 w-4 text-slate-400 transition-transform ' + (isOpen ? 'rotate-180' : '')} />
        </Button>

        {isOpen && (
          <div className="absolute top-full mt-1 right-0 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden">
            <div className="py-1">
              {presetRanges.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetClick(preset.value)}
                  className={'w-full px-3 py-2 text-left text-sm transition-colors ' +
                    (selectedPreset === preset.value
                      ? 'bg-slate-100 text-slate-900 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                    )
                  }
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Custom Range (future enhancement) */}
      {/* <Button variant="outline" size="sm" className="border-slate-300 text-slate-700 hover:bg-slate-100">
        <Calendar className="h-4 w-4 mr-2" />
        <span className="text-xs">Kustom</span>
      </Button> */}
    </div>
  )
}

// Quick date chips for horizontal filter
interface DateChipsProps {
  selected: PresetRange
  onChange: (preset: PresetRange) => void
  className?: string
}

export function DateChips({ selected, onChange, className }: DateChipsProps) {
  const chips = [
    { value: '7d' as PresetRange, label: '7H' },
    { value: '30d' as PresetRange, label: '30H' },
    { value: '90d' as PresetRange, label: '3B' },
    { value: '1y' as PresetRange, label: '1T' },
  ]

  return (
    <div className={'flex items-center gap-2 ' + (className || '')}>
      {chips.map((chip) => (
        <button
          key={chip.value}
          onClick={() => onChange(chip.value)}
          className={
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' +
            (selected === chip.value
              ? 'bg-slate-800 text-white shadow-md'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            )
          }
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
