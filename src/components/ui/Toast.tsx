import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { useAppContext } from '../../AppContext';

export function ToastHost() {
  const { notification, setNotification, reconnectGoogle } = useAppContext();

  if (!notification) return null;

  const isWarning = notification.type === 'warning' || notification.type === 'error';

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[92vw] max-w-md">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={`flex items-start gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-xl ${
            isWarning
              ? 'bg-red-50/95 dark:bg-red-900/40 border-red-200 dark:border-red-800'
              : 'bg-white/95 dark:bg-neutral-800/95 border-neutral-200 dark:border-neutral-700'
          }`}
        >
          {isWarning && <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {notification.title}
            </p>
            {notification.message && (
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                {notification.message}
              </p>
            )}
            {notification.showReconnect && (
              <button
                onClick={() => {
                  reconnectGoogle();
                  setNotification(null);
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-3 py-1.5 rounded-full hover:opacity-90 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reconnect Google
              </button>
            )}
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}