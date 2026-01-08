'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  MapPin,
  AlertCircle,
  Search,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { getDaerahLogoUrl } from '@/lib/daerah-logo'
import Image from 'next/image'

interface DaerahStats {
  id: string
  namaDaerah: string
  kodeDaerah: string
  kodePropinsi: string | null
  isActive: boolean
  diskonPersen: number
  totalKta: number
  totalUsers: number
  statusBreakdown: Record<string, number>
}

export default function DaerahListPage() {
  const router = useRouter()
  const { session } = useSession()
  const [daerahList, setDaerahList] = useState<DaerahStats[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const initialFetchDone = useRef(false)

  // Only PUSAT and ADMIN can access
  const isPusatOrAdmin = session?.user.role === 'PUSAT' || session?.user.role === 'ADMIN'

  useEffect(() => {
    if (session === null || session === undefined) {
      return
    }

    if (initialFetchDone.current) {
      setSessionLoading(false)
      return
    }

    setSessionLoading(false)

    if (!isPusatOrAdmin) {
      setError('Anda tidak memiliki akses ke halaman ini')
      setLoading(false)
      return
    }

    setError(null)
    initialFetchDone.current = true
    setLoading(true)
    fetchDaerahList()
  }, [session, isPusatOrAdmin])

  const fetchDaerahList = async () => {
    try {
      const response = await fetch('/api/daerah/stats')
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

  const handleImageError = (daerahId: string) => {
    setImageErrors(prev => new Set(prev).add(daerahId))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED_BY_PUSAT':
      case 'PRINTED':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'READY_TO_PRINT':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'WAITING_PAYMENT':
      case 'READY_FOR_PUSAT':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Filter daerah
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
        <h1 className="text-2xl font-semibold text-slate-900">Daftar Daerah</h1>
        <p className="text-slate-500 text-sm">
          Kelola daerah dan lihat statistik KTA per provinsi
        </p>
      </div>

      {/* Search */}
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

      {/* Grid Daerah */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <PulseLogo />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-slide-up-stagger stagger-3">
          {filteredDaerah.map((daerah) => (
            <Card
              key={daerah.id}
              className="card-3d-hover cursor-pointer transition-all"
              onClick={() => router.push(`/dashboard/daerah/${daerah.id}`)}
            >
              <CardContent className="p-4">
                {/* Logo */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    {!imageErrors.has(daerah.id) ? (
                      <Image
                        src={getDaerahLogoUrl(daerah.namaDaerah)}
                        alt={daerah.namaDaerah}
                        fill
                        className="object-contain"
                        onError={() => handleImageError(daerah.id)}
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 rounded-lg flex items-center justify-center">
                        <MapPin className="h-8 w-8 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">
                      {daerah.namaDaerah}
                    </h3>
                    <p className="text-sm text-slate-500">{daerah.kodeDaerah}</p>
                    <Badge
                      variant={daerah.isActive ? 'default' : 'secondary'}
                      className="mt-1"
                    >
                      {daerah.isActive ? 'Aktif' : 'Non-Aktif'}
                    </Badge>
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      Total KTA
                    </span>
                    <span className="font-semibold text-slate-900">
                      {daerah.totalKta}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      Admin/User
                    </span>
                    <span className="font-semibold text-slate-900">
                      {daerah.totalUsers}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Diskon</span>
                    <span className="font-semibold text-blue-600">
                      {daerah.diskonPersen}%
                    </span>
                  </div>
                </div>

                {/* Status Summary */}
                {daerah.totalKta > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="flex flex-wrap gap-1">
                      {daerah.statusBreakdown['PRINTED'] && (
                        <Badge className={`text-xs ${getStatusColor('PRINTED')}`}>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {daerah.statusBreakdown['PRINTED']}
                        </Badge>
                      )}
                      {daerah.statusBreakdown['WAITING_PAYMENT'] && (
                        <Badge className={`text-xs ${getStatusColor('WAITING_PAYMENT')}`}>
                          <Clock className="h-3 w-3 mr-1" />
                          {daerah.statusBreakdown['WAITING_PAYMENT']}
                        </Badge>
                      )}
                      {daerah.statusBreakdown['REJECTED'] && (
                        <Badge className={`text-xs ${getStatusColor('REJECTED')}`}>
                          <XCircle className="h-3 w-3 mr-1" />
                          {daerah.statusBreakdown['REJECTED']}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {filteredDaerah.length === 0 && (
            <Card className="col-span-full">
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
