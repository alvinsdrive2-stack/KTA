import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/auth-helpers'
import { clearKTACache } from '@/lib/pdf-generator'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN can clear cache
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Clear the KTA template cache
    clearKTACache()

    return NextResponse.json({
      success: true,
      message: 'KTA template cache cleared successfully'
    })

  } catch (error) {
    console.error('Clear cache error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
