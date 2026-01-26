import { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Login',
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const session = await getServerSession(authOptions)

  // Redirect to dashboard if already logged in
  if (session) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md opacity-0 animate-fade-in">
        {/* Logo */}
        

        {/* Login Card - 3D Style */}
        <Card className="card-3d">
          <div className="flex justify-center mt-4">
          <div className="relative w-20 h-20 flex items-center justify-center p-3">
            <Image
              src="/logo.png"
              alt="Gatensi Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-semibold text-slate-900">
              Login Management KTA
            </CardTitle>
            <CardDescription className="text-slate-500 text-sm">
              Masuk ke dashboard untuk mengelola Kartu Tanda Anggota
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-5 text-xs text-slate-500">
          <p>&copy; 2025 Gabungan Ahli Teknik Nasional Indonesia</p>
        </div>
      </div>
    </div>
  )
}