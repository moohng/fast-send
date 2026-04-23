import { useState, useEffect, useCallback } from 'react'
import { Socket } from 'socket.io-client'
import { SharedItem } from '../types'
import { Capacitor } from '@capacitor/core'

export const useItems = (
  baseUrl: string,
  socket: Socket | null,
  clientId: string,
  showToast: (m: string, t?: any) => void,
) => {
  const [items, setItems] = useState<SharedItem[]>([])

  // 移动端自动同步逻辑
  const autoDownloadForMobile = useCallback(
    async (item: SharedItem) => {
      if (!Capacitor.isNativePlatform() || item.type !== 'file' || !item.filename) return

      // 避免重复下载
      const key = `synced_${item.id}`
      if (localStorage.getItem(key)) return

      try {
        console.log('[Sync] Auto downloading:', item.originalName || item.filename)
        const downloadUrl = `${baseUrl}/download/${item.filename}`

        // 动态导入插件，避免非原生环境下报错
        const { Filesystem, Directory } = await import('@capacitor/filesystem')

        // 1. 获取文件内容
        const response = await fetch(downloadUrl)
        const blob = await response.blob()

        // 2. 转为 Base64 (Capacitor Filesystem 插件的要求)
        const reader = new FileReader()
        reader.readAsDataURL(blob)
        reader.onloadend = async () => {
          const base64data = reader.result as string
          const base64Content = base64data.split(',')[1]

          try {
            const fileName = item.originalName || item.filename || 'unknown'
            const isMedia = fileName.match(/\.(jpg|jpeg|png|gif|mp4|mov|webm)$/i)
            const directory = isMedia ? Directory.Documents : Directory.ExternalStorage
            const folder = isMedia ? 'FastSend/Media' : 'FastSend/Files'

            // 如果是图片或视频，尝试保存到 DCIM (相册)
            let finalPath = `${folder}/${fileName}`
            let finalDir = directory

            if (isMedia && Capacitor.isNativePlatform()) {
              // 在 Android 上，DCIM 是相册目录
              finalDir = Directory.ExternalStorage
              finalPath = `DCIM/FastSend/${fileName}`
            }

            await Filesystem.writeFile({
              path: finalPath,
              data: base64Content,
              directory: finalDir,
              recursive: true,
            })

            localStorage.setItem(key, 'true')
            showToast(isMedia ? '媒体已保存到相册' : `文件已同步: ${fileName}`)
          } catch (e: any) {
            const fileName = item.originalName || item.filename || 'unknown'
            // 兜底：如果 ExternalStorage 不可用，尝试 Documents
            await Filesystem.writeFile({
              path: `FastSend/${fileName}`,
              data: base64Content,
              directory: Directory.Documents,
              recursive: true,
            })
            localStorage.setItem(key, 'true')
            showToast(`文件已同步到文档目录`)
          }
        }
      } catch (e) {
        console.error('[Sync] Auto download failed:', e)
      }
    },
    [baseUrl, showToast],
  )

  const fetchData = useCallback(
    async (newUrl?: string) => {
      const targetUrl = newUrl || baseUrl
      if (!targetUrl) return
      try {
        const itemsRes = await fetch(`${targetUrl}/api/items`, {
          mode: 'cors',
          headers: { Accept: 'application/json' },
        })
        const i = await itemsRes.json()
        setItems([...i].reverse())

        // 这里的逻辑可以改为：拉取列表后，自动同步还没同步过的文件
        if (Capacitor.isNativePlatform()) {
          i.forEach((item: SharedItem) => {
            if (item.type === 'file' && item.senderId !== clientId) {
              autoDownloadForMobile(item)
            }
          })
        }
      } catch (e: any) {
        console.error('[Items] Fetch error:', e.message)
      }
    },
    [baseUrl, clientId, autoDownloadForMobile],
  )

  useEffect(() => {
    if (baseUrl) {
      fetchData()
    }
  }, [baseUrl, fetchData])

  useEffect(() => {
    if (!socket) return

    socket.on('new-item', (item: SharedItem) => {
      setItems((p) => (p.some((x) => x.id === item.id) ? p : [...p, item]))

      // 移动端自动同步
      if (
        item.senderId !== clientId &&
        !['CLIPBOARD_SYNC', 'CLIPBOARD_IMAGE'].includes(item.senderId)
      ) {
        showToast('收到新内容', 'info')
        if (Capacitor.isNativePlatform() && item.type === 'file') {
          autoDownloadForMobile(item)
        }
      }
    })

    socket.on('item-removed', (id: number) => {
      setItems((p) => p.filter((x) => x.id !== id))
    })

    socket.on('items-cleared', () => {
      setItems([])
    })

    return () => {
      socket.off('new-item')
      socket.off('item-removed')
      socket.off('items-cleared')
    }
  }, [socket, clientId, showToast])

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${baseUrl}/api/items/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems((p) => p.filter((x) => x.id !== id))
        showToast('已删除记录')
      }
    } catch (e) {
      showToast('删除失败', 'error')
    }
  }

  return { items, setItems, fetchData, handleDelete }
}
