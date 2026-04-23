import React from 'react'
import { Paperclip, Image, Camera, Video, FolderPlus, LucideIcon } from 'lucide-react'

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
      className={`w-14 h-14 rounded-[1.5rem] bg-${color}-50 text-${color}-600 flex items-center justify-center group-active:scale-90 transition-all shadow-sm border border-${color}-100/20`}
    >
      <Icon size={26} />
    </div>
    <span className="text-[11px] font-bold text-slate-500">{label}</span>
  </button>
)

interface ActionPanelProps {
  isOpen: boolean
  isMobile: boolean
  onAction: (type: string) => void
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
  isOpen,
  isMobile,
  onAction,
}) => {
  return (
    <div
      className={`bg-white border-t border-slate-100 transition-all duration-300 ease-in-out overflow-hidden ${
        isOpen ? 'max-h-[280px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
      }`}
    >
      <div className="p-8 mx-auto">
        <div className={`grid gap-8 grid-cols-4`}>
          <ActionButton icon={Paperclip} label="文件" onClick={() => onAction('file')} />
          {isMobile && (
            <>
              <ActionButton
                icon={Image}
                label="相册"
                color="emerald"
                onClick={() => onAction('album')}
              />
              <ActionButton
                icon={Camera}
                label="拍照"
                color="orange"
                onClick={() => onAction('camera')}
              />
              <ActionButton
                icon={Video}
                label="录像"
                color="rose"
                onClick={() => onAction('video')}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
