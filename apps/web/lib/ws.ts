'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000/ws'
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 8000

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

type WsMessage = {
  type: string
  id?: string
  ts?: string
  channel?: string
  roomId?: string
  tournamentId?: string
  matchId?: string
  payload?: Record<string, unknown>
}

type WsOptions = {
  onMessage?: (msg: WsMessage) => void
  autoConnect?: boolean
}

export function useWs(opts: WsOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = useRef(0)
  const onMessageRef = useRef<WsOptions['onMessage']>(opts.onMessage)
  onMessageRef.current = opts.onMessage
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (!mountedRef.current) return

    setStatus((prev) => (prev === 'connected' ? 'reconnecting' : prev === 'connecting' ? 'connecting' : 'reconnecting'))

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectAttempts.current = 0
      setStatus('connected')
    }

    ws.onmessage = (ev) => {
      try {
        const msg: WsMessage = JSON.parse(ev.data)
        onMessageRef.current?.(msg)
      } catch {
        // malformed message — ignore
      }
    }

    ws.onclose = () => {
      setStatus('reconnecting')
      // Exponential backoff reconnect
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(1.5, reconnectAttempts.current),
        RECONNECT_MAX_MS,
      )
      reconnectAttempts.current += 1
      reconnectTimer.current = setTimeout(() => {
        if (mountedRef.current) connect()
      }, delay)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (opts.autoConnect !== false) connect()
    return () => {
      mountedRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect, opts.autoConnect])

  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const subscribe = useCallback(
    (type: string, payload?: Record<string, unknown>) => {
      send({ type, id: crypto.randomUUID(), ...payload })
    },
    [send],
  )

  // Backwards-compatible `connected` boolean
  const connected = status === 'connected'

  return { connected, status, send, subscribe, reconnect: connect }
}
