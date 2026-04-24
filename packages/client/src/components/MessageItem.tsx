import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Copy,
  Download,
  Trash2,
  Laptop,
  Smartphone,
  FileText,
  Image as ImageIcon,
  Video,
  FileArchive,
  Loader2,
  Play,
  Check,
  MoreVertical,
  FolderOpen,
} from 'lucide-react'
import { SharedItem, FileInfo } from '../types'
import { Capacitor } from '@capacitor/core'
import { Clipboard } from '@capacitor/clipboard'

export const getFileIcon = (n: string = '') => {
  const e = n.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(e!)) return <ImageIcon size={20} />
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(e!)) return <Video size={20} />
  if (['zip', 'rar', '7z', 'tar'].includes(e!)) return <FileArchive size={20} />
  return <FileText size={20} />
}

interface Props {
  item: SharedItem
  isMe: boolean
  baseUrl: string
  onDelete: (id: number) => void
  onPreview: (url: string, type: 'image' | 'video', index?: number, items?: FileInfo[]) => void
  onSaveToAlbum?: (url: string, filename: string) => void
  isMenuOpen: boolean
  onToggleMenu: (id: number | null, rect?: DOMRect) => void
  menuPos: { x: number; y: number } | null
  style?: React.CSSProperties
}

const MediaGrid: React.FC<{
  files: FileInfo[]
  baseUrl: string
  onPreview: Props['onPreview']
}> = ({ files, baseUrl, onPreview }) => {
  const count = files.length

  const gridClass = useMemo(() => {
    if (count === 1) return 'grid-cols-1'
    if (count === 2 || count === 4) return 'grid-cols-2'
    return 'grid-cols-3'
  }, [count])

  const renderItem = (file: FileInfo, index: number) => {
    const url = `${baseUrl}/download/${file.filename}`
    const isVid = file.type === 'video'
    const isLast = count > 9 && index === 8

    if (index >= 9) return null

    return (
      <div
        key={index}
        className={`relative aspect-square cursor-pointer overflow-hidden group/item ${count === 1 ? 'max-h-[400px] aspect-auto rounded-2xl' : 'rounded-lg'}`}
        onClick={() => onPreview(url, isVid ? 'video' : 'image', index, files)}
      >
        {file.type === 'image' || file.type === 'video' ? (
          <>
            <img
              src={url}
              loading="lazy"
              className={`w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-300 ${count === 1 ? 'object-contain bg-black/5' : ''}`}
              alt={file.originalName}
            />
            {isVid && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <div className="w-10 h-10 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/40">
                  <Play size={20} fill="currentColor" />
                </div>
              </div>
            )}
            {isLast && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-lg backdrop-blur-[2px]">
                +{count - 9}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-2 text-slate-400 gap-1">
            {getFileIcon(file.originalName)}
            <span className="text-[10px] truncate w-full text-center px-1 font-medium">{file.originalName}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`grid gap-1.5 ${gridClass}`}>
      {files.map((f, i) => renderItem(f, i))}
    </div>
  )
}

export const MessageItem: React.FC<Props> = React.memo(
  ({ item, isMe, baseUrl, onDelete, onPreview, onSaveToAlbum, isMenuOpen, onToggleMenu, menuPos, style }) => {
    const [copied, setCopied] = useState(false)
    const menuBtnRef = useRef<HTMLButtonElement>(null)

    const ext = item.originalName?.split('.').pop()?.toLowerCase() || ''
    const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
    const isVid = ['mp4', 'mov', 'webm'].includes(ext)
    const downloadUrl =
      item.type === 'file' ? `${baseUrl}/download/${item.filename}` : ''
    const contentToCopy = item.type === 'text' ? item.content : downloadUrl

    const handleCopy = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation()
        try {
          if (Capacitor.isNativePlatform()) {
            await Clipboard.write({
              string: contentToCopy || '',
            })
          } else {
            await navigator.clipboard.writeText(contentToCopy || '')
          }
          setCopied(true)
          setTimeout(() => {
            setCopied(false)
            onToggleMenu(null)
          }, 1000)
        } catch (err) {
          console.error(err)
        }
      },
      [contentToCopy, onToggleMenu],
    )

    const handleToggle = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (isMenuOpen) {
        onToggleMenu(null)
      } else {
        const rect = menuBtnRef.current?.getBoundingClientRect()
        onToggleMenu(item.id, rect)
      }
    }

    return (
      <div style={style} className={`flex flex-col w-full py-1 ${isMe ? 'items-end' : 'items-start'}`}>
        <div
          className={`flex max-w-[95%] sm:max-w-[480px] group gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1 border ${isMe ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-200'}`}
          >
            {isMe ? (
              <Laptop size={14} className="text-blue-600" />
            ) : (
              <Smartphone size={14} className="text-slate-500" />
            )}
          </div>
          <div className={`flex items-start gap-1 min-w-0 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="space-y-1 min-w-0 flex-1">
              <div
                className={`rounded-[1.4rem] shadow-sm text-sm relative transition-all overflow-hidden ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'} ${item.type !== 'text' && !item.progress ? 'p-1.5' : 'p-4'}`}
              >
                {item.type === 'text' ? (
                  <div className="leading-relaxed break-all whitespace-pre-wrap font-medium select-text">
                    {item.content}
                  </div>
                ) : item.type === 'gallery' && item.files ? (
                  <div className="space-y-2">
                    <MediaGrid files={item.files} baseUrl={baseUrl} onPreview={onPreview} />
                    {item.files.some((f) => f.type === 'file') && (
                      <div className="p-2 space-y-1">
                        {item.files
                          .filter((f) => f.type === 'file')
                          .map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] opacity-80">
                              <FileText size={12} />
                              <span className="truncate">{f.originalName}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {isImg && !item.progress ? (
                      <div className="relative min-h-[100px] bg-slate-100 rounded-xl overflow-hidden">
                        <img
                          src={downloadUrl}
                          loading="eager"
                          onClick={() => onPreview(downloadUrl, 'image', 0, [{ filename: item.filename || '', originalName: item.originalName || '', size: item.size || '', type: 'image' }])}
                          className="max-w-full rounded-xl cursor-zoom-in hover:brightness-95 shadow-sm mx-auto block"
                          style={{ minHeight: '100px' }}
                        />
                      </div>
                    ) : isVid && !item.progress ? (
                      <div
                        className="relative cursor-pointer overflow-hidden rounded-xl group/vid bg-slate-100 min-h-[150px]"
                        onClick={() => onPreview(downloadUrl, 'video', 0, [{ filename: item.filename || '', originalName: item.originalName || '', size: item.size || '', type: 'video' }])}
                      >
                        <video src={downloadUrl} className="max-w-full block" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/vid:bg-black/40 transition-colors">
                          <div className="w-12 h-12 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/50">
                            <Play size={24} fill="currentColor" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      item.progress === undefined ? (
                        <a 
                          href={`${downloadUrl}?download=1`}
                          download={item.originalName}
                          className="flex items-center gap-3 py-1 pr-1 min-w-0 cursor-pointer hover:bg-black/5 rounded-xl transition-colors no-underline text-inherit block w-full"
                        >
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${isMe ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}
                          >
                            {getFileIcon(item.originalName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs break-all leading-tight mb-1">
                              {item.originalName}
                            </p>
                            <p
                              className={`text-[9px] uppercase font-bold ${isMe ? 'text-blue-100' : 'text-slate-400'}`}
                            >
                              {item.size}
                            </p>
                          </div>
                        </a>
                      ) : (
                        <div className="flex items-center gap-3 py-1 pr-1 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${isMe ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}
                          >
                            <Loader2 size={20} className="animate-spin" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs break-all leading-tight mb-1">
                              {item.originalName}
                            </p>
                            <div className="w-full bg-blue-100/30 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-white h-full transition-all"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
              <p
                className={`text-[9px] font-bold px-1 uppercase tracking-tighter ${isMe ? 'text-right text-slate-400' : 'text-left text-slate-400'}`}
              >
                {item.time}
              </p>
            </div>
            {item.progress === undefined && (
              <button
                ref={menuBtnRef}
                onClick={handleToggle}
                className={`mt-2 p-1.5 rounded-full transition-colors shrink-0 more-menu-trigger ${isMenuOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'}`}
              >
                <MoreVertical size={16} />
              </button>
            )}
          </div>
        </div>

        {isMenuOpen && menuPos && (
          <div
            className="fixed z-[1000] bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl py-1.5 min-w-[160px] animate-in fade-in zoom-in-95 duration-100 more-menu-container"
            style={{ top: menuPos.y, left: menuPos.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCopy}
              className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-3 text-slate-700 transition-colors"
            >
              {copied ? (
                <Check size={16} className="text-green-500" />
              ) : (
                <Copy size={16} className="text-slate-400" />
              )}
              <span className="font-medium">复制内容</span>
            </button>

            {item.type === 'file' && !Capacitor.isNativePlatform() && (
              <a
                href={`${downloadUrl}?download=1`}
                download={item.originalName}
                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-3 text-slate-700 transition-colors no-underline"
              >
                <Download size={16} className="text-slate-400" />
                <span className="font-medium">下载文件</span>
              </a>
            )}

            {(isImg || isVid) && Capacitor.isNativePlatform() && (
              <button
                onClick={() => {
                  onSaveToAlbum?.(downloadUrl, item.originalName || 'media');
                  onToggleMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-3 text-slate-700 transition-colors"
              >
                <ImageIcon size={16} className="text-slate-400" />
                <span className="font-medium">保存到相册</span>
              </button>
            )}

            <div className="h-px bg-slate-100 my-1 mx-2" />
            <button
              onClick={() => {
                onDelete(item.id)
                onToggleMenu(null)
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-rose-50 flex items-center gap-3 text-rose-500 transition-colors"
            >
              <Trash2 size={16} className="opacity-70" />
              <span className="font-medium">删除记录</span>
            </button>
          </div>
        )}
      </div>
    )
  },
)
