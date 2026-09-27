'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageTransition } from '@/components/ui/page-transition'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useToast } from '@/components/ui/use-toast'
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FileText,
  ExternalLink,
  Info,
} from 'lucide-react'

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

interface Detail {
  id: string
  fieldName: string
  fieldLabel: string
  fieldHint: string | null
  oldValue: string | null
  newValue: string
  reason: string
  buktiUrl: string
  idIzinInput: string | null
  sikiValue: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  catatan: string | null
  appliedResult: string | null
  appliedAt: string | null
  reviewedAt: string | null
  createdAt: string
  ktaRequest: {
    id: string
    nama: string
    nik: string
    idIzin: string | null
    nomorKTA: string | null
    daerah: { namaDaerah: string; kodeDaerah: string }
  }
  requestedByUser: { id: string; name: string; email: string }
  reviewedByUser: { id: string; name: string } | null
}

export default function DetailPerubahanPage() {
  const params = useParams()
  const router = useRouter()
  const { session } = useSession()
  const { toast } = useToast()

  const [akses, setAkses] = useState<'menunggu' | 'boleh' | 'ditolak'>('menunggu')
  const initialCheckDone = useRef(false)

  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [catatan, setCatatan] = useState('')
  const [memproses, setMemproses] = useState<'terima' | 'tolak' | null>(null)

  const muat = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/kta/change-request/${params.id}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        setError(json.error || 'Gagal memuat detail permohonan')
        return
      }
      setData(json.data)
    } catch (err) {
      console.error('Muat detail error:', err)
      setError('Terjadi kesalahan saat memuat detail permohonan')
    } finally {
      setLoading(false)
    }
  }

  // Gerbang akses: cuma Keuangan.
  useEffect(() => {
    if (session === null || session === undefined) return
    if (initialCheckDone.current) return
    initialCheckDone.current = true

    if (session.user?.role === 'KEUANGAN') {
      setAkses('boleh')
      muat()
    } else {
      setAkses('ditolak')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  /**
   * Putuskan permohonan. Yang diterima bakal langsung menerapkan perubahannya
   * ke KTA dan menarik ulang data dari SIKI — field yang barusan di-approve
   * dikecualikan dari refresh, biar nggak ketimpa balik sama data SIKI lama.
   */
  const putuskan = async (approved: boolean) => {
    if (!approved && !catatan.trim()) {
      toast({
        variant: 'destructive',
        title: 'Alasan wajib diisi',
        description: 'Isi alasan penolakannya dulu.',
      })
      return
    }

    setMemproses(approved ? 'terima' : 'tolak')
    try {
      const res = await fetch(`/api/kta/change-request/${params.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, catatan: catatan.trim() }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        toast({
          variant: 'destructive',
          title: approved ? 'Gagal menerima' : 'Gagal menolak',
          description: json.error || 'Coba lagi.',
        })
        return
      }

      toast({
        variant: 'success',
        title: approved ? 'Permohonan diterima' : 'Permohonan ditolak',
        description: json.data?.appliedResult || json.message,
      })

      router.push('/dashboard/keuangan/perubahan')
    } catch (err) {
      console.error('Putusan error:', err)
      toast({
        variant: 'destructive',
        title: 'Terjadi kesalahan',
        description: 'Coba lagi.',
      })
    } finally {
      setMemproses(null)
    }
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
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Halaman ini khusus buat Keuangan. Role kamu nggak punya akses.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulseLogo text="Memuat detail permohonan..." />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Data nggak ditemukan'}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/dashboard/keuangan/perubahan')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
      </div>
    )
  }

  const pending = data.status === 'PENDING'

  return (
    <PageTransition>
      <>
        <div className={`space-y-6 ${pending ? 'pb-20' : ''}`}>
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/keuangan/perubahan')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
            <h1 className="text-2xl font-bold text-slate-800 mt-2">
              Detail Permohonan Perubahan
            </h1>
            <p className="text-sm text-slate-500">
              Diajukan {data.requestedByUser.name} ·{' '}
              {new Date(data.createdAt).toLocaleString('id-ID')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge className={STATUS_STYLE[data.status]}>
              {data.status === 'PENDING' && <Clock className="h-3 w-3 mr-1" />}
              {data.status === 'APPROVED' && <CheckCircle className="h-3 w-3 mr-1" />}
              {data.status === 'REJECTED' && <XCircle className="h-3 w-3 mr-1" />}
              {STATUS_LABEL[data.status]}
            </Badge>
            {data.reviewedByUser && (
              <span className="text-sm text-slate-500">
                diputus {data.reviewedByUser.name} ·{' '}
                {data.reviewedAt
                  ? new Date(data.reviewedAt).toLocaleString('id-ID')
                  : ''}
              </span>
            )}
          </div>

          {/* Anggota */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Anggota</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="font-semibold text-slate-800">{data.ktaRequest.nama}</p>
              <p className="text-sm text-slate-600">NIK {data.ktaRequest.nik}</p>
              <p className="text-sm text-slate-600">
                {data.ktaRequest.daerah.namaDaerah}
                {data.ktaRequest.nomorKTA
                  ? ` · No. KTA ${data.ktaRequest.nomorKTA}`
                  : ' · KTA belum terbit'}
              </p>
              <Button
                variant="link"
                className="px-0 h-auto text-sm"
                onClick={() => router.push(`/dashboard/kta/${data.ktaRequest.id}`)}
              >
                Buka data KTA
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          {/* Perbandingan */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Perubahan: {data.fieldLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.fieldHint && (
                <p className="text-xs text-slate-500 flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  {data.fieldHint}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-red-600 font-medium mb-1">
                    Nilai Sekarang
                  </p>
                  <p className="text-slate-600 bg-red-50 p-3 rounded break-words">
                    {data.oldValue || '(kosong)'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium mb-1">
                    Di SIKI
                    {!data.idIzinInput && ' (nggak dicek)'}
                  </p>
                  <p className="text-slate-600 bg-blue-50 p-3 rounded break-words">
                    {data.sikiValue ?? (
                      <span className="text-slate-400">
                        {data.idIzinInput
                          ? 'SIKI nggak ngirim nilainya'
                          : 'BPP nggak ngisi ID Izin'}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-green-600 font-medium mb-1">
                    Nilai Baru (diajukan)
                  </p>
                  <p className="text-slate-600 bg-green-50 p-3 rounded font-medium break-words">
                    {data.newValue}
                  </p>
                </div>
              </div>

              {data.idIzinInput && (
                <p className="text-xs text-slate-500">
                  Dibandingkan pakai ID Izin: {data.idIzinInput}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Alasan + bukti */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alasan &amp; Bukti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">
                  Alasan dari BPP
                </p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {data.reason}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">
                  Bukti permohonan
                </p>
                <a
                  href={data.buktiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  Buka bukti
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Hasil penerapan */}
          {data.status !== 'PENDING' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hasil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.catatan && (
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">
                      {data.status === 'REJECTED'
                        ? 'Alasan penolakan'
                        : 'Catatan Keuangan'}
                    </p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {data.catatan}
                    </p>
                  </div>
                )}

                {data.appliedResult && (
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">
                      Yang dijalankan sistem
                    </p>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded whitespace-pre-wrap">
                      {data.appliedResult}
                    </p>
                  </div>
                )}

                {data.appliedAt && (
                  <p className="text-xs text-slate-500">
                    Diterapkan {new Date(data.appliedAt).toLocaleString('id-ID')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Floating bar — cuma muncul kalau masih nunggu putusan */}
        {pending && (
          <div className="fixed bottom-0 left-0 right-0 z-50">
            <Card className="rounded-none shadow-2xl animate-slide-up">
              <CardContent className="py-4 px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {data.fieldLabel}: {data.oldValue || '(kosong)'} →{' '}
                      {data.newValue}
                    </p>
                    <p className="text-xs text-slate-500">
                      Kalau diterima, {data.fieldLabel} langsung diubah dan data
                      lain ditarik ulang dari SIKI.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Alasan penolakan..."
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      disabled={memproses !== null}
                      className="w-full sm:w-64"
                    />
                    <Button
                      onClick={() => putuskan(false)}
                      disabled={memproses !== null || !catatan.trim()}
                      variant="destructive"
                    >
                      {memproses === 'tolak' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Tolak
                        </>
                      )}
                    </Button>
                  </div>

                  <Button
                    onClick={() => putuskan(true)}
                    disabled={memproses !== null}
                    className="bg-emerald-600 hover:bg-emerald-700 px-8"
                  >
                    {memproses === 'terima' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Menerapkan...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Terima
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </>
    </PageTransition>
  )
}
