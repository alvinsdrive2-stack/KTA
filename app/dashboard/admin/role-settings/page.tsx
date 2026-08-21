'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/hooks/useSession'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useToast } from '@/components/ui/use-toast'
import { Smartphone, Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const ROLE_LABELS: Record<string, string> = {
  DAERAH: 'BPD (Daerah)',
  PUSAT: 'BPP (Pusat)',
  ADMIN: 'Admin',
  KEUANGAN: 'Keuangan',
}

const ROLE_COLORS: Record<string, string> = {
  DAERAH: 'bg-blue-100 text-blue-800',
  PUSAT: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
  KEUANGAN: 'bg-green-100 text-green-800',
}

interface RoleSetting {
  role: string
  maxDevices: number
}

export default function RoleSettingsPage() {
  const router = useRouter()
  const { session } = useSession()
  const { toast } = useToast()
  const [settings, setSettings] = useState<RoleSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    if (session === null || session === undefined) return

    if (!isAdmin) {
      setError('Anda tidak memiliki akses ke halaman ini')
      setLoading(false)
      return
    }

    fetchSettings()
  }, [session])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/role-settings')
      const data = await response.json()
      if (data.success) {
        setSettings(data.data)
      } else {
        setError(data.error || 'Gagal memuat pengaturan')
      }
    } catch (err) {
      setError('Terjadi kesalahan saat memuat data')
      console.error('Fetch role settings error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (role: string, value: string) => {
    const parsed = parseInt(value, 10)
    const maxDevices = Number.isFinite(parsed) ? parsed : 1
    setSettings(prev =>
      prev.map(s => (s.role === role ? { ...s, maxDevices } : s))
    )
  }

  const handleSave = async (role: string) => {
    const setting = settings.find(s => s.role === role)
    if (!setting) return

    setSaving(true)
    try {
      const response = await fetch('/api/admin/role-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, maxDevices: setting.maxDevices }),
      })
      const data = await response.json()

      if (data.success) {
        toast({
          variant: 'success',
          title: 'Berhasil Disimpan',
          description: `Max device untuk ${ROLE_LABELS[role] || role} diubah ke ${setting.maxDevices}`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal Menyimpan',
          description: data.error || 'Terjadi kesalahan',
        })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Gagal Menyimpan',
        description: 'Terjadi kesalahan server',
      })
      console.error('Save role setting error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin && !loading) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Anda tidak memiliki akses ke halaman ini. Halaman ini hanya untuk ADMIN.
          </AlertDescription>
        </Alert>
        <Link href="/dashboard">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali ke Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PulseLogo text="Memuat pengaturan..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pengaturan Device per Role</h1>
          <p className="text-slate-500 text-sm">
            Batasi jumlah device aktif yang bisa login untuk tiap role
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {settings.map(setting => (
          <Card key={setting.role} className="card-3d">
            <CardHeader className="border-b border-slate-200 bg-slate-50/50">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-slate-500" />
                  {ROLE_LABELS[setting.role] || setting.role}
                </span>
                <Badge className={ROLE_COLORS[setting.role] || 'bg-gray-100 text-gray-800'}>
                  {setting.role}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Maksimal device aktif per user
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={setting.maxDevices}
                  onChange={e => handleChange(setting.role, e.target.value)}
                  className="w-32"
                />
                <Button
                  onClick={() => handleSave(setting.role)}
                  disabled={saving}
                  className="bg-slate-800 text-slate-100 hover:bg-slate-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Simpan
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Contoh: 1 = satu user cuma bisa login di 1 device. Login di device lain otomatis memutus device lama.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
