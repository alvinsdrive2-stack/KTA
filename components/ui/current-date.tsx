'use client'

import { useState, useEffect } from 'react'

export function CurrentDate() {
  const [date, setDate] = useState('')

  useEffect(() => {
    // Set date on client side only to avoid hydration mismatch
    setDate(
      new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    )
  }, [])

  return (
    <span className="text-sm font-medium text-slate-700">
      {date || 'Loading...'}
    </span>
  )
}
