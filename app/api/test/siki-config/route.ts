import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    sikiApiUrl: 'https://siki.pu.go.id/siki-api/v1',
    tokenConfigured: !!process.env.SIKI_API_TOKEN,
    tokenValue: process.env.SIKI_API_TOKEN ? `${process.env.SIKI_API_TOKEN.substring(0, 4)}...` : null,
    envVars: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      SIKI_API_TOKEN: !!process.env.SIKI_API_TOKEN
    }
  })
}