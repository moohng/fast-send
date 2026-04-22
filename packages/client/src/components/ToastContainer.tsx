import React from 'react';
import { Check, X } from 'lucide-react';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContainerProps {
  toasts: Toast[];
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts }) => {
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`px-6 py-2.5 rounded-full text-[10px] font-black shadow-2xl animate-in pointer-events-auto flex items-center gap-2 ${t.type === 'success' ? "bg-blue-600 text-white" : t.type === 'error' ? "bg-rose-500 text-white" : "bg-slate-800 text-white"}`}>
          {t.type === 'success' && <Check size={14} />}
          {t.type === 'error' && <X size={14} />}
          {t.message}
        </div>
      ))}
    </div>
  );
};
