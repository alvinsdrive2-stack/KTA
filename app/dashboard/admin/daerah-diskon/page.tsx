'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Settings,
  AlertCircle,
  CheckCircle,
  Search,
  Save,
  MapPin
} from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'

interface Daerah {
  id: string
  namaDaerah: string
  kodeDaerah: string
  diskonPersen: number
  isActive: boolean
}

export default function DaerahDiskonPage() {
  const { session } = useSession()
  const [daerahList, setDaerahList] = useState<Daerah[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

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
    fetchDaerahList()
  }, [session, isPusatOrAdmin])

  const fetchDaerahList = async () => {
    try {
      const response = await fetch('/api/admin/daerah/diskon')
      const data = await response.json()

      if (response.ok) {
        setDaerahList(data.data)
      } else {
        setError(data.error || 'Gagal mengambil data daerah')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mengambil data')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateDiskon = async (daerahId: string, newDiskon: number) => {
    if (newDiskon < 0 || newDiskon > 100) {
      setError('Diskon harus antara 0-100')
      return
    }

    setUpdatingId(daerahId)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/admin/daerah/diskon', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: daerahId, diskonPersen: newDiskon })
      })

      const data = await response.json()

      if (response.ok) {
        // Update local state
        setDaerahList(prev =>
          prev.map(d => d.id === daerahId ? { ...d, diskonPersen: newDiskon } : d)
        )
        setSuccessMessage(`Diskon untuk ${data.data.namaDaerah} berhasil diupdate`)
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(data.error || 'Gagal mengupdate diskon')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mengupdate diskon')
    } finally {
      setUpdatingId(null)
    }
  }

  // Filter daerah based on search
  const filteredDaerah = daerahList.filter(d =>
    d.namaDaerah.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.kodeDaerah.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulseLogo />
      </div>
    )
  }

  if (!isPusatOrAdmin) {
    return (
      <div className="space-y-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">{error || 'Anda tidak memiliki akses ke halaman ini'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="animate-slide-up-stagger stagger-1">
        <h1 className="text-2xl font-semibold text-slate-900">Kelola Diskon Daerah</h1>
        <p className="text-slate-500 text-sm">
          Atur diskon untuk setiap daerah (0-100%)
        </p>
      </div>

      {/* Alert Messages */}
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50 animate-slide-up-stagger stagger-2">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-200 bg-green-50 animate-slide-up-stagger stagger-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Search Card */}
      <Card className="card-3d animate-slide-up-stagger stagger-2">
        <CardContent className="pt-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari nama daerah atau kode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* Daerah List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <PulseLogo />
        </div>
      ) : (
        <div className="space-y-3 animate-slide-up-stagger stagger-3">
          {filteredDaerah.map((daerah) => (
            <Card key={daerah.id} className="card-3d-hover transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Daerah Info */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Kode Daerah</p>
                      <p className="font-semibold text-slate-900">{daerah.kodeDaerah}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Nama Daerah</p>
                      <p className="font-semibold text-slate-900">{daerah.namaDaerah}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Status</p>
                      <Badge variant={daerah.isActive ? 'default' : 'secondary'}>
                        {daerah.isActive ? 'Aktif' : 'Non-Aktif'}
                      </Badge>
                    </div>
                  </div>

                  {/* Diskon Input */}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`diskon-${daerah.id}`} className="text-sm text-slate-700">
                      Diskon:
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`diskon-${daerah.id}`}
                        type="number"
                        min="0"
                        max="100"
                        value={daerah.diskonPersen}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0
                          setDaerahList(prev =>
                            prev.map(d => d.id === daerah.id ? { ...d, diskonPersen: val } : d)
                          )
                        }}
                        className="w-20 h-9 text-right"
                        disabled={updatingId === daerah.id}
                      />
                      <span className="text-slate-600">%</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleUpdateDiskon(daerah.id, daerah.diskonPersen)}
                      disabled={updatingId === daerah.id}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {updatingId === daerah.id ? (
                        <PulseLogo className="scale-50" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Simpan
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredDaerah.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Tidak ada daerah ditemukan</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
