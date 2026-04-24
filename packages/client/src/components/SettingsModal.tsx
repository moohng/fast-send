import React from 'react'
import { X, ClipboardList, FolderTree } from 'lucide-react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  baseUrl: string
  clipboardSync: boolean
  onToggleClipboardSync: () => Promise<void>
  dataDir: string
  isServerLocal: boolean
  onUpdateDataDir: (newDir: string) => Promise<void>
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  baseUrl,
  clipboardSync,
  onToggleClipboardSync,
  dataDir,
  isServerLocal,
  onUpdateDataDir,
  showToast
}) => {
  if (!isOpen) return null

  const handleSelectFolder = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/utils/select-folder`)
      const data = await res.json()
      if (data.path) {
        await onUpdateDataDir(data.path)
      }
    } catch (e) {
      showToast('无法打开文件夹选择器', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">设置</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <ClipboardList size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">剪贴板同步</p>
                <p className="text-[10px] text-slate-400 font-medium">在所有设备间自动同步剪贴板文本</p>
              </div>
            </div>
            <button
              onClick={onToggleClipboardSync}
              className={`w-12 h-6 rounded-full transition-all relative ${clipboardSync ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${clipboardSync ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="h-px bg-slate-100" />

          <div>
            <div className="flex items-center gap-2 mb-2">
              <FolderTree size={16} className="text-blue-600" />
              <label className="block text-xs font-bold text-slate-400 uppercase">服务端存储目录</label>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={dataDir}
                readOnly
                placeholder="尚未设置存储目录"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] text-slate-400 cursor-not-allowed font-mono outline-none"
              />
              {isServerLocal && (
                <button
                  onClick={handleSelectFolder}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-[10px] font-bold flex items-center gap-2 shadow-lg shadow-blue-200"
                >
                  <FolderTree size={14} />
                  <span>选择目录</span>
                </button>
              )}
            </div>
            <p className="mt-2 text-[9px] text-amber-500 font-medium">注意：更改后服务端将立即开始使用新目录存储文件</p>
          </div>
        </div>
      </div>
    </div>
  )
}
