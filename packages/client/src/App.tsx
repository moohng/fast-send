import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, FileUp, Download, Copy, Trash2, QrCode, Smartphone, Laptop, Check, X, AlertCircle, Plus, Paperclip } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CLIENT_ID = (() => {
  let id = localStorage.getItem('fast_send_client_id');
  if (!id) {
    id = 'c_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('fast_send_client_id', id);
  }
  return id;
})();

interface SharedItem {
  id: number;
  type: 'text' | 'file';
  content?: string;
  filename?: string;
  originalName?: string;
  size?: string;
  time: string;
  senderId?: string;
}

interface Device {
  name: string;
  ip: string;
}

interface ServerConfig {
  ip: string;
  url: string;
  qr: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  const [items, setItems] = useState<SharedItem[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [inputText, setInputText] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socketRef.current = io();
    socketRef.current.on('new-item', (item: SharedItem) => {
      const isMine = String(item.senderId) === String(CLIENT_ID);
      setItems(prev => {
        if (prev.some(i => i.id === item.id)) return prev;
        return [...prev, item];
      });
      if (isMine) showToast(item.type === 'text' ? '发送成功' : '上传成功', 'success');
      else showToast(`收到新${item.type === 'text' ? '文字' : '文件'}`, 'info');
    });
    socketRef.current.on('item-removed', (id: number) => {
      setItems(prev => prev.filter(i => i.id !== id));
    });
    socketRef.current.on('items-cleared', () => {
      setItems([]);
      showToast('历史记录已清空', 'info');
    });
    socketRef.current.on('devices-update', (newDevices: Device[]) => {
      setDevices(newDevices);
    });
    fetchData();
    return () => { socketRef.current?.disconnect(); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [items]);

  const fetchData = async () => {
    try {
      const configRes = await fetch(`/api/config?url=${window.location.origin}`);
      const configData = await configRes.json();
      setConfig(configData);
      const itemsRes = await fetch('/api/items');
      const itemsData = await itemsRes.json();
      setItems(itemsData.reverse());
    } catch (e) { console.error(e); }
  };

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    try {
      await fetch('/api/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: inputText, senderId: CLIENT_ID })
      });
      setInputText('');
    } catch (e) { showToast('连接异常', 'error'); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('senderId', CLIENT_ID);
    formData.append('file', file);
    try {
      await fetch('/api/upload', { method: 'POST', body: formData });
    } catch (e) { showToast('上传失败', 'error'); } 
    finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 健壮的复制函数
  const copyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        showToast('内容已复制');
      } else {
        // 兼容性降级方案：创建隐藏 textarea
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) showToast('内容已复制');
        else throw new Error('Copy failed');
      }
    } catch (err) {
      showToast('复制失败，请手动选择文字', 'error');
    }
  };

  return (
    <div className="h-screen bg-slate-100 text-slate-900 font-sans flex flex-col overflow-hidden">
      <nav className="h-16 bg-white/80 backdrop-blur-md border-b px-4 flex justify-between items-center shadow-sm shrink-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black">FS</div>
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">FastSend Stream</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1.5 mr-1">
            {devices.map((device, idx) => (
              <div key={idx} className="w-7 h-7 rounded-full bg-slate-50 border border-white flex items-center justify-center text-blue-500 shadow-sm" title={device.name}>
                {device.name.includes('PC') || device.name.includes('Mac') ? <Laptop size={12} /> : <Smartphone size={12} />}
              </div>
            ))}
          </div>
          <button onClick={() => setShowQR(!showQR)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-600 active:scale-90"><QrCode size={20} /></button>
        </div>
      </nav>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth bg-[#f8fafc]">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-30">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-inner"><Send size={32} /></div>
            <p className="font-bold text-sm uppercase tracking-widest">等待数据同步...</p>
          </div>
        ) : (
          items.map((item) => {
            const isMine = item.senderId === CLIENT_ID;
            const contentToCopy = item.type === 'text' ? item.content : `${window.location.protocol}//${config?.ip}:${window.location.port === '5173' ? '3000' : window.location.port}/download/${item.filename}`;
            return (
              <div key={item.id} className={cn("flex flex-col", isMine ? "items-end" : "items-start animate-in")}>
                <div className={cn("flex max-w-[85%] sm:max-w-[70%] group gap-2", isMine ? "flex-row-reverse" : "flex-row")}>
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm mt-1">
                    {isMine ? <Laptop size={14} className="text-blue-600" /> : <Smartphone size={14} className="text-slate-500" />}
                  </div>
                  <div className="space-y-1">
                    <div className={cn("p-4 rounded-2xl shadow-sm text-sm relative", isMine ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-slate-700 border border-slate-200 rounded-tl-none")}>
                      {item.type === 'text' ? (
                        <div className="leading-relaxed break-all whitespace-pre-wrap font-medium">{item.content}</div>
                      ) : (
                        <div className="flex items-center gap-4 py-1">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner", isMine ? "bg-blue-500" : "bg-slate-100")}>
                            <FileUp size={20} />
                          </div>
                          <div className="min-w-0 pr-2">
                            <p className="font-bold truncate text-xs">{item.originalName}</p>
                            <p className={cn("text-[9px] uppercase font-bold mt-0.5", isMine ? "text-blue-100" : "text-slate-400")}>{item.size}</p>
                          </div>
                        </div>
                      )}
                      <div className={cn("absolute top-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity p-1", isMine ? "right-full mr-2" : "left-full ml-2")}>
                        <button onClick={() => copyToClipboard(contentToCopy || '')} className="p-1.5 bg-white shadow-md border rounded-lg text-slate-400 hover:text-blue-600" title="复制内容"><Copy size={12} /></button>
                        {item.type === 'file' && (
                           <a href={`/download/${item.filename}`} download={item.originalName} className="p-1.5 bg-white shadow-md border rounded-lg text-slate-400 hover:text-green-600" title="下载文件"><Download size={12} /></a>
                        )}
                        <button onClick={() => fetch(`/api/items/${item.id}`, {method:'DELETE'})} className="p-1.5 bg-white shadow-md border rounded-lg text-slate-400 hover:text-rose-600" title="删除记录"><X size={12} /></button>
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold px-1 uppercase tracking-tighter">{item.time}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-white border-t p-3 pb-6 sm:p-4 sm:pb-6 shrink-0 z-50">
        <div className="max-w-3xl mx-auto flex items-end gap-2 bg-slate-100 p-2 rounded-[1.5rem] border border-slate-200 focus-within:border-blue-400 focus-within:bg-white transition-all shadow-inner">
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="p-3 text-slate-400 hover:text-blue-600 active:scale-90 transition-all shrink-0">
            {isUploading ? <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent animate-spin rounded-full" /> : <Paperclip size={20} />}
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <textarea rows={1} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }} placeholder="输入消息、链接..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 px-1 resize-none max-h-32 min-h-[44px]" />
          <button onClick={handleSendText} disabled={!inputText.trim()} className={cn("p-3 rounded-2xl transition-all shrink-0", inputText.trim() ? "bg-blue-600 text-white shadow-lg shadow-blue-200 active:scale-90" : "text-slate-300")}><Send size={20} /></button>
        </div>
      </div>

      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={cn("px-6 py-2 rounded-full text-xs font-black shadow-2xl animate-in pointer-events-auto flex items-center gap-2 transition-all", toast.type === 'success' ? "bg-blue-600 text-white" : toast.type === 'error' ? "bg-rose-500 text-white" : "bg-slate-800 text-white")}>
            {toast.message}
          </div>
        ))}
      </div>

      {showQR && config && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowQR(false)}>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl text-center animate-in" onClick={e => e.stopPropagation()}>
            <img src={config.qr} alt="QR" className="w-56 h-56 mx-auto mb-4" />
            <p className="text-slate-800 font-black text-sm uppercase tracking-widest">Scan to Join</p>
            <code className="block mt-4 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl text-[10px] font-mono border border-blue-100">{config.url}</code>
          </div>
        </div>
      )}
    </div>
  );
}

