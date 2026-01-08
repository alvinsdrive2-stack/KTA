import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

export const authOptions: NextAuthOptions = {
  // Remove adapter when using JWT strategy to avoid conflicts
  // adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
            isActive: true,
          },
          include: {
            daerah: true
          }
        })

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          daerahId: user.daerahId,
          daerah: user.daerah ? {
            id: user.daerah.id,
            kodeDaerah: user.daerah.kodeDaerah,
            namaDaerah: user.daerah.namaDaerah,
          } : null,
        }
      }
    })
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      // Persist additional user data to token
      if (user) {
        token.role = user.role
        token.daerahId = user.daerahId
        token.daerah = user.daerah
        token.name = user.name
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      // Send token data to the client
      if (token) {
        session.user = {
          id: token.sub!,
          name: token.name,
          email: token.email,
          role: token.role,
          daerahId: token.daerahId,
          daerah: token.daerah
        }
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error"
  }
}