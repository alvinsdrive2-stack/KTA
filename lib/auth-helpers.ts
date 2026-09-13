import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth"
import { NextRequest } from "next/server"

export async function authMiddleware(request?: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    // Route handler API: balikin null supaya caller balas 401.
    // Sebelumnya pakai redirect() yang melempar NEXT_REDIRECT,
    // jadi request tanpa session dapat 307 HTML, bukan JSON 401.
    return null
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email || "",
      name: session.user.name || "",
      role: session.user.role || "",
      daerahId: session.user.daerahId || null,
      daerah: session.user.daerah || null,
    },
  }
}