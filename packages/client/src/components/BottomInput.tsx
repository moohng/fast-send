import React, { useRef, useEffect } from 'react';
import { Plus, Send } from 'lucide-react';

interface BottomInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  onSend: () => void;
  isMobile: boolean;
}

export const BottomInput: React.FC<BottomInputProps> = ({ 
  inputText, 
  setInputText, 
  isMenuOpen, 
  setIsMenuOpen, 
  onSend,
  isMobile
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px'; // 重置为一行高度
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 24), 128)}px`;
    }
  }, [inputText]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="p-4 flex items-end gap-3 mx-auto w-full">
      <button 
        onClick={() => setIsMenuOpen(!isMenuOpen)} 
        className={`w-12 h-12 flex items-center justify-center rounded-full transition-all shrink-0 ${isMenuOpen ? "bg-slate-800 text-white rotate-45" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
      >
        <Plus size={22} />
      </button>

      <div className="flex-1 bg-slate-100 rounded-[1.5rem] px-4 flex items-center min-h-[48px] border border-transparent focus-within:border-blue-200 focus-within:bg-white transition-all shadow-sm">
        <textarea 
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入文字..."
          rows={1}
          className="flex-1 bg-transparent border-none focus:ring-0 shadow-none outline-none text-sm py-[12px] px-0 resize-none max-h-32 leading-[24px] block overflow-y-auto" 
        />
      </div>
      
      <button 
        onClick={onSend}
        disabled={!inputText.trim()} 
        className={`w-12 h-12 flex items-center justify-center rounded-full transition-all shrink-0 ${inputText.trim() ? "bg-blue-600 text-white shadow-lg scale-105" : "bg-slate-200 text-slate-400"}`}
      >
        <Send size={20} />
      </button>
    </div>
  );
};
