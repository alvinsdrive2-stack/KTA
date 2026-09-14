import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isEmailConfigured, sendMail, renderPasswordResetEmail, appUrl } from '@/lib/email'
import { createPasswordResetToken, RESET_TOKEN_TTL_MINUTES } from '@/lib/password-reset'

export const dynamic = 'force-dynamic'

/**
 * Kirim link reset password ke email user.
 *
 * Selalu balas pesan yang sama, ada akunnya atau nggak — biar endpoint ini
 * nggak bisa dipakai buat ngecek email mana yang terdaftar.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    // SMTP belum di-set = masalah setup, bukan rahasia akun. Boleh dibedain.
    if (!isEmailConfigured()) {
      console.error('Forgot password: SMTP_USER / SMTP_PASS belum diisi di .env')
      return NextResponse.json(
        { error: 'Layanan email belum dikonfigurasi. Hubungi administrator.' },
        { status: 503 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, isActive: true },
    })

    // Pesan balikan sengaja identik buat semua kasus di bawah ini.
    const genericResponse = NextResponse.json({
      success: true,
      message:
        'Kalau email itu terdaftar, kami sudah kirim link reset password ke inbox-nya.',
    })

    if (!user || !user.isActive) return genericResponse

    const { rawToken } = await createPasswordResetToken(user.id)

    const resetUrl = appUrl(`/auth/reset-password?token=${rawToken}`)
    const { subject, html } = renderPasswordResetEmail({
      name: user.name,
      resetUrl,
      expiresMinutes: RESET_TOKEN_TTL_MINUTES,
    })

    try {
      await sendMail({ to: user.email, subject, html })
    } catch (mailError) {
      // Kegagalan kirim jangan bikin responsnya beda — cuma dicatat di log.
      console.error('Forgot password: gagal kirim email', mailError)
    }

    return genericResponse
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
