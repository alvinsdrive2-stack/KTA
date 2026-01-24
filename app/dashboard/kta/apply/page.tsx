'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Search, User, Mail, Phone, MapPin, Calendar, CreditCard, Eye, Maximize2, X, ZoomIn, ZoomOut, RotateCw, Download, Separator, Info, Plus, CheckCircle, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { Separator as UISeparator } from '@/components/ui/separator'
import { useSidebar } from '@/contexts/sidebar-context'
import { useSession } from '@/hooks/useSession'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const formSchema = z.object({
  idIzin: z.string().min(1, 'ID Izin harus diisi'),
})

type FormData = z.infer<typeof formSchema>

interface IdIzinItem {
  idIzin: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  data?: any
  error?: string
  ktaRequestId?: string
}

export default function KTAApplyPage() {
  const router = useRouter()
  const { setSidebarCollapsed } = useSidebar()
  const { session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sikiData, setSikiData] = useState<any>(null)
  const [ktaRequestId, setKtaRequestId] = useState<string | null>(null)

  // Multi-ID queue states
  const [idIzinQueue, setIdIzinQueue] = useState<IdIzinItem[]>([])
  const [currentIdIndex, setCurrentIdIndex] = useState(0)
  const [isSummaryMode, setIsSummaryMode] = useState(false)
  const [bulkInputMode, setBulkInputMode] = useState(false)
  const [bulkIdIzinText, setBulkIdIzinText] = useState('')

  // Daerah states
  const [daerahList, setDaerahList] = useState<any[]>([])
  const [selectedDaerahId, setSelectedDaerahId] = useState<string>('')

  // Pricing states
  const [diskonPersen, setDiskonPersen] = useState(0)
  const [hargaBase, setHargaBase] = useState(0)
  const [hargaFinal, setHargaFinal] = useState(0)

  // Upgrade state
  const [upgradeInfo, setUpgradeInfo] = useState<any>(null)

  // Modal states
  const [ktpModalOpen, setKtpModalOpen] = useState(false)
  const [fotoModalOpen, setFotoModalOpen] = useState(false)
  const [compareModalOpen, setCompareModalOpen] = useState(false)

  // Zoom states
  const [ktpZoom, setKtpZoom] = useState(1)
  const [fotoZoom, setFotoZoom] = useState(1)
  const [compareKtpZoom, setCompareKtpZoom] = useState(1)
  const [compareFotoZoom, setCompareFotoZoom] = useState(1)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      idIzin: '',
    },
  })

  // Fetch daerah diskon on component mount
  useEffect(() => {
    const fetchDiskon = async () => {
      try {
        const response = await fetch('/api/daerah/my-diskon')
        const data = await response.json()
        if (data.success) {
          setDiskonPersen(data.diskonPersen)
        }
      } catch (error) {
        console.error('Failed to fetch diskon:', error)
      }
    }

    fetchDiskon()
  }, [])

  // Fetch daerah list for PUSAT/ADMIN users
  useEffect(() => {
    const fetchDaerahList = async () => {
      try {
        const response = await fetch('/api/daerah')
        const data = await response.json()
        if (data.success) {
          setDaerahList(data.daerah || [])
        }
      } catch (error) {
        console.error('Failed to fetch daerah list:', error)
      }
    }

    const userRole = session?.user?.role
    const userDaerahKode = session?.user?.daerah?.kodeDaerah
    const canAssignAnyDaerah = userRole === 'PUSAT' || userRole === 'ADMIN' || userDaerahKode === '00'

    if (canAssignAnyDaerah) {
      fetchDaerahList()
      // Set default to user's daerah
      if (session?.user?.daerahId) {
        setSelectedDaerahId(session.user.daerahId)
      }
    }
  }, [session])

  // Check if user can assign to any daerah
  const canAssignAnyDaerah = session?.user?.role === 'PUSAT' ||
                             session?.user?.role === 'ADMIN' ||
                             session?.user?.daerah?.kodeDaerah === '00'

  // Calculate price when jenjang or diskon changes
  useEffect(() => {
    if (sikiData?.jenjang) {
      const jenjangNum = parseInt(sikiData.jenjang, 10)
      const base = jenjangNum >= 7 ? 300000 : 100000
      setHargaBase(base)
      setHargaFinal(base - (base * diskonPersen / 100))
    }
  }, [sikiData?.jenjang, diskonPersen])

  // Check for upgrade scenario when sikiData is fetched
  useEffect(() => {
    const checkUpgrade = async () => {
      if (sikiData?.nik && sikiData.jenjang) {
        try {
          const response = await fetch('/api/kta/check-upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nik: sikiData.nik,
              jenjang: sikiData.jenjang,
              subklasifikasi: sikiData.klasifikasi?.subklasifikasi || ''
            })
          })
          const result = await response.json()
          if (result.success) {
            setUpgradeInfo(result.data)
            // Update pricing if upgrade
            if (result.data.isUpgrade) {
              setHargaBase(result.data.hargaBaru)
              // Apply discount to hargaBaru, then subtract hargaLama (what they already paid)
              const hargaBaruAfterDiskon = result.data.hargaBaru - (result.data.hargaBaru * diskonPersen / 100)
              setHargaFinal(hargaBaruAfterDiskon - result.data.hargaLama)
            }
          }
        } catch (error) {
          console.error('Failed to check upgrade:', error)
        }
      }
    }
    checkUpgrade()
  }, [sikiData?.nik, sikiData?.jenjang, sikiData?.klasifikasi?.subklasifikasi, diskonPersen])

  // Add single ID Izin to queue
  const addIdIzinToQueue = async (idIzin: string) => {
    const trimmedId = idIzin.trim()
    if (!trimmedId) return false

    // Check if already exists
    if (idIzinQueue.some(item => item.idIzin === trimmedId)) {
      setError('ID Izin sudah ada dalam antrian')
      return false
    }

    setIdIzinQueue(prev => [...prev, { idIzin: trimmedId, status: 'pending' }])
    return true
  }

  // Process bulk ID Izin input
  const processBulkInput = () => {
    // Split by comma, space, comma+space, or newline
    const items = bulkIdIzinText
      .split(/[,\s\n]+/)
      .map(item => item.trim())
      .filter(item => item.length > 0)

    const newItems: IdIzinItem[] = []

    for (const item of items) {
      // Check for duplicates in both existing queue and new items
      const existsInQueue = idIzinQueue.some(q => q.idIzin === item)
      const existsInNew = newItems.some(q => q.idIzin === item)

      if (!existsInQueue && !existsInNew) {
        newItems.push({ idIzin: item, status: 'pending' })
      }
    }

    if (newItems.length === 0) {
      setError('Tidak ada ID Izin baru yang ditambahkan')
      return
    }

    setIdIzinQueue(prev => [...prev, ...newItems])
    setBulkIdIzinText('')
    setBulkInputMode(false)
    form.reset()
  }

  // Process current ID Izin in queue
  const processCurrentIdIzin = async (idIzin: string, index?: number) => {
    setIsLoading(true)
    setError(null)

    const targetIndex = index !== undefined ? index : currentIdIndex

    try {
      const response = await fetch('/api/siki/get-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idIzin }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        let errorMessage = result.error || 'Gagal mengambil data dari SIKI'

        if (response.status === 400) {
          if (errorMessage.includes('ID Izin')) {
            errorMessage = 'ID Izin tidak valid. Pastikan ID Izin yang Anda masukkan benar.'
          } else if (errorMessage.includes('tidak ditemukan')) {
            errorMessage = 'Data tidak ditemukan di SIKI.'
          }
        }

        // Mark current item as error
        setIdIzinQueue(prev => prev.map((item, idx) =>
          idx === targetIndex ? { ...item, status: 'error', error: errorMessage } : item
        ))

        setError(errorMessage)
      } else {
        // Mark current item as processing and store data
        setIdIzinQueue(prev => prev.map((item, idx) =>
          idx === targetIndex ? { ...item, status: 'processing', data: result.data } : item
        ))
        setSikiData(result.data)
        setKtaRequestId(null)
      }
    } catch (error) {
      const errorMessage = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.'
      setIdIzinQueue(prev => prev.map((item, idx) =>
        idx === targetIndex ? { ...item, status: 'error', error: errorMessage } : item
      ))
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Complete current ID and move to next
  const completeCurrentAndNext = async () => {
    // Check upgrade restriction first
    if (upgradeInfo && !upgradeInfo.canUpgrade) {
      setError(upgradeInfo.reason || 'Tidak dapat membuat permohonan KTA baru untuk NIK ini.')
      return
    }

    setIsLoading(true)

    try {
      if (!sikiData.nik || !sikiData.nama) {
        setError('NIK dan Nama harus diisi sebelum menyimpan.')
        return
      }

      // Save current KTA request
      const response = await fetch('/api/kta/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idIzin: idIzinQueue[currentIdIndex].idIzin,
          sikiData: sikiData,
          daerahId: canAssignAnyDaerah ? selectedDaerahId : undefined
        }),
      })

      const result = await response.json()

      if (response.ok) {
        // Mark current as completed
        const updatedQueue = [...idIzinQueue]
        updatedQueue[currentIdIndex] = {
          ...updatedQueue[currentIdIndex],
          status: 'completed',
          ktaRequestId: result.data?.id
        }
        setIdIzinQueue(updatedQueue)

        // Check if there are more pending items
        const nextIndex = updatedQueue.findIndex((item, idx) => idx > currentIdIndex && item.status === 'pending')

        if (nextIndex !== -1) {
          // Move to next item
          setCurrentIdIndex(nextIndex)
          setSikiData(null)
          setKtaRequestId(null)
          setUpgradeInfo(null)
          setError(null)
          // Auto-process next ID
          setTimeout(() => {
            processCurrentIdIzin(updatedQueue[nextIndex].idIzin, nextIndex)
          }, 500)
        } else {
          // All done, show summary
          setIsSummaryMode(true)
          setSikiData(null)
        }
      } else {
        let errorMessage = result.error || 'Gagal menyimpan permohonan'
        setError(`❌ ${errorMessage}`)
      }
    } catch (error) {
      setError('❌ Tidak dapat menyimpan data. Periksa koneksi internet Anda.')
    } finally {
      setIsLoading(false)
    }
  }

  // Retry current ID Izin
  const retryCurrentId = () => {
    setError(null)
    processCurrentIdIzin(idIzinQueue[currentIdIndex].idIzin, currentIdIndex)
  }

  // Skip to next ID Izin
  const skipToNext = () => {
    const nextIndex = idIzinQueue.findIndex((item, idx) => idx > currentIdIndex && item.status === 'pending')
    if (nextIndex !== -1) {
      setCurrentIdIndex(nextIndex)
      setSikiData(null)
      setKtaRequestId(null)
      setUpgradeInfo(null)
      setError(null)
      setTimeout(() => {
        processCurrentIdIzin(idIzinQueue[nextIndex].idIzin, nextIndex)
      }, 500)
    } else {
      // All done
      setIsSummaryMode(true)
      setSikiData(null)
    }
  }

  // Navigate to specific ID Izin in queue
  const navigateToIdIzin = (index: number) => {
    if (index === currentIdIndex) return

    setCurrentIdIndex(index)
    const item = idIzinQueue[index]

    if (item.status === 'completed' || (item.status === 'processing' && item.data)) {
      setSikiData(item.data)
      setKtaRequestId(item.ktaRequestId || null)
      setUpgradeInfo(null)
      setError(null)
    } else if (item.status === 'pending') {
      setSikiData(null)
      setKtaRequestId(null)
      setUpgradeInfo(null)
      setError(null)
      setTimeout(() => {
        processCurrentIdIzin(item.idIzin, index)
      }, 300)
    } else {
      // error status
      setSikiData(null)
      setKtaRequestId(null)
      setError(item.error || 'Terjadi kesalahan')
    }
  }

  const onSearch = async (data: FormData) => {
    // Check if input contains multiple ID Izin (comma, space, or newline separated)
    const separators = /[,\s\n]+/
    const multipleIds = data.idIzin.split(separators).filter(id => id.trim().length > 0)

    if (multipleIds.length > 1) {
      // Multiple IDs detected - add all to queue
      let addedCount = 0
      const newItems: IdIzinItem[] = []

      for (const id of multipleIds) {
        const trimmedId = id.trim()
        const existsInQueue = idIzinQueue.some(item => item.idIzin === trimmedId)
        const existsInNew = newItems.some(item => item.idIzin === trimmedId)

        if (!existsInQueue && !existsInNew) {
          newItems.push({ idIzin: trimmedId, status: 'pending' })
          addedCount++
        }
      }

      if (addedCount > 0) {
        setIdIzinQueue(prev => {
          const updated = [...prev, ...newItems]
          // Start processing first new item
          const firstNewIndex = prev.length
          setTimeout(() => {
            setCurrentIdIndex(firstNewIndex)
            processCurrentIdIzin(newItems[0].idIzin, firstNewIndex)
          }, 300)
          return updated
        })
        form.reset()
      } else {
        setError('Semua ID Izin sudah ada dalam antrian')
      }
      return
    }

    // Single ID - normal flow
    if (idIzinQueue.length === 0) {
      await addIdIzinToQueue(data.idIzin)
      setCurrentIdIndex(0)
      await processCurrentIdIzin(data.idIzin)
      form.reset()
    } else {
      // Add to existing queue
      const added = await addIdIzinToQueue(data.idIzin)
      if (added) {
        form.reset()
      }
    }
  }

  const handleZoom = (type: 'ktp' | 'foto' | 'compareKtp' | 'compareFoto', direction: 'in' | 'out') => {
    switch (type) {
      case 'ktp':
        setKtpZoom(prev => direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5))
        break
      case 'foto':
        setFotoZoom(prev => direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5))
        break
      case 'compareKtp':
        setCompareKtpZoom(prev => direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5))
        break
      case 'compareFoto':
        setCompareFotoZoom(prev => direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5))
        break
    }
  }

  const resetZoom = (type: 'ktp' | 'foto' | 'all') => {
    switch (type) {
      case 'ktp':
        setKtpZoom(1)
        break
      case 'foto':
        setFotoZoom(1)
        break
      case 'all':
        setKtpZoom(1)
        setFotoZoom(1)
        setCompareKtpZoom(1)
        setCompareFotoZoom(1)
        break
    }
  }

  const closeAllPreviews = () => {
    setKtpModalOpen(false)
    setFotoModalOpen(false)
    setSidebarCollapsed(false)
    setKtpZoom(1)
    setFotoZoom(1)
  }

  const handleDownload = (url: string, type: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `${type}-${Date.now()}`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Calculate stats
  const completedCount = idIzinQueue.filter(item => item.status === 'completed').length
  const errorCount = idIzinQueue.filter(item => item.status === 'error').length
  const totalCount = idIzinQueue.length

  const currentItem = idIzinQueue[currentIdIndex]

  return (
    <div className="space-y-5 transition-all duration-300">
      {/* Header */}
      <div className="animate-slide-up-stagger stagger-1">
        <h1 className="text-2xl font-semibold text-slate-900">Permohonan KTA Baru</h1>
        <p className="text-slate-500 text-sm">
          {idIzinQueue.length === 0
            ? 'Masukkan ID Izin untuk mengambil data dari SIKI'
            : `Memproses ${currentIdIndex + 1} dari ${totalCount} ID Izin`
          }
        </p>
      </div>

      {/* Queue Progress Bar - Show when queue exists */}
      {idIzinQueue.length > 0 && !isSummaryMode && (
        <Card className="card-3d animate-slide-up-stagger stagger-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Progress</span>
                <Badge variant="outline" className="text-xs">
                  {completedCount}/{totalCount} Selesai
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {errorCount} Error
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkInputMode(true)}
                  className="h-8"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Tambah
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSummaryMode(true)}
                  className="h-8"
                >
                  Lihat Ringkasan
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-2 mb-3">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>

            {/* Queue Items - Horizontal Scroll */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {idIzinQueue.map((item, index) => (
                <button
                  key={index}
                  onClick={() => navigateToIdIzin(index)}
                  className={cn(
                    "flex-shrink-0 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all min-w-[120px]",
                    index === currentIdIndex
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : item.status === 'completed'
                      ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                      : item.status === 'error'
                      ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">#{index + 1}</span>
                    {item.status === 'completed' && <CheckCircle className="h-3.5 w-3.5 text-green-600" />}
                    {item.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-red-600" />}
                    {item.status === 'processing' && <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />}
                  </div>
                  <div className="truncate mt-1 opacity-70">{item.idIzin}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Mode - Show when all done or manually opened */}
      {isSummaryMode && (
        <Card className="card-3d animate-slide-up-stagger stagger-2">
          <CardHeader className="border-b border-slate-200 bg-slate-50/50">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Ringkasan Permohonan
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{completedCount}</div>
                  <div className="text-sm text-green-700">Berhasil</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                  <div className="text-sm text-red-700">Gagal</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-600">{totalCount}</div>
                  <div className="text-sm text-slate-700">Total</div>
                </div>
              </div>

              {/* Detailed List */}
              <div className="border rounded-lg divide-y">
                {idIzinQueue.map((item, index) => (
                  <div key={index} className="p-3 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      {item.status === 'completed' && (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      )}
                      {item.status === 'error' && (
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                      )}
                      {item.status === 'pending' && (
                        <div className="h-5 w-5 rounded-full border-2 border-slate-300 flex-shrink-0" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-slate-900">{item.idIzin}</div>
                        {item.data?.nama && (
                          <div className="text-xs text-slate-500">{item.data.nama}</div>
                        )}
                        {item.error && (
                          <div className="text-xs text-red-600 mt-1">{item.error}</div>
                        )}
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        item.status === 'completed' && 'bg-green-100 text-green-800',
                        item.status === 'error' && 'bg-red-100 text-red-800',
                        item.status === 'pending' && 'bg-slate-100 text-slate-800'
                      )}
                    >
                      {item.status === 'completed' && 'Selesai'}
                      {item.status === 'error' && 'Gagal'}
                      {item.status === 'pending' && 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsSummaryMode(false)
                    if (idIzinQueue.some(item => item.status === 'pending')) {
                      const nextPending = idIzinQueue.findIndex(item => item.status === 'pending')
                      setCurrentIdIndex(nextPending)
                      processCurrentIdIzin(idIzinQueue[nextPending].idIzin, nextPending)
                    }
                  }}
                  disabled={!idIzinQueue.some(item => item.status === 'pending')}
                  className="flex-1"
                >
                  Lanjutkan Pending
                </Button>
                <Button
                  onClick={() => router.push('/dashboard/permohonan')}
                  className="flex-1 bg-slate-800 text-slate-100 hover:bg-slate-700"
                >
                  Ke Daftar Permohonan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Input Mode */}
      {bulkInputMode && (
        <Card className="card-3d animate-slide-up-stagger stagger-2">
          <CardHeader className="border-b border-slate-200 bg-slate-50/50">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Plus className="h-5 w-5 text-slate-700" />
              Tambah Banyak ID Izin
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="space-y-4">
              <div>
                <Label htmlFor="bulkIdIzin">ID Izin (satu per baris)</Label>
                <textarea
                  id="bulkIdIzin"
                  value={bulkIdIzinText}
                  onChange={(e) => setBulkIdIzinText(e.target.value)}
                  placeholder="I-2023100412221515288, I-2025121020400471648&#10;atau satu per baris"
                  rows={8}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Pisahkan dengan koma, spasi, atau baris baru
                </p>
              </div>

              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setBulkInputMode(false)
                    setBulkIdIzinText('')
                    setError(null)
                  }}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  onClick={processBulkInput}
                  disabled={isLoading || !bulkIdIzinText.trim()}
                  className="flex-1 bg-blue-800 text-slate-100 hover:bg-blue-950"
                >
                  {isLoading ? 'Memproses...' : 'Tambah ke Antrian'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Card - Hide when queue is active and not in bulk mode */}
      {(idIzinQueue.length === 0 || bulkInputMode) && !isSummaryMode && (
        <Card className="card-3d animate-slide-up-stagger stagger-2">
          <CardHeader className="border-b border-slate-200 bg-slate-50/50">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Search className="h-5 w-5 text-slate-700" />
              {idIzinQueue.length === 0 ? 'Cari Data SIKI' : 'Tambah ID Izin Lain'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={form.handleSubmit(onSearch)} className="space-y-2">
              {error && !sikiData && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="idIzin" className="text-slate-700">ID Izin <span className="text-red-600">*</span></Label>
                <Input
                  id="idIzin"
                  placeholder="Contoh: 1234567890123456"
                  {...form.register('idIzin')}
                  disabled={isLoading}
                  className="bg-white"
                />
                <p className="text-xs text-slate-500">
                  Masukkan 21 digit nomor ID Izin yang Anda dapatkan dari SIKI
                </p>
                {form.formState.errors.idIzin && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {form.formState.errors.idIzin.message}
                  </p>
                )}
              </div>

              {/* Daerah Selection - Only for PUSAT/ADMIN/Nasional users */}
              {canAssignAnyDaerah && daerahList.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="daerah" className="text-slate-700">Daerah</Label>
                  <select
                    id="daerah"
                    value={selectedDaerahId}
                    onChange={(e) => setSelectedDaerahId(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Pilih Daerah</option>
                    {daerahList.map((daerah) => (
                      <option key={daerah.id} value={daerah.id}>
                        {daerah.namaDaerah}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    Pilih daerah untuk KTA ini
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-800 text-slate-100 hover:bg-blue-950 shadow-md"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <PulseLogo className="scale-50" />
                    </span>
                  ) : (
                    'Cari Data'
                  )}
                </Button>
                {idIzinQueue.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBulkInputMode(true)}
                    className="border-slate-300"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Banyak
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Current Item Processing */}
      {!isSummaryMode && !bulkInputMode && currentItem && sikiData && (
        <>
          {/* Current Item Header */}
          <Card className="card-3d animate-slide-up-stagger stagger-2">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-700">{currentIdIndex + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">ID Izin: {currentItem.idIzin}</p>
                    <p className="text-xs text-slate-500">{sikiData.nama || 'Data SIKI'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {currentIdIndex > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateToIdIzin(currentIdIndex - 1)}
                      className="h-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}
                  {currentIdIndex < idIzinQueue.length - 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateToIdIzin(currentIdIndex + 1)}
                      className="h-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Card */}
          <Card className="card-3d animate-slide-up-stagger stagger-3">
            <CardHeader className="border-b border-slate-200 bg-slate-50/50">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <User className="h-5 w-5 text-slate-700" />
                Data Pemohon
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <Alert className="bg-sky-50 border-sky-200">
                <AlertCircle className="h-4 w-4 text-sky-600" />
                <AlertDescription className="text-sky-800 text-sm">
                  Data diambil dari SIKI. Data bersifat read-only dan tidak dapat diubah.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nik" className="text-slate-700">NIK</Label>
                  <Input
                    id="nik"
                    value={sikiData.nik}
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label htmlFor="nama" className="text-slate-700">Nama Lengkap</Label>
                  <Input
                    id="nama"
                    value={sikiData.nama}
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label htmlFor="jabatan" className="text-slate-700">Jabatan Kerja</Label>
                  <Input
                    id="jabatan"
                    value={sikiData.jabatanKerja || sikiData.jabatan || ''}
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label htmlFor="subklasifikasi" className="text-slate-700">Sub Klasifikasi</Label>
                  <Input
                    id="subklasifikasi"
                    value={
                      sikiData.klasifikasi
                        ? `${sikiData.klasifikasi.kodeSubklasifikasi} - ${sikiData.klasifikasi.subklasifikasi}`
                        : sikiData.subklasifikasi || ''
                    }
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label htmlFor="jenjang" className="text-slate-700">Jenjang</Label>
                  <Input
                    id="jenjang"
                    value={sikiData.jenjang || ''}
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">Jenjang diambil dari data SIKI</p>
                </div>
                <div>
                  <Label htmlFor="telp" className="text-slate-700">No. Telepon</Label>
                  <Input
                    id="telp"
                    value={sikiData.telp || ''}
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="email" className="text-slate-700">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={sikiData.email || ''}
                    readOnly
                    className="mt-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="alamat" className="text-slate-700">Alamat</Label>
                  <textarea
                    id="alamat"
                    value={sikiData.alamat || ''}
                    readOnly
                    rows={3}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Document Previews */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div>
                  <Label className="text-sm font-medium text-slate-700">KTP</Label>
                  {sikiData.ktpUrl ? (
                    <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <p className="text-sm text-emerald-700">Dokumen KTP tersedia</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">KTP tidak tersedia</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Pas Foto</Label>
                  {sikiData.fotoUrl ? (
                    <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <p className="text-sm text-emerald-700">Pas Foto tersedia</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Pas foto tidak tersedia</p>
                  )}
                </div>
                {(sikiData.ktpUrl || sikiData.fotoUrl) && (
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-300"
                      onClick={() => {
                        setKtpModalOpen(true)
                        setFotoModalOpen(true)
                        setSidebarCollapsed(true)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Bandingkan Dokumen
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Card */}
          <Card className="card-3d animate-slide-up-stagger stagger-4">
            <CardHeader className="border-b border-slate-200 bg-slate-50/50">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <CreditCard className="h-5 w-5 text-slate-700" />
                Pembayaran
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="space-y-4">
                {/* Upgrade Alert */}
                {upgradeInfo?.isUpgrade && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <p className="font-semibold">Upgrade KTA Terdeteksi!</p>
                      <p className="text-sm mt-1">KTA Lama: Jenjang {upgradeInfo.oldJenjang} - Rp {upgradeInfo.hargaLama.toLocaleString('id-ID')}</p>
                      <p className="text-sm">KTA Baru: Jenjang {upgradeInfo.newJenjang} - Rp {upgradeInfo.hargaBaru.toLocaleString('id-ID')}</p>
                      <p className="text-lg font-bold mt-1">Biaya Upgrade: Rp {upgradeInfo.hargaUpgrade.toLocaleString('id-ID')}</p>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Error Alert if cannot upgrade */}
                {upgradeInfo && !upgradeInfo.canUpgrade && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 text-sm">
                      {upgradeInfo.reason}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Jenjang Info */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">Jenjang</Label>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {sikiData.jenjang || '-'}
                  </p>
                </div>

                {/* Price Breakdown */}
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  {upgradeInfo?.isUpgrade ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Harga KTA Baru</span>
                        <span className="font-medium">Rp {upgradeInfo.hargaBaru.toLocaleString('id-ID')}</span>
                      </div>
                      {diskonPersen > 0 && (
                        <div className="flex justify-between text-sm items-center">
                          <span className="text-slate-600">Diskon ({diskonPersen}%)</span>
                          <span className="font-medium text-green-600">-Rp {(upgradeInfo.hargaBaru * diskonPersen / 100).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Harga Setelah Diskon</span>
                        <span className="font-medium">Rp {(upgradeInfo.hargaBaru - (upgradeInfo.hargaBaru * diskonPersen / 100)).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-slate-600">Sudah Dibayar (KTA Lama)</span>
                        <span className="font-medium text-green-600">-Rp {upgradeInfo.hargaLama.toLocaleString('id-ID')}</span>
                      </div>
                      <UISeparator />
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-900">Total Bayar (Upgrade)</span>
                        <span className="text-xl font-bold text-blue-600">
                          Rp {hargaFinal.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Harga</span>
                        <span className="font-medium">Rp {hargaBase.toLocaleString('id-ID')}</span>
                      </div>
                      {diskonPersen > 0 && (
                        <div className="flex justify-between text-sm items-center">
                          <span className="text-slate-600">Diskon</span>
                          <span className="font-medium text-green-600">-Rp {(hargaBase - hargaFinal).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      <UISeparator />
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-900">Total Bayar</span>
                        <span className="text-xl font-bold text-blue-600">
                          Rp {hargaFinal.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 text-sm">
                    Harga berdasarkan jenjang: 1-6 = Rp 100.000, 7-9 = Rp 300.000
                  </AlertDescription>
                </Alert>

                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-sm">
                    Pembayaran dapat dilakukan setelah permohonan disimpan.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-2xl z-50 animate-slide-up">
            <div className="max-w-5xl mx-auto px-6 py-4">
              <div className="flex gap-3">
                {currentItem?.status === 'error' && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={skipToNext}
                      disabled={isLoading || currentIdIndex === idIzinQueue.length - 1}
                      className="border-slate-300"
                    >
                      Lewati
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={retryCurrentId}
                      disabled={isLoading}
                      className="border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      Coba Lagi
                    </Button>
                  </>
                )}
                {currentItem?.status !== 'error' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSikiData(null)
                      setKtaRequestId(null)
                    }}
                    disabled={isLoading}
                    className="border-slate-300"
                  >
                    Batal & Cari Ulang
                  </Button>
                )}
                <Button
                  onClick={completeCurrentAndNext}
                  disabled={isLoading || (upgradeInfo && !upgradeInfo.canUpgrade)}
                  className="flex-1 bg-slate-800 text-slate-100 hover:bg-slate-700 shadow-md"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <PulseLogo className="scale-50" />
                    </span>
                  ) : currentIdIndex < idIzinQueue.length - 1 ? (
                    'Simpan & Lanjut ke Berikutnya'
                  ) : (
                    'Simpan Permohonan'
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Spacer for fixed bottom bar */}
          <div className="h-24" />
        </>
      )}

      {/* Error State for Current Item */}
      {!isSummaryMode && !bulkInputMode && currentItem?.status === 'error' && !sikiData && (
        <Card className="card-3d animate-slide-up-stagger stagger-3">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Gagal Memuat Data
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              ID Izin: {currentItem.idIzin}
            </p>
            <p className="text-sm text-red-600 mb-6">
              {currentItem.error}
            </p>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={skipToNext}
                disabled={currentIdIndex === idIzinQueue.length - 1}
              >
                Lewati
              </Button>
              <Button
                onClick={retryCurrentId}
                className="bg-blue-800 text-slate-100 hover:bg-blue-950"
              >
                Coba Lagi
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Floating Preview Panels */}
      {(ktpModalOpen || fotoModalOpen) && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:bg-transparent lg:inset-y-0 lg:left-0 lg:right-[444px]"
            onClick={closeAllPreviews}
          />

          <div className="fixed inset-0 lg:inset-y-6 lg:inset-x-auto lg:right-6 lg:left-auto lg:top-6 lg:bottom-6 lg:w-[420px] flex flex-col z-40 bg-white lg:bg-transparent">
            <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-900">Bandingkan Dokumen</h3>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={closeAllPreviews}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 lg:flex lg:flex-col overflow-y-auto lg:overflow-visible">
              {ktpModalOpen && sikiData?.ktpUrl && (
                <div className="lg:flex-1 bg-white lg:rounded-t-xl shadow-2xl overflow-hidden flex flex-col">
                  <div className="hidden lg:flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-semibold text-slate-900 text-sm">Scan KTP</h3>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleZoom('ktp', 'in')}>
                        <ZoomIn className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleZoom('ktp', 'out')}>
                        <ZoomOut className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-semibold text-slate-900">Scan KTP</h3>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleZoom('ktp', 'in')}>
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleZoom('ktp', 'out')}>
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 p-3 lg:p-3 bg-slate-100 overflow-auto min-h-[300px] lg:min-h-0">
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden h-full flex justify-center" style={{ transform: `scale(${ktpZoom})`, transformOrigin: 'top center' }}>
                      {sikiData.ktpUrl.toLowerCase().endsWith('.pdf') ? (
                        <iframe
                          src={sikiData.ktpUrl}
                          className="w-full h-full"
                          title="Scan KTP PDF"
                        />
                      ) : (
                        <img
                          src={sikiData.ktpUrl}
                          alt="Scan KTP"
                          className="w-full h-auto object-contain"
                        />
                      )}
                    </div>
                  </div>
                  <div className="px-3 py-2 lg:px-3 lg:py-2 border-t border-slate-200 bg-slate-50 flex justify-center">
                    <p className="text-xs text-slate-500">{Math.round(ktpZoom * 100)}%</p>
                  </div>
                </div>
              )}

              {ktpModalOpen && fotoModalOpen && (
                <div className="h-2 lg:h-0" />
              )}

              {fotoModalOpen && sikiData?.fotoUrl && (
                <div className="lg:flex-1 bg-white lg:rounded-b-xl shadow-2xl overflow-hidden flex flex-col">
                  <div className="hidden lg:flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-semibold text-slate-900 text-sm">Pas Foto</h3>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleZoom('foto', 'in')}>
                        <ZoomIn className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleZoom('foto', 'out')}>
                        <ZoomOut className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={closeAllPreviews}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <h3 className="font-semibold text-slate-900">Pas Foto</h3>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleZoom('foto', 'in')}>
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleZoom('foto', 'out')}>
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 p-3 lg:p-3 bg-slate-100 overflow-auto min-h-[300px] lg:min-h-0">
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden h-full flex justify-center" style={{ transform: `scale(${fotoZoom})`, transformOrigin: 'top center' }}>
                      <img
                        src={sikiData.fotoUrl}
                        alt="Pas Foto"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  </div>
                  <div className="px-3 py-2 lg:px-3 lg:py-2 border-t border-slate-200 bg-slate-50 flex justify-center">
                    <p className="text-xs text-slate-500">{Math.round(fotoZoom * 100)}%</p>
                  </div>
                </div>
              )}

              <div className="lg:hidden p-4 border-t border-slate-200 bg-slate-50">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={closeAllPreviews}
                >
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
