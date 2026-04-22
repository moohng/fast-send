import React, { useState, useEffect, useRef } from 'react';
import { QrCode, X, UploadCloud, Settings, FolderOpen } from 'lucide-react';
import { SharedItem, ServerConfig } from './types';
import { MessageItem } from './components/MessageItem';
import { ToastContainer, Toast } from './components/ToastContainer';
import { ActionPanel } from './components/ActionPanel';
import { BottomInput } from './components/BottomInput';
import { DebugConsole } from './components/DebugConsole';

import { useSocket } from './hooks/useSocket';
import { useItems } from './hooks/useItems';
import { useUpload } from './hooks/useUpload';
import { useDiscovery } from './hooks/useDiscovery';
import { RefreshCw } from 'lucide-react';

const CLIENT_ID = (() => {
  let id = localStorage.getItem('fast_send_client_id');
  if (!id) { id = 'c_' + Math.random().toString(36).substr(2, 9); localStorage.setItem('fast_send_client_id', id); }
  return id;
})();

export default function App() {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [inputText, setInputText] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [previewMedia, setPreviewMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('fast_send_last_url') || '');
  const [downloadPath, setDownloadPath] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<{ id: number, x: number, y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isElectron = !!(window as any).electronAPI;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  const showToast = (m: string, t: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message: m, type: t }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 2500);
  };

  const scrollToBottom = () => {
    setTimeout(() => scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const { socket, devices } = useSocket(baseUrl, CLIENT_ID, isMobile, isElectron);
  const { items, setItems, fetchData, handleDelete } = useItems(baseUrl, socket, CLIENT_ID, showToast);
  const { uploadFile } = useUpload(baseUrl, CLIENT_ID, setItems, showToast);
  const { scan, isScanning } = useDiscovery(baseUrl, setBaseUrl, fetchData, showToast);

  useEffect(() => { scrollToBottom(); }, [items.length]);

  useEffect(() => {
    if (!baseUrl) return;
    console.log('[App] Config fetching from:', baseUrl);
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/config?url=${baseUrl}`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        const c = await response.json(); 
        setConfig(c); 
        if (c.downloadPath) setDownloadPath(c.downloadPath);
      } catch (e) { console.error('Config fetch error:', e); }
    };
    fetchConfig();
  }, [baseUrl]);

  useEffect(() => {
    const initUrl = async () => {
      let url = '';
      if (isElectron) url = (await (window as any).electronAPI.getServerUrl()) || '';
      else url = `http://${window.location.hostname}:3000`;
      console.log('[App] Initial URL:', url);
      setBaseUrl(url); 
      localStorage.setItem('fast_send_last_url', url);
    };
    initUrl();
  }, [isElectron]);

  const handleActionClick = (type: string) => {
    setIsMenuOpen(false);
    if (type === 'file') fileInputRef.current?.click();
    if (type === 'album') albumInputRef.current?.click();
    if (type === 'camera') cameraInputRef.current?.click();
    if (type === 'video') videoInputRef.current?.click();
  };

  const handleNativeFolderSelect = async () => {
    setIsMenuOpen(false);
    const path = await (window as any).electronAPI.selectDownloadPath();
    if (path) {
      const isDir = await (window as any).electronAPI.checkIsDirectory(path);
      if (isDir) {
        showToast('正在压缩文件夹并上传...', 'info');
        await (window as any).electronAPI.zipFolder(path);
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounter.current = 0;
    if (isElectron && e.dataTransfer.items) {
      const itemsArr = Array.from(e.dataTransfer.items);
      for (const item of itemsArr) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            const path = (file as any).path;
            if (path) {
              const isDir = await (window as any).electronAPI.checkIsDirectory(path);
              if (isDir) {
                showToast('检测到文件夹，正在压缩并上传...', 'info');
                await (window as any).electronAPI.zipFolder(path);
                continue;
              }
            }
            if (file) uploadFile(file);
          }
        }
      }
    } else if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach(file => uploadFile(file));
    }
  };

  const handleSendText = async () => {
    if (!inputText.trim() || !baseUrl) return;
    const content = inputText;
    setInputText('');
    try {
      const res = await fetch(`${baseUrl}/api/text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, senderId: CLIENT_ID }) });
      if (!res.ok) throw new Error('Send failed');
    } catch (e) { showToast('发送失败', 'error'); setInputText(content); }
  };

  const handleToggleMenu = (id: number | null, rect?: DOMRect) => {
    if (id === null) setActiveMenu(null);
    else if (rect) {
      const isMe = items.find(i => i.id === id)?.senderId === CLIENT_ID;
      const menuWidth = 160; // 菜单的大致宽度
      let x = isMe ? rect.left - 140 : rect.left;
      let y = rect.bottom + 8;

      // 左侧边界检查：确保不会超出屏幕左边
      if (x < 8) x = 8;

      // 右侧边界检查：确保不会超出屏幕右边
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 16;

      // 底部边界检查：确保不会超出屏幕底部
      if (y + 120 > window.innerHeight) y = rect.top - 128;

      setActiveMenu({ id, x, y });
    }
  };

  useEffect(() => {
    const handleGlobalClick = () => setActiveMenu(null);
    if (activeMenu) { window.addEventListener('click', handleGlobalClick); return () => window.removeEventListener('click', handleGlobalClick); }
  }, [activeMenu]);

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-700 overflow-hidden relative" onDragEnter={handleDragEnter} onDragOver={e => e.preventDefault()} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {isDragging && <div className="absolute inset-0 z-[100] bg-blue-600/10 backdrop-blur-sm border-4 border-dashed border-blue-500/50 m-4 rounded-[2.5rem] flex flex-col items-center justify-center pointer-events-none transition-all animate-in fade-in duration-200"><UploadCloud size={80} className="text-blue-600 animate-bounce" /><p className="mt-4 text-blue-600 font-black text-xl">将文件/文件夹拖入此处</p></div>}
      <div className="bg-white/80 backdrop-blur-md border-b shrink-0 z-50 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg rotate-3"><UploadCloud className="text-white" size={24} strokeWidth={2.5} /></div>
          <div><h1 className="text-lg font-black tracking-tight text-slate-800">FastSend</h1><div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{devices.length} 设备在线</p></div></div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => scan()} className={`p-2.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-all ${isScanning ? "animate-spin" : ""}`}>
            <RefreshCw size={20} />
          </button>
          <button onClick={() => setShowQR(true)} className="p-2.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-all">
            <QrCode size={20} />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-all">
            <Settings size={20} />
          </button>
        </div>
      </div>
      <div onScroll={() => activeMenu && setActiveMenu(null)} className="flex-1 overflow-y-auto p-4 sm:p-6 w-full"><div className="mx-auto flex flex-col gap-4">{items.map(item => (<MessageItem key={item.id} item={item} isMe={item.senderId === CLIENT_ID || item.senderId === 'DESKTOP' || item.senderId === 'CLIPBOARD_SYNC' || item.senderId === 'CLIPBOARD_IMAGE'} baseUrl={baseUrl} onDelete={() => handleDelete(item.id)} onPreview={(url, type) => setPreviewMedia({ url, type })} isMenuOpen={activeMenu?.id === item.id} onToggleMenu={handleToggleMenu} menuPos={activeMenu?.id === item.id ? { x: activeMenu.x, y: activeMenu.y } : null} isElectron={isElectron} />))}{items.length === 0 && (<div className="py-20 flex flex-col items-center justify-center text-slate-300"><UploadCloud size={64} strokeWidth={1} /><p className="mt-4 text-sm font-medium">暂无共享内容，开始发送吧</p></div>)}<div ref={scrollEndRef} /></div></div>
      <div className="bg-white border-t shrink-0 z-50 pb-safe"><BottomInput inputText={inputText} setInputText={setInputText} isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} onSend={handleSendText} isMobile={isMobile} /><ActionPanel isOpen={isMenuOpen} isMobile={isMobile} isElectron={isElectron} onAction={handleActionClick} onNativeFolder={handleNativeFolderSelect} /></div>
      <input type="file" multiple ref={fileInputRef} onChange={(e) => e.target.files && Array.from(e.target.files).forEach(f => uploadFile(f))} className="hidden" />
      <input type="file" accept="image/*" ref={albumInputRef} onChange={(e) => e.target.files && Array.from(e.target.files).forEach(f => uploadFile(f))} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={(e) => e.target.files && Array.from(e.target.files).forEach(f => uploadFile(f))} className="hidden" />
      <input type="file" accept="video/*" capture="environment" ref={videoInputRef} onChange={(e) => e.target.files && Array.from(e.target.files).forEach(f => uploadFile(f))} className="hidden" />
      {showQR && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowQR(false)}>
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl text-center w-full max-w-sm" onClick={e => e.stopPropagation()}>
            {config ? (
              <>
                <div className="bg-slate-50 p-6 rounded-[2rem] mb-4 border border-slate-100 shadow-inner">
                  <img src={config.qr} alt="QR" className="w-56 h-56 mx-auto" />
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(config as any).allIps?.map((ip: string) => (
                    <button
                      key={ip}
                      onClick={() => {
                        const url = `http://${ip}:3000`;
                        setBaseUrl(url);
                        localStorage.setItem('fast_send_last_url', url);
                        showToast(`已切换到地址: ${ip}`, 'info');
                      }}
                      className={`block w-full px-4 py-2 rounded-xl text-[10px] font-mono border transition-all ${baseUrl.includes(ip) ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'}`}
                    >
                      http://{ip}:3000
                    </button>
                  ))}
                  <code className="block mt-4 text-slate-400 text-[9px] uppercase font-bold tracking-tighter">点击地址可手动切换</code>
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
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">设置</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">服务器地址 (电脑 IP)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={baseUrl} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setBaseUrl(val);
                      localStorage.setItem('fast_send_last_url', val);
                    }}
                    placeholder="http://192.168.x.x:3000"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={() => { fetchData(); showToast('已尝试重新连接'); }} className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors tracking-tighter text-[10px] font-bold">连接</button>
                </div>
                <p className="mt-2 text-[10px] text-slate-400 italic">请在电脑端 FastSend 顶部查看显示的 IP 地址</p>
              </div>

              {isElectron && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">文件保存路径</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-600 truncate">{downloadPath}</div>
                    <button onClick={async () => { const path = await (window as any).electronAPI.selectDownloadPath(); if (path) { setDownloadPath(path); showToast('保存路径已更新'); } }} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"><FolderOpen size={18} /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} />
      <DebugConsole />
      {previewMedia && (<div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setPreviewMedia(null)}><button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"><X size={32} /></button>{previewMedia.type === 'image' ? (<img src={previewMedia.url} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" alt="Preview" />) : (<div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}><video src={previewMedia.url} controls autoPlay className="w-full h-full" /></div>)}</div>)}
    </div>
  );
}
