'use client'

import { useEffect, useRef } from 'react'

export function useRenderCount(componentName: string) {
  const renderCount = useRef(0)
  const isProduction = process.env.NODE_ENV === 'production'

  useEffect(() => {
    if (!isProduction) {
      renderCount.current++
      console.log(`[RENDER DEBUG] ${componentName} rendered ${renderCount.current} times`)
    }
  })

  // In production, log excessive re-renders
  useEffect(() => {
    if (isProduction) {
      renderCount.current++
      if (renderCount.current > 50) {
        console.error(`[INFINITE LOOP] ${componentName} rendered ${renderCount.current} times!`)
      }
    }
  })
}
