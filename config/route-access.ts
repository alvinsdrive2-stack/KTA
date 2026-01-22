/**
 * Route Access Control Configuration
 *
 * Defines which roles can access which routes
 *
 * Roles: DAERAH, PUSAT, ADMIN
 *
 * @param allowedRoles - Array of roles that can access this route
 * @param useForbiddenPage - If true, redirect to /forbidden instead of redirectPath
 * @param redirectPath - Where to redirect if access is denied (only if useForbiddenPage is false)
 */

export interface RouteAccess {
  path: string
  allowedRoles: ('DAERAH' | 'PUSAT' | 'ADMIN')[]
  useForbiddenPage?: boolean  // If true, redirect to /forbidden when access denied
  redirectPath?: string
}

export const routeAccessMap: RouteAccess[] = [
  // ==================== DASHBOARD HOME ====================
  {
    path: '/dashboard',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },

  // ==================== PERMOHONAN (All roles) ====================
  {
    path: '/dashboard/permohonan',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },
  {
    path: '/dashboard/permohonan/payment',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },
  {
    path: '/dashboard/permohonan/create-manual',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },

  // ==================== WAITING APPROVAL ====================
  {
    path: '/dashboard/waiting-approval',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },

  // ==================== KTA (All roles) ====================
  {
    path: '/dashboard/kta',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },
  {
    path: '/dashboard/kta/apply',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },
  {
    path: '/dashboard/kta/payment',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },
  {
    path: '/dashboard/kta/fetch-siki',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },
  {
    path: '/dashboard/kta/[id]',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },
  {
    path: '/dashboard/kta/[id]/print',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },

  // ==================== PAYMENTS - DAERAH (DAERAH+PUSAT+ADMIN can view) ====================
  {
    path: '/dashboard/payments/daerah',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },
  {
    path: '/dashboard/payments/daerah/invoice',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },
  {
    path: '/dashboard/payments/daerah/invoice/[id]',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },
  {
    path: '/dashboard/payments/daerah/upload/[id]',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },
  {
    path: '/dashboard/payments/daerah/invoices',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },

  // ==================== PAYMENTS - PUSAT (PUSAT+ADMIN only) ====================
  {
    path: '/dashboard/payments/pusat',
    allowedRoles: ['PUSAT', 'ADMIN'],
    useForbiddenPage: true,  // DAERAH will see forbidden page
  },
  {
    path: '/dashboard/payments/pusat/invoice',
    allowedRoles: ['PUSAT', 'ADMIN'],
    useForbiddenPage: true,
  },
  {
    path: '/dashboard/payments/pusat/invoice/[id]',
    allowedRoles: ['PUSAT', 'ADMIN'],
    useForbiddenPage: true,
  },
  {
    path: '/dashboard/payments/pusat/upload/[id]',
    allowedRoles: ['PUSAT', 'ADMIN'],
    useForbiddenPage: true,
  },
  {
    path: '/dashboard/payments/pusat/invoices',
    allowedRoles: ['PUSAT', 'ADMIN'],
    useForbiddenPage: true,
  },

  // ==================== PAYMENTS - GENERAL ====================
  {
    path: '/dashboard/payments',
    allowedRoles: ['DAERAH', 'PUSAT', 'ADMIN'],
  },
  {
    path: '/dashboard/payments/[id]',
    allowedRoles: ['PUSAT', 'ADMIN'],
    useForbiddenPage: true,  // DAERAH cannot verify
  },

  // ==================== ADMIN ONLY (PUSAT+ADMIN, DAERAH forbidden) ====================
  {
    path: '/dashboard/admin/daerah-diskon',
    allowedRoles: ['PUSAT', 'ADMIN'],
    useForbiddenPage: true,
  },

  // ==================== KEUANGAN (PUSAT/ADMIN) ====================
  {
    path: '/dashboard/keuangan',
    allowedRoles: ['PUSAT', 'ADMIN'],
    useForbiddenPage: true,
  },

  // ==================== DAERAH MANAGEMENT (PUSAT/ADMIN) ====================
  {
    path: '/dashboard/daerah',
    allowedRoles: ['PUSAT', 'ADMIN'],
    useForbiddenPage: true,
  },
  {
    path: '/dashboard/daerah/[id]',
    allowedRoles: ['PUSAT', 'ADMIN'],
    useForbiddenPage: true,
  },
]

/**
 * Check if a role can access a specific path
 */
export function canAccessPath(role: string | undefined, pathname: string): boolean {
  if (!role) return false

  // Find matching route (supports dynamic routes with [id] pattern)
  const route = routeAccessMap.find(r => {
    // Convert route pattern to regex
    const pattern = r.path
      // Replace [id] or [slug] with regex pattern
      .replace(/\[(\w+)\]/g, '[^/]+')
      // Escape special regex characters except * and +
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')

    const regex = new RegExp(`^${pattern}$`)
    return regex.test(pathname)
  })

  if (!route) {
    // If route not defined in map, allow access by default
    return true
  }

  return route.allowedRoles.includes(role as any)
}

/**
 * Get redirect path if access is denied
 */
export function getRedirectPath(role: string | undefined, pathname: string): string | null {
  if (!role) return '/auth/login'

  const route = routeAccessMap.find(r => {
    const pattern = r.path
      .replace(/\[(\w+)\]/g, '[^/]+')
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`^${pattern}$`)
    return regex.test(pathname)
  })

  if (!route) return null
  if (route.allowedRoles.includes(role as any)) return null

  // Use forbidden page if specified, otherwise use redirectPath
  if (route.useForbiddenPage) {
    return '/forbidden'
  }

  return route.redirectPath || '/dashboard'
}
