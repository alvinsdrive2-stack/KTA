'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Database, CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useSession } from '@/hooks/useSession'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DialogDescription } from '@radix-ui/react-dialog'

interface BulkFetchSikiModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface Daerah {
  id: string
  namaDaerah: string
  kodeDaerah: string
}

interface FetchResult {
  id: string
  nik: string
  nama: string
  status: 'updated' | 'not_found' | 'error' | 'duplicate' | 'partial'
  idIzin?: string
  hasFoto?: boolean
  hasKtp?: boolean
  error?: string
}

export function BulkFetchSikiModal({ open, onOpenChange, onSuccess }: BulkFetchSikiModalProps) {
  const { session } = useSession()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [selectedDaerah, setSelectedDaerah] = useState<string>('')
  const [daerahList, setDaerahList] = useState<Daerah[]>([])
  const [nullCount, setNullCount] = useState<number>(0)
  const [results, setResults] = useState<FetchResult[]>([])
  const [limit, setLimit] = useState<number>(50)

  const fetchDaerah = async () => {
    try {
      const response = await fetch('/api/daerah')
      const data = await response.json()
      if (data.success) {
        setDaerahList(data.data)
      }
    } catch (error) {
      console.error('Error fetching daerah:', error)
    }
  }

  const fetchNullCount = async () => {
    setStatsLoading(true)
    try {
      const params = selectedDaerah ? `?daerahId=${selectedDaerah}` : ''
      const response = await fetch(`/api/kta/fetch-siki-bulk${params}`)
      const data = await response.json()
      if (data.success) {
        setNullCount(data.data.count)
      }
    } catch (error) {
      console.error('Error fetching null count:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchDaerah()
      if (session?.user.daerahId) {
        setSelectedDaerah(session.user.daerahId)
      }
    }
  }, [open])

  useEffect(() => {
    if (open) {
      fetchNullCount()
    }
  }, [selectedDaerah, open])

  const handleBulkFetch = async () => {
    setLoading(true)
    setResults([])
    try {
      const response = await fetch('/api/kta/fetch-siki-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daerahId: selectedDaerah || undefined,
          limit,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal melakukan bulk fetch')
      }

      setResults(data.data.results)

      const withPhotosCount = data.data.withPhotos || 0
      const skippedCount = data.data.skipped || 0

      toast({
        variant: 'success',
        title: 'Bulk Fetch Berhasil',
        description: `${data.data.updated} diupdate (${withPhotosCount} dengan foto & KTP)${skippedCount > 0 ? `, ${skippedCount} duplikat/dilewati` : ''}, ${data.data.notFound} tidak ditemukan di SIKI`,
      })

      // Refresh stats
      fetchNullCount()

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal melakukan bulk fetch',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setResults([])
    onOpenChange(false)
  }

  const updatedCount = results.filter(r => r.status === 'updated').length
  const partialCount = results.filter(r => r.status === 'partial').length
  const duplicateCount = results.filter(r => r.status === 'duplicate').length
  const notFoundCount = results.filter(r => r.status === 'not_found').length
  const errorCount = results.filter(r => r.status === 'error').length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-slate-900">
            Sync dengan SIKI (ID Izin, Foto & KTP)
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Fetch data lengkap dari SIKI (ID Izin, foto, KTP, dan data lainnya). Record akan langsung status READY_TO_PRINT
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Stats Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-700">Record perlu Sync SIKI (belum ada ID Izin / foto / KTP)</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {statsLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin inline" />
                    ) : (
                      nullCount.toLocaleString()
                    )}
                  </p>
                </div>
              </div>
              <Button
                onClick={fetchNullCount}
                variant="outline"
                size="sm"
                disabled={statsLoading}
                className="border-blue-300"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${statsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">Info Sync SIKI</p>
                <ul className="text-sm text-amber-700 mt-1 space-y-1">
                  <li>• Untuk record tanpa ID Izin: Fetch dari SIKI index, lalu ambil data lengkap</li>
                  <li>• Untuk record dengan ID Izin tapi kurang lengkap: Langsung fetch data lengkap</li>
                  <li>• Data yang di-update: Nama, Jabatan, Jenjang, Subklasifikasi, Telp, Email, Alamat, Foto, KTP</li>
                  <li>• Setelah fetch → KTA langsung bisa di print</li>
                  <li>• Record dengan ID Izin duplikat akan dilewati</li>
                  <li>• Cache SIKI index selama 10 menit</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Daerah</label>
              <Select value={selectedDaerah || "all"} onValueChange={(v) => setSelectedDaerah(v === "all" ? "" : v)}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Semua Daerah" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Daerah</SelectItem>
                  {daerahList.map(daerah => (
                    <SelectItem key={daerah.id} value={daerah.id}>
                      {daerah.kodeDaerah} - {daerah.namaDaerah}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Limit per Request</label>
              <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 record</SelectItem>
                  <SelectItem value="25">25 record</SelectItem>
                  <SelectItem value="50">50 record</SelectItem>
                  <SelectItem value="100">100 record (maks)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-6 gap-3">
                <div className="bg-slate-100 p-3 rounded-lg">
                  <p className="text-xs text-slate-600">Total</p>
                  <p className="text-xl font-bold text-slate-900">{results.length}</p>
                </div>
                <div className="bg-emerald-100 p-3 rounded-lg">
                  <p className="text-xs text-emerald-700">Updated</p>
                  <p className="text-xl font-bold text-emerald-900">{updatedCount}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <p className="text-xs text-blue-700">Partial</p>
                  <p className="text-xl font-bold text-blue-900">{partialCount}</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                  <p className="text-xs text-purple-700">Duplikat</p>
                  <p className="text-xl font-bold text-purple-900">{duplicateCount}</p>
                </div>
                <div className="bg-amber-100 p-3 rounded-lg">
                  <p className="text-xs text-amber-700">Not Found</p>
                  <p className="text-xl font-bold text-amber-900">{notFoundCount}</p>
                </div>
                <div className="bg-red-100 p-3 rounded-lg">
                  <p className="text-xs text-red-700">Error</p>
                  <p className="text-xl font-bold text-red-900">{errorCount}</p>
                </div>
              </div>

              {/* Results List */}
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Nama</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">NIK</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">ID Izin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-3 py-2">{result.nama}</td>
                        <td className="px-3 py-2 font-mono text-slate-600">{result.nik}</td>
                        <td className="px-3 py-2">
                          {result.status === 'updated' && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Updated
                            </Badge>
                          )}
                          {result.status === 'partial' && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200" title="idIzin set tapi SIKI data gagal diambil">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Partial
                            </Badge>
                          )}
                          {result.status === 'not_found' && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                              <XCircle className="h-3 w-3 mr-1" />
                              Not Found
                            </Badge>
                          )}
                          {result.status === 'duplicate' && (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200" title={result.error}>
                              Duplicate
                            </Badge>
                          )}
                          {result.status === 'error' && (
                            <Badge className="bg-red-100 text-red-800 border-red-200">
                              Error
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600">
                          {result.idIzin || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 pt-4 flex justify-between">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-slate-300"
            disabled={loading}
          >
            Tutup
          </Button>

          <Button
            onClick={handleBulkFetch}
            disabled={loading || nullCount === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Sync SIKI ({limit} record)
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
