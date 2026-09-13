import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * User yang sedang login, dari session NextAuth.
 *
 * Versi sebelumnya baca cookie `session-token` lalu `JSON.parse` hasil
 * `Buffer.from(token, 'base64')` — tanpa verifikasi signature sama sekali.
 * Jadi siapa pun bisa ngarang cookie berisi `{"role":"ADMIN"}` dan diterima.
 * Sekarang ambil dari `getServerSession()`, yang verifikasi JWT-nya beneran.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      data: { user: session.user },
    })
  } catch (error) {
    console.error('Auth me error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
