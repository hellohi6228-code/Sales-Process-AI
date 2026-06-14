import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';
import { X } from 'lucide-react';

// SVG Icons styled to look minimalistic and clean (Notion-esque)
const ExecutiveIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);

const SalesIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const MarketingIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const navigation = [
  { name: 'Executive', href: '/', icon: ExecutiveIcon },
  { name: 'Lead', href: '/lead', icon: SalesIcon },
  { name: 'Process', href: '/process', icon: MarketingIcon },
];

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const SidebarContent = () => (
    <>
      <div className="flex h-16 items-center flex-shrink-0 px-4 border-b border-white/40 dark:border-white/10">
        {/* Empty space where Platform icon used to be */}
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
        <nav className="flex-1 space-y-1 px-3">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => {
                if (onClose) onClose();
              }}
              className={({ isActive }) =>
                cn(
                  isActive
                    ? 'bg-white/80 dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-100 shadow-sm border border-white/60 dark:border-white/10'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-white/50 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-neutral-100',
                  'group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all'
                )
              }
            >
              <item.icon
                className="mr-3 h-5 w-5 flex-shrink-0 opacity-80"
                aria-hidden="true"
              />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      {isOpen && (
        <div className="relative z-50 md:hidden">
          {/* Mobile backdrop */}
          <div 
            className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />

          <div className="fixed inset-0 flex">
            <div className="relative flex w-full max-w-xs flex-1 flex-col bg-[#f8fafc] dark:bg-[#09090b] shadow-2xl">
              <div className="absolute right-0 top-0 -mr-12 pt-2">
                <button
                  type="button"
                  className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none"
                  onClick={onClose}
                >
                  <span className="sr-only">Close sidebar</span>
                  <X className="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>
              <SidebarContent />
            </div>
            <div className="w-14 flex-shrink-0" aria-hidden="true">
              {/* Force sidebar to shrink to fit close icon */}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col border-r border-white/40 dark:border-white/10 bg-white/40 dark:bg-neutral-950/40 backdrop-blur-xl relative z-20">
        <SidebarContent />
      </div>
    </>
  );
}
