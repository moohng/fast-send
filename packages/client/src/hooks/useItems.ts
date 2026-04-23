import { useState, useEffect, useCallback } from 'react'
import { Socket } from 'socket.io-client'
import { SharedItem } from '../types'
import { Capacitor } from '@capacitor/core'
import { Directory } from '@capacitor/filesystem'

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

        // 1. 准备路径和目录
        const fileName = item.originalName || item.filename || 'unknown'
        const isMedia = fileName.match(/\.(jpg|jpeg|png|gif|mp4|mov|webm)$/i)
        const directory = isMedia ? Directory.ExternalStorage : Directory.Documents
        const folder = isMedia ? 'DCIM/FastSend' : 'FastSend'

        let finalPath = `${folder}/${fileName}`
        let finalDir = directory

        // 显式先创建目录
        const { Filesystem } = await import('@capacitor/filesystem')
        try {
          const folderPath = finalPath.substring(0, finalPath.lastIndexOf('/'))
          await Filesystem.mkdir({
            path: folderPath,
            directory: finalDir,
            recursive: true,
          })
        } catch (e) {
          // 目录已存在会报错，忽略即可
        }

        // 2. 使用原生下载
        await Filesystem.downloadFile({
          url: downloadUrl,
          path: finalPath,
          directory: finalDir,
          recursive: true,
        })

        localStorage.setItem(key, 'true')
        showToast(isMedia ? '媒体已保存到相册' : `文件已同步: ${fileName}`)
      } catch (e: any) {
        console.error('[Sync] Download failed:', e)
        showToast(`同步失败: ${item.originalName}`, 'error')
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
            if (item.senderId === clientId) return
            if (item.type === 'file' && item.filename) {
              autoDownloadForMobile(item)
            } else if (item.type === 'gallery' && item.files) {
              item.files.forEach(f => {
                autoDownloadForMobile({
                  ...item,
                  type: 'file',
                  filename: f.filename,
                  originalName: f.originalName,
                  size: f.size
                })
              })
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
        if (Capacitor.isNativePlatform()) {
          if (item.type === 'file') {
            autoDownloadForMobile(item)
          } else if (item.type === 'gallery' && item.files) {
            // 批量下载画廊中的所有文件
            item.files.forEach(f => {
              autoDownloadForMobile({
                ...item,
                type: 'file',
                filename: f.filename,
                originalName: f.originalName,
                size: f.size
              })
            })
          }
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
