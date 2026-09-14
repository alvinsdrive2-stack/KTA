'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, Loader2, Lock } from 'lucide-react'

const schema = z
  .object({
    password: z.string().min(8, 'Password baru minimal 8 karakter'),
    confirmPassword: z.string().min(1, 'Konfirmasi wajib diisi'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword'],
  })

type FormInput = z.infer<typeof schema>

type TokenState =
  | { status: 'checking' }
  | { status: 'valid'; email: string }
  | { status: 'invalid'; message: string }

/**
 * Dipanggil dari `app/auth/reset-password/page.tsx` dengan token dari query
 * string. Token dicek dulu ke server sebelum form ditampilin, biar user nggak
 * ngetik password dua kali buat link yang udah mati.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [tokenState, setTokenState] = useState<TokenState>({ status: 'checking' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    let cancelled = false

    if (!token) {
      setTokenState({
        status: 'invalid',
        message: 'Link reset nggak lengkap. Minta link baru dari halaman lupa password.',
      })
      return
    }

    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json()
        if (cancelled) return

        if (!res.ok || !json.valid) {
          setTokenState({
            status: 'invalid',
            message: json.error || 'Link reset nggak valid atau sudah kedaluwarsa',
          })
          return
        }

        setTokenState({ status: 'valid', email: json.email })
      })
      .catch(() => {
        if (!cancelled) {
          setTokenState({
            status: 'invalid',
            message: 'Gagal memeriksa link. Coba muat ulang halaman ini.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const onSubmit = async (data: FormInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        setError(json.error || 'Gagal mengganti password')
        setIsLoading(false)
        return
      }

      setDone(true)
      setIsLoading(false)
      router.push('/auth/login?password_reset=1')
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setIsLoading(false)
    }
  }

  if (tokenState.status === 'checking') {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memeriksa link...
      </div>
    )
  }

  if (tokenState.status === 'invalid') {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{tokenState.message}</span>
        </div>

        <Button
          asChild
          className="w-full btn-ripple bg-blue-900 hover:bg-blue-950 text-white font-medium py-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <Link href="/auth/forgot-password">Minta Link Baru</Link>
        </Button>

        <div className="text-center">
          <Link
            href="/auth/login"
            className="text-sm text-blue-700 hover:text-blue-800 font-medium transition-colors"
          >
            Kembali ke login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <p className="text-sm text-slate-500 -mt-1">
        Password baru untuk <span className="font-medium text-slate-700">{tokenState.email}</span>
      </p>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm animate-fade-in">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 text-blue-900 text-sm animate-fade-in">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>Password berhasil diganti. Mengarahkan ke halaman login...</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password" className="text-slate-700 font-medium">
          Password Baru
        </Label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-4 w-4 text-gray-400" />
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Minimal 8 karakter"
            autoComplete="new-password"
            className={`pl-10 transition-all duration-200 ${focusedField === 'password' ? 'border-blue-500 ring-2 ring-blue-500' : ''}`}
            {...form.register('password')}
            disabled={isLoading || done}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
          />
        </div>
        {form.formState.errors.password && (
          <p className="text-sm text-red-600 animate-fade-in">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">
          Ulangi Password Baru
        </Label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-4 w-4 text-gray-400" />
          </div>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Ulangi password baru"
            autoComplete="new-password"
            className={`pl-10 transition-all duration-200 ${focusedField === 'confirmPassword' ? 'border-blue-500 ring-2 ring-blue-500' : ''}`}
            {...form.register('confirmPassword')}
            disabled={isLoading || done}
            onFocus={() => setFocusedField('confirmPassword')}
            onBlur={() => setFocusedField(null)}
          />
        </div>
        {form.formState.errors.confirmPassword && (
          <p className="text-sm text-red-600 animate-fade-in">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full btn-ripple bg-blue-900 hover:bg-blue-950 text-white font-medium py-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
        disabled={isLoading || done}
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

      <div className="text-center">
        <Link
          href="/auth/login"
          className="text-sm text-blue-700 hover:text-blue-800 font-medium transition-colors"
        >
          Kembali ke login
        </Link>
      </div>
    </form>
  )
}
