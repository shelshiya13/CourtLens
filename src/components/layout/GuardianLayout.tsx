import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../../lib/auth.js';

export const GuardianLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] flex flex-col text-[#2B2D33]">
      {/* Top Header */}
      <header className="bg-[#14213D] text-white border-b border-[#1E2D4A] px-4 py-3 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#B08D57] flex items-center justify-center text-[#14213D]">
              <Scale className="w-5 h-5 text-[#14213D]" />
            </div>
            <div>
              <span className="font-legal-heading text-lg font-bold">CaseLens</span>
              <span className="block text-[10px] text-[#E4DFD3]/80 uppercase tracking-wider">Client & Guardian Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:block text-right">
              <span className="block font-medium text-white">{user?.name}</span>
              <span className="block text-[#E4DFD3]/60 font-mono text-[11px]">{user?.email || user?.mobile}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-white/10 rounded text-white/80 hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 sm:py-8">
        {children}
      </main>

      {/* Footer Legal Notice */}
      <footer className="bg-white border-t border-[#E4DFD3] py-4 text-center text-xs text-[#5C5E66] px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[#14213D]">
            <Shield className="w-3.5 h-3.5 text-[#B08D57]" />
            <span>Secure Client Portal</span>
          </div>
          <p>For legal advice or questions about your case record, please contact your attorney directly.</p>
        </div>
      </footer>
    </div>
  );
};
