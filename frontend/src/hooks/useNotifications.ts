import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsClient } from '../api'
import { useAuthStore } from '../store/useAuthStore'
import { useToastStore } from '../store/useToastStore'

const RECONNECT_DELAY_MS = 30000
const POLL_INTERVAL_MS = 30000

interface StreamPayload {
  type: string
  ticketId?: number
  message: string
}

export function useNotifications() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const seenIds = useRef<Set<number>>(new Set())
  const isFirstLoad = useRef(true)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsClient.getUnread(),
    refetchInterval: POLL_INTERVAL_MS,
    enabled: !!accessToken,
  })

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationsClient.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsClient.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  function handleIncoming(payload: StreamPayload) {
    queryClient.invalidateQueries({ queryKey: ['tickets'] })
    if (payload.ticketId) {
      queryClient.invalidateQueries({ queryKey: ['ticket', payload.ticketId] })
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', payload.ticketId] })
    }
    addToast({ message: payload.message, ticketId: payload.ticketId })
  }

  // SSE kapcsolat — az EventSource nem támogat egyéni headereket, ezért a token query
  // paraméterként megy (lásd Program.cs OnMessageReceived, csak erre az útvonalra engedve).
  useEffect(() => {
    if (!accessToken) return

    let cancelled = false

    function connect() {
      if (cancelled) return

      const url = `/api/portal/notifications/stream?token=${encodeURIComponent(accessToken!)}`
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as StreamPayload
          handleIncoming(payload)
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        } catch {
          // hibás/nem várt payload — kihagyjuk
        }
      }

      es.onerror = () => {
        es.close()
        if (!cancelled) {
          reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      eventSourceRef.current?.close()
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  // Polling fallback: ha az SSE éppen nem szállít semmit (megszakadt, vagy sosem sikerült
  // csatlakozni), a 30mp-es lista-lekérdezés is felfedezi az új, eddig nem látott értesítéseket.
  useEffect(() => {
    const items = notificationsQuery.data
    if (!items) return

    if (isFirstLoad.current) {
      for (const n of items) seenIds.current.add(n.id!)
      isFirstLoad.current = false
      return
    }

    for (const n of items) {
      if (!seenIds.current.has(n.id!)) {
        seenIds.current.add(n.id!)
        handleIncoming({ type: n.triggerType!, ticketId: n.ticketId, message: n.message! })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationsQuery.data])

  const notifications = notificationsQuery.data ?? []

  return {
    notifications,
    unreadCount: notifications.length,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  }
}
