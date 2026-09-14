'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, ArrowLeft, Loader2, Mail, MailCheck } from 'lucide-react'

const schema = z.object({
  email: z.string().min(1, 'Email wajib diisi').email('Email tidak valid'),
})

type FormInput = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (data: FormInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error || 'Gagal mengirim link reset')
        setIsLoading(false)
        return
      }

      setSentTo(data.email)
      setIsLoading(false)
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setIsLoading(false)
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 text-blue-900 text-sm">
          <MailCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            Kalau <strong>{sentTo}</strong> terdaftar, link reset sudah dikirim ke
            inbox-nya. Cek juga folder spam — link berlaku 60 menit dan cuma bisa
            dipakai sekali.
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full py-6 rounded-lg"
          onClick={() => {
            setSentTo(null)
            form.reset()
          }}
        >
          Kirim ke email lain
        </Button>

        <div className="text-center">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-800 font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm animate-fade-in">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email" className="text-slate-700 font-medium">
          Email
        </Label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="h-4 w-4 text-gray-400" />
          </div>
          <Input
            id="email"
            type="email"
            placeholder="nama@email.com"
            autoComplete="email"
            className={`pl-10 transition-all duration-200 ${focusedField === 'email' ? 'border-blue-500 ring-2 ring-blue-500' : ''}`}
            {...form.register('email')}
            disabled={isLoading}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
          />
        </div>
        {form.formState.errors.email && (
          <p className="text-sm text-red-600 animate-fade-in">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full btn-ripple bg-blue-900 hover:bg-blue-950 text-white font-medium py-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Mengirim...
          </>
        ) : (
          'Kirim Link Reset'
        )}
      </Button>

      <div className="text-center">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-800 font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke login
        </Link>
      </div>
    </form>
  )
}
