'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Database, ArrowLeft, Loader2, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { JenjangBadge } from '@/components/ui/jenjang-badge'
import { BulkFetchSikiModal } from '@/components/dashboard/bulk-fetch-siki-modal'
import { useTableSort } from '@/hooks/use-table-sort'
import { SortableHeader } from '@/components/ui/sortable-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface LegacyKTA {
  id: string
  idIzin: string | null
  nomorKTA: string | null
  nama: string
  nik: string
  jenjang: string
  jabatanKerja: string
  subklasifikasi: string
  status: string
  daerah?: {
    namaDaerah: string
    kodeDaerah: string
  }
}

export default function LegacyKTAPage() {
  const { session } = useSession()
  const router = useRouter()
  const [legacyKTAs, setLegacyKTAs] = useState<LegacyKTA[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedDaerah, setSelectedDaerah] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [bulkFetchModalOpen, setBulkFetchModalOpen] = useState(false)
  const [nullIdIzinCount, setNullIdIzinCount] = useState(0)

  const { sort, toggleSort, sortQuery } = useTableSort()

  const initialLoadDone = useRef(false)

  const handleSort = (key: string) => {
    if (sort.key !== key) setCurrentPage(1)
    toggleSort(key)
  }

  // Check if user is ADMIN
  const isAdmin = session?.user.role === 'ADMIN'

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    fetchLegacyKTAs()
    fetchNullIdIzinCount()
  }, [selectedDaerah, debouncedSearchTerm, currentPage, isAdmin, sort.key, sort.dir])

  const fetchNullIdIzinCount = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedDaerah) params.append('daerahId', selectedDaerah)

      const response = await fetch(`/api/kta/fetch-siki-bulk?${params}`)
      const data = await response.json()
      if (data.success) {
        setNullIdIzinCount(data.data.count)
      }
    } catch (error) {
      console.error('Error fetching null idIzin count:', error)
    }
  }

  const fetchLegacyKTAs = async () => {
    try {
      if (initialLoadDone.current) {
        setIsFetching(true)
      }

      const params = new URLSearchParams()

      // Only fetch legacy data (DRAFT OR missing foto/ktp)
      params.append('legacy', 'true')

      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm)
      if (selectedDaerah) params.append('daerahId', selectedDaerah)
      if (sortQuery) params.append('sortBy', sort.key)
      if (sortQuery) params.append('sortDir', sort.dir)
      params.append('page', currentPage.toString())
      params.append('limit', '20')

      const response = await fetch(`/api/kta/legacy?${params}`)
      const data = await response.json()

      if (data.success) {
        setLegacyKTAs(data.data)

        if (data.pagination) {
          setTotalPages(data.pagination.totalPages)
        }
      }
    } catch (error) {
      console.error('Error fetching legacy KTA requests:', error)
    } finally {
      setLoading(false)
      setIsFetching(false)
      initialLoadDone.current = true
    }
  }

  const handleRowClick = (ktaId: string) => {
    router.push(`/dashboard/kta/${ktaId}`)
  }

  const getStatusColor = (status: string, hasIdIzin: boolean) => {
    if (!hasIdIzin) {
      return 'bg-amber-100 text-amber-800 border-amber-200'
    }
    const colors: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-800 border-slate-200',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string, hasIdIzin: boolean, hasNomorKTA: boolean) => {
    if (!hasIdIzin) {
      return 'Perlu Sync SIKI'
    }
    if (hasNomorKTA) {
      return 'Legacy (Ada No. KTA)'
    }
    return 'Legacy (Perlu No. KTA)'
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Akses Ditolak</h2>
            <p className="text-slate-500">Halaman ini hanya dapat diakses oleh Admin</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat data legacy KTA..." />
      </div>
    )
  }

  return (
    <>
      <BulkFetchSikiModal
        open={bulkFetchModalOpen}
        onOpenChange={setBulkFetchModalOpen}
        onSuccess={() => {
          fetchLegacyKTAs()
          fetchNullIdIzinCount()
        }}
      />

      <div className="space-y-5">
        {/* Header */}
        <div className="animate-slide-up-stagger stagger-1">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/kta')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Data Legacy KTA</h1>
              <p className="text-slate-500 text-sm">Data KTA lama yang diimpor dan perlu diproses</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up-stagger stagger-2">
          <Card className="card-3d">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                  <FileText className="h-6 w-6 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {legacyKTAs.length}
                  </p>
                  <p className="text-xs text-slate-500">Total Data Legacy</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-3d">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {nullIdIzinCount}
                  </p>
                  <p className="text-xs text-slate-500">Perlu Sync SIKI</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-3d bg-gradient-to-r from-purple-50 to-blue-50">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Database className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Sync dengan SIKI</p>
                    <p className="text-xs text-slate-500">Fetch ID Izin dari SIKI</p>
                  </div>
                </div>
                <Button
                  onClick={() => setBulkFetchModalOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Sync SIKI
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Bar */}
        <Card className="card-3d animate-slide-up-stagger stagger-3">
          <CardContent className="pt-5">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Cari berdasarkan nama, NIK, atau No. KTA..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white"
                />
              </div>

              <Select value={selectedDaerah || "all"} onValueChange={(v) => { setSelectedDaerah(v === "all" ? "" : v); setCurrentPage(1) }}>
                <SelectTrigger className="w-48 bg-white">
                  <SelectValue placeholder="Semua Daerah" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Daerah</SelectItem>
                  {/* TODO: Fetch daerah list */}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Legacy KTA Table */}
        <Card className="card-3d animate-slide-up-stagger stagger-4">
          <CardHeader className="border-b border-slate-200 bg-slate-50/50">
            <CardTitle className="text-base font-semibold text-slate-900">
              Daftar Data Legacy KTA
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {legacyKTAs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Belum ada data legacy KTA</p>
                <p className="text-sm text-slate-400 mt-1">Import data legacy melalui tombol Import Data Lama di dashboard</p>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <SortableHeader label="Nama" sortKey="nama" sort={sort} onSort={handleSort} />
                      <SortableHeader label="NIK" sortKey="nik" sort={sort} onSort={handleSort} />
                      <SortableHeader label="No. KTA" sortKey="nomorKTA" sort={sort} onSort={handleSort} />
                      <SortableHeader label="ID Izin" sortKey="idIzin" sort={sort} onSort={handleSort} />
                      <SortableHeader label="Kualifikasi" sortKey="jenjang" sort={sort} onSort={handleSort} />
                      <SortableHeader label="Jabatan" sortKey="jabatanKerja" sort={sort} onSort={handleSort} />
                      <SortableHeader label="Status" sortKey="status" sort={sort} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {isFetching ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                          <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>
                        </tr>
                      ))
                    ) : (
                      legacyKTAs.map((kta) => {
                        const hasIdIzin = !!kta.idIzin
                        const hasNomorKTA = !!kta.nomorKTA

                        return (
                          <tr
                            key={kta.id}
                            className="border-b border-slate-100 hover:bg-purple-50 transition-all duration-200 cursor-pointer"
                            onClick={() => handleRowClick(kta.id)}
                          >
                            <td className="py-3 px-4 text-sm text-slate-900 font-medium">{kta.nama}</td>
                            <td className="py-3 px-4 text-sm text-slate-600 font-mono">{kta.nik}</td>
                            <td className="py-3 px-4 text-sm text-slate-700 font-mono">{kta.nomorKTA || '-'}</td>
                            <td className="py-3 px-4 text-sm text-slate-600 font-mono">{kta.idIzin || '-'}</td>
                            <td className="py-3 px-4">
                              <JenjangBadge jenjang={kta.jenjang} />
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600">{kta.jabatanKerja}</td>
                            <td className="py-3 px-4">
                              <Badge className={getStatusColor(kta.status, hasIdIzin)}>
                                {getStatusLabel(kta.status, hasIdIzin, hasNomorKTA)}
                              </Badge>
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
      </div>
    </>
  )
}
