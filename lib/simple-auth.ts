import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { createSecureSession, createSimpleSession } from './secure-session'

interface User {
  id: string
  email: string
  name: string
  role: string
  daerahId?: string | null
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: {
      email,
      isActive: true,
    },
  })

  if (!user) {
    return null
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    daerahId: user.daerahId
  }
}

export async function createSession(user: User) {
  try {
    // Try to create a secure JWT session
    const secureSession = await createSecureSession(user)
    return {
      user,
      token: secureSession.session,
      expiresAt: secureSession.expiresAt
    }
  } catch (error) {
    // Fall back to simple session if JWT fails
    console.warn('JWT session creation failed, using fallback session:', error)
    const simpleSession = await createSimpleSession(user)
    return {
      user,
      token: simpleSession.token,
      expiresAt: simpleSession.expiresAt
    }
  }
}