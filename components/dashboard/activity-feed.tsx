'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, CheckCircle, AlertCircle, FileText, User, Building } from 'lucide-react'

interface ActivityItem {
  id: string
  type: 'kta_created' | 'kta_approved' | 'kta_printed' | 'payment_received' | 'user_registered'
  title: string
  description: string
  timestamp: string
  actor?: string
}

interface ActivityFeedProps {
  activities: ActivityItem[]
  className?: string
}

const activityIcons = {
  kta_created: { icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100' },
  kta_approved: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  kta_printed: { icon: FileText, color: 'text-sky-600', bg: 'bg-sky-100' },
  payment_received: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  user_registered: { icon: User, color: 'text-violet-600', bg: 'bg-violet-100' },
}

const formatTimeAgo = (timestamp: string) => {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Baru saja'
  if (diffMins < 60) return `${diffMins} menit lalu`
  if (diffHours < 24) return `${diffHours} jam lalu`
  if (diffDays < 7) return `${diffDays} hari lalu`
  return then.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ActivityFeed({ activities, className }: ActivityFeedProps) {
  return (
    <Card className={'card-3d ' + (className || '')}>
      <CardHeader className="border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-200 rounded-lg shadow-inner-soft">
              <Clock className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Aktivitas Terbaru
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {activities.length} aktivitas dalam 7 hari terakhir
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-200" />

          <div className="space-y-4">
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">Belum ada aktivitas</p>
              </div>
            ) : (
              activities.map((activity, index) => {
                const { icon: Icon, color, bg } = activityIcons[activity.type]
                return (
                  <div key={activity.id} className="relative flex gap-3 opacity-0 animate-fade-in" style={{ animationDelay: (index * 50) + 'ms' }}>
                    {/* Icon */}
                    <div className={'relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ' + bg}>
                      <Icon className={'h-4 w-4 ' + color} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {activity.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {activity.description}
                          </p>
                          {activity.actor && (
                            <p className="text-xs text-slate-400 mt-1">
                              oleh {activity.actor}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {formatTimeAgo(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {activities.length > 0 && (
          <button className="w-full mt-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Lihat Semua Aktivitas
          </button>
        )}
      </CardContent>
    </Card>
  )
}
