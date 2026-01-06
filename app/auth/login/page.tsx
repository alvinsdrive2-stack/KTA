import { LoginForm } from '@/components/auth/login-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md opacity-0 animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="relative w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center p-3">
            <Image
              src="/logo.png"
              alt="LSP Gatensi Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Login Card - 3D Style */}
        <Card className="card-3d">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-semibold text-slate-900">
              Login Sistem KTA
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
          <p>&copy; 2025 LSP Gatensi Karya Konstruksi</p>
        </div>
      </div>
    </div>
  )
}