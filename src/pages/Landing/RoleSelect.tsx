import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, Briefcase, UserCheck, Shield, ArrowRight } from 'lucide-react';

export const RoleSelect: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FAF7F0] flex flex-col justify-between text-[#2B2D33]">
      {/* Top Banner */}
      <header className="py-6 px-4 text-center border-b border-[#E4DFD3] bg-white">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded bg-[#14213D] flex items-center justify-center text-[#B08D57] shadow-sm">
            <Scale className="w-6 h-6" />
          </div>
          <div className="text-left">
            <h1 className="font-legal-heading text-2xl font-bold tracking-tight text-[#14213D]">CaseLens</h1>
            <p className="text-xs text-[#5C5E66] uppercase tracking-wider">Court & Legal Case Intelligence Platform</p>
          </div>
        </div>
      </header>

      {/* Main Role Selection Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 flex flex-col justify-center">
        <div className="text-center mb-10">
          <h2 className="font-legal-heading text-2xl sm:text-3xl text-[#14213D] font-bold">
            Select Your Legal Access Role
          </h2>
          <p className="mt-2 text-sm text-[#5C5E66] max-w-lg mx-auto">
            Choose your portal to access case documents, grounded evidence analytics, and auditable case timelines.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto w-full">
          {/* Lawyer Card */}
          <Link
            to="/auth/lawyer"
            className="group relative bg-white border border-[#E4DFD3] rounded-md p-6 hover:border-[#14213D] hover:shadow-md transition-all flex flex-col justify-between card-brass-top"
          >
            <div>
              <div className="w-12 h-12 rounded bg-[#FAF7F0] border border-[#E4DFD3] flex items-center justify-center text-[#14213D] mb-4 group-hover:bg-[#14213D] group-hover:text-[#B08D57] transition-colors">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="font-legal-heading text-lg font-bold text-[#14213D] group-hover:text-[#B08D57] transition-colors">
                Advocate / Legal Counsel
              </h3>
              <p className="mt-2 text-xs text-[#5C5E66] leading-relaxed">
                Full legal workspace for case management, multi-document evidence extraction, deterministic conflict detection, and human review sign-offs.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E4DFD3] flex items-center justify-between text-xs font-semibold text-[#14213D]">
              <span>Counsel Login & Registration</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#B08D57]" />
            </div>
          </Link>

          {/* Guardian / Individual Card */}
          <Link
            to="/auth/guardian"
            className="group relative bg-white border border-[#E4DFD3] rounded-md p-6 hover:border-[#14213D] hover:shadow-md transition-all flex flex-col justify-between card-brass-top"
          >
            <div>
              <div className="w-12 h-12 rounded bg-[#FAF7F0] border border-[#E4DFD3] flex items-center justify-center text-[#14213D] mb-4 group-hover:bg-[#14213D] group-hover:text-[#B08D57] transition-colors">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="font-legal-heading text-lg font-bold text-[#14213D] group-hover:text-[#B08D57] transition-colors">
                Guardian / Individual Client
              </h3>
              <p className="mt-2 text-xs text-[#5C5E66] leading-relaxed">
                Simplified, secure portal to view court hearing schedules, authorized case timeline milestones, and documents shared by your lawyer.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E4DFD3] flex items-center justify-between text-xs font-semibold text-[#14213D]">
              <span>OTP Verification Login</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#B08D57]" />
            </div>
          </Link>
        </div>

        <div className="mt-12 text-center text-xs text-[#5C5E66] flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#2F6B4F]" />
          <span>Role-Based Access Control & Immutable Append-Only Audit Logging Active</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[#5C5E66] border-t border-[#E4DFD3] bg-white">
        CaseLens Legal Intelligence Platform · Alpha Build · Dedicated to auditable legal reasoning
      </footer>
    </div>
  );
};
