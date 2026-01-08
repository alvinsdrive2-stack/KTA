'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Download, Filter, FileText, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { PulseLogo } from '@/components/ui/loading-spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface KTARequest {
  id: string
  idIzin: string
  nama: string
  nik: string
  jenjang: string
  jabatanKerja: string
  status: string
  createdAt: string
  hargaFinal: number
  daerah?: {
    namaDaerah: string
    kodeDaerah: string
  }
  payments?: Array<{
    bulkPayment?: {
      id: string
      invoiceNumber: string
      status: string
    }
  }>
}

export default function KTAPage() {
  const { session } = useSession()
  const [ktaRequests, setKtaRequests] = useState<KTARequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Check if user is PUSAT or ADMIN
  const isPusatOrAdmin = session?.user.role === 'PUSAT' || session?.user.role === 'ADMIN'

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    fetchKTARequests()
  }, [statusFilter, debouncedSearchTerm, currentPage])

  const fetchKTARequests = async () => {
    try {
      setLoading(true)

      // Build query string for filters - only fetch verified/approved KTAs
      const params = new URLSearchParams()

      // Only show verified statuses
      const verifiedStatuses = ['APPROVED_BY_PUSAT', 'READY_TO_PRINT', 'PRINTED']
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      } else {
        // If no filter, only show verified ones
        verifiedStatuses.forEach(status => params.append('status', status))
      }

      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm)
      params.append('page', currentPage.toString())
      params.append('limit', '10')

      const response = await fetch(`/api/kta/list?${params}`)
      const data = await response.json()

      if (data.success) {
        setKtaRequests(data.data)

        if (data.pagination) {
          setTotalPages(data.pagination.totalPages)
        }
      }
    } catch (error) {
      console.error('Error fetching KTA requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      APPROVED_BY_PUSAT: 'bg-green-100 text-green-800 border-green-200',
      READY_TO_PRINT: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      PRINTED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      APPROVED_BY_PUSAT: 'Terverifikasi',
      READY_TO_PRINT: 'Siap Cetak',
      PRINTED: 'Sudah Cetak',
    }
    return labels[status] || status
  }

  const canDownload = (status: string) => {
    return status === 'APPROVED_BY_PUSAT' || status === 'READY_TO_PRINT' || status === 'PRINTED'
  }

  const getInvoiceNumber = (request: KTARequest) => {
    return request.payments?.[0]?.bulkPayment?.invoiceNumber || '-'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat data KTA..." />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="animate-slide-up-stagger stagger-1">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Data KTA</h1>
          <p className="text-slate-500 text-sm">Daftar KTA yang sudah terverifikasi dan siap didownload</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up-stagger stagger-2">
        <Card className="card-3d">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {ktaRequests.filter(k => k.status === 'APPROVED_BY_PUSAT').length}
                </p>
                <p className="text-xs text-slate-500">Terverifikasi</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-3d">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
                <FileText className="h-6 w-6 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {ktaRequests.filter(k => k.status === 'READY_TO_PRINT').length}
                </p>
                <p className="text-xs text-slate-500">Siap Cetak</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-3d">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Download className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {ktaRequests.filter(k => k.status === 'PRINTED').length}
                </p>
                <p className="text-xs text-slate-500">Sudah Cetak</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Bar */}
      <Card className="card-3d animate-slide-up-stagger stagger-3">
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Cari berdasarkan nama, ID Izin, atau NIK..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-white">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="APPROVED_BY_PUSAT">Terverifikasi</SelectItem>
                <SelectItem value="READY_TO_PRINT">Siap Cetak</SelectItem>
                <SelectItem value="PRINTED">Sudah Cetak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KTA Table */}
      <Card className="card-3d animate-slide-up-stagger stagger-4">
        <CardHeader className="border-b border-slate-200 bg-slate-50/50">
          <CardTitle className="text-base font-semibold text-slate-900">
            Daftar KTA Terverifikasi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ktaRequests.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Belum ada KTA yang terverifikasi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Nama</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">ID Izin</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">NIK</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Jenjang</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Jabatan</th>
                    {isPusatOrAdmin && <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Daerah</th>}
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">No. Invoice</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Harga</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {ktaRequests.map((request) => (
                    <tr key={request.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-sm text-slate-900 font-medium">{request.nama}</td>
                      <td className="py-3 px-4 text-sm text-slate-600 font-mono">{request.idIzin}</td>
                      <td className="py-3 px-4 text-sm text-slate-600 font-mono">{request.nik}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="border-blue-200 text-blue-700">
                          {request.jenjang}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">{request.jabatanKerja}</td>
                      {isPusatOrAdmin && (
                        <td className="py-3 px-4 text-sm text-slate-600">{request.daerah?.namaDaerah || '-'}</td>
                      )}
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(request.status)}>
                          {getStatusLabel(request.status)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-blue-600 font-medium">
                        {getInvoiceNumber(request)}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-900 font-medium">
                        Rp {request.hargaFinal?.toLocaleString('id-ID') || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-2">
                          {/* View Detail */}
                          <Link href={`/dashboard/permohonan/${request.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-slate-100"
                              title="Lihat Detail"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </Link>

                          {/* Download Button - For APPROVED_BY_PUSAT, READY_TO_PRINT, or PRINTED */}
                          {canDownload(request.status) && (
                            <Link href={`/dashboard/kta/${request.id}/print`}>
                              <Button
                                size="sm"
                                className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                                title="Download KTA"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card className="card-3d animate-slide-up-stagger stagger-5">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Halaman {currentPage} dari {totalPages}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="border-slate-300"
                >
                  Sebelumnya
                </Button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1
                  if (totalPages <= 5) {
                    return pageNum
                  }
                  if (currentPage <= 3) {
                    return i < 5 ? i + 1 : null
                  }
                  if (currentPage >= totalPages - 2) {
                    return i >= totalPages - 5 ? i + 1 : null
                  }
                  return i === 2 ? currentPage : i === 0 ? currentPage - 1 : i === 4 ? currentPage + 1 : null
                }).filter(Boolean).map((pageNum, index) => (
                  <Button
                    key={index}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum as number)}
                    className={pageNum === currentPage ? 'bg-slate-800 text-slate-100' : 'border-slate-300'}
                  >
                    {pageNum}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="border-slate-300"
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
