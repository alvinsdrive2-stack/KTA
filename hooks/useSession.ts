'use client'

import { useSession as useNextAuthSession } from 'next-auth/react'
import { useMemo } from 'react'

export function useSession() {
  const { data: session, status } = useNextAuthSession()

  // Transform session data to match our interface
  const transformedSession = useMemo(() => {
    if (!session) return null

    return {
      user: {
        id: session.user.id || '',
        name: session.user.name || '',
        email: session.user.email || '',
        role: session.user.role || 'DAERAH',
        daerahId: session.user.daerahId || null
      }
    }
  }, [session])

  return {
    session: transformedSession,
    loading: status === 'loading'
  }
}