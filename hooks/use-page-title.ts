'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { generateTitleFromPath } from '@/lib/metadata'

// Import nav items directly - same as sidebar uses
const navItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    roles: ['DAERAH', 'PUSAT', 'ADMIN','KEUANGAN'],
  },
  {
    title: 'Data Permohonan',
    href: '/dashboard/permohonan',
    roles: ['DAERAH', 'PUSAT', 'ADMIN','KEUANGAN'],
  },
  {
    title: 'Pembayaran',
    href: '/dashboard/payments/daerah',
    roles: ['DAERAH'],
  },
  {
    title: 'Pembayaran',
    href: '/dashboard/payments/pusat',
    roles: ['PUSAT', 'ADMIN','KEUANGAN'],
  },
  {
    title: 'Konfirmasi',
    href: '/dashboard/payments',
    roles: ['ADMIN','KEUANGAN'],
  },
  {
    title: 'Data KTA',
    href: '/dashboard/kta',
    roles: ['DAERAH', 'PUSAT', 'ADMIN','KEUANGAN'],
  },
  {
    title: 'Riwayat Invoice',
    href: '/dashboard/payments/daerah/invoices',
    roles: ['DAERAH'],
  },
  {
    title: 'Riwayat Invoice',
    href: '/dashboard/payments/pusat/invoices',
    roles: ['PUSAT', 'ADMIN','KEUANGAN'],
  },
  {
    title: 'Kelola Daerah',
    href: '/dashboard/daerah',
    roles: ['KEUANGAN'],
  },
  {
    title: 'Laporan',
    href: '/dashboard/keuangan',
    roles: ['KEUANGAN'],
  },
  {
    title: 'Kelola User',
    href: '/dashboard/admin/users',
    roles: ['ADMIN'],
  },
  {
    title: 'Data Manage',
    href: '/dashboard/admin/data-manage',
    roles: ['ADMIN'],
  },
]

// Default suffix matching root layout template
const DEFAULT_SUFFIX = 'Gatensi KTA Management'

/**
 * Hook to automatically set page title from current route
 * Uses sidebar nav title if available, otherwise falls back to path-based generation
 * @param customTitle - Optional custom title to override the auto-generated one
 * @param suffix - Optional suffix to append after the title (default: "Gatensi KTA Management")
 */
export function usePageTitle(customTitle?: string, suffix?: string) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const finalSuffix = suffix ?? DEFAULT_SUFFIX

  useEffect(() => {
    if (customTitle) {
      document.title = `${customTitle} - ${finalSuffix}`
      return
    }

    const userRole = session?.user?.role as string

    // Filter nav items by role (same logic as sidebar)
    const filteredItems = navItems.filter(item => {
      if (userRole === 'KEUANGAN') {
        return item.roles.includes('KEUANGAN')
      }
      if (userRole === 'ADMIN') {
        return item.roles.includes('ADMIN') || item.roles.includes('PUSAT')
      }
      if (userRole === 'PUSAT') {
        return item.roles.includes('PUSAT') || item.roles.includes('ADMIN')
      }
      return item.roles.includes('DAERAH')
    })

    // Find active item using SAME logic as sidebar
    let title: string | undefined

    // 1. Try exact match first
    const exactMatch = filteredItems.find(nav => pathname === nav.href)
    if (exactMatch) {
      title = exactMatch.title
    }

    // 2. If no exact match, find longest matching prefix
    if (!title) {
      const matchingItems = filteredItems
        .filter(nav => nav.href !== '/dashboard' && pathname.startsWith(nav.href + '/'))
        .sort((a, b) => b.href.length - a.href.length)

      if (matchingItems.length > 0) {
        title = matchingItems[0].title
      }
    }

    // 3. Fallback to path-based generation
    if (!title) {
      title = generateTitleFromPath(pathname)
    }

    document.title = `${title} - ${finalSuffix}`
  }, [pathname, customTitle, finalSuffix, session?.user?.role])
}
