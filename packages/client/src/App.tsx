import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, FileUp, Download, Copy, Trash2, QrCode } from 'lucide-react';

interface SharedItem {
  id: number;
  type: 'text' | 'file';
  content?: string;
  filename?: string;
  originalName?: string;
  size?: string;
  time: string;
}

interface ServerConfig {
  ip: string;
  url: string;
  qr: string;
}

export default function App() {
  const [items, setItems] = useState<SharedItem[]>([]);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [showQR, setShowQR] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = io();
    socketRef.current.on('new-item', (item: SharedItem) => {
      setItems(prev => [item, ...prev]);
    });
    socketRef.current.on('items-cleared', () => {
      setItems([]);
    });

    fetchData();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const fetchData = async () => {
    try {
      // 关键：带上当前 origin，后端会自动将 localhost 替换为局域网 IP
      const configRes = await fetch(`/api/config?url=${window.location.origin}`);
      const configData = await configRes.json();
      setConfig(configData);

      const itemsRes = await fetch('/api/items');
      const itemsData = await itemsRes.json();
      setItems(itemsData);
    } catch (e) {
      console.error('Failed to fetch data', e);
    }
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    await fetch('/api/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: inputText })
    });
    setInputText('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
    } catch (e) {
      console.error('Upload failed', e);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClear = async () => {
    if (confirm('确定清空历史记录吗？')) {
      await fetch('/api/clear', { method: 'POST' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">F</div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">FastSend</h1>
        </div>
        <button 
          onClick={() => setShowQR(!showQR)}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
        >
          <QrCode size={24} />
        </button>
      </nav>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {showQR && config && (
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowQR(false)}>
            <div className="bg-white p-8 rounded-3xl shadow-2xl text-center scale-up-center" onClick={e => e.stopPropagation()}>
              <img src={config.qr} alt="QR Code" className="w-64 h-64 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">手机扫码快速访问</p>
              <code className="block mt-2 text-blue-500 bg-blue-50 px-3 py-1 rounded-full text-xs select-all">
                {config.url}
              </code>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex p-1 bg-slate-50">
            <button 
              onClick={() => setActiveTab('text')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === 'text' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              文字
            </button>
            <button 
              onClick={() => setActiveTab('file')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === 'file' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              文件
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'text' ? (
              <div className="space-y-4">
                <textarea 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="在此输入或粘贴任何内容..."
                  className="w-full h-32 p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none resize-none placeholder:text-slate-300"
                />
                <button 
                  onClick={handleSendText}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                >
                  <Send size={20} />
                  发送内容
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full aspect-video border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileUp size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-700">{isUploading ? '正在上传...' : '选择共享文件'}</p>
                    <p className="text-xs text-slate-400 mt-1">支持任意格式文件</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">最近共享</h2>
            <button onClick={handleClear} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>

          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto flex items-center justify-center text-slate-300">
                  <Send size={32} />
                </div>
                <p className="text-slate-400 font-medium italic">暂无内容，快去分享吧</p>
              </div>
            ) : (
              items.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow animate-in">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-lg uppercase tracking-tighter">
                      {item.type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.time}</span>
                  </div>

                  {item.type === 'text' ? (
                    <div className="relative group">
                      <div className="text-slate-700 leading-relaxed break-all whitespace-pre-wrap">
                        {item.content}
                      </div>
                      <button 
                        onClick={() => copyToClipboard(item.content || '')}
                        className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Copy size={12} /> 点击复制内容
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 border border-slate-100">
                        <FileUp size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 truncate text-sm">{item.originalName}</p>
                        <p className="text-[10px] text-slate-400">{item.size}</p>
                      </div>
                      <a 
                        href={`/download/${item.filename}`}
                        download={item.originalName}
                        className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-700 active:scale-95 transition-all shadow-sm"
                      >
                        <Download size={20} />
                      </a>
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
