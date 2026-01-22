import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check environment variables in Vercel
 * Access at: /api/debug-env
 * SECURITY: Remember to remove this after debugging!
 */
export async function GET() {
  const envVars = {
    SIKI_API_TOKEN: {
      exists: !!process.env.SIKI_API_TOKEN,
      length: process.env.SIKI_API_TOKEN?.length || 0,
      firstChar: process.env.SIKI_API_TOKEN?.[0] || '',
      lastChar: process.env.SIKI_API_TOKEN?.[process.env.SIKI_API_TOKEN?.length - 1] || '',
      // WARNING: Never log the actual token in production!
      // preview: process.env.SIKI_API_TOKEN?.substring(0, 10) + '...',
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
