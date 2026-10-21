import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { encode } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registerDeviceSession } from '@/lib/device-session'

export const dynamic = 'force-dynamic'

// Login as user: ADMIN dapet cookie sesi atas nama user target.
//
// Bukan lewat CredentialsProvider karena password user nggak dipegang admin.
// Yang dipakai cookie next-auth standar: JWT `next-auth.session-token` yang
// isinya sama persis dengan hasil login biasa — token.sub = id user target,
// plus role/daerahId/daerah/deviceToken yang dibaca callback jwt & session.
//
// Device session target tetap didaftarkan ke tabel Session biar pengecekan
// isDeviceSessionValid di callback jwt lolos. Kalau user target sudah punya
// device aktif sampai batas, login-as ditolak (ACTIVE_SESSION_EXISTS) — sama
// kayak login biasa, admin nggak boleh nendang device user diam-diam.
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Hanya ADMIN yang boleh login as user' },
        { status: 403 }
      )
    }

    // Nggak ada gunanya login as diri sendiri — cuma bikin sesi dobel.
    if (session.user.id === params.id) {
      return NextResponse.json(
        { success: false, error: 'Tidak bisa login as diri sendiri' },
        { status: 400 }
      )
    }

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      include: { daerah: true }
    })

    if (!target) {
      return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 })
    }

    if (!target.isActive) {
      return NextResponse.json(
        { success: false, error: 'User nonaktif, aktifkan dulu sebelum login as' },
        { status: 400 }
      )
    }

    let deviceToken: string
    try {
      deviceToken = await registerDeviceSession(target.id, target.role)
    } catch (error) {
      const msg = (error as Error).message
      if (msg === 'ACTIVE_SESSION_EXISTS') {
        return NextResponse.json(
          {
            success: false,
            error: 'User ini sedang punya sesi aktif di device lain. Minta dia logout dulu.',
          },
          { status: 409 }
        )
      }
      throw error
    }

    const maxAge = authOptions.session?.maxAge ?? 24 * 60 * 60
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
      throw new Error('NEXTAUTH_SECRET not set')
    }

    const token = await encode({
      secret,
      maxAge,
      token: {
        sub: target.id,
        name: target.name,
        email: target.email,
        role: target.role,
        daerahId: target.daerahId,
        daerah: target.daerah
          ? {
              id: target.daerah.id,
              kodeDaerah: target.daerah.kodeDaerah,
              namaDaerah: target.daerah.namaDaerah,
            }
          : null,
        deviceToken,
        // Admin yang lagi impersonate jangan malah kejebak redirect ganti password.
        mustChangePassword: false,
      },
    })

    const cookieName = process.env.NEXTAUTH_URL?.startsWith('https://')
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token'

    const response = NextResponse.json({
      success: true,
      user: { id: target.id, name: target.name, role: target.role },
    })

    response.cookies.set(cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: cookieName.startsWith('__Secure-'),
      maxAge,
    })

    return response
  } catch (error) {
    console.error('Impersonate error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
