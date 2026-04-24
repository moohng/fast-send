import React, { useRef, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Download, FileText, FileArchive, Image as ImageIcon } from 'lucide-react'
import { FileInfo } from '../types'
import { Capacitor } from '@capacitor/core'

interface Props {
  items: FileInfo[]
  initialIndex: number
  baseUrl: string
  onClose: () => void
  onSaveToAlbum?: (url: string, filename: string) => void
}

export const GalleryPreview: React.FC<Props> = ({ items, initialIndex, baseUrl, onClose, onSaveToAlbum }) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current
      const targetX = initialIndex * el.clientWidth
      el.scrollTo({ left: targetX, behavior: 'auto' })
    }
  }, [initialIndex])

  const handleDownload = (file: FileInfo) => {
    const url = `${baseUrl}/download/${file.filename}?download=1`
    const a = document.createElement('a')
    a.href = url
    a.download = file.originalName
    a.click()
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200">
      <div className="absolute top-0 inset-x-0 h-16 flex items-center justify-between px-6 z-[210] bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
        <div className="text-white/80 text-sm font-medium pointer-events-auto">
          {items.length} 张内容
        </div>
        <div className="flex gap-4 pointer-events-auto">
          {Capacitor.isNativePlatform() && (
            <button
              onClick={() => {
                const index = Math.round(scrollRef.current!.scrollLeft / scrollRef.current!.clientWidth)
                const file = items[index]
                if (file.type === 'image' || file.type === 'video') {
                  const url = `${baseUrl}/download/${file.filename}`
                  onSaveToAlbum?.(url, file.originalName)
                }
              }}
              className="text-white/70 hover:text-white p-2"
            >
              <ImageIcon size={24} />
            </button>
          )}
          {!Capacitor.isNativePlatform() && (
            <button
              onClick={() => {
                const index = Math.round(scrollRef.current!.scrollLeft / scrollRef.current!.clientWidth)
                handleDownload(items[index])
              }}
              className="text-white/70 hover:text-white p-2"
            >
              <Download size={24} />
            </button>
          )}
          <button onClick={onClose} className="text-white/70 hover:text-white p-2">
            <X size={28} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory no-scrollbar touch-pan-x"
        style={{ scrollBehavior: 'auto' }}
        onClick={onClose}
      >
        {items.map((file, i) => {
          const url = `${baseUrl}/download/${file.filename}`
          return (
            <div
              key={i}
              className="w-full h-full shrink-0 snap-center flex items-center justify-center relative overflow-hidden"
            >
              {file.type === 'image' ? (
                <div className="w-full h-full flex items-center justify-center p-2">
                  <img
                    src={url}
                    className="max-w-full max-h-full object-contain shadow-2xl select-none animate-in zoom-in-95 duration-300"
                    alt={file.originalName}
                    draggable={false}
                  />
                </div>
              ) : file.type === 'video' ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <div 
                    className="w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <video src={url} controls className="w-full h-full" autoPlay />
                  </div>
                </div>
              ) : (
                <div 
                  className="text-white flex flex-col items-center gap-6 p-8 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center text-white/50">
                    {file.originalName.match(/\.(zip|rar|7z|tar)$/i) ? <FileArchive size={48} /> : <FileText size={48} />}
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-bold text-xl">{file.originalName}</p>
                    <p className="text-white/40 text-sm font-medium uppercase">{file.size}</p>
                  </div>
                  <button
                    onClick={() => handleDownload(file)}
                    className="bg-white text-black px-10 py-4 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
                  >
                    <Download size={20} />
                    下载文件
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {items.length > 1 && !Capacitor.isNativePlatform() && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); scrollRef.current?.scrollBy({ left: -scrollRef.current.clientWidth }) }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors z-[210]"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); scrollRef.current?.scrollBy({ left: scrollRef.current.clientWidth }) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors z-[210]"
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}
    </div>
  )
}
