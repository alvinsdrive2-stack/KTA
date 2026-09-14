import { Metadata } from 'next'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export const metadata: Metadata = {
  title: 'Reset Password',
}

/**
 * Halaman target link di email lupa password. Token dibaca di server dari query
 * string lalu diteruskan ke form — `useSearchParams` di client component bikin
 * build minta Suspense boundary, dan ini lebih simpel.
 */
export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md opacity-0 animate-fade-in">
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
              Buat Password Baru
            </CardTitle>
            <CardDescription className="text-slate-500 text-sm">
              Tentukan password baru untuk akun Anda
            </CardDescription>
          </CardHeader>

          <CardContent>
            <ResetPasswordForm token={searchParams.token || ''} />
          </CardContent>
        </Card>

        <div className="text-center mt-5 text-xs text-slate-500">
          <p>&copy; 2025 Gabungan Ahli Teknik Nasional Indonesia</p>
        </div>
      </div>
    </div>
  )
}
