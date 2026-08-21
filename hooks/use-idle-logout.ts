'use client'

import { useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'

const DEFAULT_IDLE_TIMEOUT = 5 * 60 * 1000 // 5 menit

// Auto logout setelah user diam (tidak ada aktivitas) selama timeout ms
export function useIdleLogout(timeout: number = DEFAULT_IDLE_TIMEOUT) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        signOut({ callbackUrl: '/auth/login' })
      }, timeout)
    }

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'click',
      'scroll',
      'touchstart',
    ]

    events.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true })
    })

    resetTimer()

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, [timeout])
}
