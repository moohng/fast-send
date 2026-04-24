import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { QrCode, X, UploadCloud, Settings, Scan, RefreshCw, MoreHorizontal } from 'lucide-react'
import { ServerConfig, FileInfo } from './types'
import { MessageItem } from './components/MessageItem'
import { ToastContainer, Toast } from './components/ToastContainer'
import { GalleryPreview } from "./components/GalleryPreview"
import { ActionPanel } from './components/ActionPanel'
import { BottomInput } from './components/BottomInput'
import { DebugConsole } from './components/DebugConsole'
import { SettingsModal } from './components/SettingsModal'
import { QRModal } from './components/QRModal'

import { useSocket } from './hooks/useSocket'
import { useItems } from './hooks/useItems'
import { useUpload } from './hooks/useUpload'
import { useDiscovery } from './hooks/useDiscovery'
import { requestNotificationPermission } from './utils/notifications'
import { saveToAlbum, saveFileToLocal, saveAllMediaFromGallery } from './utils/media'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
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

  const [selectedQRip, setSelectedQRip] = useState<string>('')

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
    if (!Capacitor.isNativePlatform()) return;

    const updateStatusBar = async () => {
      try {
        if (previewMedia) {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#000000' });
        } else if (showQR || showSettings) {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#666666' });
        } else {
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: '#ffffff' });
        }
      } catch (e) {
        console.error('Failed to update status bar:', e);
      }
    };
    
    updateStatusBar();
  }, [previewMedia, showQR, showSettings]);

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
      <div className="bg-white/80 backdrop-blur-md border-b shrink-0 z-50 shadow-sm flex flex-col">
        <div className="pt-safe" />
        <div className="px-4 py-3 flex items-center justify-between">
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
                <div className="absolute top-full right-0 mt-2 w-48 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-xl py-2 z-[100] animate-in fade-in zoom-in-95 duration-100 more-menu-container">
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
            <div className={`px-4 sm:px-6 ${index === items.length - 1 ? 'pb-2' : ''} ${index === 0 ? 'pt-2' : ''}`}>
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
                onSaveAllMedia={(files, bu) => saveAllMediaFromGallery(files, bu, showToast)}
                onSaveFileToLocal={(url, filename) => saveFileToLocal(url, filename, showToast)}
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

      <div className="bg-white border-t shrink-0 z-50 flex flex-col">
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
          onChangeAction={uploadBatch}
        />
        <div className="pb-safe" />
      </div>

      <QRModal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        config={config}
        selectedQRip={selectedQRip}
        onSelectIP={setSelectedQRip}
      />

      <ToastContainer toasts={toasts} />
      <DebugConsole />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        baseUrl={baseUrl}
        clipboardSync={clipboardSync}
        onToggleClipboardSync={toggleClipboardSync}
        dataDir={dataDir}
        isServerLocal={isServerLocal}
        onUpdateDataDir={updateDataDir}
        showToast={showToast}
      />
      {previewMedia && (
        <GalleryPreview
          items={previewMedia.items || [{ filename: previewMedia.url.split('/').pop() || '', originalName: 'Media', size: '', type: previewMedia.type === 'video' ? 'video' : 'image' }]}
          initialIndex={previewMedia.index || 0}
          baseUrl={baseUrl}
          onClose={() => setPreviewMedia(null)}
          onSaveToAlbum={(url, filename) => saveToAlbum(url, filename, showToast)}
        />
      )}
    </div>
  )
}
