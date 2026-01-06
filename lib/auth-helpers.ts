import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth"
import { redirect } from "next/navigation"
import { NextRequest } from "next/server"

export async function authMiddleware(request?: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
    return null
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email || "",
      name: session.user.name || "",
      role: session.user.role || "",
      daerahId: session.user.daerahId || null,
    },
  }
}