'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from '@/hooks/useSession'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Eye, Edit, FileText, Filter, Upload } from 'lucide-react'
import Link from 'next/link'
import { ImportKtaModal } from '@/components/dashboard/import-kta-modal'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useToast } from '@/components/ui/use-toast'
import { JenjangBadge } from '@/components/ui/jenjang-badge'
import { useTableSort } from '@/hooks/use-table-sort'
import { SortableHeader } from '@/components/ui/sortable-header'
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
  jabatanKerja: string
  jenjang: string
  status: string
  createdAt: string
  hargaFinal: number
  daerah?: {
    namaDaerah: string
    kodeDaerah: string
  }
}

interface Daerah {
  id: string
  namaDaerah: string
  kodeDaerah: string
}

export default function PermohonanPage() {
  const { session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [ktaRequests, setKtaRequests] = useState<KTARequest[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [daerahFilter, setDaerahFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [daerahList, setDaerahList] = useState<Daerah[]>([])

  const { sort, toggleSort, sortQuery } = useTableSort()

  // Track if we've already shown the toast
  const hasShownToast = useRef(false)

  // Check if user is PUSAT, ADMIN, or KEUANGAN
  const isPusatOrAdmin = session?.user.role === 'PUSAT' || session?.user.role === 'ADMIN' || session?.user.role === 'KEUANGAN'
  // Check if user is PUSAT only
  const isPusatOnly = session?.user.role === 'PUSAT'|| session?.user.role === 'ADMIN'

  // Track initial load
  const initialLoadDone = useRef(false)

  // Check for success params and show toast (only once)
  useEffect(() => {
    if (hasShownToast.current) return

    const success = searchParams.get('success')
    const nama = searchParams.get('nama')

    if (success === 'true' && nama) {
      hasShownToast.current = true
      toast({
        variant: 'success',
        title: 'Permohonan Berhasil',
        description: `Permohonan KTA atas nama ${decodeURIComponent(nama)} telah berhasil dicatat.`,
      })

      // Clear URL params
      router.replace('/dashboard/permohonan', { scroll: false })
    }
  }, [searchParams, toast, router])

  // Debounce search - hanya fetch 500ms setelah user stop ngetik
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(handler)
  }, [searchTerm])

  useEffect(() => {
    fetchKTARequests()
  }, [statusFilter, daerahFilter, debouncedSearchTerm, currentPage, sort.key, sort.dir])

  const handleSort = (key: string) => {
    if (sort.key !== key) setCurrentPage(1)
    toggleSort(key)
  }

  // Fetch daerah list for filter
  useEffect(() => {
    const fetchDaerahList = async () => {
      try {
        const response = await fetch('/api/daerah')
        const data = await response.json()
        if (data.success) {
          setDaerahList(data.data)
        }
      } catch (error) {
        console.error('Error fetching daerah list:', error)
      }
    }
    fetchDaerahList()
  }, [])

  const fetchKTARequests = async () => {
    try {
      // Only show loading skeleton for subsequent fetches, not initial load
      if (initialLoadDone.current) {
        setIsFetching(true)
      }

      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      if (daerahFilter && daerahFilter !== 'all') params.append('daerahKode', daerahFilter)
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm)
      if (sortQuery) params.append('sortBy', sort.key)
      if (sortQuery) params.append('sortDir', sort.dir)
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      FETCHED_FROM_SIKI: 'bg-blue-100 text-blue-800',
      EDITED: 'bg-yellow-100 text-yellow-800',
      WAITING_PAYMENT: 'bg-orange-100 text-orange-800',
      READY_FOR_PUSAT: 'bg-purple-100 text-purple-800',
      APPROVED_BY_PUSAT: 'bg-green-100 text-green-800',
      READY_TO_PRINT: 'bg-cyan-100 text-cyan-800',
      PRINTED: 'bg-emerald-100 text-emerald-800',
      REJECTED: 'bg-red-100 text-red-800',
      IMPORTED_PENDING_DOCS: 'bg-indigo-100 text-indigo-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Draft',
      FETCHED_FROM_SIKI: 'Diambil dari SIKI',
      EDITED: 'Diedit',
      WAITING_PAYMENT: 'Menunggu Pembayaran',
      READY_FOR_PUSAT: 'Siap ke Pusat',
      APPROVED_BY_PUSAT: 'Terkonfirmasi',
      READY_TO_PRINT: 'Siap Cetak',
      PRINTED: 'Sudah Cetak',
      REJECTED: 'Ditolak',
      IMPORTED_PENDING_DOCS: 'Import - Perlu Dokumen',
    }
    return labels[status] || status.replace(/_/g, ' ')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat data..." />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center animate-slide-up-stagger stagger-1">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Data Permohonan</h1>
          <p className="text-slate-500 text-sm">Kelola dan pantau permohonan Kartu Tanda Anggota</p>
        </div>
        <div className="flex gap-2">
          {session?.user.role === 'DAERAH' && (
            <Link href="/dashboard/payments/daerah">
              <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-md">
                <FileText className="h-4 w-4 mr-2" />
                Bayar KTA
              </Button>
            </Link>
          )}

          <Dialog open={showModal} onOpenChange={setShowModal}>
            <DialogTrigger asChild>
              <Button className="bg-slate-800 text-slate-100 hover:bg-slate-700 shadow-md">
                <Plus className="h-4 w-4 mr-2" />
                Tambah KTA
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-slate-900">Pilih Aksi</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Link href="/dashboard/kta/apply" className="block">
                  <Button className="w-full bg-slate-800 text-slate-100 hover:bg-slate-700">
                    <FileText className="h-4 w-4 mr-2" />
                    Ajukan KTA dengan ID Izin
                  </Button>
                </Link>
                  <Link href="/dashboard/permohonan/create-manual" className="block">
                    <Button variant="outline" className="w-full border-slate-300">
                      <Edit className="h-4 w-4 mr-2" />
                      Input Manual
                    </Button>
                  </Link>
                {isPusatOnly && (
                  <Button
                    onClick={() => {
                      setShowModal(false)
                      setShowImportModal(true)
                    }}
                    variant="outline"
                    className="w-full border-slate-300"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import Excel/CSV
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Info Guide */}
      <Card className="bg-blue-50 border-blue-200 animate-slide-up-stagger stagger-2">
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <div className="text-blue-600 mt-0.5">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">Informasi</h3>
              <p className="text-sm text-blue-800 leading-relaxed">
                Tambah permohonan KTA baru dengan menekan tombol <strong>"Tambah KTA"</strong>. Setelah data selesai diisi, lanjutkan ke halaman pembayaran melalui tombol <strong>"Bayar KTA"</strong>. Gunakan fitur pencarian dan filter untuk menemukan data yang diperlukan, kemudian klik baris tabel untuk melihat atau mengedit detail.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter Bar */}
      <Card className="card-3d animate-slide-up-stagger stagger-3">
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Cari berdasarkan nama, ID Izin, atau NIK..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1) // Reset to page 1 when searching
                }}
                className="pl-10 bg-white"
              />
            </div>

            <Select value={statusFilter} onValueChange={(val) => {
              setStatusFilter(val)
              setCurrentPage(1)
            }}>
              <SelectTrigger className="w-48 bg-white">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="WAITING_PAYMENT">Menunggu Pembayaran</SelectItem>
                <SelectItem value="READY_TO_PRINT">Siap Cetak</SelectItem>
              </SelectContent>
            </Select>

            {isPusatOrAdmin && (
              <Select value={daerahFilter} onValueChange={(val) => {
                setDaerahFilter(val)
                setCurrentPage(1)
              }}>
                <SelectTrigger className="w-64 bg-white">
                  <SelectValue placeholder="Filter Daerah" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Daerah</SelectItem>
                  {daerahList.map((daerah) => (
                    <SelectItem key={daerah.id} value={daerah.kodeDaerah}>
                      {daerah.kodeDaerah} - {daerah.namaDaerah}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KTA Requests Table */}
      <Card className="card-3d animate-slide-up-stagger stagger-4">
        <CardHeader className="border-b border-slate-200 bg-slate-50/50">
          <CardTitle className="text-base font-semibold text-slate-900">Daftar Permohonan KTA</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ktaRequests.length === 0 ? (
            <p className="text-center text-slate-500 py-10 text-sm">
              {session?.user.role === 'DAERAH' && !session.user.daerahId
                ? 'Anda belum di-assign ke daerah. Silakan hubungi administrator.'
                : 'Tidak ada data KTA yang ditemukan'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <SortableHeader label="Nama" sortKey="nama" sort={sort} onSort={handleSort} />
                    <SortableHeader label="ID Izin" sortKey="idIzin" sort={sort} onSort={handleSort} />
                    <SortableHeader label="NIK" sortKey="nik" sort={sort} onSort={handleSort} />
                    <SortableHeader label="Kualifikasi" sortKey="jenjang" sort={sort} onSort={handleSort} />
                    <SortableHeader label="Jabatan" sortKey="jabatanKerja" sort={sort} onSort={handleSort} />
                    {(isPusatOrAdmin || session?.user.daerahId) && <SortableHeader label="Daerah" sortKey="daerah" sort={sort} onSort={handleSort} />}
                    <SortableHeader label="Status" sortKey="status" sort={sort} onSort={handleSort} />
                    <SortableHeader label="Tanggal" sortKey="createdAt" sort={sort} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {isFetching ? (
                    // Skeleton loading rows
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                        {(isPusatOrAdmin || session?.user.daerahId) && (
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                        )}
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                      </tr>
                    ))
                  ) : (
                    ktaRequests.map((request) => (
                      <tr
                        key={request.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/dashboard/kta/${request.id}`)}
                      >
                        <td className="py-3 px-4 text-sm text-slate-900 font-medium">{request.nama}</td>
                        <td className="py-3 px-4 text-sm text-slate-600 font-mono">{request.idIzin}</td>
                        <td className="py-3 px-4 text-sm text-slate-600 font-mono">{request.nik}</td>
                        <td className="py-3 px-4">
                          {request.jenjang ? <JenjangBadge jenjang={request.jenjang} /> : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">{request.jabatanKerja}</td>
                        {(isPusatOrAdmin || session?.user.daerahId) && (
                          <td className="py-3 px-4 text-sm text-slate-600">{request.daerah?.namaDaerah || '-'}</td>
                        )}
                        <td className="py-3 px-4">
                          <Badge className={getStatusColor(request.status)}>
                            {getStatusLabel(request.status)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {new Date(request.createdAt).toLocaleDateString('id-ID')}
                        </td>
                      </tr>
                    ))
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
                  if (totalPages <= 5) return pageNum
                  if (currentPage <= 3) return i < 5 ? i + 1 : null
                  if (currentPage >= totalPages - 2) return i >= totalPages - 5 ? i + 1 : null
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

      {/* Import KTA Modal */}
      <ImportKtaModal
        open={showImportModal}
        onOpenChange={(open) => {
          setShowImportModal(open)
          if (!open) {
            // Refresh data when modal closes
            fetchKTARequests()
          }
        }}
        onSuccess={() => {
          fetchKTARequests()
        }}
      />
    </div>
  )
}
