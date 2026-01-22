'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  options: string[] | Array<{ value: string; label: string }>
  loading?: boolean
  className?: string
}

export function Autocomplete({
  value,
  onChange,
  placeholder = 'Ketik untuk mencari...',
  disabled = false,
  options = [],
  loading = false,
  className,
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update input when value changes from outside
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Normalize options to {value, label} format
  const normalizedOptions = options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  )

  // Filter options based on input
  const filteredOptions = normalizedOptions.filter(option =>
    option.label.toLowerCase().includes(inputValue.toLowerCase())
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    setIsOpen(true)
  }

  const handleFocus = () => {
    // If already has value and dropdown is closed, clear it (toggle behavior)
    if (inputValue && !isOpen) {
      setInputValue('')
      onChange('')
    }
    setIsOpen(true)
  }

  const handleSelectOption = (option: { value: string; label: string }) => {
    setInputValue(option.label)
    onChange(option.label)
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const handleClear = () => {
    setInputValue('')
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={cn('pr-16', className)}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && (
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
          )}
          {inputValue && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 p-1"
              tabIndex={-1}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredOptions.map((option, index) => {
            const isSelected = option.label.toLowerCase() === inputValue.toLowerCase()
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectOption(option)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between gap-2',
                  isSelected && 'bg-blue-50 text-blue-600'
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}

      {isOpen && inputValue && filteredOptions.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3">
          <p className="text-sm text-slate-500 text-center">
            Tidak ditemukan: "{inputValue}"
          </p>
        </div>
      )}
    </div>
  )
}
