/**
 * Augmentasi tipe next-auth — field tambahan yang di-set callback jwt/session
 * di `lib/auth.ts`. Tanpa ini, semua pemanggil route terpaksa menulis
 * `session.user as any` cuma buat baca `role`/`daerahId`/`daerah`.
 *
 * Field dibuat optional supaya assignment di callback session tetap lolos
 * (nilai dari token bisa undefined di awal siklus JWT).
 */
import type { DefaultSession } from 'next-auth'

type SessionDaerah = {
  id: string
  kodeDaerah: string
  namaDaerah: string
} | null

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role?: string
      daerahId?: string | null
      daerah?: SessionDaerah
      mustChangePassword?: boolean
    } & DefaultSession['user']
  }

  interface User {
    role?: string
    daerahId?: string | null
    daerah?: SessionDaerah
    deviceToken?: string
    mustChangePassword?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    daerahId?: string | null
    daerah?: SessionDaerah
    deviceToken?: string
    mustChangePassword?: boolean
    /** Ditandai true kalau device session udah nggak valid — dipaksa logout. */
    invalid?: boolean
  }
}
