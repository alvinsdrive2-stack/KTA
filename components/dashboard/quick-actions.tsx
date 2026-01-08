'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Users,
  Download,
  RefreshCw,
  Settings,
  BarChart3,
  Plus,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'

interface QuickAction {
  id: string
  label: string
  description: string
  icon: any
  href: string
  color: 'slate' | 'blue' | 'green' | 'orange'
  badge?: string
}

const quickActions: QuickAction[] = [
  {
    id: 'new-kta',
    label: 'Buat KTA Baru',
    description: 'Tambah permohonan KTA baru',
    icon: Plus,
    href: '/dashboard/kta/apply',
    color: 'blue',
  },
  {
    id: 'fetch-siki',
    label: 'Ambil Data SIKI',
    description: 'Verifikasi data anggota SIKI',
    icon: RefreshCw,
    href: '/dashboard/kta/apply',
    color: 'slate',
  },
  {
    id: 'manage-users',
    label: 'Kelola Pengguna',
    description: 'Manajemen user & role',
    icon: Users,
    href: '/dashboard/users',
    color: 'green',
    badge: 'Admin',
  },
  {
    id: 'reports',
    label: 'Laporan',
    description: 'Download laporan & statistik',
    icon: Download,
    href: '/dashboard/reports',
    color: 'orange',
  },
]

const colorStyles = {
  slate: {
    bg: 'bg-slate-100',
    icon: 'text-slate-700',
    hoverBg: 'hover:bg-slate-200',
  },
  blue: {
    bg: 'bg-sky-100',
    icon: 'text-sky-700',
    hoverBg: 'hover:bg-sky-200',
  },
  green: {
    bg: 'bg-emerald-100',
    icon: 'text-emerald-700',
    hoverBg: 'hover:bg-emerald-200',
  },
  orange: {
    bg: 'bg-orange-100',
    icon: 'text-orange-700',
    hoverBg: 'hover:bg-orange-200',
  },
}

export function QuickActions() {
  return (
    <Card className="card-3d">
      <CardHeader className="border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-200 rounded-lg shadow-inner-soft">
            <Settings className="h-4 w-4 text-slate-700" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Aksi Cepat
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Tugas yang sering dilakukan
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action, index) => {
            const styles = colorStyles[action.color]
            const Icon = action.icon
            return (
              <Link
                key={action.id}
                href={action.href}
                className={'group relative overflow-hidden rounded-xl p-4 transition-all duration-200 hover:shadow-md ' + styles.bg + ' ' + styles.hoverBg}
                style={{ animationDelay: (index * 50) + 'ms' }}
              >
                <div className="flex items-start gap-3">
                  <div className={'p-2 rounded-lg ' + styles.bg}>
                    <Icon className={'h-4 w-4 ' + styles.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {action.label}
                      </p>
                      {action.badge && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-800 text-white rounded">
                          {action.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                      {action.description}
                    </p>
                  </div>
                  <ChevronRight className={'h-4 w-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all'} />
                </div>
              </Link>
            )
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm" className="w-full justify-between border-slate-300 text-slate-700 hover:bg-slate-100">
              <span className="text-xs">Pengaturan Dashboard</span>
              <Settings className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
