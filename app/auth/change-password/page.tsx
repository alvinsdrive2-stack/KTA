'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2, Lock, ShieldCheck } from 'lucide-react'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Password lama wajib diisi'),
    newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
    confirmPassword: z.string().min(1, 'Konfirmasi wajib diisi'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword'],
  })

type FormInput = z.infer<typeof schema>

export default function ChangePasswordPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const isFirstLogin = session?.user?.mustChangePassword === true

  const onSubmit = async (data: FormInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        setError(json.error || 'Gagal mengganti password')
        setIsLoading(false)
        return
      }

      // Token masih menyimpan mustChangePassword=true sampai login ulang,
      // jadi keluar dulu biar middleware nggak muter-muter balik ke sini.
      await signOut({ redirect: false })
      router.push('/auth/login?password_changed=1')
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-blue-50">
              <ShieldCheck className="h-5 w-5 text-blue-700" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">
              {isFirstLogin ? 'Ganti Password Dulu' : 'Ganti Password'}
            </h1>
          </div>

          <p className="text-sm text-slate-500 mb-6">
            {isFirstLogin
              ? 'Password akun ini masih dari admin. Demi keamanan, ganti dulu sebelum lanjut.'
              : 'Masukkan password lama, lalu password baru.'}
          </p>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-slate-700 font-medium">
                Password Lama
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Password dari admin"
                  className="pl-9"
                  {...form.register('currentPassword')}
                  disabled={isLoading}
                />
              </div>
              {form.formState.errors.currentPassword && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-slate-700 font-medium">
                Password Baru
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Minimal 8 karakter"
                  className="pl-9"
                  {...form.register('newPassword')}
                  disabled={isLoading}
                />
              </div>
              {form.formState.errors.newPassword && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">
                Ulangi Password Baru
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Ulangi password baru"
                  className="pl-9"
                  {...form.register('confirmPassword')}
                  disabled={isLoading}
                />
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-900 hover:bg-blue-950 text-white py-6 rounded-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Password Baru'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
