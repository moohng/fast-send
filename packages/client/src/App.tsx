import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, FileUp, Download, Copy, Trash2, QrCode, Smartphone, Laptop, Check, X, AlertCircle } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [showQR, setShowQR] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    socketRef.current = io();
    
    socketRef.current.on('new-item', (item: SharedItem) => {
      // 调试用：console.log('Received item:', item.senderId, 'My ID:', CLIENT_ID);
      const isMine = String(item.senderId) === String(CLIENT_ID);
      
      setItems(prev => {
        if (prev.some(i => i.id === item.id)) return prev;
        return [item, ...prev];
      });

      if (isMine) {
        showToast(item.type === 'text' ? '消息已成功发送' : '文件已上传共享', 'success');
      } else {
        showToast(`局域网新${item.type === 'text' ? '文字' : '文件'}`, 'info');
      }
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

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const fetchData = async () => {
    try {
      const configRes = await fetch(`/api/config?url=${window.location.origin}`);
      const configData = await configRes.json();
      setConfig(configData);
      const itemsRes = await fetch('/api/items');
      const itemsData = await itemsRes.json();
      setItems(itemsData);
    } catch (e) { console.error(e); }
  };

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
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
    formData.append('senderId', CLIENT_ID); // 必须在 file 之前
    formData.append('file', file);
    try {
      await fetch('/api/upload', { method: 'POST', body: formData });
    } catch (e) { showToast('上传失败', 'error'); } 
    finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-200 text-lg">FS</div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">FastSend</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex -space-x-2">
            {devices.map((device, idx) => (
              <div key={idx} className="w-8 h-8 rounded-full bg-white border-2 border-slate-50 flex items-center justify-center text-blue-600 shadow-sm ring-1 ring-slate-100" title={device.name}>
                {device.name.includes('PC') || device.name.includes('Mac') ? <Laptop size={14} /> : <Smartphone size={14} />}
              </div>
            ))}
          </div>
          <button onClick={() => setShowQR(!showQR)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-600 active:scale-90"><QrCode size={22} /></button>
        </div>
      </nav>

      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={cn(
            "px-6 py-2.5 rounded-full text-sm font-bold shadow-2xl animate-in pointer-events-auto flex items-center gap-2 transition-all",
            toast.type === 'success' ? "bg-blue-600 text-white" : 
            toast.type === 'error' ? "bg-rose-500 text-white" : "bg-slate-800 text-white border border-slate-700"
          )}>
            {toast.type === 'error' && <AlertCircle size={16} />}
            {toast.type === 'success' && <Check size={16} />}
            {toast.message}
          </div>
        ))}
      </div>

      <main className="max-w-2xl mx-auto p-4 space-y-6 mt-4">
        {showQR && config && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowQR(false)}>
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl text-center animate-in" onClick={e => e.stopPropagation()}>
              <div className="bg-slate-50 p-4 rounded-3xl mb-4 inline-block border border-slate-100 shadow-inner">
                <img src={config.qr} alt="QR Code" className="w-64 h-64 mx-auto" />
              </div>
              <p className="text-slate-800 font-bold text-lg">扫码加入局域网</p>
              <code className="block mt-4 text-blue-600 bg-blue-50 px-4 py-2 rounded-2xl text-xs select-all font-mono border border-blue-100">{config.url}</code>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="flex p-1.5 bg-slate-50/50">
            <button onClick={() => setActiveTab('text')} className={cn("flex-1 py-3 rounded-2xl text-sm font-bold transition-all", activeTab === 'text' ? "bg-white shadow-md text-blue-600" : "text-slate-400")}>文字消息</button>
            <button onClick={() => setActiveTab('file')} className={cn("flex-1 py-3 rounded-2xl text-sm font-bold transition-all", activeTab === 'file' ? "bg-white shadow-md text-blue-600" : "text-slate-400")}>文件共享</button>
          </div>
          <div className="p-6">
            {activeTab === 'text' ? (
              <div className="space-y-4">
                <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="在此输入内容..." className="w-full h-36 p-5 bg-slate-50 border-none rounded-3xl focus:ring-2 focus:ring-blue-500 outline-none resize-none font-medium" />
                <button onClick={handleSendText} className="w-full bg-blue-600 text-white font-bold py-4 rounded-[1.2rem] hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"><Send size={20} />发送给局域网</button>
              </div>
            ) : (
              <div className="space-y-4">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full aspect-[2/1] border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:border-blue-400 hover:bg-blue-50/50 transition-all group">
                  <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center transition-all", isUploading ? "bg-blue-600 text-white animate-pulse" : "bg-blue-50 text-blue-600 group-hover:scale-110")}><FileUp size={40} /></div>
                  <div className="text-center"><p className="font-bold text-slate-700 text-lg">{isUploading ? '正在上传...' : '选择共享文件'}</p></div>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">最近共享内容</h2>
            <button onClick={() => { if(confirm('清空历史？')) fetch('/api/clear', {method:'POST'}) }} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={18} /></button>
          </div>
          <div className="space-y-4">
            {items.length === 0 ? (
              <div className="py-24 text-center space-y-4 opacity-30"><Send size={40} className="mx-auto" /><p className="font-bold">暂无内容</p></div>
            ) : (
              items.map(item => (
                <div key={item.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2.5 py-1 rounded-lg uppercase tracking-wider">{item.type}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-300 font-bold">{item.time}</span>
                      <button onClick={() => fetch(`/api/items/${item.id}`, {method:'DELETE'})} className="opacity-0 group-hover:opacity-100 text-slate-200 hover:text-rose-500 transition-all"><X size={14} /></button>
                    </div>
                  </div>
                  {item.type === 'text' ? (
                    <div className="space-y-4">
                      <div className="text-slate-700 leading-relaxed break-all whitespace-pre-wrap font-medium">{item.content}</div>
                      <button onClick={() => copyToClipboard(item.content || '')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase transition-all"><Copy size={12} /> 复制内容</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 border border-slate-100"><FileUp size={32} /></div>
                      <div className="flex-1 min-w-0"><p className="font-bold text-slate-800 truncate">{item.originalName}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{item.size}</p></div>
                      <a href={`/download/${item.filename}`} download={item.originalName} className="p-4 bg-slate-900 text-white rounded-[1.2rem] hover:bg-blue-600 transition-all"><Download size={24} /></a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
