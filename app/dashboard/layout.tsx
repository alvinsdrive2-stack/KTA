import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DashboardClient } from './layout-client'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  const isPusat = session.user.role === 'PUSAT' || session.user.role === 'ADMIN'

  return (
    <DashboardClient
      session={session}
      isPusat={isPusat}
    >
      {children}
    </DashboardClient>
  )
}