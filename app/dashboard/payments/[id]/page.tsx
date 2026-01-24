'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useToast } from '@/components/ui/use-toast'
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Gift,
  Info
} from 'lucide-react'

interface BulkPaymentDetail {
  id: string
  invoiceNumber: string
  totalJumlah: number
  totalNominal: number
  buktiPembayaranUrl: string
  status: 'PENDING' | 'VERIFIED' | 'REJECTED'
  isEnrolment: boolean
  keterangan?: string
  submittedByUser: {
    name: string
  }
  verifiedByUser?: {
    name: string
  }
  verifiedAt?: string
  createdAt: string
  daerah: {
    namaDaerah: string
    kodeDaerah: string
  }
  payments: Array<{
    id: string
    ktaRequest: {
      id: string
      idIzin: string
      nama: string
      nik: string
      jabatanKerja: string
      jenjang: string
    }
  }>
}

export default function PaymentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { session } = useSession()
  const { toast } = useToast()
  const [payment, setPayment] = useState<BulkPaymentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  // Use ref to track if we've already fetched
  const initialFetchDone = useRef(false)

  // Single useEffect for initial load and access control
  useEffect(() => {
    // If session hasn't loaded yet, wait
    if (session === null || session === undefined) {
      return
    }

    // If we already did initial fetch, don't do it again
    if (initialFetchDone.current) {
      return
    }

    // Check access control - only KEUANGAN can access
    const userRole = session?.user?.role
    const isKeuangan = userRole === 'KEUANGAN'

    if (!isKeuangan) {
      setError('Anda tidak memiliki akses ke halaman ini')
      setLoading(false)
      return
    }

    // Access granted, do initial fetch
    setError(null)
    initialFetchDone.current = true
    setLoading(true)

    const fetchPaymentDetail = async () => {
      try {
        const response = await fetch(`/api/payments/${params.id}`)

        if (!response.ok) {
          throw new Error('Failed to fetch payment detail')
        }

        const data = await response.json()

        if (data.success) {
          setPayment(data.data)
        } else {
          setError(data.error || 'Gagal memuat detail pembayaran')
        }
      } catch (error) {
        setError('Terjadi kesalahan saat memuat data')
        console.error('Fetch payment detail error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPaymentDetail()
  }, [session, params.id])

  // Access control check (after loading)
  const userRole = session?.user?.role
  const isKeuangan = userRole === 'KEUANGAN'

  if (!loading && !isKeuangan && session) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Anda tidak memiliki akses ke halaman ini. Halaman ini hanya dapat diakses oleh user KEUANGAN.
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/dashboard/payments')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali ke Daftar Pembayaran
        </Button>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-orange-100 text-orange-800',
      VERIFIED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const handleVerify = async () => {
    if (!payment) return

    setVerifying(true)
    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulkPaymentId: payment.id,
          approved: true
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Verifikasi Berhasil',
          description: 'Pembayaran telah berhasil diverifikasi.',
        })
        router.push('/dashboard/payments')
      } else {
        toast({
          variant: 'destructive',
          title: 'Verifikasi Gagal',
          description: result.error || 'Gagal memverifikasi pembayaran.',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Verifikasi Gagal',
        description: 'Terjadi kesalahan saat memverifikasi pembayaran.',
      })
    } finally {
      setVerifying(false)
    }
  }

  const handleReject = async () => {
    if (!payment || !rejectionReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Alasan Ditolak Diperlukan',
        description: 'Silakan masukkan alasan penolakan.',
      })
      return
    }

    setRejecting(true)
    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulkPaymentId: payment.id,
          approved: false,
          reason: rejectionReason
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Pembayaran Ditolak',
          description: 'Pembayaran telah berhasil ditolak.',
        })
        router.push('/dashboard/payments')
      } else {
        toast({
          variant: 'destructive',
          title: 'Penolakan Gagal',
          description: result.error || 'Gagal menolak pembayaran.',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Penolakan Gagal',
        description: 'Terjadi kesalahan saat menolak pembayaran.',
      })
    } finally {
      setRejecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulseLogo text="Memuat detail pembayaran..." />
      </div>
    )
  }

  if (error || !payment) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Data tidak ditemukan'}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/dashboard/payments')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali ke Daftar Pembayaran
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between animate-slide-up-stagger stagger-1">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/payments')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali
              </Button>
              <h1 className="text-3xl font-bold">Detail Pembayaran</h1>
            </div>
            <p className="text-gray-600">{payment.invoiceNumber}</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-3 animate-slide-up-stagger stagger-2">
          <Badge className={getStatusColor(payment.status)}>
            {payment.status === 'PENDING' && (
              <>
                <Clock className="h-4 w-4 mr-1" />
                Menunggu Konfirmasi
              </>
            )}
            {payment.status === 'VERIFIED' && (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Terkonfirmasi
              </>
            )}
            {payment.status === 'REJECTED' && (
              <>
                <XCircle className="h-4 w-4 mr-1" />
                Ditolak
              </>
            )}
          </Badge>
          <span className="text-sm text-gray-600">
            {new Date(payment.createdAt).toLocaleString('id-ID')}
          </span>
        </div>

        {/* Enrolment Banner */}
        {payment.isEnrolment && (
          <div className="animate-slide-up-stagger stagger-3">
            <Alert className="bg-purple-50 border-purple-200">
              <Gift className="h-5 w-5 text-purple-600" />
              <AlertDescription className="text-purple-800">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-purple-900">Enrolment (GRATIS - SUDAH DIBAYAR)</p>
                    <p className="text-sm text-purple-700 mt-1">
                      Ini adalah enrolment gratis - pembayaran sudah terkonfirmasi. KTA status: READY_FOR_PUSAT, menunggu konfirmasi dari Keuangan.
                    </p>
                    {payment.keterangan && (
                      <div className="mt-2 p-2 bg-purple-100 rounded-md">
                        <p className="text-xs font-medium text-purple-900 flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          Keterangan:
                        </p>
                        <p className="text-xs text-purple-800 mt-1">{payment.keterangan}</p>
                      </div>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Invoice PDF or Enrolment Info */}
          {payment.isEnrolment ? (
            <Card className="card-3d animate-slide-up-stagger stagger-4">
              <CardHeader>
                <CardTitle>Informasi Enrolment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <Gift className="h-10 w-10 text-purple-600" />
                    <div>
                      <p className="font-semibold text-purple-900">Enrolment Gratis</p>
                      <p className="text-sm text-purple-700">Tidak ada invoice untuk enrolment</p>
                    </div>
                  </div>

                  {payment.keterangan && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Keterangan:</p>
                      <div className="p-3 bg-slate-50 rounded-lg border">
                        <p className="text-sm text-gray-800">{payment.keterangan}</p>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm font-medium text-green-900 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Status: Sudah Dibayar
                    </p>
                    <p className="text-sm text-green-800 mt-1">
                      Enrolment ini sudah terkonfirmasi dan pembayaran sudah selesai (GRATIS). KTA dengan status READY_FOR_PUSAT menunggu konfirmasi dari Keuangan.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="card-3d animate-slide-up-stagger stagger-4">
              <CardHeader>
                <CardTitle>Invoice</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-slate-50">
                  <iframe
                    src={`/api/payments/invoice/${payment.id}/pdf`}
                    className="w-full h-[600px]"
                    title="Invoice PDF"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Right: Data Pembayaran */}
          <Card className={`card-3d animate-slide-up-stagger stagger-5 ${payment.isEnrolment ? 'border-purple-200' : ''}`}>
            <CardHeader>
              <CardTitle>{payment.isEnrolment ? 'Informasi Enrolment' : 'Informasi Pembayaran'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Daerah</span>
                  <span className="font-medium">
                    {payment.daerah.namaDaerah} ({payment.daerah.kodeDaerah})
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Jumlah KTA</span>
                  <span className="font-medium">{payment.totalJumlah} KTA</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">{payment.isEnrolment ? 'Total' : 'Total Pembayaran'}</span>
                  <span className={`font-bold ${payment.isEnrolment ? 'text-purple-600' : 'text-green-600'}`}>
                    {payment.isEnrolment ? (
                      <>GRATIS</>
                    ) : (
                      <>Rp {payment.totalNominal.toLocaleString('id-ID')}</>
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Diajukan oleh</span>
                  <span className="font-medium">{payment.submittedByUser.name}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-600">Tanggal Pengajuan</span>
                  <span className="font-medium">
                    {new Date(payment.createdAt).toLocaleString('id-ID')}
                  </span>
                </div>

                {payment.verifiedByUser && (
                  <>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Dikonfirmasi oleh</span>
                      <span className="font-medium">{payment.verifiedByUser.name}</span>
                    </div>
                    {payment.verifiedAt && (
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-600">Tanggal Konfirmasi</span>
                        <span className="font-medium">
                          {new Date(payment.verifiedAt).toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Bukti Pembayaran Section */}
              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-3">Bukti Pembayaran</p>
                {payment.buktiPembayaranUrl ? (
                  <div className="border rounded-lg overflow-hidden bg-slate-50">
                    {payment.buktiPembayaranUrl.toLowerCase().endsWith('.pdf') ? (
                      <iframe
                        src={payment.buktiPembayaranUrl}
                        className="w-full h-[300px]"
                        title="Bukti Pembayaran PDF"
                      />
                    ) : (
                      <img
                        src={payment.buktiPembayaranUrl}
                        alt="Bukti Pembayaran"
                        className="w-full h-[300px] object-contain cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => window.open(payment.buktiPembayaranUrl, '_blank')}
                      />
                    )}
                  </div>
                ) : (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <p className="font-semibold">Pembayaran Online</p>
                      <p className="text-sm">Pembayaran terverifikasi otomatis melalui Midtrans</p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daftar KTA */}
        <Card className="card-3d animate-slide-up-stagger stagger-6">
          <CardHeader>
            <CardTitle>Daftar KTA ({payment.payments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">ID Izin</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Nama</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">NIK</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Jenjang</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Jabatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payment.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900">{p.ktaRequest.idIzin}</td>
                      <td className="px-4 py-3 text-slate-700">{p.ktaRequest.nama}</td>
                      <td className="px-4 py-3 text-slate-700">{p.ktaRequest.nik}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {p.ktaRequest.jenjang}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.ktaRequest.jabatanKerja}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floating Bar for Actions */}
      {!payment.isEnrolment && payment.status === 'PENDING' && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <Card className="rounded-none shadow-2xl animate-slide-up">
            <CardContent className="py-4 px-6 lg:px-8">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-lg font-semibold text-slate-900">Konfirmasi Pembayaran</p>
                  <p className="text-sm text-slate-500">
                    {payment.totalJumlah} KTA • Rp {payment.totalNominal.toLocaleString('id-ID')}
                  </p>
                </div>

                {/* Reject Section */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Alasan penolakan..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    disabled={rejecting}
                    className="w-64"
                  />
                  <Button
                    onClick={handleReject}
                    disabled={rejecting || !rejectionReason.trim()}
                    variant="destructive"
                  >
                    {rejecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 mr-2" />
                        Tolak
                      </>
                    )}
                  </Button>
                </div>

                {/* Verify Button */}
                <Button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="bg-emerald-600 hover:bg-emerald-700 px-8"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Verifikasi
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
