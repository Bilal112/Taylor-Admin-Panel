'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import clsx from 'clsx';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['super_admin', 'admin'] },
  { href: '/orders', label: 'Orders', icon: '📋', roles: ['super_admin', 'admin', 'cutting_master', 'stitcher', 'presser', 'stock_manager'] },
  { href: '/customers', label: 'Customers', icon: '👤', roles: ['super_admin', 'admin'] },
  { href: '/staff', label: 'Staff', icon: '👷', roles: ['super_admin', 'admin'] },
  { href: '/branches', label: 'Branches', icon: '🏪', roles: ['super_admin'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => { logout(); router.push('/login'); };

  const allowed = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-xl font-bold text-primary">✂️ Hafiz Tailor</h1>
        <p className="text-xs text-gray-400 mt-1">{user?.branch?.name || 'All Branches'}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {allowed.map(item => (
          <Link key={item.href} href={item.href}
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
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-secondary w-full text-sm">Sign Out</button>
      </div>
    </aside>
  );
}
