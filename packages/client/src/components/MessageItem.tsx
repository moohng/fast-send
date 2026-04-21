import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Download, Trash2, Laptop, Smartphone, FileText, Image as ImageIcon, Video, FileArchive, Loader2, Play, Check, MoreVertical } from 'lucide-react';
import { SharedItem } from '../types';

export const getFileIcon = (n: string = '') => {
  const e = n.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(e!)) return <ImageIcon size={20} />;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(e!)) return <Video size={20} />;
  if (['zip', 'rar', '7z', 'tar'].includes(e!)) return <FileArchive size={20} />;
  return <FileText size={20} />;
};

interface Props {
  item: SharedItem;
  isMine: boolean;
  downloadUrl: string;
  onCopy: (t: string) => void;
  onDelete: (id: number) => void;
  onPreview: (url: string, type: 'image' | 'video') => void;
}

export const MessageItem: React.FC<Props> = ({ item, isMine, downloadUrl, onCopy, onDelete, onPreview }) => {
  const [copied, setCopied] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number, y: number, visible: boolean }>({ x: 0, y: 0, visible: false });
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  
  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(item.originalName?.split('.').pop()?.toLowerCase() || '');
  const isVid = ['mp4', 'mov', 'webm'].includes(item.originalName?.split('.').pop()?.toLowerCase() || '');
  const cp = item.type === 'text' ? item.content : downloadUrl;

  const handleCopy = useCallback(() => {
    onCopy(cp || '');
    setCopied(true);
    setMenuPos(prev => ({ ...prev, visible: false }));
    setTimeout(() => setCopied(false), 2000);
  }, [onCopy, cp]);

  const closeMenu = useCallback(() => setMenuPos(prev => ({ ...prev, visible: false })), []);

  useEffect(() => {
    const handleGlobalClose = () => closeMenu();
    if (menuPos.visible) {
      window.addEventListener('click', handleGlobalClose);
      window.addEventListener('scroll', handleGlobalClose, true);
      window.addEventListener('fast-send-close-menus', handleGlobalClose);
      return () => {
        window.removeEventListener('click', handleGlobalClose);
        window.removeEventListener('scroll', handleGlobalClose, true);
        window.removeEventListener('fast-send-close-menus', handleGlobalClose);
      };
    }
  }, [menuPos.visible, closeMenu]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (menuPos.visible) {
      closeMenu();
      return;
    }

    window.dispatchEvent(new CustomEvent('fast-send-close-menus'));
    
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (!rect) return;

    const menuWidth = 160;
    const menuHeight = 150;
    
    let x = isMine ? rect.left - menuWidth + rect.width : rect.left;
    let y = rect.bottom + 8;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 16;
    if (x < 16) x = 16;
    if (y + menuHeight > window.innerHeight) y = rect.top - menuHeight - 8;

    setMenuPos({ x, y, visible: true });
  };

  return (
    <div className={`flex flex-col w-full ${isMine ? "items-end" : "items-start"}`}>
      <div className={`flex max-w-[95%] sm:max-w-[85%] group gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm mt-1">
          {isMine ? <Laptop size={14} className="text-blue-600" /> : <Smartphone size={14} className="text-slate-500" />}
        </div>
        
        <div className={`flex items-start gap-1 min-w-0 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
          <div className="space-y-1 min-w-0 flex-1">
            <div 
              className={`rounded-[1.4rem] shadow-sm text-sm relative transition-all overflow-hidden ${isMine ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-slate-700 border border-slate-200 rounded-tl-none"} ${item.type === 'file' && (isImg || isVid) && !item.progress ? "p-1.5" : "p-4"}`}
            >
              {item.type === 'text' ? (
                <div className="leading-relaxed break-all whitespace-pre-wrap font-medium select-text">{item.content}</div>
              ) : (
                <div className="space-y-2">
                  {isImg && !item.progress ? (
                    <img src={downloadUrl} className="max-w-full rounded-xl cursor-zoom-in hover:brightness-95 shadow-sm mx-auto" onClick={() => onPreview(downloadUrl, 'image')} />
                  ) : isVid && !item.progress ? (
                    <div className="relative cursor-pointer overflow-hidden rounded-xl group/vid" onClick={() => onPreview(downloadUrl, 'video')}>
                      <video src={downloadUrl} className="max-w-full block" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/vid:bg-black/40 transition-colors">
                        <div className="w-12 h-12 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/50">
                          <Play size={24} fill="currentColor" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 py-1 pr-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${isMine ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {item.progress !== undefined ? <Loader2 size={20} className="animate-spin" /> : getFileIcon(item.originalName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs break-all leading-tight mb-1">{item.originalName}</p>
                        {item.progress !== undefined ? (
                          <div className="w-full bg-blue-100/30 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-white h-full transition-all" style={{ width: `${item.progress}%` }} />
                          </div>
                        ) : <p className={`text-[9px] uppercase font-bold ${isMine ? "text-blue-100" : "text-slate-400"}`}>{item.size}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className={`text-[9px] font-bold px-1 uppercase tracking-tighter ${isMine ? "text-right text-slate-400" : "text-left text-slate-400"}`}>{item.time}</p>
          </div>

          {item.progress === undefined && (
            <button
              ref={menuBtnRef}
              onClick={toggleMenu}
              className={`mt-2 p-1.5 rounded-full transition-colors shrink-0 ${menuPos.visible ? "bg-blue-50 text-blue-600" : "text-slate-300 hover:bg-slate-100 hover:text-slate-600"}`}
            >
              <MoreVertical size={16} />
            </button>
          )}
        </div>
      </div>

      {menuPos.visible && (
        <div 
          className="fixed z-[1000] bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl py-1.5 min-w-[140px] animate-in fade-in zoom-in-95 duration-100"
          style={{ top: menuPos.y, left: menuPos.x }}
          onClick={e => { e.stopPropagation(); }}
        >
          <button 
            onClick={handleCopy}
            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-3 text-slate-700 transition-colors"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-slate-400" />}
            <span className="font-medium">复制内容</span>
          </button>
          
          {item.type === 'file' && (
            <a 
              href={downloadUrl} 
              download={item.originalName}
              className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-3 text-slate-700 transition-colors no-underline"
            >
              <Download size={16} className="text-slate-400" />
              <span className="font-medium">下载文件</span>
            </a>
          )}
          
          <div className="h-px bg-slate-100 my-1 mx-2" />
          
          <button 
            onClick={() => { onDelete(item.id); closeMenu(); }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-rose-50 flex items-center gap-3 text-rose-500 transition-colors"
          >
            <Trash2 size={16} className="opacity-70" />
            <span className="font-medium">删除记录</span>
          </button>
        </div>
      )}
    </div>
  );
};
