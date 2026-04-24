import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { QrCode, X, UploadCloud, Settings, Scan, RefreshCw, MoreHorizontal, ClipboardList, FolderTree } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { SharedItem, ServerConfig, FileInfo } from './types'
import { MessageItem } from './components/MessageItem'
import { ToastContainer, Toast } from './components/ToastContainer'
import { GalleryPreview } from "./components/GalleryPreview"
import { ActionPanel } from './components/ActionPanel'
import { BottomInput } from './components/BottomInput'
import { DebugConsole } from './components/DebugConsole'

import { useSocket } from './hooks/useSocket'
import { useItems } from './hooks/useItems'
import { useUpload } from './hooks/useUpload'
import { useDiscovery } from './hooks/useDiscovery'
import { requestNotificationPermission } from './utils/notifications'
import { saveToAlbum } from './utils/media'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'

const CLIENT_ID = (() => {
  let id = localStorage.getItem('fast_send_client_id')
  if (!id) {
    id = 'c_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('fast_send_client_id', id)
  }
  return id
})()

const isMobile = Capacitor.getPlatform() !== 'web'

export default function App() {
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('fast_send_last_url') || `http://${window.location.hostname}:5678`)
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [inputText, setInputText] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [previewMedia, setPreviewMedia] = useState<{
    url: string
    type: "image" | "video"
    index?: number
    items?: FileInfo[]
  } | null>(null)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState<{ id: number; x: number; y: number } | null>(null)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [isServerLocal, setIsServerLocal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [downloadPath, setDownloadPath] = useState('')
  const [dataDir, setDataDir] = useState('')
  const [clipboardSync, setClipboardSync] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const [selectedQRip, setSelectedQRip] = useState<string>('')

  const qrUrl = useMemo(() => {
    if (!selectedQRip) return ''
    return `http://${selectedQRip}:5678`
  }, [selectedQRip])

  useEffect(() => {
    if (config?.ip && !selectedQRip) {
      setSelectedQRip(config.ip)
    }
  }, [config, selectedQRip])

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const { socket, devices } = useSocket(baseUrl, CLIENT_ID, isMobile, false)
  const { items, setItems, fetchData, handleDelete } = useItems(baseUrl, socket, CLIENT_ID, showToast)
  const { uploadBatch } = useUpload(baseUrl, CLIENT_ID, setItems, showToast)
  const { scan, isScanning } = useDiscovery(baseUrl, setBaseUrl, fetchData, showToast)

  useEffect(() => {
    requestNotificationPermission()
  }, [])

  useEffect(() => {
    if (!baseUrl) return
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/config?url=${baseUrl}`, {
          mode: 'cors',
          headers: { Accept: 'application/json' },
        })
        const c = await response.json()
        setConfig(c)
        if (!selectedQRip) setSelectedQRip(c.ip)

        const settingsRes = await fetch(`${baseUrl}/api/settings?key=downloadPath`)
        const settings = await settingsRes.json()
        if (settings.value) setDownloadPath(settings.value)

        const dataDirRes = await fetch(`${baseUrl}/api/settings?key=baseDir`)
        const dataDirSettings = await dataDirRes.json()
        if (dataDirSettings.value) setDataDir(dataDirSettings.value)

        const syncRes = await fetch(`${baseUrl}/api/settings?key=clipboardSync`)
        const syncSettings = await syncRes.json()
        setClipboardSync(syncSettings.value === 'true')

        const localRes = await fetch(`${baseUrl}/api/is-local`)
        const localData = await localRes.json()
        setIsServerLocal(localData.isLocal)
      } catch (e) {
        console.error('Config fetch error:', e)
      }
    }
    fetchConfig()
  }, [baseUrl])

  const toggleClipboardSync = async () => {
    const newValue = !clipboardSync
    setClipboardSync(newValue)
    try {
      await fetch(`${baseUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'clipboardSync', value: newValue ? 'true' : 'false' }),
      })
      showToast(newValue ? '已开启剪贴板同步' : '已关闭剪贴板同步', 'info')
    } catch (e) {
      showToast('设置失败', 'error')
      setClipboardSync(!newValue)
    }
  }

  const updateDataDir = async (newDir: string) => {
    if (!newDir || newDir === dataDir) return
    try {
      await fetch(`${baseUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'baseDir', value: newDir }),
      })
      setDataDir(newDir)
      showToast('存储目录已更新', 'success')
    } catch (e) {
      showToast('更新失败', 'error')
    }
  }

  const handleActionClick = (type: string) => {
    setIsMenuOpen(false)
    if (type === 'file') fileInputRef.current?.click()
    if (type === 'album') albumInputRef.current?.click()
    if (type === 'camera') cameraInputRef.current?.click()
    if (type === 'video') videoInputRef.current?.click()
    if (type === 'backup') handleBackup()
  }

  const handleBackup = async () => {
    if (!isMobile || !baseUrl) return
    try {
      const { Camera } = await import("@capacitor/camera")
      const result = await Camera.pickImages({
        quality: 100,
        limit: 0,
      })

      if (!result.photos || result.photos.length === 0) return
      showToast(`正在备份 ${result.photos.length} 项...`, "info")

      const files: File[] = []
      for (const photo of result.photos) {
        try {
          const response = await fetch(photo.webPath)
          const blob = await response.blob()
          const fileName = photo.path?.split("/").pop() || `backup_${Date.now()}.${photo.format}`
          files.push(new File([blob], fileName, { type: blob.type }))
        } catch (e) { }
      }

      if (files.length > 0) {
        await uploadBatch(files)
        showToast(`成功备份 ${files.length} 张照片`)
      }
    } catch (e: any) {
      console.error("[Backup] Picker error:", e)
      if (e.message !== "User cancelled photos app") {
        showToast(`备份失败: ${e.message}`, "error")
      }
    }
  }

  const handleScan = async () => {
    if (!isMobile) return
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning')
      const isSupported = await BarcodeScanner.isSupported()
      if (!isSupported.supported) {
        showToast('设备不支持扫码', 'error')
        return
      }

      const status = await BarcodeScanner.checkPermissions()
      if (status.camera !== 'granted') {
        const res = await BarcodeScanner.requestPermissions()
        if (res.camera !== 'granted') {
          showToast('未获得相机权限', 'error')
          return
        }
      }

      document.body.classList.add('barcode-scanner-active')
      const { barcodes } = await BarcodeScanner.scan()
      document.body.classList.remove('barcode-scanner-active')

      if (barcodes.length > 0) {
        const qrUrl = barcodes[0].rawValue
        if (qrUrl && qrUrl.startsWith('http')) {
          setBaseUrl(qrUrl)
          localStorage.setItem('fast_send_last_url', qrUrl)
          showToast('已通过扫码连接', 'success')
          fetchData(qrUrl)
        }
      }
    } catch (e) {
      console.error('Scan error:', e)
      document.body.classList.remove('barcode-scanner-active')
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    dragCounter.current = 0
    if (e.dataTransfer.files) {
      uploadBatch(Array.from(e.dataTransfer.files))
    }
  }

  const handleToggleMenu = useCallback((id: number | null, rect?: DOMRect) => {
    if (id === null) {
      setActiveMenu(null)
    } else if (rect) {
      const isMe = items.find((i) => i.id === id)?.senderId === CLIENT_ID
      const menuWidth = 160
      let x = isMe ? rect.left - 140 : rect.left
      let y = rect.bottom + 8
      if (x < 8) x = 8
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 16
      if (y + 120 > window.innerHeight) y = rect.top - 128
      setActiveMenu({ id, x, y })
    }
  }, [items])

  const handleSendText = async () => {
    if (!inputText.trim() || !baseUrl) return
    const content = inputText
    setInputText('')
    try {
      const res = await fetch(`${baseUrl}/api/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, senderId: CLIENT_ID, type: 'text' }),
      })
      if (!res.ok) throw new Error('Send failed')
    } catch (e) {
      showToast('发送失败', 'error')
      setInputText(content)
    }
  }

  const lastBackPressTime = useRef<number>(0)

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // 如果点击的是更多按钮或其子元素，或者加号按钮和面板，不要关闭
      if (
        target.closest('.more-menu-trigger') ||
        target.closest('.more-menu-container') ||
        target.closest('.plus-button') ||
        target.closest('.action-panel-container')
      ) return

      if (activeMenu) setActiveMenu(null)
      if (isMoreMenuOpen) setIsMoreMenuOpen(false)
      if (isMenuOpen) setIsMenuOpen(false)
    }

    document.addEventListener('mousedown', handleGlobalClick)
    return () => document.removeEventListener('mousedown', handleGlobalClick)
  }, [activeMenu, isMoreMenuOpen])

  useEffect(() => {
    const backHandler = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (previewMedia) {
        setPreviewMedia(null)
      } else if (showQR) {
        setShowQR(false)
      } else if (showSettings) {
        setShowSettings(false)
      } else if (isMenuOpen) {
        setIsMenuOpen(false)
      } else if (activeMenu) {
        setActiveMenu(null)
      } else {
        const now = Date.now()
        if (now - lastBackPressTime.current < 2000) {
          CapApp.exitApp()
        } else {
          lastBackPressTime.current = now
          showToast('再按一次退出应用', 'info')
        }
      }
    })

    return () => {
      backHandler.then((h) => h.remove())
    }
  }, [previewMedia, showQR, showSettings, isMenuOpen, activeMenu, showToast])

  return (
    <div
      className="h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-700 overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-[100] bg-blue-600/10 backdrop-blur-sm border-4 border-dashed border-blue-500/50 m-4 rounded-[2.5rem] flex flex-col items-center justify-center pointer-events-none transition-all animate-in fade-in duration-200">
          <UploadCloud size={80} className="text-blue-600 animate-bounce" />
          <p className="mt-4 text-blue-600 font-black text-xl">将文件/文件夹拖入此处</p>
        </div>
      )}
      <div className="bg-white/80 backdrop-blur-md border-b shrink-0 z-50 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" className="w-10 h-10 rounded-xl shadow-lg shrink-0" alt="FastSend Logo" />
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-800">FastSend</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {devices.length} 设备在线
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 relative">
          <button
            onClick={() => setShowQR(true)}
            className="p-2.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-all"
          >
            <QrCode size={20} />
          </button>

          {!isMobile ? (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-all"
            >
              <Settings size={20} />
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className={`p-2.5 rounded-xl transition-all more-menu-trigger ${isMoreMenuOpen ? "bg-blue-600 text-white shadow-lg" : "bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600"}`}
              >
                <MoreHorizontal size={20} />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl py-2 z-[100] animate-in fade-in zoom-in-95 duration-100 more-menu-container">
                  <button
                    onClick={() => { setIsMoreMenuOpen(false); scan(); }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 flex items-center gap-3 text-slate-700 transition-colors"
                  >
                    <RefreshCw size={18} className={`text-slate-400 ${isScanning ? "animate-spin" : ""}`} />
                    <span className="font-medium">发现设备</span>
                  </button>
                  <button
                    onClick={() => { setIsMoreMenuOpen(false); handleScan(); }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 flex items-center gap-3 text-slate-700 transition-colors"
                  >
                    <Scan size={18} className="text-slate-400" />
                    <span className="font-medium">扫码连接</span>
                  </button>
                  <button
                    onClick={() => { setIsMoreMenuOpen(false); setShowSettings(true); }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 flex items-center gap-3 text-slate-700 transition-colors"
                  >
                    <Settings size={18} className="text-slate-400" />
                    <span className="font-medium">系统设置</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 w-full relative">
        <Virtuoso
          ref={virtuosoRef}
          data={items}
          className="no-scrollbar"
          followOutput="smooth"
          atBottomThreshold={60}
          initialTopMostItemIndex={items.length - 1}
          overscan={1000}
          itemContent={(index, item) => (
            <div className="px-4 sm:px-6">
              <MessageItem
                key={item.id}
                item={item}
                isMe={
                  item.senderId === CLIENT_ID ||
                  item.senderId === 'DESKTOP' ||
                  item.senderId === 'CLIPBOARD_SYNC' ||
                  item.senderId === 'CLIPBOARD_IMAGE'
                }
                baseUrl={baseUrl}
                onDelete={() => handleDelete(item.id)}
                onPreview={(url, type, idx, files) =>
                  setPreviewMedia({ url, type, index: idx, items: files })
                }
                onSaveToAlbum={(url, filename) => saveToAlbum(url, filename, showToast)}
                isMenuOpen={activeMenu?.id === item.id}
                onToggleMenu={handleToggleMenu}
                menuPos={
                  activeMenu?.id === item.id && activeMenu
                    ? { x: activeMenu.x, y: activeMenu.y }
                    : null
                }
              />
            </div>
          )}
          onScroll={() => {
            if (activeMenu) setActiveMenu(null)
            if (isMoreMenuOpen) setIsMoreMenuOpen(false)
          }}
        />
        {items.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 pointer-events-none">
            <UploadCloud size={64} strokeWidth={1} />
            <p className="mt-4 text-sm font-medium">暂无共享内容，开始发送吧</p>
          </div>
        )}
      </div>

      <div className="bg-white border-t shrink-0 z-50 pb-safe">
        <BottomInput
          inputText={inputText}
          setInputText={setInputText}
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          onSend={handleSendText}
          isMobile={isMobile}
        />
        <ActionPanel
          isOpen={isMenuOpen}
          isMobile={isMobile}
          onAction={handleActionClick}
        />
      </div>

      <input type="file" multiple ref={fileInputRef} onChange={(e) => e.target.files && uploadBatch(Array.from(e.target.files))} className="hidden" />
      <input type="file" accept="image/*" ref={albumInputRef} onChange={(e) => e.target.files && uploadBatch(Array.from(e.target.files))} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={(e) => e.target.files && uploadBatch(Array.from(e.target.files))} className="hidden" />
      <input type="file" accept="video/*" capture="environment" ref={videoInputRef} onChange={(e) => e.target.files && uploadBatch(Array.from(e.target.files))} className="hidden" />

      {showQR && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowQR(false)}>
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl text-center w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {config ? (
              <>
                <div className="bg-slate-50 p-6 rounded-[2rem] mb-4 border border-slate-100 shadow-inner">
                  {qrUrl && <QRCodeSVG value={qrUrl} size={224} className="mx-auto" />}
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {config.allIps?.map((ip: string) => (
                    <button
                      key={ip}
                      onClick={() => setSelectedQRip(ip)}
                      className={`block w-full px-4 py-2 rounded-xl text-[10px] font-mono border transition-all ${selectedQRip === ip ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'}`}
                    >
                      http://{ip}:5678
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-10 text-slate-400">
                <QrCode size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium mb-4">尚未连接到服务器</p>
                <button onClick={() => { setShowQR(false); setShowSettings(true); }} className="bg-blue-600 text-white px-6 py-2 rounded-2xl text-sm font-bold shadow-lg shadow-blue-200">手动输入 IP 连接</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowSettings(false)}>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">设置</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              {!isServerLocal && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">服务器地址 (电脑 IP)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => {
                        const val = e.target.value
                        setBaseUrl(val)
                        localStorage.setItem('fast_send_last_url', val)
                      }}
                      placeholder="http://192.168.x.x:5678"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={() => { fetchData(); showToast('已尝试重新连接'); }} className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors tracking-tighter text-[10px] font-bold">连接</button>
                  </div>
                </div>
              )}

              <div className="h-px bg-slate-100" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">剪贴板同步</p>
                    <p className="text-[10px] text-slate-400 font-medium">在所有设备间自动同步剪贴板文本</p>
                  </div>
                </div>
                <button
                  onClick={toggleClipboardSync}
                  className={`w-12 h-6 rounded-full transition-all relative ${clipboardSync ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${clipboardSync ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="h-px bg-slate-100" />

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FolderTree size={16} className="text-blue-600" />
                  <label className="block text-xs font-bold text-slate-400 uppercase">服务端存储目录</label>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dataDir}
                    readOnly
                    placeholder="尚未设置存储目录"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] text-slate-400 cursor-not-allowed font-mono outline-none"
                  />
                  {isServerLocal && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`${baseUrl}/api/utils/select-folder`)
                          const data = await res.json()
                          if (data.path) {
                            updateDataDir(data.path)
                          }
                        } catch (e) {
                          showToast('无法打开文件夹选择器', 'error')
                        }
                      }}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-[10px] font-bold flex items-center gap-2 shadow-lg shadow-blue-200"
                    >
                      <FolderTree size={14} />
                      <span>选择目录</span>
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[9px] text-amber-500 font-medium">注意：更改后服务端将立即开始使用新目录存储文件</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
      <DebugConsole />
      {previewMedia && (
        previewMedia.items ? (
          <GalleryPreview
            items={previewMedia.items}
            initialIndex={previewMedia.index || 0}
            baseUrl={baseUrl}
            onClose={() => setPreviewMedia(null)}
            onSaveToAlbum={(url, filename) => saveToAlbum(url, filename, showToast)}
          />
        ) : (
          <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setPreviewMedia(null)}>
            <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"><X size={32} /></button>
            {previewMedia.type === "image" ? (
              <img src={previewMedia.url} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" alt="Preview" />
            ) : (
              <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <video src={previewMedia.url} controls autoPlay className="w-full h-full" />
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}
