'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Download, Filter, FileText, CheckCircle, Package, CheckSquare, X, Calendar, FileSpreadsheet, Loader2, Upload, Database, Import, DownloadCloudIcon } from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useKTASelection } from '@/contexts/KTASelectionContext'
import { JenjangBadge } from '@/components/ui/jenjang-badge'
import { ImportKtaLegacyModal } from '@/components/dashboard/import-kta-legacy-modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface KTARequest {
  id: string
  idIzin: string | null
  nama: string
  nik: string
  jenjang: string
  jabatanKerja: string
  status: string
  nomorKTA: string | null
  kartuGeneratedPath: string | null
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
  const router = useRouter()
  const { selectedKTAs, toggleKTA, clearSelection, selectedCount } = useKTASelection()
  const [ktaRequests, setKtaRequests] = useState<KTARequest[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectionMode, setSelectionMode] = useState(false)

  // Track initial load
  const initialLoadDone = useRef(false)

  // Date filter states
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [downloading, setDownloading] = useState(false)

  // Import modal state (ADMIN only)
  const [importLegacyModalOpen, setImportLegacyModalOpen] = useState(false)

  // Check if user is PUSAT, ADMIN, or KEUANGAN
  const isPusatOrAdmin = session?.user.role === 'PUSAT' || session?.user.role === 'ADMIN' || session?.user.role === 'KEUANGAN'
  const isAdmin = session?.user.role === 'ADMIN'

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
      // Only show loading skeleton for subsequent fetches, not initial load
      if (initialLoadDone.current) {
        setIsFetching(true)
      }

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
      setIsFetching(false)
      initialLoadDone.current = true
    }
  }

  const handleRowClick = (ktaId: string, request: KTARequest) => {
    if (selectionMode) {
      // In selection mode, toggle the checkbox
      toggleKTA({
        id: request.id,
        nomorKTA: request.nomorKTA,
        nama: request.nama,
        kartuGeneratedPath: request.kartuGeneratedPath
      })
    } else {
      // In normal mode, navigate to detail page
      router.push(`/dashboard/kta/${ktaId}`)
    }
  }

  const handleToggleSelectionMode = () => {
    if (selectionMode) {
      // Exiting selection mode - clear selections
      clearSelection()
      setSelectionMode(false)
    } else {
      // Entering selection mode
      setSelectionMode(true)
    }
  }

  const handleSelectAll = () => {
    const allSelected = ktaRequests.every(req =>
      selectedKTAs.find(k => k.id === req.id)
    )

    if (allSelected) {
      clearSelection()
    } else {
      ktaRequests.forEach(req => {
        toggleKTA({
          id: req.id,
          nomorKTA: req.nomorKTA,
          nama: req.nama,
          kartuGeneratedPath: req.kartuGeneratedPath
        })
      })
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
      APPROVED_BY_PUSAT: 'Terkonfirmasi',
      READY_TO_PRINT: 'Siap Cetak',
      PRINTED: 'Sudah Cetak',
    }
    return labels[status] || status
  }

  const getInvoiceNumber = (request: KTARequest) => {
    return request.payments?.[0]?.bulkPayment?.invoiceNumber || '-'
  }

  const handleDownloadExcel = async () => {
    setDownloading(true)
    try {
      const params = new URLSearchParams()

      // Add date filters
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      // Add status filter
      const verifiedStatuses = ['APPROVED_BY_PUSAT', 'READY_TO_PRINT', 'PRINTED']
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      } else {
        verifiedStatuses.forEach(status => params.append('status', status))
      }

      // Add search filter
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm)

      const response = await fetch(`/api/kta/export/excel?${params}`)

      if (!response.ok) {
        throw new Error('Failed to download')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      // Generate filename with date range (use .csv extension)
      const dateStr = startDate && endDate
        ? `${startDate}_sd_${endDate}`
        : new Date().toISOString().split('T')[0]
      a.download = `Data_Anggota_KTA_${dateStr}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading file:', error)
      alert('Gagal mendownload file')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat data KTA..." />
      </div>
    )
  }

  return (
    <>
      <ImportKtaLegacyModal
        open={importLegacyModalOpen}
        onOpenChange={setImportLegacyModalOpen}
        onSuccess={() => {
          fetchKTARequests()
        }}
      />

      <div className="space-y-5 overflow-hidden">
        {/* Header */}
        <div className="animate-slide-up-stagger stagger-1">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Data KTA</h1>
            <p className="text-slate-500 text-sm">Daftar KTA yang sudah terverifikasi</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up-stagger stagger-2 over">
          <Card className="card-3d overflow-hidden">
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
            <div className="space-y-4">
              {/* Top row: Search and Date Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Cari berdasarkan nama, ID Izin, atau NIK..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-[160px] bg-white"
                  />
                  <span className="text-slate-500">sd</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-[160px] bg-white"
                  />
                </div>

                <Button
                  onClick={handleDownloadExcel}
                  disabled={downloading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Download Excel
                    </>
                  )}
                </Button>

                {isAdmin && (
                  <>
                    <Button
                      onClick={() => setImportLegacyModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <DownloadCloudIcon className="h-4 w-4 mr-2" />
                      Import Data
                    </Button>

                    <Button
                      onClick={() => router.push('/dashboard/kta/legacy')}
                      className="border-purple-300 bg-purple-800 text-white hover:bg-purple-950 hover:text-purple-100 "
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Lihat Data Legacy
                    </Button>
                  </>
                )}
              </div>

              {/* Filter info */}
              {(startDate || endDate) && (
                <div className="text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                  <span className="font-medium">Filter Tanggal:</span> {startDate || 'Awal'} sd {endDate || 'Akhir'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KTA Table */}
        <Card className="card-3d animate-slide-up-stagger stagger-4">
          <CardHeader className="border-b border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-900">
                Daftar KTA Terverifikasi
              </CardTitle>
              {ktaRequests.length > 0 && (
                selectionMode ? (
                  <div className="flex items-center gap-2 animate-[fadeIn_0.2s_ease-out]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="text-sm transition-all duration-200 hover:bg-slate-100"
                    >
                      {selectedCount === ktaRequests.length ? 'Batal Semua' : 'Pilih Semua'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleSelectionMode}
                      className="text-sm border-slate-300 transition-all duration-200 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Batal
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleSelectionMode}
                    className="text-sm border-slate-300 transition-all duration-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Pilih untuk Download
                  </Button>
                )
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {ktaRequests.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Belum ada KTA yang terverifikasi</p>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className={`text-left py-3 px-4 transition-all duration-300 ease-out overflow-hidden ${
                        selectionMode ? 'w-12 opacity-100' : 'w-0 opacity-0 p-0'
                      }`}>
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={selectedCount > 0 && selectedCount === ktaRequests.length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Nama</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">No. KTA</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">ID Izin</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">NIK</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Jenjang</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Jabatan</th>
                      {isPusatOrAdmin && <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Daerah</th>}
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">No. Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isFetching ? (
                      // Skeleton loading rows
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className={`transition-all duration-300 ease-out overflow-hidden ${
                            selectionMode ? 'w-12 opacity-100 py-3 px-4' : 'w-0 opacity-0 p-0'
                          }`}>
                            <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
                          </td>
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                          {isPusatOrAdmin && <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>}
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                        </tr>
                      ))
                    ) : (
                      ktaRequests.map((request) => {
                      const isSelected = selectedKTAs.find(k => k.id === request.id)

                      return (
                        <tr
                          key={request.id}
                          className={`border-b border-slate-100 hover:bg-blue-50 transition-all duration-200 cursor-pointer ${
                            isSelected ? 'bg-blue-50/70 scale-[1.01]' : ''
                          }`}
                          onClick={() => handleRowClick(request.id, request)}
                        >
                          <td className={`transition-all duration-300 ease-out overflow-hidden ${
                            selectionMode ? 'w-12 opacity-100 py-3 px-4' : 'w-0 opacity-0 p-0'
                          }`} onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={!!isSelected}
                                onChange={() => toggleKTA({
                                  id: request.id,
                                  nomorKTA: request.nomorKTA,
                                  nama: request.nama,
                                  kartuGeneratedPath: request.kartuGeneratedPath
                                })}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all duration-200"
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-900 font-medium">{request.nama}</td>
                          <td className="py-3 px-4 text-sm text-slate-700 font-mono">{request.nomorKTA || '-'}</td>
                          <td className="py-3 px-4 text-sm text-slate-600 font-mono">{request.idIzin || '-'}</td>
                          <td className="py-3 px-4 text-sm text-slate-600 font-mono">{request.nik}</td>
                          <td className="py-3 px-4">
                            <JenjangBadge jenjang={request.jenjang} />
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
                        </tr>
                      )
                    })
                  )}
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
    </>
  )
}
