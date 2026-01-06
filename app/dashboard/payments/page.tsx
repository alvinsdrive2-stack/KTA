'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  CreditCard,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { PulseLogo } from '@/components/ui/loading-spinner'

interface BulkPayment {
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
    }
  }>
}

export default function PaymentsPage() {
  const { session } = useSession()
  const [payments, setPayments] = useState<BulkPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [daerahFilter, setDaerahFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // Use ref to track if initial fetch has happened
  const initialFetchDone = useRef(false)

  // Only PUSAT and ADMIN can access
  const isPusatOrAdmin = session?.user.role === 'PUSAT' || session?.user.role === 'ADMIN'

  // Single useEffect for initial load and access control
  useEffect(() => {
    // If session hasn't loaded yet, wait
    if (session === null || session === undefined) {
      return
    }

    // If we already did initial fetch, don't do it again
    if (initialFetchDone.current) {
      setSessionLoading(false)
      return
    }

    // Session is loaded, mark it
    setSessionLoading(false)

    // Check access control
    if (!isPusatOrAdmin) {
      setError('Anda tidak memiliki akses ke halaman ini')
      setLoading(false)
      return
    }

    // Access granted, do initial fetch
    setError(null)
    initialFetchDone.current = true
    setLoading(true)

    const fetchInitialData = async () => {
      try {
        const params = new URLSearchParams()
        params.append('page', '1')
        params.append('limit', '10')

        const response = await fetch(`/api/payments/list?${params}`)
        const data = await response.json()

        if (data.success) {
          setPayments(data.data)
          setTotalPages(data.pagination?.totalPages || 1)
        } else {
          setError(data.error || 'Gagal memuat data pembayaran')
        }
      } catch (error) {
        setError('Terjadi kesalahan saat memuat data')
        console.error('Fetch payments error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()
  }, [session, isPusatOrAdmin])

  // Separate useEffect for filters/pagination (only after initial load)
  useEffect(() => {
    // Skip if session still loading or initial fetch not done
    if (sessionLoading || !initialFetchDone.current || !isPusatOrAdmin) {
      return
    }

    const fetchFilteredData = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (searchTerm) params.append('search', searchTerm)
        if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
        if (daerahFilter && daerahFilter !== 'all') params.append('daerahKode', daerahFilter)
        params.append('page', currentPage.toString())
        params.append('limit', '10')

        const response = await fetch(`/api/payments/list?${params}`)
        const data = await response.json()

        if (data.success) {
          setPayments(data.data)
          setTotalPages(data.pagination?.totalPages || 1)
          setError(null)
        } else {
          setError(data.error || 'Gagal memuat data pembayaran')
        }
      } catch (error) {
        setError('Terjadi kesalahan saat memuat data')
        console.error('Fetch payments error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFilteredData()
  }, [searchTerm, statusFilter, daerahFilter, currentPage, sessionLoading, isPusatOrAdmin])

  const fetchPayments = async () => {
    // This function is now only used for manual refresh after verify
    if (!isPusatOrAdmin) {
      return
    }

    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      if (daerahFilter && daerahFilter !== 'all') params.append('daerahKode', daerahFilter)
      params.append('page', currentPage.toString())
      params.append('limit', '10')

      const response = await fetch(`/api/payments/list?${params}`)
      const data = await response.json()

      if (data.success) {
        setPayments(data.data)
        setTotalPages(data.pagination?.totalPages || 1)
        setError(null)
      } else {
        setError(data.error || 'Gagal memuat data pembayaran')
      }
    } catch (error) {
      setError('Terjadi kesalahan saat memuat data')
      console.error('Fetch payments error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-orange-100 text-orange-800',
      VERIFIED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (!isPusatOrAdmin && !sessionLoading) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Anda tidak memiliki akses ke halaman konfirmasi pembayaran. Halaman ini hanya dapat diakses oleh user PUSAT atau ADMIN.
          </AlertDescription>
        </Alert>
        <Link href="/dashboard">
          <Button>Kembali ke Dashboard</Button>
        </Link>
      </div>
    )
  }

  if (loading || sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulseLogo text="Memuat data pembayaran..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-slide-up-stagger stagger-1">
        <h1 className="text-3xl font-bold">Konfirmasi Pembayaran KTA</h1>
        <p className="text-gray-600">Kelola konfirmasi pembayaran dari seluruh daerah</p>
      </div>

      {/* Search and Filter */}
      <Card className="card-3d animate-slide-up-stagger stagger-2">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Cari invoice number atau nama daerah..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md w-48"
            >
              <option value="all">Semua Status</option>
              <option value="PENDING">Menunggu Konfirmasi</option>
              <option value="VERIFIED">Terkonfirmasi</option>
              <option value="REJECTED">Ditolak</option>
            </select>

            <select
              value={daerahFilter}
              onChange={(e) => setDaerahFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md w-48"
            >
              <option value="all">Semua Daerah</option>
              <option value="00">00 - Nasional</option>
              <option value="11">11 - Aceh</option>
              <option value="12">12 - Sumatera Utara</option>
              <option value="13">13 - Sumatera Barat</option>
              <option value="14">14 - Riau</option>
              <option value="31">31 - DKI Jakarta</option>
              <option value="32">32 - Jawa Barat</option>
              <option value="33">33 - Jawa Tengah</option>
              <option value="34">34 - DI Yogyakarta</option>
              <option value="35">35 - Jawa Timur</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Payments List */}
      <Card className="card-3d animate-slide-up-stagger stagger-3">
        <CardHeader>
          <CardTitle>Daftar Pembayaran</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : payments.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Tidak ada data pembayaran yang ditemukan</p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <Link
                  key={payment.id}
                  href={`/dashboard/payments/${payment.id}`}
                  className="block"
                >
                  <div className="border rounded-lg p-4 hover:bg-blue-50 cursor-pointer transition-colors duration-150">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{payment.invoiceNumber}</h3>
                          <Badge className={getStatusColor(payment.status)}>
                            {payment.status === 'PENDING' && (
                              <>
                                <Clock className="h-3 w-3 mr-1" />
                                Menunggu Konfirmasi
                              </>
                            )}
                            {payment.status === 'VERIFIED' && (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Terkonfirmasi
                              </>
                            )}
                            {payment.status === 'REJECTED' && (
                              <>
                                <XCircle className="h-3 w-3 mr-1" />
                                Ditolak
                              </>
                            )}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Daerah</p>
                            <p className="font-medium">
                              {payment.daerah.namaDaerah} ({payment.daerah.kodeDaerah})
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Jumlah KTA</p>
                            <p className="font-medium">{payment.totalJumlah} KTA</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Total Pembayaran</p>
                            <p className="font-medium text-green-600">
                              Rp {payment.totalNominal.toLocaleString('id-ID')}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Diajukan oleh</p>
                            <p className="font-medium">{payment.submittedByUser.name}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Tanggal</p>
                            <p className="font-medium">
                              {new Date(payment.createdAt).toLocaleDateString('id-ID')}
                            </p>
                          </div>
                          {payment.verifiedByUser && (
                            <div>
                              <p className="text-gray-600">Dikonfirmasi oleh</p>
                              <p className="font-medium">{payment.verifiedByUser.name}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card className="card-3d animate-slide-up-stagger stagger-4">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Halaman {currentPage} dari {totalPages}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}