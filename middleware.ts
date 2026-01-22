import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Route access configuration
const routeAccessMap: Record<string, string[]> = {
  // DAERAH routes - PUSAT/ADMIN can also view
  '/dashboard/payments/daerah': ['DAERAH', 'PUSAT', 'ADMIN'],
  '/dashboard/payments/daerah/invoice': ['DAERAH', 'PUSAT', 'ADMIN'],
  '/dashboard/payments/daerah/invoice/[id]': ['DAERAH', 'PUSAT', 'ADMIN'],
  '/dashboard/payments/daerah/upload/[id]': ['DAERAH', 'PUSAT', 'ADMIN'],
  '/dashboard/payments/daerah/invoices': ['DAERAH', 'PUSAT', 'ADMIN'],

  // PUSAT routes - PUSAT/ADMIN only (DAERAH forbidden)
  '/dashboard/payments/pusat': ['PUSAT', 'ADMIN'],
  '/dashboard/payments/pusat/invoice': ['PUSAT', 'ADMIN'],
  '/dashboard/payments/pusat/invoice/[id]': ['PUSAT', 'ADMIN'],
  '/dashboard/payments/pusat/upload/[id]': ['PUSAT', 'ADMIN'],
  '/dashboard/payments/pusat/invoices': ['PUSAT', 'ADMIN'],

  // Verification - PUSAT/ADMIN only
  '/dashboard/payments/[id]': ['PUSAT', 'ADMIN'],

  // Admin only
  '/dashboard/admin/daerah-diskon': ['PUSAT', 'ADMIN'],
  '/dashboard/keuangan': ['PUSAT', 'ADMIN'],
  '/dashboard/daerah': ['PUSAT', 'ADMIN'],
  '/dashboard/daerah/[id]': ['PUSAT', 'ADMIN'],
}

function matchRoute(pathname: string, pattern: string): boolean {
  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/\[(\w+)\]/g, '[^/]+')  // Replace [id] with regex pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(pathname)
}

function canAccess(role: string, pathname: string): boolean {
  // If route not in map, allow access
  const allowedRoles = routeAccessMap[pathname]
  if (!allowedRoles) return true

  return allowedRoles.includes(role)
}

async function getUserRole(request: NextRequest): Promise<string | null> {
  try {
    // Try to get session from API
    const apiUrl = new URL('/api/auth/session', request.url)
    const response = await fetch(apiUrl.toString(), {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    })

    if (!response.ok) {
      return null
    }

    const session = await response.json()
    return session?.user?.role || null
  } catch (error) {
    console.error('Error fetching user role:', error)
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow access to login, auth, and public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/qr') ||
    pathname.startsWith('/forbidden') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next()
  }

  // Skip for static files
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') ||
    pathname.includes('__')
  ) {
    return NextResponse.next()
  }

  // Check for session token
  const sessionToken = request.cookies.get('next-auth.session-token')?.value ||
                      request.cookies.get('__Secure-next-auth.session-token')?.value

  // If no session token and trying to access dashboard, redirect to login
  if (!sessionToken && pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/auth/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Get user role
  const role = await getUserRole(request)

  // If no role found and trying to access dashboard, redirect to login
  if (!role && pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/auth/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Check if user can access this route
  if (role && !canAccess(role, pathname)) {
    // Access denied - redirect to forbidden page
    const url = new URL('/forbidden', request.url)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*']
}
