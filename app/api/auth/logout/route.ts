import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out' })

  // Clear session cookie
  response.cookies.set('session-token', '', {
    expires: new Date(0),
    path: '/',
  })

  return response
}