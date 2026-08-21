import { randomUUID } from 'crypto'
import { prisma } from './prisma'

// Idle timeout: 5 menit tanpa aktivitas -> auto logout (sliding window).
// Env SESSION_IDLE_MINUTES bisa override (dalam menit).
const SESSION_IDLE_MS = 5 * 60 * 1000
const REFRESH_THRESHOLD_MS = 60 * 1000 // perpanjang sesi kalau sisa waktu < 1 menit

export function getIdleTimeoutMs(): number {
  const raw = process.env.SESSION_IDLE_MINUTES
  const parsed = parseInt(raw || '', 10)
  if (Number.isFinite(parsed) && parsed >= 1) {
    return parsed * 60 * 1000
  }
  return SESSION_IDLE_MS
}

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

// Daftarkan device baru untuk user. Kebijakan keep-first:
// kalau masih ada sesi AKTIF (belum expired) yang mencapai batas, login ditolak
// (lempar ACTIVE_SESSION_EXISTS). Device pertama yang login dipertahankan.
export async function registerDeviceSession(userId: string, role: string): Promise<string> {
  const maxDevices = await getMaxDevices(role)
  const deviceToken = randomUUID()
  const now = BigInt(Date.now())
  const expires = now + BigInt(getIdleTimeoutMs())

  const activeSessions = await prisma.session.findMany({
    where: { userId, expires: { gt: now } },
    orderBy: { id: 'asc' },
    select: { id: true }
  })

  if (activeSessions.length >= maxDevices) {
    throw new Error('ACTIVE_SESSION_EXISTS')
  }

  // Bersihkan sesi yang sudah expired biar tabel gak numpuk
  await prisma.session.deleteMany({
    where: { userId, expires: { lte: now } }
  })

  await prisma.session.create({
    data: {
      sessionToken: deviceToken,
      userId,
      expires
    }
  })

  return deviceToken
}

// Cek apakah device token masih sesi aktif milik user + belum idle timeout.
// Sliding window: tiap request valid memperpanjang waktu kedaluwarsa,
// jadi logout otomatis kalau diam lebih dari idle timeout.
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

  if (!session || session.userId !== userId) {
    return false
  }

  const now = BigInt(Date.now())

  // Sudah lewat idle timeout -> hapus sesi & anggap logout
  if (session.expires <= now) {
    await prisma.session.deleteMany({
      where: { sessionToken: deviceToken }
    })
    return false
  }

  // Sliding window: perpanjang kalau mau habis, biar request gak selalu nulis DB
  const remainingMs = Number(session.expires - now)
  if (remainingMs < REFRESH_THRESHOLD_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { expires: now + BigInt(getIdleTimeoutMs()) }
    })
  }

  return true
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
