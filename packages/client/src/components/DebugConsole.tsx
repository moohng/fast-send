import React, { useState, useEffect } from 'react'
import { X, Terminal } from 'lucide-react'

export const DebugConsole = () => {
  const [logs, setLogs] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error

    const addLog = (type: string, args: any[]) => {
      const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
      setLogs((prev) =>
        [`[${new Date().toLocaleTimeString()}] ${type}: ${msg}`, ...prev].slice(0, 50),
      )
    }

    console.log = (...args) => {
      addLog('LOG', args)
      originalLog(...args)
    }
    console.warn = (...args) => {
      addLog('WARN', args)
      originalWarn(...args)
    }
    console.error = (...args) => {
      addLog('ERROR', args)
      originalError(...args)
    }

    return () => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
    }
  }, [])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-[999] bg-slate-800 text-white p-3 rounded-full shadow-xl opacity-50 hover:opacity-100"
      >
        <Terminal size={20} />
      </button>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[999] bg-slate-900 text-emerald-400 font-mono text-[10px] h-1/2 flex flex-col shadow-2xl border-t border-slate-700 animate-in slide-in-from-bottom duration-300">
      <div className="flex justify-between items-center bg-slate-800 px-4 py-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Terminal size={14} />
          <span className="font-bold uppercase tracking-widest">Debug Console</span>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setLogs([])} className="text-slate-400 hover:text-white">
            Clear
          </button>
          <button onClick={() => setIsOpen(false)}>
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {logs.map((log, i) => (
          <div
            key={i}
            className={`break-all ${log.includes('ERROR') ? 'text-red-400' : log.includes('WARN') ? 'text-yellow-400' : ''}`}
          >
            {log}
          </div>
        ))}
        {logs.length === 0 && <div className="text-slate-600 italic">No logs yet...</div>}
      </div>
    </div>
  )
}
