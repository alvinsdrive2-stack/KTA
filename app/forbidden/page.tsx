import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Akses Ditolak',
}
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ShieldX, ArrowLeft } from 'lucide-react'

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50/10 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-12 pb-8">
          <div className="text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-6">
              <ShieldX className="h-10 w-10 text-red-600" />
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Akses Ditolak
            </h1>

            {/* Description */}
            <p className="text-slate-600 mb-8">
              Maaf, Anda tidak memiliki izin untuk mengakses halaman ini.
            </p>

            {/* Back Button */}
            <Link href="/dashboard" className="inline-block">
              <Button className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Dashboard
              </Button>
            </Link>

            {/* Additional Info */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                Jika Anda merasa ini adalah kesalahan, silakan hubungi administrator.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
