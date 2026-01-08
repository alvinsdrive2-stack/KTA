'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes/dist/types'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // next-themes handles SSR correctly internally
  // Just pass the necessary props to prevent hydration issues
  return (
    <NextThemesProvider {...props} attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </NextThemesProvider>
  )
}
