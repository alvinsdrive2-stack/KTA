'use client'

import { useSession as useNextAuthSession } from 'next-auth/react'

export function useSession() {
  const { data: session, status } = useNextAuthSession()

  // Transform session data to match our interface
  const transformedSession = session ? {
    user: {
      id: session.user.id || '',
      name: session.user.name || '',
      email: session.user.email || '',
      role: session.user.role || 'DAERAH',
      daerahId: session.user.daerahId || null
    }
  } : null

  return {
    session: transformedSession,
    loading: status === 'loading'
  }
}