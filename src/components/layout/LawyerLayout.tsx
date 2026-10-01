import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Scale, LayoutDashboard, Briefcase, PlusCircle, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../lib/auth.js';
import { NotificationBell } from '../NotificationBell.js';

export const LawyerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { label: 'Dashboard', path: '/lawyer/dashboard', icon: LayoutDashboard },
    { label: 'Cases', path: '/lawyer/cases', icon: Briefcase },
    { label: 'New Case', path: '/lawyer/cases/new', icon: PlusCircle },
    { label: 'System & Status', path: '/lawyer/system', icon: Settings }
  ];

  return (
    <div className="min-h-screen flex bg-[#FAF7F0] text-[#2B2D33]">
      {/* Left Sidebar */}
      <aside className="w-64 bg-[#14213D] text-white flex flex-col shrink-0 border-r border-[#1E2D4A]">
        {/* Brand */}
        <div className="p-5 border-b border-white/10">
          <Link to="/lawyer/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#B08D57] flex items-center justify-center text-[#14213D] shadow-sm">
              <Scale className="w-5 h-5 text-[#14213D]" />
            </div>
            <div>
              <span className="font-legal-heading text-lg font-bold tracking-wide">CaseLens</span>
              <span className="block text-[10px] text-[#E4DFD3]/70 uppercase tracking-widest">Evidence Platform</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path || (item.path !== '/lawyer/dashboard' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded transition-colors ${
                  active
                    ? 'bg-[#B08D57] text-[#14213D] font-semibold'
                    : 'text-[#E4DFD3]/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-white/10 bg-[#0E172B]">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <span className="block text-xs font-medium text-white truncate">{user?.name}</span>
              <span className="block text-[11px] text-[#E4DFD3]/60 truncate font-mono">{user?.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 bg-[#14213D] border-b border-[#1E2D4A] px-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-[#B08D57] font-semibold">Counsel Workspace</span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
