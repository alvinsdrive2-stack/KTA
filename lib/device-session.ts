import { randomUUID } from 'crypto'
import { prisma } from './prisma'

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

// Maksimal device aktif per user per role. Prioritas:
// 1. Setting admin di tabel RoleSetting
// 2. Env MAX_DEVICES_PER_USER (fallback global)
// 3. Default 1
export async function getMaxDevices(role: string): Promise<number> {
  if (role) {
    const setting = await prisma.roleSetting.findUnique({
      where: { role: role as any }
    })
    if (setting && setting.maxDevices >= 1) {
      return setting.maxDevices
    }
  }

  const raw = process.env.MAX_DEVICES_PER_USER
  const parsed = parseInt(raw || '', 10)
  if (Number.isFinite(parsed) && parsed >= 1) {
    return parsed
  }
  return 1
}

// Daftarkan device baru untuk user. Session lama yang melebihi batas di-evict,
// sehingga login di device baru otomatis memutus device lama.
export async function registerDeviceSession(userId: string, role: string): Promise<string> {
  const maxDevices = await getMaxDevices(role)
  const deviceToken = randomUUID()
  const expires = BigInt(Date.now() + SESSION_DURATION_MS)

  const activeSessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
    select: { id: true }
  })

  // Simpan maxDevices - 1 sesi lama (sesi terbaru setelah yang baru dibuat)
  const keepCount = Math.max(maxDevices - 1, 0)
  const toDelete = activeSessions.slice(0, activeSessions.length - keepCount)
  if (toDelete.length > 0) {
    await prisma.session.deleteMany({
      where: { id: { in: toDelete.map(s => s.id) } }
    })
  }

  await prisma.session.create({
    data: {
      sessionToken: deviceToken,
      userId,
      expires
    }
  })

  return deviceToken
}

// Cek apakah device token masih menjadi sesi aktif milik user.
// Jika user login di device lain (sesi ini di-evict), return false.
export async function isDeviceSessionValid(
  userId: string | undefined | null,
  deviceToken: string | undefined | null
): Promise<boolean> {
  if (!userId || !deviceToken) {
    return false
  }

  const session = await prisma.session.findUnique({
    where: { sessionToken: deviceToken }
  })

  return !!session && session.userId === userId
}

// Bersihkan sesi saat logout
export async function removeDeviceSession(deviceToken: string | undefined | null): Promise<void> {
  if (!deviceToken) {
    return
  }
  await prisma.session.deleteMany({
    where: { sessionToken: deviceToken }
  })
}
