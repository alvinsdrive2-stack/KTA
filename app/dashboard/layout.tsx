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

  // Only pass isPusat, not session object
  // Client components will use useSession() hook instead
  return (
    <DashboardClient isPusat={isPusat}>
      {children}
    </DashboardClient>
  )
}