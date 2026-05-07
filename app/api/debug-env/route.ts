import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check environment variables in Vercel
 * Access at: /api/debug-env
 * SECURITY: Remember to remove this after debugging!
 */
export async function GET() {
  const envVars = {
    SIKI_TOKEN_GKK: {
      exists: !!process.env.SIKI_TOKEN_GKK,
      length: process.env.SIKI_TOKEN_GKK?.length || 0,
    },
    SIKI_TOKEN_GATAKSINDO: {
      exists: !!process.env.SIKI_TOKEN_GATAKSINDO,
      length: process.env.SIKI_TOKEN_GATAKSINDO?.length || 0,
    },
    SIKI_TOKEN_MIK: {
      exists: !!process.env.SIKI_TOKEN_MIK,
      length: process.env.SIKI_TOKEN_MIK?.length || 0,
    },
    SIKI_API_TOKEN: {
      exists: !!process.env.SIKI_API_TOKEN,
      length: process.env.SIKI_API_TOKEN?.length || 0,
    },
    DATABASE_URL: {
      exists: !!process.env.DATABASE_URL,
      length: process.env.DATABASE_URL?.length || 0,
    },
    NEXTAUTH_URL: {
      exists: !!process.env.NEXTAUTH_URL,
      value: process.env.NEXTAUTH_URL || '',
    },
    NODE_ENV: process.env.NODE_ENV || 'unknown',
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: envVars,
    note: 'Remove this endpoint after debugging for security reasons!'
  })
}
