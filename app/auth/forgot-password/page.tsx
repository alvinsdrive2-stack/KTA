import { Metadata } from 'next'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export const metadata: Metadata = {
  title: 'Lupa Password',
}

/**
 * Shell-nya sengaja disamain sama halaman login (logo + card-3d + fade-in),
 * biar pindah dari login ke sini nggak berasa keluar aplikasi.
 */
export default function ForgotPasswordPage() {
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
              Lupa Password
            </CardTitle>
            <CardDescription className="text-slate-500 text-sm">
              Masukkan email akun Anda, kami kirim link buat bikin password baru
            </CardDescription>
          </CardHeader>

          <CardContent>
            <ForgotPasswordForm />
          </CardContent>
        </Card>

        <div className="text-center mt-5 text-xs text-slate-500">
          <p>&copy; 2025 Gabungan Ahli Teknik Nasional Indonesia</p>
        </div>
      </div>
    </div>
  )
}
