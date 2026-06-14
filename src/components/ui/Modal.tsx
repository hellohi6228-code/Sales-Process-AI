import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
  hidePadding?: boolean;
}

export function Modal({ isOpen, onClose, title, children, className, hideHeader, hidePadding }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Left empty since we do not want to alter body overflow to avoid layout shifts.
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm p-4 sm:p-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div 
        className="fixed inset-0 transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      ></div>

      <div className={cn("relative transform overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-left shadow-lg transition-all m-4 sm:my-8 sm:w-full sm:max-w-lg", className)}>
        {!hideHeader && (
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/50 px-8 py-6">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="rounded-full bg-neutral-100 dark:bg-neutral-800 p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 focus:outline-none transition-colors"
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5 stroke-[2]" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className={cn(hidePadding ? "" : "px-8 py-6")}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
