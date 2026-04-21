import React from 'react';
import { Copy, Download, X, Laptop, Smartphone, FileText, Image as ImageIcon, Video, FileArchive, Loader2, Play } from 'lucide-react';
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
  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(item.originalName?.split('.').pop()?.toLowerCase() || '');
  const isVid = ['mp4', 'mov', 'webm'].includes(item.originalName?.split('.').pop()?.toLowerCase() || '');
  const cp = item.type === 'text' ? item.content : downloadUrl;

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div className={`flex max-w-[85%] sm:max-w-[70%] group gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm mt-1">
          {isMine ? <Laptop size={14} className="text-blue-600" /> : <Smartphone size={14} className="text-slate-500" />}
        </div>
        <div className="space-y-1">
          <div className={`rounded-[1.4rem] shadow-sm text-sm relative overflow-visible transition-all ${isMine ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-slate-700 border border-slate-200 rounded-tl-none"} ${item.type === 'file' && (isImg || isVid) && !item.progress ? "p-1.5" : "p-4"}`}>
            {item.type === 'text' ? (
              <div className="leading-relaxed break-all whitespace-pre-wrap font-medium">{item.content}</div>
            ) : (
              <div className="space-y-2">
                {isImg && !item.progress ? (
                  <img src={downloadUrl} className="max-w-full rounded-xl cursor-zoom-in hover:brightness-95 shadow-sm" onClick={() => onPreview(downloadUrl, 'image')} />
                ) : isVid && !item.progress ? (
                  <div className="relative cursor-pointer overflow-hidden rounded-xl" onClick={() => onPreview(downloadUrl, 'video')}>
                    <video src={downloadUrl} className="max-w-full blur-[0.5px]" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20"><div className="w-10 h-10 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/50"><Play size={20} fill="currentColor" /></div></div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 py-1 pr-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${isMine ? "bg-blue-500" : "bg-slate-100 text-slate-500"}`}>
                      {item.progress !== undefined ? <Loader2 size={20} className="animate-spin" /> : getFileIcon(item.originalName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate text-xs">{item.originalName}</p>
                      {item.progress !== undefined ? (
                        <div className="w-32 bg-blue-100/30 rounded-full h-1 mt-2 overflow-hidden"><div className="bg-blue-400 h-full transition-all" style={{ width: `${item.progress}%` }} /></div>
                      ) : <p className={`text-[9px] uppercase font-bold mt-0.5 ${isMine ? "text-blue-100" : "text-slate-400"}`}>{item.size}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className={`absolute top-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 z-10 ${isMine ? "right-full mr-2" : "left-full ml-2"} ${item.progress !== undefined && "hidden"}`}>
              <button onClick={() => onCopy(cp || '')} className="p-1.5 bg-white shadow-md border rounded-lg text-slate-400 hover:text-blue-600 active:scale-90"><Copy size={12} /></button>
              {item.type === 'file' && <a href={downloadUrl} download={item.originalName} className="p-1.5 bg-white shadow-md border rounded-lg text-slate-400 hover:text-green-600 active:scale-90"><Download size={12} /></a>}
              <button onClick={() => onDelete(item.id)} className="p-1.5 bg-white shadow-md border rounded-lg text-slate-400 hover:text-rose-600 active:scale-90"><X size={12} /></button>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 font-bold px-1 uppercase tracking-tighter">{item.time}</p>
        </div>
      </div>
    </div>
  );
};
