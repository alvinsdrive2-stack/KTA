import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session-token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'No session found' },
        { status: 401 }
      )
    }

    // Decode the session token (base64 encoded JSON)
    try {
      const decoded = JSON.parse(Buffer.from(sessionToken, 'base64').toString())

      return NextResponse.json({
        success: true,
        data: {
          user: {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role,
            daerah: decoded.daerah,
          }
        }
      })
    } catch (decodeError) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Auth me error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}