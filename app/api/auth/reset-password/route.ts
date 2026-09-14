import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { findPasswordResetToken } from '@/lib/password-reset'

export const dynamic = 'force-dynamic'

/**
 * Cek link reset masih valid atau nggak, tanpa memakainya.
 * Dipakai halaman /auth/reset-password buat nampilin form vs pesan "link mati".
 */
export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token') || ''
    const record = await findPasswordResetToken(token)

    if (!record) {
      return NextResponse.json(
        { valid: false, error: 'Link reset nggak valid atau sudah kedaluwarsa' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      // Cuma nama + email yang dikembalikan. Nggak ada data lain.
      email: record.user.email,
      name: record.user.name,
    })
  } catch (error) {
    console.error('Reset password (GET) error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

/**
 * Pakai token buat nge-set password baru. Token langsung dimatikan
 * (`usedAt`) supaya link-nya cuma jalan sekali.
 */
export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token reset nggak valid' }, { status: 400 })
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password baru wajib diisi' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password baru minimal 8 karakter' },
        { status: 400 }
      )
    }

    const record = await findPasswordResetToken(token)

    if (!record) {
      return NextResponse.json(
        { error: 'Link reset nggak valid atau sudah kedaluwarsa. Minta link baru.' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          password: hashedPassword,
          // User milih password sendiri -> nggak perlu dipaksa ganti lagi.
          mustChangePassword: false,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Sisa token lain milik user ini ikut dimatikan.
      prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId, id: { not: record.id } },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: 'Password berhasil diganti. Silakan login dengan password baru.',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
