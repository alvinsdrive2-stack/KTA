import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

/**
 * Token lupa password.
 *
 * Alur: email dikirim berisi token MENTAH (32 byte acak, hex). Yang masuk DB
 * cuma sha256-nya. Jadi kalau isi tabel bocor, token-nya nggak bisa dipakai
 * buat reset password orang. Satu kali pakai — begitu sukses, `usedAt` diisi.
 */

/** Link reset lupa password berlaku berapa menit. Dipakai juga di teks email. */
export const RESET_TOKEN_TTL_MINUTES = 60

/**
 * Link "bikin password sendiri" buat akun yang baru dibuat admin.
 *
 * TTL-nya jauh lebih panjang dari reset biasa (7 hari): user-nya belum tentu
 * buka email hari itu, dan kalau link-nya mati admin harus kirim ulang.
 */
export const SET_PASSWORD_TOKEN_TTL_MINUTES = 60 * 24 * 7

export function hashResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/**
 * Bikin token baru buat satu user. Token lama yang belum kepakai langsung
 * dimatikan, biar cuma link terbaru yang jalan (nggak numpuk link aktif).
 *
 * `ttlMinutes` dipakai buat bedain link reset biasa (60 menit) sama link
 * set-password akun baru (`SET_PASSWORD_TOKEN_TTL_MINUTES`). Tabel-nya sama,
 * mekanismenya sama — yang beda cuma masa berlaku dan teks emailnya.
 */
export async function createPasswordResetToken(
  userId: string,
  ttlMinutes: number = RESET_TOKEN_TTL_MINUTES
): Promise<{
  rawToken: string
  expiresAt: Date
}> {
  const rawToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)

  await prisma.$transaction([
    // Token lama user ini dimatikan — cuma link terbaru yang valid.
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    // Housekeeping: buang token kedaluwarsa milik user lain.
    prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    }),
    prisma.passwordResetToken.create({
      data: { userId, tokenHash: hashResetToken(rawToken), expiresAt },
    }),
  ])

  return { rawToken, expiresAt }
}

/**
 * Cek token tanpa menandainya terpakai. Dipakai halaman reset buat mastiin
 * link-nya masih valid sebelum user ngetik password baru.
 */
export async function findPasswordResetToken(rawToken: string) {
  if (!rawToken) return null

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(rawToken) },
    include: {
      user: { select: { id: true, name: true, email: true, isActive: true } },
    },
  })

  if (!record) return null
  if (record.usedAt) return null
  if (record.expiresAt.getTime() < Date.now()) return null
  if (!record.user.isActive) return null

  return record
}
