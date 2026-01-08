'use client'

import { useEffect, useRef } from 'react'

export function useRenderCount(componentName: string) {
  const renderCount = useRef(0)

  useEffect(() => {
    renderCount.current++
    // Move environment check inside useEffect for consistency
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[RENDER DEBUG] ${componentName} rendered ${renderCount.current} times`)
    }
    // Check for excessive re-renders in production
    if (renderCount.current > 50) {
      console.error(`[INFINITE LOOP] ${componentName} rendered ${renderCount.current} times!`)
    }
  })
}
