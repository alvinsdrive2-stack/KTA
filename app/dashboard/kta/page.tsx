'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Eye, Edit, FileText, Download, Filter, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
  jabatanKerja: string
  status: string
  createdAt: string
  hargaRegion: number
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

export default function KTAPage() {
  const { session } = useSession()
  const [ktaRequests, setKtaRequests] = useState<KTARequest[]>([])
  const [daerahList, setDaerahList] = useState<Daerah[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [daerahFilter, setDaerahFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Bulk payment states
  const [selectedRequests, setSelectedRequests] = useState<string[]>([])
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false)
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [uploadingPayment, setUploadingPayment] = useState(false)
  const [regionPrice, setRegionPrice] = useState<number | null>(null)

  // Check if user is PUSAT or ADMIN (can see all)
  const isPusatOrAdmin = session?.user.role === 'PUSAT' || session?.user.role === 'ADMIN'

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    fetchKTARequests()
    // fetchDaerahList() // Comment out for now

    // Fetch region price if user is DAERAH
    if (session?.user.role === 'DAERAH') {
      fetchRegionPrice()
    }
  }, [statusFilter, daerahFilter, debouncedSearchTerm, currentPage, session?.user.role])

  const fetchKTARequests = async () => {
    try {
      setLoading(true)
      // Build query string for filters
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      if (daerahFilter && daerahFilter !== 'all') params.append('daerahKode', daerahFilter)
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm)
      params.append('page', currentPage.toString())
      params.append('limit', '10')

      const response = await fetch(`/api/kta/list?${params}`)
      const data = await response.json()

      if (data.success) {
        setKtaRequests(data.data)

        // Set pagination info from API response
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages)
        }

        // Show message if user not assigned to daerah
        if (data.message === 'User belum di-assign ke daerah' && session?.user.role === 'DAERAH') {
          console.log('User belum di-assign ke daerah')
        }
      }
    } catch (error) {
      console.error('Error fetching KTA requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRegionPrice = async () => {
    try {
      const response = await fetch('/api/daerah/price')
      const data = await response.json()
      if (data.success) {
        setRegionPrice(data.price)
      }
    } catch (error) {
      console.error('Failed to fetch region price:', error)
    }
  }

  // No longer need client-side filtering - handled by API

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
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  // Handle checkbox selection
  const handleSelectRequest = (requestId: string) => {
    const newSelection = selectedRequests.includes(requestId)
      ? selectedRequests.filter(id => id !== requestId)
      : [...selectedRequests, requestId]

    setSelectedRequests(newSelection)

    // Store in localStorage for payment page
    const requestsData = ktaRequests
      .filter(req => newSelection.includes(req.id))
      .map(({ id, idIzin, nama, nik, jabatanKerja, status, daerah }) => ({
        id,
        idIzin,
        nama,
        nik,
        jabatanKerja,
        status,
        daerah
      }))

    localStorage.setItem('selectedKTARequests', JSON.stringify(requestsData))
  }

  const handleSelectAll = () => {
    let newSelection: string[]
    if (selectedRequests.length === ktaRequests.length) {
      newSelection = []
    } else {
      newSelection = ktaRequests.map(req => req.id)
    }

    setSelectedRequests(newSelection)

    // Store in localStorage for payment page
    const requestsData = ktaRequests
      .filter(req => newSelection.includes(req.id))
      .map(({ id, idIzin, nama, nik, jabatanKerja, status, daerah }) => ({
        id,
        idIzin,
        nama,
        nik,
        jabatanKerja,
        status,
        daerah
      }))

    localStorage.setItem('selectedKTARequests', JSON.stringify(requestsData))
  }

  // Calculate total payment amount
  const calculateTotalPayment = () => {
    if (!regionPrice) return 0
    return selectedRequests.length * regionPrice
  }

  // Handle bulk payment submission
  const handleBulkPayment = async () => {
    if (!paymentProof || selectedRequests.length === 0) return

    setUploadingPayment(true)
    const formData = new FormData()
    formData.append('paymentProof', paymentProof)
    formData.append('requestIds', JSON.stringify(selectedRequests))

    try {
      const response = await fetch('/api/kta/bulk-payment', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setShowBulkPaymentModal(false)
        setSelectedRequests([])
        setPaymentProof(null)
        fetchKTARequests() // Refresh data
        alert('Pembayaran berhasil diupload dan menunggu verifikasi dari Pusat')
      } else {
        alert(result.error || 'Gagal mengupload pembayaran')
      }
    } catch (error) {
      alert('Terjadi kesalahan saat mengupload pembayaran')
    } finally {
      setUploadingPayment(false)
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
    <div className="space-y-5">
      {/* Header - 3D Style */}
      <div className="flex justify-between items-center animate-slide-up-stagger stagger-1">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Data KTA</h1>
          <p className="text-slate-500 text-sm">Kelola permohonan Kartu Tanda Anggota</p>
        </div>
        <div className="flex gap-2">
          {session?.user.role === 'DAERAH' && selectedRequests.length > 0 && (
            <Link href="/dashboard/kta/payment">
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-md">
                <CreditCard className="h-4 w-4 mr-2" />
                Bayar ({selectedRequests.length}) - Rp {calculateTotalPayment().toLocaleString('id-ID')}
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
                    Ajukan KTA Baru
                  </Button>
                </Link>
                <Link href="/dashboard/kta/create-manual" className="block">
                  <Button variant="outline" className="w-full border-slate-300">
                    <Edit className="h-4 w-4 mr-2" />
                    Input Manual
                  </Button>
                </Link>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filter Bar - 3D Style */}
      <Card className="card-3d animate-slide-up-stagger stagger-2">
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
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="FETCHED_FROM_SIKI">Diambil dari SIKI</SelectItem>
                <SelectItem value="WAITING_PAYMENT">Menunggu Pembayaran</SelectItem>
                <SelectItem value="APPROVED_BY_PUSAT">Disetujui Pusat</SelectItem>
                <SelectItem value="PRINTED">Sudah Cetak</SelectItem>
              </SelectContent>
            </Select>

            {isPusatOrAdmin && (
              <Select value={daerahFilter} onValueChange={setDaerahFilter}>
                <SelectTrigger className="w-48 bg-white">
                  <SelectValue placeholder="Filter Daerah" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Daerah</SelectItem>
                  <SelectItem value="00">00 - Nasional</SelectItem>
                  <SelectItem value="11">11 - Aceh</SelectItem>
                  <SelectItem value="12">12 - Sumatera Utara</SelectItem>
                  <SelectItem value="31">31 - DKI Jakarta</SelectItem>
                  <SelectItem value="32">32 - Jawa Barat</SelectItem>
                  <SelectItem value="33">33 - Jawa Tengah</SelectItem>
                  <SelectItem value="34">34 - DI Yogyakarta</SelectItem>
                  <SelectItem value="35">35 - Jawa Timur</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KTA Requests Table - 3D Style */}
      <Card className="card-3d animate-slide-up-stagger stagger-3">
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
                    {session?.user.role === 'DAERAH' && (
                      <th className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedRequests.length === ktaRequests.length && ktaRequests.length > 0}
                          onChange={handleSelectAll}
                          className="rounded border-slate-300"
                        />
                      </th>
                    )}
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Nama</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">ID Izin</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">NIK</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Jabatan</th>
                    {(isPusatOrAdmin || session?.user.daerahId) && <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Daerah</th>}
                    {(isPusatOrAdmin || session?.user.daerahId) && <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Kode</th>}
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Tanggal</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {ktaRequests.map((request) => (
                    <tr key={request.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      {session?.user.role === 'DAERAH' && (
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedRequests.includes(request.id)}
                            onChange={() => handleSelectRequest(request.id)}
                            className="rounded border-slate-300"
                            disabled={request.status === 'APPROVED_BY_PUSAT' || request.status === 'READY_TO_PRINT' || request.status === 'PRINTED'}
                          />
                        </td>
                      )}
                      <td className="py-3 px-4 text-sm text-slate-900">{request.nama}</td>
                      <td className="py-3 px-4 text-sm text-slate-600 font-mono">{request.idIzin}</td>
                      <td className="py-3 px-4 text-sm text-slate-600 font-mono">{request.nik}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{request.jabatanKerja}</td>
                      {(isPusatOrAdmin || session?.user.daerahId) && (
                        <td className="py-3 px-4 text-sm text-slate-600">{request.daerah?.namaDaerah || '-'}</td>
                      )}
                      {(isPusatOrAdmin || session?.user.daerahId) && (
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-slate-200 rounded text-xs font-mono text-slate-700">
                            {request.daerah?.kodeDaerah || '-'}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(request.status)}>
                          {request.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {new Date(request.createdAt).toLocaleDateString('id-ID')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-2">
                          <Link href={`/dashboard/kta/${request.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {(request.status === 'APPROVED_BY_PUSAT' || request.status === 'READY_TO_PRINT') && (
                            <Link href={`/dashboard/kta/${request.id}/print`}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100">
                                <Download className="h-4 w-4" />
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

      {/* Pagination - 3D Style */}
      {totalPages > 1 && (
        <Card className="card-3d animate-slide-up-stagger stagger-4">
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