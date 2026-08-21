'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useToast } from '@/components/ui/use-toast'
import { useTableSort } from '@/hooks/use-table-sort'
import { SortableHeader } from '@/components/ui/sortable-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  AlertCircle,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Eye,
  Database,
  FileText,
  Receipt,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

// Types
interface Daerah {
  id: string
  namaDaerah: string
  kodeDaerah: string
}

interface KTARequest {
  id: string
  idIzin: string
  nama: string
  nik: string
  jabatanKerja: string
  jenjang: string
  status: string
  daerahId: string
  daerah: { namaDaerah: string; kodeDaerah: string } | null
  hargaFinal: number | null
  createdAt: string
  updatedAt: string
}

interface BulkPayment {
  id: string
  invoiceNumber: string
  daerahId: string
  totalJumlah: number
  totalNominal: number
  status: string
  isEnrolment: boolean
  keterangan: string | null
  daerah: { namaDaerah: string; kodeDaerah: string } | null
  submittedByUser: { name: string } | null
  verifiedByUser: { name: string } | null
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
  _count?: { payments: number }
}

interface Payment {
  id: string
  invoiceNumber: string
  ktaRequestId: string
  rekeningTujuan: string
  jumlah: number
  buktiBayarLink: string | null
  statusPembayaran: string
  paidAt: string | null
  bulkPaymentId: string | null
  createdAt: string
  updatedAt: string
  ktaRequest: {
    id: string
    idIzin: string
    nama: string
    jenjang: string
    daerah: { namaDaerah: string; kodeDaerah: string } | null
  } | null
  bulkPayment: {
    id: string
    invoiceNumber: string
    status: string
  } | null
}

type TabType = 'kta_requests' | 'bulk_payments' | 'payments'

// Status colors
const KTA_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  FETCHED_FROM_SIKI: 'bg-blue-100 text-blue-800',
  EDITED: 'bg-indigo-100 text-indigo-800',
  WAITING_PAYMENT: 'bg-yellow-100 text-yellow-800',
  READY_FOR_PUSAT: 'bg-orange-100 text-orange-800',
  APPROVED_BY_PUSAT: 'bg-green-100 text-green-800',
  READY_TO_PRINT: 'bg-teal-100 text-teal-800',
  PRINTED: 'bg-purple-100 text-purple-800',
  REJECTED: 'bg-red-100 text-red-800',
  UPGRADE_PENDING: 'bg-amber-100 text-amber-800',
  UPGRADE_PAID: 'bg-lime-100 text-lime-800',
  IMPORTED_PENDING_DOCS: 'bg-cyan-100 text-cyan-800',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-blue-100 text-blue-800',
  VERIFIED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

const KTA_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  FETCHED_FROM_SIKI: 'Dari SIKI',
  EDITED: 'Edited',
  WAITING_PAYMENT: 'Menunggu Pembayaran',
  READY_FOR_PUSAT: 'Siap ke Pusat',
  APPROVED_BY_PUSAT: 'Disetujui Pusat',
  READY_TO_PRINT: 'Siap Cetak',
  PRINTED: 'Sudah Cetak',
  REJECTED: 'Ditolak',
  UPGRADE_PENDING: 'Upgrade Pending',
  UPGRADE_PAID: 'Upgrade Dibayar',
  IMPORTED_PENDING_DOCS: 'Import Pending Docs',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PAID: 'Dibayar',
  VERIFIED: 'Terverifikasi',
  REJECTED: 'Ditolak',
}

