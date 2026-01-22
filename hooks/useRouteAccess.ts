import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { canAccessPath, getRedirectPath, routeAccessMap } from '@/config/route-access'
import { useToast } from '@/components/ui/use-toast'

/**
 * Hook to check route access control
 * Redirects user if they don't have access to the current route
 *
 * @example
 * ```tsx
 * function MyPage() {
 *   const { isAllowed, isLoading } = useRouteAccess()
 *
 *   if (isLoading) return <Loading />
 *   if (!isAllowed) return null // Will auto-redirect
 *
 *   return <div>Page content</div>
 * }
 * ```
 */
export function useRouteAccess() {
  const router = useRouter()
  const { session, isLoading: sessionLoading } = useSession()
  const { toast } = useToast()

  useEffect(() => {
    // Wait for session to load
    if (sessionLoading) return

    // No session = not logged in
    if (!session) {
      router.push('/auth/login')
      return
    }

    const pathname = window.location.pathname
    const role = session.user?.role

    // Check if user can access this path
    if (!canAccessPath(role, pathname)) {
      const redirectPath = getRedirectPath(role, pathname)

      // Find the route to show allowed roles
      const route = routeAccessMap.find(r => {
        const pattern = r.path
          .replace(/\[(\w+)\]/g, '[^/]+')
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`^${pattern}$`)
        return regex.test(pathname)
      })

      const allowedRolesText = route
        ? route.allowedRoles.join(', ')
        : 'tertentu'

      toast({
        variant: 'destructive',
        title: 'Akses Ditolak',
        description: `Halaman ini hanya untuk role: ${allowedRolesText}.`,
      })

      if (redirectPath) {
        router.push(redirectPath)
      }
    }
  }, [session, sessionLoading, router, toast])

  const hasAccess = () => {
    if (!session) return false
    const pathname = window.location.pathname
    const role = session.user?.role
    return canAccessPath(role, pathname)
  }

  return {
    isAllowed: hasAccess(),
    isLoading: sessionLoading,
    canAccess: canAccessPath,
  }
}

/**
 * HOC (Higher Order Component) to protect pages with route access control
 *
 * @example
 * ```tsx
 * // page.tsx
 * import { withRouteAccess } from '@/hooks/useRouteAccess'
 *
 * function MyPage() {
 *   return <div>Protected content</div>
 * }
 *
 * export default withRouteAccess(MyPage)
 * ```
 */
export function withRouteAccess<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: {
    redirectPath?: string
  }
) {
  return function WithRouteAccess(props: P) {
    const { isAllowed, isLoading } = useRouteAccess()

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )
    }

    if (!isAllowed) {
      return null // Will auto-redirect
    }

    return <WrappedComponent {...props} />
  }
}
