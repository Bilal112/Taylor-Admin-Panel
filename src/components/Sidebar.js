'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import clsx from 'clsx';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['super_admin', 'admin', 'checker'] },
  { href: '/upcoming-delivery', label: 'Upcoming Delivery', icon: '🚚', roles: ['super_admin', 'admin', 'checker'] },
  { href: '/orders', label: 'Orders', icon: '📋', roles: ['super_admin', 'admin', 'checker', 'cutting_master', 'stitcher', 'presser', 'stock_manager'] },
  { href: '/customers', label: 'Customers', icon: '👤', roles: ['super_admin', 'admin'] },
  { href: '/staff', label: 'Staff', icon: '👷', roles: ['super_admin', 'admin'] },
  { href: '/branches', label: 'Branches', icon: '🏪', roles: ['super_admin'] },
];

// Shared nav content used by both the desktop sidebar and the mobile drawer.
function NavContent({ allowed, pathname, user, onNavigate, handleLogout }) {
  return (
    <>
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-xl font-bold text-primary">✂️ Hafiz Tailor</h1>
        <p className="text-xs text-gray-400 mt-1">{user?.branch?.name || 'All Branches'}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {allowed.map(item => (
          <Link key={item.href} href={item.href} onClick={onNavigate}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-primary-light text-primary'
                : 'text-gray-600 hover:bg-gray-50'
            )}>
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-secondary w-full text-sm">Sign Out</button>
      </div>
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); router.push('/login'); };

  const allowed = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <>
      {/* Mobile top bar — hamburger + brand, shown below md breakpoint only */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-primary">✂️ Hafiz Tailor</h1>
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
          {user?.name?.[0]?.toUpperCase()}
        </div>
      </header>

      {/* Desktop sidebar — always visible at md and up */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col h-screen sticky top-0 shrink-0">
        <NavContent allowed={allowed} pathname={pathname} user={user} handleLogout={handleLogout} />
      </aside>

      {/* Mobile drawer — slides in from the left, only rendered when open */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white flex flex-col shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-700"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <NavContent
              allowed={allowed} pathname={pathname} user={user} handleLogout={handleLogout}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
