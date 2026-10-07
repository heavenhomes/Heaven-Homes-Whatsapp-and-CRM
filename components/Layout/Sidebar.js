"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  LayoutDashboard,
  Users,
  Building2,
  Calendar,
  Home,
  UserPlus,
  Shield,
  Activity,
  LogOut,
  ShieldCheck,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../../lib/auth/useAuth';

export default function Sidebar({ isSidebarOpen, toggleSidebar, isMobile = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isOwner } = useAuth();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Lead Management', path: '/leads', icon: Users },
    { name: 'Property Management', path: '/properties', icon: Building2 },
   
    { name: 'Site Visit Management', path: '/site-visits', icon: Calendar },
    ...(
      isOwner
        ? [{ name: 'Rent Out Property Requests', path: '/rent-out', icon: Home }]
        : []
    ),
    // Owner-only — channel partners don't assign leads
    ...(isOwner
      ? [{ name: 'Lead Assignment', path: '/leads/assign', icon: UserPlus }]
      : []),
    // Owner-only — team management is admin-level
    ...(isOwner
      ? [{ name: 'Manage Team & Role-Based Access', path: '/settings/team', icon: Shield }]
      : []),
    // Owner-only — the scoped world doesn't need partner activity logs here
    ...(isOwner
      ? [{ name: 'Activity Log', path: '/activity-log', icon: Activity }]
      : []),
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Logged out');
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Logout failed');
    }
  };

  const roleLabel = user?.role === 'owner' ? 'Owner' : 'Channel Partner';

  return (
    <>
      {isSidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`
          flex flex-col flex-shrink-0
          bg-[#092b1f] border-r border-[#092b1f] shadow-xl
          transition-all duration-300
          fixed top-0 left-0 z-50 w-72 h-screen
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:sticky md:top-0 md:translate-x-0 md:z-auto md:h-screen
          ${isSidebarOpen ? 'md:w-72' : 'md:w-20'}
        `}
      >
        <div className="py-6 px-4 border-b-2 border-gray-600 flex-shrink-0">
          {isSidebarOpen ? (
            <div className="flex items-center gap-3.5">
              <img
                src="../../../logo-heaven.png"
                alt="Heaven Homes"
                className="w-14 h-14 object-contain flex-shrink-0 border border-white/20 rounded-lg"
              />
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-white font-bold text-xl tracking-wide leading-tight">
                  Heaven Homes
                </span>
                <span className="text-white/60 text-[11px] font-light tracking-wider leading-tight mt-1">
                  Give your dreams a new address
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <img
                src="../../../logo-heaven.png"
                alt="Heaven Homes"
                className="w-11 h-11 object-contain"
              />
            </div>
          )}
        </div>

        {isSidebarOpen && (
          <div className="px-4 pt-4 pb-2 flex-shrink-0">
            <p className="text-white/40 text-[11px] uppercase tracking-wider font-semibold">
              Workspace
            </p>
          </div>
        )}

        <nav className="flex-1 px-3 py-3 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => isMobile && toggleSidebar()}
                className={`flex items-center px-3 py-2 rounded-xl mb-1.5 transition-all duration-200 group ${
                  isActive
                    ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] flex-shrink-0 ${
                    isActive ? 'text-white' : 'text-white/60 group-hover:text-white'
                  }`}
                />
                {isSidebarOpen && (
                  <span className="ml-3 text-sm font-medium truncate">
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-shrink-0 border-t border-gray-600 bg-[#092b1f]">
          {isSidebarOpen ? (
            <div className="p-3 space-y-2.5">
              {user && (
                <div className="flex items-center gap-4 px-3 py-1">
                  <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/20">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-[13px] font-medium truncate leading-tight">
                      {user.name}
                    </p>
                    <p className="text-white/60 text-[10px] uppercase tracking-wider font-semibold leading-tight mt-1">
                      {roleLabel}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-[#fde8e8] hover:text-[#c0392b] text-white/70 border border-white/10 hover:border-[#c0392b]/40 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>

              <p className="text-white/70 text-[10px] text-center font-light tracking-wider pt-0.5">
                Heaven Homes CRM
              </p>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              title="Logout"
              className="w-full flex justify-center py-3 text-white/60 hover:text-[#ff8080] hover:bg-white/5 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}