export default function DataManagePage() {
  const router = useRouter()
  const { session } = useSession()
  const { toast } = useToast()

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('kta_requests')

  // Data states
  const [ktaRequests, setKtaRequests] = useState<KTARequest[]>([])
  const [bulkPayments, setBulkPayments] = useState<BulkPayment[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

  // UI states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [submitting, setSubmitting] = useState(false)

  // Pagination states
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10

  // Modal states
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)

  // Form state
  const [formData, setFormData] = useState<any>({})

  // Daerah list
  const [daerahList, setDaerahList] = useState<Daerah[]>([])

  const { sort, toggleSort, sortQuery } = useTableSort()

  const initialFetchDone = useRef(false)

  const handleSort = (key: string) => {
    if (sort.key !== key) setPage(1)
    toggleSort(key)
  }

  // Check access control
  useEffect(() => {
    if (session === null || session === undefined) {
      return
    }

    if (initialFetchDone.current) {
      return
    }

    const userRole = session?.user?.role
    const isAdmin = userRole === 'ADMIN'

    if (!isAdmin) {
      setError('Anda tidak memiliki akses ke halaman ini')
      setLoading(false)
      return
    }

    initialFetchDone.current = true
    setError(null)
    setLoading(true)

    fetchAllData()
    fetchDaerahList()
  }, [session])

  // Fetch data based on active tab
  useEffect(() => {
    if (initialFetchDone.current && session?.user?.role === 'ADMIN') {
      setPage(1) // Reset page when tab/filter changes
      fetchAllData()
    }
  }, [activeTab, statusFilter, sort.key, sort.dir])

  // Search debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (initialFetchDone.current) {
        setPage(1) // Reset page when search changes
        fetchAllData()
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [search])

  // Fetch data when page changes
  useEffect(() => {
    if (initialFetchDone.current && session?.user?.role === 'ADMIN') {
      fetchAllData()
    }
  }, [page])

  const fetchAllData = () => {
    switch (activeTab) {
      case 'kta_requests':
        fetchKTARequests()
        break
      case 'bulk_payments':
        fetchBulkPayments()
        break
      case 'payments':
        fetchPayments()
        break
    }
  }

  const fetchKTARequests = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter)
      if (sortQuery) params.append('sortBy', sort.key)
      if (sortQuery) params.append('sortDir', sort.dir)
      params.append('page', page.toString())
      params.append('limit', pageSize.toString())

      const response = await fetch(`/api/admin/data-manage/kta-requests?${params}`)
      const data = await response.json()

      if (data.success) {
        setKtaRequests(data.data)
        setTotal(data.pagination.total)
        setTotalPages(data.pagination.totalPages)
      } else {
        setError(data.error || 'Gagal memuat data KTA Request')
      }
    } catch (error) {
      setError('Terjadi kesalahan saat memuat data')
      console.error('Fetch KTA requests error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBulkPayments = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter)
      if (sortQuery) params.append('sortBy', sort.key)
      if (sortQuery) params.append('sortDir', sort.dir)
      params.append('page', page.toString())
      params.append('limit', pageSize.toString())

      const response = await fetch(`/api/admin/data-manage/bulk-payments?${params}`)
      const data = await response.json()

      if (data.success) {
        setBulkPayments(data.data)
        setTotal(data.pagination.total)
        setTotalPages(data.pagination.totalPages)
      } else {
        setError(data.error || 'Gagal memuat data Bulk Payment')
      }
    } catch (error) {
      setError('Terjadi kesalahan saat memuat data')
      console.error('Fetch bulk payments error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPayments = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter)
      if (sortQuery) params.append('sortBy', sort.key)
      if (sortQuery) params.append('sortDir', sort.dir)
      params.append('page', page.toString())
      params.append('limit', pageSize.toString())

      const response = await fetch(`/api/admin/data-manage/payments?${params}`)
      const data = await response.json()

      if (data.success) {
        setPayments(data.data)
        setTotal(data.pagination.total)
        setTotalPages(data.pagination.totalPages)
      } else {
        setError(data.error || 'Gagal memuat data Payment')
      }
    } catch (error) {
      setError('Terjadi kesalahan saat memuat data')
      console.error('Fetch payments error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDaerahList = async () => {
    try {
      const response = await fetch('/api/daerah')
      const data = await response.json()

      if (data.success) {
        setDaerahList(data.data)
      }
    } catch (error) {
      console.error('Fetch daerah list error:', error)
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({})
  }

  // Handle update
  const handleUpdate = async () => {
    if (!selectedItem) return

    setSubmitting(true)

    try {
      const endpoint = activeTab === 'kta_requests'
        ? `/api/admin/data-manage/kta-requests/${selectedItem.id}`
        : activeTab === 'bulk_payments'
        ? `/api/admin/data-manage/bulk-payments/${selectedItem.id}`
        : `/api/admin/data-manage/payments/${selectedItem.id}`

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Berhasil',
          description: 'Data berhasil diperbarui',
        })
        setIsEditModalOpen(false)
        setSelectedItem(null)
        resetForm()
        fetchAllData()
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal',
          description: result.error || 'Gagal memperbarui data',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: 'Terjadi kesalahan saat memperbarui data',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Handle input change
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Open view modal
  const openViewModal = (item: any) => {
    setSelectedItem(item)
    setIsViewModalOpen(true)
  }

  // Open edit modal
  const openEditModal = (item: any) => {
    setSelectedItem(item)
    setFormData(item)
    setIsEditModalOpen(true)
  }

  // Open delete modal
  const openDeleteModal = (item: any) => {
    setSelectedItem(item)
    setIsDeleteModalOpen(true)
  }

  // Handle delete
  const handleDelete = async () => {
    if (!selectedItem) return

    setSubmitting(true)

    try {
      const endpoint = activeTab === 'kta_requests'
        ? `/api/admin/data-manage/kta-requests/${selectedItem.id}`
        : activeTab === 'bulk_payments'
        ? `/api/admin/data-manage/bulk-payments/${selectedItem.id}`
        : `/api/admin/data-manage/payments/${selectedItem.id}`

      const response = await fetch(endpoint, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Berhasil',
          description: 'Data berhasil dihapus',
        })
        setIsDeleteModalOpen(false)
        setSelectedItem(null)
        fetchAllData()
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal',
          description: result.error || 'Gagal menghapus data',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: 'Terjadi kesalahan saat menghapus data',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Format currency
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const userRole = session?.user?.role
  const isAdmin = userRole === 'ADMIN'

  if (!loading && !isAdmin && session) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Anda tidak memiliki akses ke halaman ini. Halaman ini hanya dapat diakses oleh user ADMIN.
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali ke Dashboard
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulseLogo text="Memuat data..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali ke Dashboard
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="animate-slide-up-stagger stagger-1">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-6 w-6 text-slate-700" />
            <h1 className="text-2xl font-semibold text-slate-900">Data Manage</h1>
          </div>
          <p className="text-slate-500 text-sm">Kelola data KTA Request, Bulk Payment, dan Payment</p>
        </div>

        {/* Tab Navigation */}
        <Card className="card-3d animate-slide-up-stagger stagger-2">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'kta_requests' ? 'default' : 'outline'}
                onClick={() => setActiveTab('kta_requests')}
                className={cn(
                  "flex items-center gap-2",
                  activeTab === 'kta_requests'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <FileText className="h-4 w-4" />
                KTA Requests
              </Button>
              <Button
                variant={activeTab === 'bulk_payments' ? 'default' : 'outline'}
                onClick={() => setActiveTab('bulk_payments')}
                className={cn(
                  "flex items-center gap-2",
                  activeTab === 'bulk_payments'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <Receipt className="h-4 w-4" />
                Bulk Payments
              </Button>
              <Button
                variant={activeTab === 'payments' ? 'default' : 'outline'}
                onClick={() => setActiveTab('payments')}
                className={cn(
                  "flex items-center gap-2",
                  activeTab === 'payments'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <Receipt className="h-4 w-4" />
                Payments
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="card-3d animate-slide-up-stagger stagger-3">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Cari..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  {activeTab === 'kta_requests' && (
                    <>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="WAITING_PAYMENT">Menunggu Pembayaran</SelectItem>
                      <SelectItem value="READY_TO_PRINT">Siap Cetak</SelectItem>
                      <SelectItem value="REJECTED">Ditolak</SelectItem>
                    </>
                  )}
                  {(activeTab === 'bulk_payments' || activeTab === 'payments') && (
                    <>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="PAID">Dibayar</SelectItem>
                      <SelectItem value="VERIFIED">Terverifikasi</SelectItem>
                      <SelectItem value="REJECTED">Ditolak</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="card-3d animate-slide-up-stagger stagger-4">
          <CardContent className="p-4">
            {activeTab === 'kta_requests' && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <SortableHeader label="ID Izin" sortKey="idIzin" sort={sort} onSort={handleSort} />
                      <SortableHeader label="Nama" sortKey="nama" sort={sort} onSort={handleSort} />
                      <SortableHeader label="Jabatan" sortKey="jabatanKerja" sort={sort} onSort={handleSort} />
                      <SortableHeader label="Daerah" sortKey="daerah" sort={sort} onSort={handleSort} />
                      <SortableHeader label="Status" sortKey="status" sort={sort} onSort={handleSort} />
                      <SortableHeader label="Harga" sortKey="hargaFinal" sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3 text-center font-medium text-slate-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ktaRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          Tidak ada data KTA Request
                        </td>
                      </tr>
                    ) : (
                      ktaRequests.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{item.idIzin}</td>
                          <td className="px-4 py-3 text-slate-700">{item.nama}</td>
                          <td className="px-4 py-3 text-slate-700">{item.jabatanKerja}</td>
                          <td className="px-4 py-3 text-slate-700">{item.daerah?.namaDaerah || '-'}</td>
                          <td className="px-4 py-3">
                            <Badge className={KTA_STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-800'}>
                              {KTA_STATUS_LABELS[item.status] || item.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(item.hargaFinal)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openViewModal(item)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openEditModal(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteModal(item)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'bulk_payments' && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <SortableHeader label="Invoice" sortKey="invoiceNumber" sort={sort} onSort={handleSort} />
                      <SortableHeader label="Daerah" sortKey="daerah" sort={sort} onSort={handleSort} />
                      <SortableHeader label="Jumlah" sortKey="totalJumlah" sort={sort} onSort={handleSort} />
                      <SortableHeader label="Total" sortKey="totalNominal" sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3 text-left font-medium text-slate-700">Enrolment</th>
                      <SortableHeader label="Status" sortKey="status" sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3 text-center font-medium text-slate-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bulkPayments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          Tidak ada data Bulk Payment
                        </td>
                      </tr>
                    ) : (
                      bulkPayments.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{item.invoiceNumber}</td>
                          <td className="px-4 py-3 text-slate-700">{item.daerah?.namaDaerah || '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{item.totalJumlah}</td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(item.totalNominal)}</td>
                          <td className="px-4 py-3">
                            <Badge className={item.isEnrolment ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}>
                              {item.isEnrolment ? 'Ya' : 'Tidak'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={PAYMENT_STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-800'}>
                              {PAYMENT_STATUS_LABELS[item.status] || item.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openViewModal(item)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openEditModal(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteModal(item)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <SortableHeader label="Invoice" sortKey="invoiceNumber" sort={sort} onSort={handleSort} />
                      <SortableHeader label="KTA Request" sortKey="nama" sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3 text-left font-medium text-slate-700">Rekening</th>
                      <SortableHeader label="Jumlah" sortKey="jumlah" sort={sort} onSort={handleSort} />
                      <SortableHeader label="Status" sortKey="statusPembayaran" sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3 text-center font-medium text-slate-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          Tidak ada data Payment
                        </td>
                      </tr>
                    ) : (
                      payments.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{item.invoiceNumber}</td>
                          <td className="px-4 py-3 text-slate-700">{item.ktaRequest?.nama || '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{item.rekeningTujuan}</td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(item.jumlah)}</td>
                          <td className="px-4 py-3">
                            <Badge className={PAYMENT_STATUS_COLORS[item.statusPembayaran] || 'bg-gray-100 text-gray-800'}>
                              {PAYMENT_STATUS_LABELS[item.statusPembayaran] || item.statusPembayaran}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openViewModal(item)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openEditModal(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteModal(item)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {total > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                <p className="text-sm text-slate-500">
                  Menampilkan {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} dari {total} data
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (page <= 3) {
                        pageNum = i + 1
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = page - 2 + i
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Data</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-4">
              {activeTab === 'kta_requests' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500">ID Izin</Label>
                      <p className="font-medium">{selectedItem.idIzin}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Status</Label>
                      <p><Badge className={KTA_STATUS_COLORS[selectedItem.status]}>{KTA_STATUS_LABELS[selectedItem.status]}</Badge></p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Nama</Label>
                      <p className="font-medium">{selectedItem.nama}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">NIK</Label>
                      <p className="font-medium">{selectedItem.nik}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Jabatan Kerja</Label>
                      <p className="font-medium">{selectedItem.jabatanKerja}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Kualifikasi</Label>
                      <p className="font-medium">{selectedItem.jenjang}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Daerah</Label>
                      <p className="font-medium">{selectedItem.daerah?.namaDaerah || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Harga Final</Label>
                      <p className="font-medium">{formatCurrency(selectedItem.hargaFinal)}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-slate-500">Email</Label>
                      <p className="font-medium">{selectedItem.email}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-slate-500">Alamat</Label>
                      <p className="font-medium">{selectedItem.alamat}</p>
                    </div>
                  </div>
                </>
              )}
              {activeTab === 'bulk_payments' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500">Invoice Number</Label>
                      <p className="font-medium">{selectedItem.invoiceNumber}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Status</Label>
                      <p><Badge className={PAYMENT_STATUS_COLORS[selectedItem.status]}>{PAYMENT_STATUS_LABELS[selectedItem.status]}</Badge></p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Daerah</Label>
                      <p className="font-medium">{selectedItem.daerah?.namaDaerah || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Enrolment</Label>
                      <p><Badge className={selectedItem.isEnrolment ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}>{selectedItem.isEnrolment ? 'Ya' : 'Tidak'}</Badge></p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Total Jumlah</Label>
                      <p className="font-medium">{selectedItem.totalJumlah}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Total Nominal</Label>
                      <p className="font-medium">{formatCurrency(selectedItem.totalNominal)}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Submitted By</Label>
                      <p className="font-medium">{selectedItem.submittedByUser?.name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Verified By</Label>
                      <p className="font-medium">{selectedItem.verifiedByUser?.name || '-'}</p>
                    </div>
                    {selectedItem.keterangan && (
                      <div className="col-span-2">
                        <Label className="text-slate-500">Keterangan</Label>
                        <p className="font-medium">{selectedItem.keterangan}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
              {activeTab === 'payments' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500">Invoice Number</Label>
                      <p className="font-medium">{selectedItem.invoiceNumber}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Status</Label>
                      <p><Badge className={PAYMENT_STATUS_COLORS[selectedItem.statusPembayaran]}>{PAYMENT_STATUS_LABELS[selectedItem.statusPembayaran]}</Badge></p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Nama KTA</Label>
                      <p className="font-medium">{selectedItem.ktaRequest?.nama || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Rekening Tujuan</Label>
                      <p className="font-medium">{selectedItem.rekeningTujuan}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Jumlah</Label>
                      <p className="font-medium">{formatCurrency(selectedItem.jumlah)}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Paid At</Label>
                      <p className="font-medium">{formatDate(selectedItem.paidAt)}</p>
                    </div>
                    {selectedItem.buktiBayarLink && (
                      <div className="col-span-2">
                        <Label className="text-slate-500">Bukti Bayar</Label>
                        <p><a href={selectedItem.buktiBayarLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Lihat Bukti</a></p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Data</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="py-4">
              <p className="font-medium">
                {activeTab === 'kta_requests' && selectedItem.nama}
                {activeTab === 'bulk_payments' && selectedItem.invoiceNumber}
                {activeTab === 'payments' && selectedItem.invoiceNumber}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Hapus'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Data</DialogTitle>
            <DialogDescription>
              Perbarui data di bawah ini
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-4">
              {activeTab === 'kta_requests' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-idIzin">ID Izin</Label>
                      <Input
                        id="edit-idIzin"
                        value={formData.idIzin || ''}
                        onChange={(e) => handleInputChange('idIzin', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-nik">NIK</Label>
                      <Input
                        id="edit-nik"
                        value={formData.nik || ''}
                        onChange={(e) => handleInputChange('nik', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="edit-nama">Nama</Label>
                      <Input
                        id="edit-nama"
                        value={formData.nama || ''}
                        onChange={(e) => handleInputChange('nama', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-jabatanKerja">Jabatan Kerja</Label>
                      <Input
                        id="edit-jabatanKerja"
                        value={formData.jabatanKerja || ''}
                        onChange={(e) => handleInputChange('jabatanKerja', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-jenjang">Kualifikasi</Label>
                      <Input
                        id="edit-jenjang"
                        value={formData.jenjang || ''}
                        onChange={(e) => handleInputChange('jenjang', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-daerahId">Daerah</Label>
                      <Select
                        value={formData.daerahId || ''}
                        onValueChange={(value) => handleInputChange('daerahId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Daerah" />
                        </SelectTrigger>
                        <SelectContent>
                          {daerahList.map((daerah) => (
                            <SelectItem key={daerah.id} value={daerah.id}>
                              {daerah.namaDaerah}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-status">Status</Label>
                      <Select
                        value={formData.status || ''}
                        onValueChange={(value) => handleInputChange('status', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DRAFT">Draft</SelectItem>
                          <SelectItem value="FETCHED_FROM_SIKI">Dari SIKI</SelectItem>
                          <SelectItem value="EDITED">Edited</SelectItem>
                          <SelectItem value="WAITING_PAYMENT">Menunggu Pembayaran</SelectItem>
                          <SelectItem value="READY_FOR_PUSAT">Siap ke Pusat</SelectItem>
                          <SelectItem value="APPROVED_BY_PUSAT">Disetujui Pusat</SelectItem>
                          <SelectItem value="READY_TO_PRINT">Siap Cetak</SelectItem>
                          <SelectItem value="PRINTED">Sudah Cetak</SelectItem>
                          <SelectItem value="REJECTED">Ditolak</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="edit-email">Email</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="edit-noTelp">No. Telp</Label>
                      <Input
                        id="edit-noTelp"
                        value={formData.noTelp || ''}
                        onChange={(e) => handleInputChange('noTelp', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="edit-alamat">Alamat</Label>
                      <Input
                        id="edit-alamat"
                        value={formData.alamat || ''}
                        onChange={(e) => handleInputChange('alamat', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
              {activeTab === 'bulk_payments' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="edit-invoiceNumber">Invoice Number</Label>
                      <Input
                        id="edit-invoiceNumber"
                        value={formData.invoiceNumber || ''}
                        onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-daerahId">Daerah</Label>
                      <Select
                        value={formData.daerahId || ''}
                        onValueChange={(value) => handleInputChange('daerahId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Daerah" />
                        </SelectTrigger>
                        <SelectContent>
                          {daerahList.map((daerah) => (
                            <SelectItem key={daerah.id} value={daerah.id}>
                              {daerah.namaDaerah}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-status">Status</Label>
                      <Select
                        value={formData.status || ''}
                        onValueChange={(value) => handleInputChange('status', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="PAID">Dibayar</SelectItem>
                          <SelectItem value="VERIFIED">Terverifikasi</SelectItem>
                          <SelectItem value="REJECTED">Ditolak</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-totalJumlah">Total Jumlah</Label>
                      <Input
                        id="edit-totalJumlah"
                        type="number"
                        value={formData.totalJumlah || ''}
                        onChange={(e) => handleInputChange('totalJumlah', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-totalNominal">Total Nominal</Label>
                      <Input
                        id="edit-totalNominal"
                        type="number"
                        value={formData.totalNominal || ''}
                        onChange={(e) => handleInputChange('totalNominal', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-isEnrolment">Is Enrolment</Label>
                      <Select
                        value={formData.isEnrolment?.toString() || 'false'}
                        onValueChange={(value) => handleInputChange('isEnrolment', value === 'true')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Ya</SelectItem>
                          <SelectItem value="false">Tidak</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="edit-keterangan">Keterangan</Label>
                      <Input
                        id="edit-keterangan"
                        value={formData.keterangan || ''}
                        onChange={(e) => handleInputChange('keterangan', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
              {activeTab === 'payments' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="edit-invoiceNumber">Invoice Number</Label>
                      <Input
                        id="edit-invoiceNumber"
                        value={formData.invoiceNumber || ''}
                        onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-rekeningTujuan">Rekening Tujuan</Label>
                      <Input
                        id="edit-rekeningTujuan"
                        value={formData.rekeningTujuan || ''}
                        onChange={(e) => handleInputChange('rekeningTujuan', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-statusPembayaran">Status Pembayaran</Label>
                      <Select
                        value={formData.statusPembayaran || ''}
                        onValueChange={(value) => handleInputChange('statusPembayaran', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="PAID">Dibayar</SelectItem>
                          <SelectItem value="VERIFIED">Terverifikasi</SelectItem>
                          <SelectItem value="REJECTED">Ditolak</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-jumlah">Jumlah</Label>
                      <Input
                        id="edit-jumlah"
                        type="number"
                        value={formData.jumlah || ''}
                        onChange={(e) => handleInputChange('jumlah', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-buktiBayarLink">Bukti Bayar Link</Label>
                      <Input
                        id="edit-buktiBayarLink"
                        value={formData.buktiBayarLink || ''}
                        onChange={(e) => handleInputChange('buktiBayarLink', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Simpan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
