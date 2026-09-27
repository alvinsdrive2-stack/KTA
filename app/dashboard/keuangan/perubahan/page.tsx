'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageTransition } from '@/components/ui/page-transition'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { AlertCircle, Search, ChevronRight, Inbox } from 'lucide-react'

const FIELD_LABEL: Record<string, string> = {
  nama: 'Nama Lengkap',
  nik: 'NIK',
  jabatanKerja: 'Jabatan Kerja',
  jenjang: 'Kualifikasi',
  noTelp: 'No. Telepon',
  email: 'Email',
  alamat: 'Alamat',
  subklasifikasi: 'Subklasifikasi',
}

interface Item {
  id: string
  fieldName: string
  oldValue: string | null
  newValue: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  catatan: string | null
  createdAt: string
  sikiValue: string | null
  idIzinInput: string | null
  ktaRequest: {
    id: string
    nama: string
    nik: string
    idIzin: string | null
    nomorKTA: string | null
    daerah: { namaDaerah: string; kodeDaerah: string }
  }
  requestedByUser: { id: string; name: string }
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu Konfirmasi',
  APPROVED: 'Diterima',
  REJECTED: 'Ditolak',
}

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'

export default function KonfirmasiPerubahanPage() {
  const router = useRouter()
  const { session } = useSession()

  const [akses, setAkses] = useState<'menunggu' | 'boleh' | 'ditolak'>('menunggu')
  const initialCheckDone = useRef(false)

  const [filter, setFilter] = useState<Filter>('PENDING')
  const [cari, setCari] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const muat = useCallback(async (f: Filter, q: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (f !== 'ALL') params.set('status', f)
      if (q.trim()) params.set('search', q.trim())

      const res = await fetch(`/api/kta/change-request?${params.toString()}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Gagal memuat daftar permohonan')
        return
      }

      setItems(data.data)
      setPendingCount(data.pendingCount ?? 0)
    } catch (err) {
      console.error('Muat permohonan error:', err)
      setError('Terjadi kesalahan saat memuat daftar permohonan')
    } finally {
      setLoading(false)
    }
  }, [])

  // Gerbang akses: cuma Keuangan yang memutus.
  useEffect(() => {
    if (session === null || session === undefined) return
    if (initialCheckDone.current) return
    initialCheckDone.current = true

    if (session.user?.role === 'KEUANGAN') {
      setAkses('boleh')
      muat('PENDING', '')
    } else {
      setAkses('ditolak')
    }
  }, [session, muat])

  const gantiFilter = (f: Filter) => {
    setFilter(f)
    muat(f, cari)
  }

  if (akses === 'menunggu') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo />
      </div>
    )
  }

  if (akses === 'ditolak') {
    return (
      <PageTransition>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Halaman ini khusus buat Keuangan. Role kamu nggak punya akses.
            </AlertDescription>
          </Alert>
        </div>
      </PageTransition>
    )
  }

  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: 'PENDING', label: 'Menunggu', count: pendingCount },
    { key: 'APPROVED', label: 'Diterima' },
    { key: 'REJECTED', label: 'Ditolak' },
    { key: 'ALL', label: 'Semua' },
  ]

  return (
    <PageTransition>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Konfirmasi Perubahan KTA
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Permohonan perubahan data KTA yang diajukan BPP.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex gap-2 flex-wrap">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => gantiFilter(t.key)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors flex items-center gap-1.5 ${
                  filter === t.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span
                    className={`text-xs px-1.5 rounded-full ${
                      filter === t.key
                        ? 'bg-white/25 text-white'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Cari nama, NIK, ID Izin..."
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && muat(filter, cari)}
            />
            <Button
              variant="outline"
              onClick={() => muat(filter, cari)}
              disabled={loading}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <PulseLogo />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Inbox className="h-10 w-10 mb-3" />
              <p className="text-sm">Nggak ada permohonan di filter ini.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() =>
                  router.push(`/dashboard/keuangan/perubahan/${item.id}`)
                }
                className="w-full text-left"
              >
                <Card className="hover:border-blue-300 hover:shadow-sm transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-800">
                            {item.ktaRequest.nama}
                          </p>
                          <Badge className={STATUS_STYLE[item.status]}>
                            {STATUS_LABEL[item.status]}
                          </Badge>
                        </div>

                        <p className="text-xs text-slate-500">
                          NIK {item.ktaRequest.nik} ·{' '}
                          {item.ktaRequest.daerah.namaDaerah} · diajukan{' '}
                          {item.requestedByUser.name}
                        </p>

                        <div className="text-sm pt-1">
                          <span className="text-slate-500">
                            {FIELD_LABEL[item.fieldName] ?? item.fieldName}:
                          </span>{' '}
                          <span className="text-red-600 line-through">
                            {item.oldValue || '(kosong)'}
                          </span>{' '}
                          <span className="text-slate-400">→</span>{' '}
                          <span className="text-green-700 font-medium">
                            {item.newValue}
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="h-5 w-5 text-slate-300 flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
