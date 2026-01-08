import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      daerahId?: string | null
      daerah?: {
        id: string
        kodeDaerah: string
        namaDaerah: string
      } | null
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    daerahId?: string | null
    daerah?: {
      id: string
      kodeDaerah: string
      namaDaerah: string
    } | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    daerahId?: string | null
    daerah?: {
      id: string
      kodeDaerah: string
      namaDaerah: string
    } | null
  }
}