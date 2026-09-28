'use client'

import { useState, useEffect } from 'react'

export function CurrentDate() {
  const [date, setDate] = useState('')

  useEffect(() => {
    // Set date on client side only to avoid hydration mismatch. setState
    // sinkron di sini memang pola standar init client-only; aturan baru
    // react-hooks menandainya tapi alternatifnya lebih rumit tanpa untung.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
