'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getDaerahLogoUrl } from '@/lib/daerah-logo'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/useSession'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PulseLogo } from '@/components/ui/loading-spinner'
import { useToast } from '@/components/ui/use-toast'
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
  ChevronDown,
  ChevronUp,
  Building,
  Users,
  BadgeX,
  CheckCircle
} from 'lucide-react'

interface Daerah {
  id: string
  namaDaerah: string
  kodeDaerah: string
}

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  daerahId: string | null
  daerah: Daerah | null
  createdAt: string
  updatedAt: string
}

interface UsersResponse {
  success: boolean
  data: User[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

const ROLE_LABELS: Record<string, string> = {
  DAERAH: 'BPD',
  PUSAT: 'BPP',
  ADMIN: 'Admin',
  KEUANGAN: 'Keuangan',
}

const ROLE_COLORS: Record<string, string> = {
  DAERAH: 'bg-blue-100 text-blue-800',
  PUSAT: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
  KEUANGAN: 'bg-green-100 text-green-800',
}

export default function UsersManagementPage() {
  const router = useRouter()
  const { session } = useSession()
  const { toast } = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [daerahList, setDaerahList] = useState<Daerah[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['pusat', 'all']))

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    daerahId: '',
    isActive: true,
  })

  const initialFetchDone = useRef(false)

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

    fetchUsers()
    fetchDaerahList()
  }, [session, roleFilter])

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams()

      if (search) {
        params.append('search', search)
      }

      if (roleFilter && roleFilter !== 'ALL') {
        params.append('role', roleFilter)
      }

      const response = await fetch(`/api/admin/users?${params}`)
      const data: UsersResponse = await response.json()

      if (data.success) {
        setUsers(data.data)
      } else {
        setError(data.error || 'Gagal memuat data user')
      }
    } catch (error) {
      setError('Terjadi kesalahan saat memuat data')
      console.error('Fetch users error:', error)
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

  // Search debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchUsers()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [search])

  // Group users by daerah
  const groupedUsers = users.reduce((acc, user) => {
    if (user.role === 'DAERAH' && user.daerahId) {
      const key = user.daerahId
      if (!acc[key]) {
        acc[key] = {
          daerah: user.daerah,
          users: [],
        }
      }
      acc[key].users.push(user)
    } else {
      // Pusat users (PUSAT, ADMIN, KEUANGAN, or DAERAH without daerah)
      if (!acc.pusat) {
        acc.pusat = {
          daerah: null,
          users: [],
        }
      }
      acc.pusat.users.push(user)
    }
    return acc
  }, {} as Record<string, { daerah: Daerah | null; users: User[] }>)

  // Toggle section expand/collapse
  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: '',
      daerahId: '',
      isActive: true,
    })
  }

  // Open create modal
  const openCreateModal = () => {
    resetForm()
    setIsCreateModalOpen(true)
  }

  // Open edit modal
  const openEditModal = (user: User) => {
    setSelectedUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      daerahId: user.daerahId || '',
      isActive: user.isActive,
    })
    setIsEditModalOpen(true)
  }

  // Open delete modal
  const openDeleteModal = (user: User) => {
    setSelectedUser(user)
    setIsDeleteModalOpen(true)
  }

  // DaerahAutocomplete Component - Searchable dropdown with logo
  const DaerahAutocomplete = ({
    value,
    onChange,
    disabled,
  }: {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
  }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const isPusat = formData.role !== 'DAERAH'
    const selectedDaerah = daerahList.find((d) => d.id === value)

    // Filter daerah based on search term
    const filteredDaerah = daerahList.filter((daerah) =>
      daerah.namaDaerah.toLowerCase().includes(searchTerm.toLowerCase()) ||
      daerah.kodeDaerah.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Update search term when value changes externally
    useEffect(() => {
      if (selectedDaerah) {
        setSearchTerm(selectedDaerah.namaDaerah)
      } else {
        setSearchTerm('')
      }
    }, [value, selectedDaerah])

    const handleSelect = (daerahId: string) => {
      onChange(daerahId)
      setIsOpen(false)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value)
      setIsOpen(true)
    }

    return (
      <div className="flex items-center gap-2" ref={containerRef}>
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={() => !disabled && !isPusat && setIsOpen(true)}
            placeholder="Cari daerah..."
            disabled={disabled || isPusat}
            className={cn(
              "w-full h-10 px-3 py-2 text-sm rounded-md border border-slate-300 bg-white",
              "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent",
              "placeholder:text-slate-400",
              (disabled || isPusat) && "bg-slate-100 cursor-not-allowed"
            )}
          />
          {selectedDaerah && isOpen && searchTerm === selectedDaerah.namaDaerah && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('')
                onChange('')
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              disabled={disabled || isPusat}
            >
              ✕
            </button>
          )}

          {/* Dropdown */}
          {isOpen && !disabled && !isPusat && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredDaerah.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-slate-500">
                  Tidak ada daerah ditemukan
                </div>
              ) : (
                filteredDaerah.map((daerah) => (
                  <button
                    key={daerah.id}
                    type="button"
                    onClick={() => handleSelect(daerah.id)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2",
                      value === daerah.id && "bg-slate-100"
                    )}
                  >
                    <img
                      src={getDaerahLogoUrl(daerah.namaDaerah)}
                      alt={daerah.namaDaerah}
                      className="h-4 w-4 object-contain flex-shrink-0"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                    <span>{daerah.namaDaerah}</span>
                    <span className="text-slate-500 text-xs">({daerah.kodeDaerah})</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {isPusat && (
          <div className="h-10 w-10 rounded-lg bg-white border-2 border-slate-200 flex items-center justify-center flex-shrink-0">
            <img
              src="/logo.png"
              alt="Pusat"
              className="h-8 w-8 object-contain"
            />
          </div>
        )}
      </div>
    )
  }

  // Create user
  const handleCreate = async () => {
    if (!formData.name || !formData.email || !formData.password || !formData.role) {
      toast({
        variant: 'destructive',
        title: 'Validasi Error',
        description: 'Nama, email, password, dan role harus diisi',
      })
      return
    }

    if (formData.role === 'DAERAH' && !formData.daerahId) {
      toast({
        variant: 'destructive',
        title: 'Validasi Error',
        description: 'Daerah harus dipilih untuk role BPD',
      })
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Berhasil',
          description: 'User berhasil dibuat',
        })
        setIsCreateModalOpen(false)
        resetForm()
        fetchUsers()
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal',
          description: result.error || 'Gagal membuat user',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: 'Terjadi kesalahan saat membuat user',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Update user
  const handleUpdate = async () => {
    if (!selectedUser) return

    if (!formData.name || !formData.email || !formData.role) {
      toast({
        variant: 'destructive',
        title: 'Validasi Error',
        description: 'Nama, email, dan role harus diisi',
      })
      return
    }

    if (formData.role === 'DAERAH' && !formData.daerahId) {
      toast({
        variant: 'destructive',
        title: 'Validasi Error',
        description: 'Daerah harus dipilih untuk role BPD',
      })
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Berhasil',
          description: 'User berhasil diupdate',
        })
        setIsEditModalOpen(false)
        setSelectedUser(null)
        resetForm()
        fetchUsers()
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal',
          description: result.error || 'Gagal mengupdate user',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: 'Terjadi kesalahan saat mengupdate user',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Delete user
  const handleDelete = async () => {
    if (!selectedUser) return

    setSubmitting(true)

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Berhasil',
          description: 'User berhasil dihapus',
        })
        setIsDeleteModalOpen(false)
        setSelectedUser(null)
        fetchUsers()
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal',
          description: result.error || 'Gagal menghapus user',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: 'Terjadi kesalahan saat menghapus user',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle user active status
  const toggleUserStatus = async (user: User) => {
    setSubmitting(true)

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          variant: 'success',
          title: 'Berhasil',
          description: `User berhasil ${user.isActive ? 'dinonaktifkan' : 'diaktifkan'}`,
        })
        fetchUsers()
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal',
          description: result.error || 'Gagal mengubah status user',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: 'Terjadi kesalahan saat mengubah status user',
      })
    } finally {
      setSubmitting(false)
    }
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
        <PulseLogo text="Memuat data user..." />
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
        <div className="flex justify-between items-center animate-slide-up-stagger stagger-1">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Kelola User</h1>
            <p className="text-slate-500 text-sm">Manajemen user sistem berdasarkan daerah</p>
          </div>
          <Button onClick={openCreateModal} className="bg-slate-800 text-slate-100 hover:bg-slate-700 shadow-md">
            <Plus className="h-4 w-4 mr-2" />
            Tambah User
          </Button>
        </div>

        {/* Filters */}
        <Card className="card-3d animate-slide-up-stagger stagger-2">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Cari nama atau email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Role</SelectItem>
                  <SelectItem value="DAERAH">BPD</SelectItem>
                  <SelectItem value="PUSAT">BPP</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="KEUANGAN">Keuangan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Grouped by Daerah */}
        <div className="space-y-4">
          {Object.keys(groupedUsers).length === 0 ? (
            <Card className="card-3d animate-slide-up-stagger stagger-3">
              <CardContent className="py-12 text-center text-slate-500">
                Tidak ada data user
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedUsers).sort(([aKey, aGroup], [bKey, bGroup]) => {
              // Pusat section first, then sort by daerah name
              if (aKey === 'pusat') return -1
              if (bKey === 'pusat') return 1
              const aName = aGroup.daerah?.namaDaerah || ''
              const bName = bGroup.daerah?.namaDaerah || ''
              return aName.localeCompare(bName)
            }).map(([key, group]) => {
              const isExpanded = expandedSections.has(key)
              const isPusat = key === 'pusat'

              return (
                <Card key={key} className="card-3d animate-slide-up-stagger stagger-3 overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 cursor-pointer hover:from-slate-100 hover:to-slate-200 transition-colors"
                    onClick={() => toggleSection(key)}
                  >
                    <div className="flex items-center gap-3">
                      {isPusat ? (
                        <div className="h-12 w-12 rounded-lg bg-white border-2 border-slate-200 flex items-center justify-center overflow-hidden shadow-lg">
                          <img
                            src="/logo.png"
                            alt="LSP"
                            className="h-10 w-10 object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-white border-2 border-slate-200 flex items-center justify-center overflow-hidden shadow-lg">
                          <img
                            src={getDaerahLogoUrl(group.daerah?.namaDaerah || '')}
                            alt={group.daerah?.namaDaerah || 'Daerah'}
                            className="h-10 w-10 object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              const fallback = target.nextElementSibling as HTMLElement
                              if (fallback) fallback.style.display = 'flex'
                            }}
                          />
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm hidden">
                            {group.daerah?.kodeDaerah?.substring(0, 2) || 'DA'}
                          </div>
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {isPusat ? 'Pusat' : group.daerah?.namaDaerah}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {group.users.length} user • {isPusat ? 'BPP, Admin, Keuangan' : `${group.daerah?.kodeDaerah}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {group.users.slice(0, 3).map((user) => (
                          <div
                            key={user.id}
                            className="h-8 w-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs font-medium text-slate-600"
                          >
                            {user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                        ))}
                        {group.users.length > 3 && (
                          <div className="h-8 w-8 rounded-full bg-slate-300 border-2 border-white flex items-center justify-center text-xs font-medium text-slate-600">
                            +{group.users.length - 3}
                          </div>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium text-slate-700">Nama</th>
                              <th className="px-4 py-3 text-left font-medium text-slate-700">Email</th>
                              <th className="px-4 py-3 text-left font-medium text-slate-700">Role</th>
                              <th className="px-4 py-3 text-left font-medium text-slate-700">Status</th>
                              <th className="px-4 py-3 text-left font-medium text-slate-700">Tanggal Dibuat</th>
                              <th className="px-4 py-3 text-center font-medium text-slate-700">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.users.map((user) => (
                              <tr key={user.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                                <td className="px-4 py-3 text-slate-700">{user.email}</td>
                                <td className="px-4 py-3">
                                  <Badge className={ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-800'}>
                                    {ROLE_LABELS[user.role] || user.role}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className={user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                    {user.isActive ? 'Aktif' : 'Nonaktif'}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  {new Date(user.createdAt).toLocaleDateString('id-ID')}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleUserStatus(user)}
                                      disabled={submitting || user.id === session?.user?.id}
                                      className={user.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                                    >
                                      {user.isActive ? <BadgeX className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditModal(user)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openDeleteModal(user)}
                                      disabled={user.id === session?.user?.id}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Tambah User Baru</DialogTitle>
            <DialogDescription>
              Buat user baru untuk akses sistem
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Nama</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Masukkan nama lengkap"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Masukkan email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Masukkan password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => {
                  setFormData({ ...formData, role: value, daerahId: '' })
                }}
              >
                <SelectTrigger id="create-role">
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAERAH">BPD - Daerah</SelectItem>
                  <SelectItem value="PUSAT">BPP - Pusat</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="KEUANGAN">Keuangan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-daerah">
                Daerah {formData.role === 'DAERAH' && '*'}
              </Label>
              <DaerahAutocomplete
                value={formData.daerahId}
                onChange={(value) => setFormData({ ...formData, daerahId: value })}
                disabled={formData.role !== 'DAERAH'}
              />
              {formData.role === 'DAERAH' && daerahList.length === 0 && (
                <p className="text-xs text-orange-600">
                  Data daerah belum tersedia. Silakan refresh halaman.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Buat User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update informasi user
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nama</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Masukkan nama lengkap"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Masukkan email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Password (opsional)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Kosongkan jika tidak ingin mengubah password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => {
                  setFormData({ ...formData, role: value, daerahId: '' })
                }}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAERAH">BPD - Daerah</SelectItem>
                  <SelectItem value="PUSAT">BPP - Pusat</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="KEUANGAN">Keuangan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-daerah">
                Daerah {formData.role === 'DAERAH' && '*'}
              </Label>
              <DaerahAutocomplete
                value={formData.daerahId}
                onChange={(value) => setFormData({ ...formData, daerahId: value })}
                disabled={formData.role !== 'DAERAH'}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="edit-isActive">Aktif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Update User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus User</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus user ini? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <p className="font-medium">{selectedUser.name}</p>
              <p className="text-sm text-slate-600">{selectedUser.email}</p>
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
    </>
  )
}
