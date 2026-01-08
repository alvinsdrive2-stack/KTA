'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PulseLogo } from '@/components/ui/loading-spinner'
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ArrowLeft
} from 'lucide-react'

interface BulkPaymentDetail {
  id: string
  invoiceNumber: string
  totalJumlah: number
  totalNominal: number
  buktiPembayaranUrl: string
  status: 'PENDING' | 'VERIFIED' | 'REJECTED'
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
  const [payment, setPayment] = useState<BulkPaymentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

    // Check access control
    const userRole = session?.user?.role
    const isPusatOrAdmin = userRole === 'PUSAT' || userRole === 'ADMIN'

    if (!isPusatOrAdmin) {
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
  const isPusatOrAdmin = userRole === 'PUSAT' || userRole === 'ADMIN'

  if (!loading && !isPusatOrAdmin && session) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Anda tidak memiliki akses ke halaman ini. Halaman ini hanya dapat diakses oleh user PUSAT atau ADMIN.
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

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Invoice PDF */}
        <Card className="card-3d animate-slide-up-stagger stagger-3">
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

        {/* Right: Data Pembayaran */}
        <Card className="card-3d animate-slide-up-stagger stagger-4">
          <CardHeader>
            <CardTitle>Informasi Pembayaran</CardTitle>
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
                <span className="text-gray-600">Total Pembayaran</span>
                <span className="font-bold text-green-600">
                  Rp {payment.totalNominal.toLocaleString('id-ID')}
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
              <div className="pt-2">
                <p className="text-gray-600 mb-2">Bukti Pembayaran</p>
                <div className="border rounded-lg overflow-hidden bg-slate-50">
                  <img
                    src={payment.buktiPembayaranUrl}
                    alt="Bukti Pembayaran"
                    className="w-full h-auto"
                    onError={(e) => {
                      e.currentTarget.src = '/images/placeholder.png'
                    }}
                  />
                </div>
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
          </CardContent>
        </Card>
      </div>

      {/* Daftar KTA */}
      <Card className="card-3d animate-slide-up-stagger stagger-5">
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
  )
}
