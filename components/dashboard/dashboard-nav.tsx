'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Building,
  Receipt,
  ChevronRight,
  Download,
  History
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useSession } from '@/hooks/useSession'

interface DashboardNavProps {
  isPusat: boolean
}

interface NavItem {
  title: string
  href?: string
  icon: any
  roles: string[]
  badge?: string | null
}

interface NavSection {
  title: string
  roles: string[]
  items: NavItem[]
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['DAERAH', 'PUSAT', 'ADMIN'],
    badge: null,
  },
        {
        title: 'Data Permohonan',
        href: '/dashboard/permohonan',
        icon: FileText,
        roles: ['DAERAH', 'PUSAT', 'ADMIN'],
        badge: null,
      },
  {
    title: 'Pembayaran',
    href: '/dashboard/payments/daerah',
    icon: CreditCard,
    roles: ['DAERAH'],
    badge: null,
  },
  {
    title: 'Konfirmasi',
    href: '/dashboard/payments',
    icon: CreditCard,
    roles: ['PUSAT', 'ADMIN'],
    badge: null,
  },
]

const navSections: NavSection[] = [
  {
    title: 'Data',
    roles: ['DAERAH', 'PUSAT', 'ADMIN'],
    items: [

      {
        title: 'Data KTA',
        href: '/dashboard/kta',
        icon: Download,
        roles: ['DAERAH', 'PUSAT', 'ADMIN'],
        badge: null,
      }
    ]
  },
  {
    title: 'Riwayat',
    roles: ['DAERAH'],
    items: [
      {
        title: 'Riwayat Invoice',
        href: '/dashboard/payments/daerah/invoices',
        icon: History,
        roles: ['DAERAH'],
        badge: null,
      }
    ]
  },
  {
    title: 'Daerah',
    roles: ['PUSAT', 'ADMIN'],
    items: [
      {
        title: 'Kelola Daerah',
        href: '/dashboard/daerah',
        icon: Building,
        roles: ['PUSAT', 'ADMIN'],
        badge: null,
      }
    ]
  },
  {
    title: 'Keuangan',
    roles: ['PUSAT', 'ADMIN'],
    items: [
      {
        title: 'Laporan',
        href: '/dashboard/keuangan',
        icon: Receipt,
        roles: ['PUSAT', 'ADMIN'],
        badge: null,
      }
    ]
  },
]

export function DashboardNav({ isPusat }: DashboardNavProps) {
  const pathname = usePathname()
  const { session } = useSession()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [verifiedCount, setVerifiedCount] = useState(0)

  // Fetch verified invoice count for DAERAH users
  useEffect(() => {
    if (!isPusat && session?.user?.role === 'DAERAH') {
      fetchVerifiedCount()
    }
  }, [isPusat, session])

  const fetchVerifiedCount = async () => {
    try {
      const response = await fetch('/api/payments/bulk?status=VERIFIED')
      const data = await response.json()
      if (data.success) {
        setVerifiedCount(data.data.length)
      }
    } catch (error) {
      console.error('Error fetching verified count:', error)
    }
  }

  // Update badge for Riwayat Invoice based on verified count
  const navSectionsWithBadges = navSections.map(section => ({
    ...section,
    items: section.items.map(item => {
      if (item.title === 'Riwayat Invoice' && !isPusat) {
        return {
          ...item,
          badge: verifiedCount > 0 ? verifiedCount.toString() : null
        }
      }
      return item
    })
  }))

  const filteredItems = navItems.filter(item => {
    if (isPusat) {
      return item.roles.includes('PUSAT') || item.roles.includes('ADMIN')
    }
    return item.roles.includes('DAERAH')
  })

  const filteredSections = navSectionsWithBadges.filter(section => {
    if (isPusat) {
      return section.roles.includes('PUSAT') || section.roles.includes('ADMIN')
    }
    return section.roles.includes('DAERAH')
  }).map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (isPusat) {
        return item.roles.includes('PUSAT') || item.roles.includes('ADMIN')
      }
      return item.roles.includes('DAERAH')
    })
  })).filter(section => section.items.length > 0)

  // Combine all nav items for active checking
  const allNavItems = [
    ...filteredItems,
    ...filteredSections.flatMap(s => s.items)
  ]

  const renderNavItem = (item: NavItem, index: number, isSubmenuItem = false) => {
    // Find the best matching active item (prefer exact match, then longest path match)
    let activeItem = allNavItems.find(nav => pathname === nav.href)

    if (!activeItem) {
      // If no exact match, find the longest matching prefix
      const matchingItems = allNavItems.filter(nav =>
        nav.href !== '/dashboard' && pathname?.startsWith(nav.href + '/')
      ).sort((a, b) => (b.href?.length || 0) - (a.href?.length || 0))

      activeItem = matchingItems[0]
    }

    const isActive = activeItem?.href === item.href

    return (
      <Link
        key={item.href || item.title}
        href={item.href || '#'}
        className={cn(
          'group relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 nav-link',
          isActive
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
            : 'text-slate-600 hover:bg-slate-100',
          !isSubmenuItem && 'opacity-0 animate-fade-in'
        )}
        style={!isSubmenuItem ? { animationDelay: `${index * 0.05}s` } : {}}
        onMouseEnter={() => setHoveredItem(item.title)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        {/* Active indicator */}
        {isActive && !isSubmenuItem && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full shadow-lg" />
        )}

        {/* Icon */}
        <div className={cn(
          "flex-shrink-0 transition-transform duration-200",
          hoveredItem === item.title && isActive && "scale-110"
        )}>
          <item.icon className={cn(
            "h-4 w-4 transition-colors",
            isActive ? "text-white" : "text-slate-400 group-hover:text-blue-600"
          )} />
        </div>

        {/* Title */}
        <span className="flex-1">{item.title}</span>

        {/* Badge */}
        {item.badge && (
          <span className={cn(
            "flex-shrink-0 px-2 py-0.5 text-xs font-bold rounded-full",
            isActive
              ? "bg-white/25 text-white"
              : "bg-red-100 text-red-600 group-hover:bg-red-200"
          )}>
            {item.badge}
          </span>
        )}

        {/* Chevron for hover effect */}
        {!isSubmenuItem && (
          <ChevronRight className={cn(
            "h-4 w-4 transition-all duration-200 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0",
            isActive ? "text-white/70" : "text-slate-400 group-hover:text-blue-600"
          )} />
        )}

        {/* Hover glow effect */}
        {!isActive && hoveredItem === item.title && (
          <div className="absolute inset-0 bg-blue-50 rounded-lg -z-10" />
        )}
      </Link>
    )
  }

  return (
    <nav className="flex-1 space-y-1 px-3 py-5 overflow-y-auto custom-scrollbar">
      {/* Main Menu */}
      <div className="mb-4">
        <div className="mb-3 px-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Menu Utama
          </p>
        </div>
        {filteredItems.map((item, index) => renderNavItem(item, index))}
      </div>

      {/* Section Menus */}
      {filteredSections.map((section, sectionIndex) => (
        <div key={section.title} className="mb-4">
          <div className="mb-3 px-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {section.title}
            </p>
          </div>
          {section.items.map((item, index) => renderNavItem(item, index, true))}
        </div>
      ))}
    </nav>
  )
}