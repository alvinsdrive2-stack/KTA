'use client'

import { useEffect, useState } from 'react'

export function CurrentDate() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <span className="text-sm text-gray-600">Loading...</span>
  }

  return (
    <span className="text-sm text-gray-600">
      {new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    </span>
  )
}