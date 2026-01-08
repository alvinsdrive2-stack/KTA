'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  MapPin,
  AlertCircle,
  ArrowLeft,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Phone,
  Building,
  Calendar,
  Save,
  Shield
} from 'lucide-react'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { getDaerahLogoUrl } from '@/lib/daerah-logo'
import Image from 'next/image'
import { Separator } from '@/components/ui/separator'
import { DaerahPrintedChart, DaerahComparisonCard } from '@/components/dashboard/dashboard-charts'

interface DaerahDetail {
  id: string
  namaDaerah: string
  kodeDaerah: string
  kodePropinsi: string | null
  alamat: string | null
  telepon: string | null
  email: string | null
  isActive: boolean
  diskonPersen: number
  totalKta: number
  totalUsers: number
  statusBreakdown: Record<string, number>
}

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

interface KTARequest {
  id: string
  idIzin: string
  nama: string
  jenjang: string
  status: string
  createdAt: string
}

interface ChartData {
  date: string
  total: number
  printed: number
}

interface ComparisonData {
  last6Months: number
  previous6Months: number
  growthPercentage: number
  totalPrinted: number
}

export default function DaerahDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  const [daerah, setDaerah] = useState<DaerahDetail | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [recentKta, setRecentKta] = useState<KTARequest[]>([])
  const [diskonInput, setDiskonInput] = useState(0)
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null)

  const hasFetched = useRef(false)

  const isPusatOrAdmin = session?.user.role === 'PUSAT' || session?.user.role === 'ADMIN'

  const fetchDaerahDetail = useCallback(async () => {
    if (hasFetched.current) return

    hasFetched.current = true
    setLoading(true)
    try {
      const response = await fetch(`/api/daerah/${params.id}`)
      const data = await response.json()

      if (response.ok) {
        setDaerah(data.data.daerah)
        setUsers(data.data.users)
        setRecentKta(data.data.recentKta)
        setDiskonInput(data.data.daerah.diskonPersen)
        setChartData(data.data.chartData || [])
        setComparisonData(data.data.comparisonData)
      } else {
        setError(data.error || 'Gagal mengambil data daerah')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mengambil data')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (!params.id || !session) return

    if (!isPusatOrAdmin) {
      setError('Anda tidak memiliki akses ke halaman ini')
      setLoading(false)
      return
    }

    fetchDaerahDetail()
  }, [params.id, session, isPusatOrAdmin, fetchDaerahDetail])

  const handleSaveDiskon = async () => {
    if (!daerah) return

    if (diskonInput < 0 || diskonInput > 100) {
      setError('Diskon harus antara 0-100')
      return
    }

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`/api/daerah/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diskonPersen: diskonInput })
      })

      const data = await response.json()

      if (response.ok) {
        setDaerah(prev => prev ? { ...prev, diskonPersen: diskonInput } : null)
        setSuccessMessage('Diskon berhasil diupdate')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(data.error || 'Gagal mengupdate diskon')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mengupdate diskon')
    } finally {
      setSaving(false)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">ADMIN</Badge>
      case 'PUSAT':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">PUSAT</Badge>
      default:
        return <Badge className="bg-slate-100 text-slate-800 border-slate-200">DAERAH</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED_BY_PUSAT':
      case 'PRINTED':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>
      case 'READY_TO_PRINT':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Ready</Badge>
      case 'WAITING_PAYMENT':
      case 'READY_FOR_PUSAT':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PulseLogo />
      </div>
    )
  }

  if (!isPusatOrAdmin || !daerah) {
    return (
      <div className="space-y-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">{error || 'Data tidak ditemukan'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4 animate-slide-up-stagger stagger-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/dashboard/daerah')}
          className="border-slate-300"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{daerah.namaDaerah}</h1>
          <p className="text-slate-500 text-sm">Kode: {daerah.kodeDaerah}</p>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column - Info & Settings */}
        <div className="space-y-5">
          {/* Daerah Info */}
          <Card className="card-3d">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building className="h-5 w-5 text-slate-700" />
                Informasi Daerah
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-20 h-20 flex-shrink-0">
                  {!imageError ? (
                    <Image
                      src={getDaerahLogoUrl(daerah.namaDaerah)}
                      alt={daerah.namaDaerah}
                      fill
                      className="object-contain"
                      onError={() => setImageError(true)}
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 rounded-lg flex items-center justify-center">
                      <MapPin className="h-10 w-10 text-slate-400" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{daerah.namaDaerah}</h3>
                  <p className="text-sm text-slate-500">{daerah.kodeDaerah}</p>
                  <Badge
                    variant={daerah.isActive ? 'default' : 'secondary'}
                    className="mt-1"
                  >
                    {daerah.isActive ? 'Aktif' : 'Non-Aktif'}
                  </Badge>
                </div>
              </div>

              {daerah.alamat && (
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-slate-500 mt-0.5" />
                    <span className="text-slate-700">{daerah.alamat}</span>
                  </div>
                  {daerah.telepon && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-700">{daerah.telepon}</span>
                    </div>
                  )}
                  {daerah.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-700">{daerah.email}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Diskon Setting */}
          <Card className="card-3d">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5 text-slate-700" />
                Pengaturan Diskon
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="diskon">Diskon Daerah (%)</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      id="diskon"
                      type="number"
                      min="0"
                      max="100"
                      value={diskonInput}
                      onChange={(e) => setDiskonInput(parseInt(e.target.value) || 0)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSaveDiskon}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {saving ? (
                        <PulseLogo className="scale-50" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Simpan
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Diskon akan diapply ke semua KTA baru di daerah ini
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Stats & Lists */}
        <div className="lg:col-span-2 space-y-5">
          {/* Statistics */}
          <Card className="card-3d">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-slate-700" />
                Statistik KTA
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{daerah.totalKta}</p>
                  <p className="text-xs text-slate-500">Total KTA</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">
                    {daerah.statusBreakdown['PRINTED'] || 0}
                  </p>
                  <p className="text-xs text-green-600">Terbit</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-700">
                    {daerah.statusBreakdown['WAITING_PAYMENT'] || 0}
                  </p>
                  <p className="text-xs text-yellow-600">Pending</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">
                    {daerah.statusBreakdown['REJECTED'] || 0}
                  </p>
                  <p className="text-xs text-red-600">Ditolak</p>
                </div>
              </div>

              {recentKta.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">KTA Terbaru</h4>
                  <div className="space-y-2">
                    {recentKta.slice(0, 5).map((kta) => (
                      <div
                        key={kta.id}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{kta.nama}</p>
                          <p className="text-xs text-slate-500">{kta.idIzin} • Jenjang {kta.jenjang}</p>
                        </div>
                        {getStatusBadge(kta.status)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          

          {/* Admin/Users List */}
          <Card className="card-3d">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-slate-700" />
                Admin & Users ({daerah.totalUsers})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              {users.length > 0 ? (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                          <Shield className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getRoleBadge(user.role)}
                        {!user.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Users className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p>Belum ada user di daerah ini</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
