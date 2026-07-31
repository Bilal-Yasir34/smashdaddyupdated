import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" role="dialog">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]"
        onClick={onClose}
      />
      <div
        className={`modal-container relative w-full ${maxWidth} max-h-[90vh] bg-zinc-900 border border-yellow-400/30 rounded-3xl shadow-2xl shadow-yellow-400/10 flex flex-col my-auto animate-[scaleIn_0.25s_cubic-bezier(0.16,1,0.3,1)] overflow-hidden`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 shrink-0">
          <h2 className="text-base sm:text-lg font-black tracking-wide text-yellow-400">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
