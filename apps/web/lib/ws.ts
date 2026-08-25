'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000/ws'

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
  const [connected, setConnected] = useState(false)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef<WsOptions['onMessage']>(opts.onMessage)
  onMessageRef.current = opts.onMessage

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
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
      setConnected(false)
      // Reconnect after 2s
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      reconnectTimer.current = setTimeout(() => connect(), 2000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    if (opts.autoConnect !== false) connect()
    return () => {
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

  return { connected, send, subscribe, reconnect: connect }
}
