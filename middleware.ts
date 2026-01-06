import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow access to login page and API auth routes
  if (pathname.startsWith('/login') || pathname.startsWith('/auth/login') ||
      pathname.startsWith('/api/auth') || pathname.startsWith('/verify') ||
      pathname.startsWith('/qr')) {
    return NextResponse.next()
  }

  // Check for session token in cookies (NextAuth JWT token)
  const sessionToken = request.cookies.get('next-auth.session-token')?.value ||
                      request.cookies.get('__Secure-next-auth.session-token')?.value

  // If no session token and trying to access protected routes, redirect to login
  if (!sessionToken && pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/auth/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*']
}