import React, { useState, useRef, useEffect } from 'react';
import { Settings, LogOut, User, Menu, CreditCard, Cpu, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { supabase } from '../lib/SupabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../AppContext';

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { session, syncDriveToState, isSyncing } = useAppContext();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <>
      <div className="sticky top-0 z-50 flex h-16 flex-shrink-0 border-b border-white/40 dark:border-white/10 bg-white/40 dark:bg-neutral-950/40 backdrop-blur-xl">
        <div className="flex flex-1 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center md:hidden">
            <button
              type="button"
              onClick={onMenuClick}
              className="relative inline-flex items-center justify-center p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-neutral-800 transition-all focus:outline-none"
            >
              <span className="sr-only">Open sidebar</span>
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-1 justify-end items-center">
            <div className="ml-4 flex items-center md:ml-6 space-x-3">

            {/* Sync Drive button */}
            <button
              type="button"
              onClick={() => syncDriveToState?.()}
              disabled={isSyncing}
              title="Sync from Google Drive"
              className="relative inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/50 dark:bg-neutral-800/50 border border-white/60 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-neutral-700/50 transition-all shadow-sm backdrop-blur-md disabled:opacity-50"
            >
              <RefreshCw className={cn("h-5 w-5 stroke-[1.5]", isSyncing && "animate-spin")} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="relative inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/50 dark:bg-neutral-800/50 border border-white/60 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-neutral-700/50 transition-all shadow-sm backdrop-blur-md"
              title="User Settings"
            >
              <span className="sr-only">Settings</span>
              <Settings className="h-5 w-5 stroke-[1.5]" aria-hidden="true" />
            </button>

            {/* Profile dropdown */}
            <div className="relative ml-1" ref={profileRef}>
               <div 
                 onClick={() => setIsProfileOpen(!isProfileOpen)}
                 className="h-10 w-10 rounded-xl overflow-hidden border border-white/60 dark:border-white/10 bg-white/50 dark:bg-neutral-800/50 shadow-sm backdrop-blur-md p-1 transition-all hover:scale-105 cursor-pointer"
               >
                  <img 
                    src="https://api.dicebear.com/9.x/notionists/svg?seed=Felix&backgroundColor=transparent" 
                    alt="User avatar" 
                    className="h-full w-full object-contain"
                  />
               </div>
               
               {isProfileOpen && (
                 <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-lg py-1 z-50 transform opacity-100 scale-100 transition-all origin-top-right">
                   <div className="px-4 py-2 border-b border-white/40 dark:border-white/10">
                     <p className="text-sm font-medium text-neutral-900 dark:text-white">User</p>
                     <p className="text-xs text-neutral-500 truncate">{session?.user?.email || 'user@example.com'}</p>
                   </div>
                   <div className="py-1 border-b border-white/40 dark:border-white/10">
                     <button className="w-full text-left px-4 py-2 hover:bg-white/50 dark:hover:bg-neutral-800/50 flex flex-col items-start gap-1">
                       <div className="flex items-center text-neutral-900 dark:text-neutral-300 text-sm font-medium">
                         <CreditCard className="h-4 w-4 mr-2 text-neutral-500" /> Credit
                       </div>
                       <p className="text-xs text-neutral-500">$14.50 available</p>
                     </button>
                     <button className="w-full text-left px-4 py-2 hover:bg-white/50 dark:hover:bg-neutral-800/50 flex flex-col items-start gap-1">
                       <div className="flex items-center text-neutral-900 dark:text-neutral-300 text-sm font-medium">
                         <Cpu className="h-4 w-4 mr-2 text-neutral-500" /> Compute
                       </div>
                       <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 mt-1">
                         <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: '45%' }}></div>
                       </div>
                       <p className="text-[10px] text-neutral-400 mt-0.5">45% of monthly quota</p>
                     </button>
                   </div>
                   <button onClick={() => { setIsProfileOpen(false); navigate('/profile'); }} className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-800/50 flex items-center mt-1">
                     <User className="h-4 w-4 mr-2" /> Profile
                   </button>
                   <button className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-800/50 flex items-center">
                     <Settings className="h-4 w-4 mr-2" /> Team
                   </button>
                   <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-800/50 flex items-center mb-1">
                     <LogOut className="h-4 w-4 mr-2" /> Sign out
                   </button>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
      </div>

      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Settings"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Settings panel is coming soon.</p>
        </div>
      </Modal>
    </>
  );
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { session } = useAppContext();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <>
      <div className="sticky top-0 z-50 flex h-16 flex-shrink-0 border-b border-white/40 dark:border-white/10 bg-white/40 dark:bg-neutral-950/40 backdrop-blur-xl">
        <div className="flex flex-1 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center md:hidden">
            <button
              type="button"
              onClick={onMenuClick}
              className="relative inline-flex items-center justify-center p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-neutral-800 transition-all focus:outline-none"
            >
              <span className="sr-only">Open sidebar</span>
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-1 justify-end items-center">
            <div className="ml-4 flex items-center md:ml-6 space-x-3">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="relative inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/50 dark:bg-neutral-800/50 border border-white/60 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-white/80 dark:hover:bg-neutral-700/50 transition-all shadow-sm backdrop-blur-md"
              title="User Settings"
            >
              <span className="sr-only">Settings</span>
              <Settings className="h-5 w-5 stroke-[1.5]" aria-hidden="true" />
            </button>

            {/* Profile dropdown */}
            <div className="relative ml-1" ref={profileRef}>
               <div 
                 onClick={() => setIsProfileOpen(!isProfileOpen)}
                 className="h-10 w-10 rounded-xl overflow-hidden border border-white/60 dark:border-white/10 bg-white/50 dark:bg-neutral-800/50 shadow-sm backdrop-blur-md p-1 transition-all hover:scale-105 cursor-pointer"
               >
                  <img 
                    src="https://api.dicebear.com/9.x/notionists/svg?seed=Felix&backgroundColor=transparent" 
                    alt="User avatar" 
                    className="h-full w-full object-contain"
                  />
               </div>
               
               {isProfileOpen && (
                 <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-lg py-1 z-50 transform opacity-100 scale-100 transition-all origin-top-right">
                   <div className="px-4 py-2 border-b border-white/40 dark:border-white/10">
                     <p className="text-sm font-medium text-neutral-900 dark:text-white">User</p>
                     <p className="text-xs text-neutral-500 truncate">{session?.user?.email || 'user@example.com'}</p>
                   </div>
                   <div className="py-1 border-b border-white/40 dark:border-white/10">
                     <button className="w-full text-left px-4 py-2 hover:bg-white/50 dark:hover:bg-neutral-800/50 flex flex-col items-start gap-1">
                       <div className="flex items-center text-neutral-900 dark:text-neutral-300 text-sm font-medium">
                         <CreditCard className="h-4 w-4 mr-2 text-neutral-500" /> Credit
                       </div>
                       <p className="text-xs text-neutral-500">$14.50 available</p>
                     </button>
                     <button className="w-full text-left px-4 py-2 hover:bg-white/50 dark:hover:bg-neutral-800/50 flex flex-col items-start gap-1">
                       <div className="flex items-center text-neutral-900 dark:text-neutral-300 text-sm font-medium">
                         <Cpu className="h-4 w-4 mr-2 text-neutral-500" /> Compute
                       </div>
                       <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 mt-1">
                         <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: '45%' }}></div>
                       </div>
                       <p className="text-[10px] text-neutral-400 mt-0.5">45% of monthly quota</p>
                     </button>
                   </div>
                   <button onClick={() => { setIsProfileOpen(false); navigate('/profile'); }} className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-800/50 flex items-center mt-1">
                     <User className="h-4 w-4 mr-2" /> Profile
                   </button>
                   <button className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-800/50 flex items-center">
                     <Settings className="h-4 w-4 mr-2" /> Team
                   </button>
                   <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-800/50 flex items-center mb-1">
                     <LogOut className="h-4 w-4 mr-2" /> Sign out
                   </button>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
      </div>

      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Settings"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Settings panel is coming soon.</p>
        </div>
      </Modal>
    </>
  );
}
