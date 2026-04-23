import { useState, useEffect, useRef } from 'react'
import { DeviceInfo } from '../types'

// 模拟 Socket.io 的接口，避免修改其他组件
interface FakeSocket {
  on: (event: string, cb: any) => void
  off: (event: string) => void
  emit: (event: string, data: any) => void
}

export const useSocket = (
  baseUrl: string,
  clientId: string,
  isMobile: boolean,
  isElectron: boolean,
) => {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const listenersRef = useRef<Record<string, any[]>>({})

  const socket: FakeSocket = {
    on: (event, cb) => {
      if (!listenersRef.current[event]) listenersRef.current[event] = []
      listenersRef.current[event].push(cb)
    },
    off: (event) => {
      delete listenersRef.current[event]
    },
    emit: (event, data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event, data }))
      }
    },
  }

  useEffect(() => {
    if (!baseUrl) return

    const wsUrl = baseUrl.replace('http', 'ws') + '/ws'
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    console.log('[Socket] Connecting to:', wsUrl)

    ws.onopen = () => {
      console.log('[Socket] Connected! Client ID:', clientId)
      socket.emit('register', {
        id: clientId,
        type: isMobile ? 'mobile' : isElectron ? 'desktop' : 'web',
      })
    }

    ws.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data)
        if (event === 'devices-update') setDevices(data)
        const callbacks = listenersRef.current[event] || []
        callbacks.forEach((cb) => cb(data))
      } catch (err) {
        console.warn('WS message error:', err)
      }
    }

    ws.onerror = (err) => console.error('[Socket] Connection error:', err)
    ws.onclose = () => console.log('[Socket] Closed')

    return () => {
      ws.close()
    }
  }, [baseUrl, clientId, isMobile, isElectron])

  return { socket, devices }
}
