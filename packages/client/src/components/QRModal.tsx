import React from 'react'
import { QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { ServerConfig } from '../types'

interface QRModalProps {
  isOpen: boolean
  onClose: () => void
  config: ServerConfig | null
  selectedQRip: string
  onSelectIP: (ip: string) => void
}

export const QRModal: React.FC<QRModalProps> = ({
  isOpen,
  onClose,
  config,
  selectedQRip,
  onSelectIP
}) => {
  if (!isOpen) return null

  const qrUrl = selectedQRip ? `http://${selectedQRip}:5678` : ''

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl text-center w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {config ? (
          <>
            <div className="bg-slate-50 p-6 rounded-[2rem] mb-4 border border-slate-100 shadow-inner">
              {qrUrl && <QRCodeSVG value={qrUrl} style={{ width: '100%', height: 'auto', maxWidth: '224px' }} className="mx-auto" />}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {config.allIps?.map((ip: string) => (
                <button
                  key={ip}
                  onClick={() => onSelectIP(ip)}
                  className={`block w-full px-4 py-2 rounded-xl text-[10px] font-mono border transition-all ${selectedQRip === ip ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'}`}
                >
                  http://{ip}:5678
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="py-10 text-slate-400">
            <QrCode size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium mb-4">尚未连接到服务器</p>
          </div>
        )}
      </div>
    </div>
  )
}
