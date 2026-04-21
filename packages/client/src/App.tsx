import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, QrCode, X, Paperclip, Check, UploadCloud, Laptop, Smartphone } from 'lucide-react';
import { SharedItem, Device, ServerConfig } from './types';
import { MessageItem } from './components/MessageItem';

const CLIENT_ID = (() => {
  let id = localStorage.getItem('fast_send_client_id');
  if (!id) { id = 'c_' + Math.random().toString(36).substr(2, 9); localStorage.setItem('fast_send_client_id', id); }
  return id;
})();

export default function App() {
  const [items, setItems] = useState<SharedItem[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [inputText, setInputText] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [toasts, setToasts] = useState<{id:number, message:string, type:string}[]>([]);
  const [previewMedia, setPreviewMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socketRef.current = io();
    socketRef.current.on('new-item', (item: SharedItem) => {
      setItems(prev => {
        const idx = prev.findIndex(i => i.id === item.id || (i.senderId === item.senderId && i.type === 'file' && i.originalName === item.originalName && i.progress !== undefined));
        return idx !== -1 ? prev.map((msg, i) => i === idx ? item : msg) : [...prev, item];
      });
      if (item.senderId !== CLIENT_ID) showToast(`收到新共享`, 'info');
    });
    socketRef.current.on('item-removed', (id: number) => setItems(prev => prev.filter(i => i.id !== id)));
    socketRef.current.on('items-cleared', () => { setItems([]); showToast('记录已清空'); });
    socketRef.current.on('devices-update', (d: Device[]) => setDevices(d));
    fetchData();
    return () => { socketRef.current?.disconnect(); };
  }, []);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [items]);

  const fetchData = async () => {
    try {
      const c = await (await fetch(`/api/config?url=${window.location.origin}`)).json(); setConfig(c);
      const i = await (await fetch('/api/items')).json(); setItems(i.slice().reverse());
    } catch (e) { console.error(e); }
  };

  const showToast = (m: string, t: string = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message: m, type: t }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 2500);
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    try {
      await fetch('/api/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: inputText, senderId: CLIENT_ID }) });
      setInputText('');
      showToast('发送成功');
    } catch (e) { showToast('发送失败', 'error'); }
  };

  const uploadFile = (file: File) => {
    const tempId = Date.now() + Math.random();
    setItems(p => [...p, { id: tempId, type: 'file', originalName: file.name, size: (file.size / 1024 / 1024).toFixed(2) + ' MB', time: new Date().toLocaleTimeString(), senderId: CLIENT_ID, progress: 0 }]);
    const formData = new FormData(); formData.append('senderId', CLIENT_ID); formData.append('file', file);
    const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/upload', true);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) { const pct = Math.round((e.loaded / e.total) * 100); setItems(p => p.map(x => x.id === tempId ? { ...x, progress: pct } : x)); } };
    xhr.onload = () => { if (xhr.status !== 200) { showToast('上传失败', 'error'); setItems(p => p.filter(x => x.id !== tempId)); } else showToast('上传成功'); };
    xhr.send(formData);
  };

  const copyToClipboard = async (text: string) => {
    const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
    showToast('内容已复制');
  };

  const handleDelete = (id: number) => fetch(`/api/items/${id}`, { method: 'DELETE' });

  return (
    <div className="h-screen bg-slate-100 font-sans flex flex-col overflow-hidden relative" onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files.length > 0) Array.from(e.dataTransfer.files).forEach(uploadFile); }}>
      {isDragging && <div className="absolute inset-0 z-[200] bg-blue-600/90 backdrop-blur-md flex flex-col items-center justify-center text-white pointer-events-none animate-in"><UploadCloud size={64} className="animate-bounce" /><p className="mt-6 text-xl font-bold">立即共享文件</p></div>}
      {previewMedia && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in" onClick={() => setPreviewMedia(null)}>
          {previewMedia.type === 'image' ? <img src={previewMedia.url} className="max-w-full max-h-full rounded-lg shadow-2xl" /> : <video src={previewMedia.url} controls autoPlay className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />}
          <button className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full"><X size={24} /></button>
        </div>
      )}
      <nav className="h-16 bg-white/80 backdrop-blur-md border-b px-4 flex justify-between items-center shadow-sm shrink-0 z-50">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black">FS</div><h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">FastSend</h1></div>
        <div className="flex items-center gap-3"><div className="flex -space-x-1.5 mr-1">{devices.map((d, i) => (<div key={i} className="w-7 h-7 rounded-full bg-slate-50 border border-white flex items-center justify-center text-blue-500 shadow-sm">{d.name.includes('PC') ? <Laptop size={12} /> : <Smartphone size={12} />}</div>))}</div><button onClick={() => setShowQR(!showQR)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 active:scale-90"><QrCode size={20} /></button></div>
      </nav>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#f8fafc]">
        {items.map((item) => (
          <MessageItem 
            key={item.id} 
            item={item} 
            isMine={String(item.senderId) === String(CLIENT_ID)} 
            downloadUrl={`${window.location.protocol}//${config?.ip}:${window.location.port === '5173' ? '3000' : window.location.port}/download/${item.filename}`}
            onCopy={copyToClipboard}
            onDelete={handleDelete}
            onPreview={(url, type) => setPreviewMedia({ url, type })}
          />
        ))}
      </div>
      <div className="bg-white border-t p-3 pb-6 sm:p-4 sm:pb-8 shrink-0 z-50">
        <div className="max-w-3xl mx-auto flex items-end gap-2 bg-slate-100 p-2 rounded-[1.8rem] border border-slate-200 focus-within:border-blue-400 focus-within:bg-white transition-all">
          <button onClick={() => fileInputRef.current?.click()} className="p-3.5 text-slate-400 hover:text-blue-600 rounded-full shrink-0"><Paperclip size={20} /></button>
          <input type="file" multiple ref={fileInputRef} onChange={(e) => { if(e.target.files) Array.from(e.target.files).forEach(uploadFile); }} className="hidden" />
          <textarea rows={1} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }} placeholder="粘贴内容、网址或上传文件..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 px-1 resize-none max-h-32 min-h-[44px]" />
          <button onClick={handleSendText} disabled={!inputText.trim()} className={`p-3.5 rounded-[1.2rem] transition-all shrink-0 ${inputText.trim() ? "bg-blue-600 text-white shadow-lg" : "bg-slate-200 text-slate-400"}`}><Send size={20} /></button>
        </div>
      </div>
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (<div key={t.id} className={`px-6 py-2.5 rounded-full text-[10px] font-black shadow-2xl animate-in pointer-events-auto flex items-center gap-2 ${t.type === 'success' ? "bg-blue-600 text-white" : t.type === 'error' ? "bg-rose-500 text-white" : "bg-slate-800 text-white"}`}>{t.type === 'success' && <Check size={14} />}{t.message}</div>))}
      </div>
      {showQR && config && (<div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowQR(false)}><div className="bg-white p-8 rounded-[3rem] shadow-2xl text-center" onClick={e => e.stopPropagation()}><div className="bg-slate-50 p-6 rounded-[2rem] mb-4 border border-slate-100 shadow-inner"><img src={config.qr} alt="QR" className="w-56 h-56 mx-auto" /></div><code className="block mt-4 text-blue-600 bg-blue-50 px-4 py-2 rounded-2xl text-[10px] font-mono border border-blue-100 select-all">{config.url}</code></div></div>)}
    </div>
  );
}
