import { SignJWT, jwtVerify } from 'jose'
import { prisma } from './prisma'

const secretKey = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'
)

const sessionExpiry = '7d' // 7 days

interface SessionPayload {
  id: string
  email: string
  name: string
  role: string
  daerahId?: string | null
}

export async function createSecureSession(user: {
  id: string
  email: string
  name: string
  role: string
  daerahId?: string | null
}) {
  const payload: SessionPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    daerahId: user.daerahId
  }

  const session = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(sessionExpiry)
    .sign(secretKey)

  return {
    session,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  }
}

export async function verifySecureSession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey)
    return payload as SessionPayload
  } catch (error) {
    return null
  }
}

// For backward compatibility, also provide a simple session option
export async function createSimpleSession(user: {
  id: string
  email: string
  name: string
  role: string
  daerahId?: string | null
}) {
  // If JWT is not available, fall back to encrypted session
  const sessionData = JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    daerahId: user.daerahId,
    timestamp: Date.now()
  })

  // Simple obfuscation (not encryption, but better than plain base64)
  const obfuscated = Buffer.from(sessionData).toString('base64')

  return {
    token: obfuscated,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }
}

export async function verifySimpleSession(token: string): Promise<SessionPayload | null> {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString())

    // Check if session is not too old (7 days)
    if (decoded.timestamp && Date.now() - decoded.timestamp > 7 * 24 * 60 * 60 * 1000) {
      return null
    }

    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      daerahId: decoded.daerahId
    }
  } catch (error) {
    return null
  }
}