import React, { useRef } from 'react'
import { Paperclip, Image, Camera, Video, FolderPlus, LucideIcon, CloudUpload } from 'lucide-react'

interface ActionButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  color?: string
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon: Icon,
  label,
  onClick,
  color = 'blue',
}) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2 group active:opacity-70 transition-opacity"
  >
    <div
      className={`w-14 h-14 rounded-2xl text-${color}-600 flex items-center justify-center group-active:scale-90 transition-all border border-${color}-100/10`}
    >
      <Icon size={26} />
    </div>
    <span className="text-[11px] font-bold text-slate-500">{label}</span>
  </button>
)

interface ActionPanelProps {
  isOpen: boolean
  isMobile: boolean
  onChangeAction: (files: File[]) => void
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ isOpen, isMobile, onChangeAction }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const onActionClick = (type: string) => {
    // setIsMenuOpen(false)
    if (type === 'file') fileInputRef.current?.click()
    if (type === 'album') isMobile ? handleBackup() : albumInputRef.current?.click()
    if (type === 'camera') cameraInputRef.current?.click()
    if (type === 'video') videoInputRef.current?.click()
  }

  const handleBackup = async () => {
    try {
      const { Camera } = await import("@capacitor/camera")
      const result = await Camera.pickImages({
        quality: 100,
        limit: 0,
      })

      if (!result.photos || result.photos.length === 0) return
      // showToast(`正在上传 ${result.photos.length} 项...`, "info")

      const files: File[] = []
      for (const photo of result.photos) {
        try {
          const response = await fetch(photo.webPath)
          const blob = await response.blob()
          const fileName = photo.path?.split("/").pop() || `backup_${Date.now()}.${photo.format}`
          files.push(new File([blob], fileName, { type: blob.type }))
        } catch (e) { }
      }

      if (files.length > 0) {
        await onChangeAction(files)
        // showToast(`成功上传 ${files.length} 张照片`)
      }
    } catch (e: any) {
      console.error("[Backup] Picker error:", e)
      if (e.message !== "User cancelled photos app") {
        // showToast(`上传失败: ${e.message}`, "error")
      }
    }
  }

  return (
    <div
      className={`bg-white border-t border-slate-100 transition-all duration-300 linear overflow-hidden action-panel-container ${
        isOpen ? 'max-h-[150px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
      }`}
    >
      <div className="p-8 mx-auto">
        <div className={`grid gap-x-8 gap-y-6 grid-cols-4`}>
          <ActionButton icon={Paperclip} label="文件" onClick={() => onActionClick('file')} />
          <ActionButton
            icon={Image}
            label="相册"
            color="emerald"
            onClick={() => onActionClick('album')}
          />
          {isMobile && (
            <>
              <ActionButton
                icon={Camera}
                label="拍照"
                color="orange"
                onClick={() => onActionClick('camera')}
              />
              <ActionButton
                icon={Video}
                label="录像"
                color="rose"
                onClick={() => onActionClick('video')}
              />
            </>
          )}
        </div>
      </div>

      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={(e) => e.target.files && onChangeAction(Array.from(e.target.files))}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        multiple
        ref={albumInputRef}
        onChange={(e) => e.target.files && onChangeAction(Array.from(e.target.files))}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={(e) => e.target.files && onChangeAction(Array.from(e.target.files))}
        className="hidden"
      />
      <input
        type="file"
        accept="video/*"
        capture="environment"
        ref={videoInputRef}
        onChange={(e) => e.target.files && onChangeAction(Array.from(e.target.files))}
        className="hidden"
      />
    </div>
  )
}
