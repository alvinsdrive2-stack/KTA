'use client'

export function CurrentDate() {
  // Use suppressHydrationWarning for client-only date rendering
  // The date will be empty during SSR, then populated on client
  return (
    <span className="text-sm text-gray-600" suppressHydrationWarning>
      {typeof window !== 'undefined'
        ? new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : ''
      }
    </span>
  )
}
