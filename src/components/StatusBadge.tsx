import React from 'react';
import {
  AlertTriangle,
  FileQuestion,
  CheckCircle2,
  Clock,
  UserCheck,
  FileText,
  Lock,
  Loader2
} from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', size = 'md' }) => {
  const isSm = size === 'sm';
  const pad = isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  switch (status) {
    case 'Conflict Detected':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded bg-[#FDF2F2] text-[#9B2C2C] border border-[#F8B4B4] ${pad} ${className}`}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#9B2C2C]" />
          <span>Conflict Detected</span>
        </span>
      );

    case 'Missing Evidence':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded bg-[#FEFCE8] text-[#B7791F] border border-[#FCE96A] ${pad} ${className}`}>
          <FileQuestion className="w-3.5 h-3.5 shrink-0 text-[#B7791F]" />
          <span>Missing Evidence</span>
        </span>
      );

    case 'Human Review':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA] ${pad} ${className}`}>
          <UserCheck className="w-3.5 h-3.5 shrink-0 text-[#C2410C]" />
          <span>Human Review</span>
        </span>
      );

    case 'Decision/Assessment Generated':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded bg-[#F0FDF4] text-[#2F6B4F] border border-[#BCF0DA] ${pad} ${className}`}>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#2F6B4F]" />
          <span>Assessment Generated</span>
        </span>
      );

    case 'Under Analysis':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded bg-[#F1F5F9] text-[#1E293B] border border-[#CBD5E1] ${pad} ${className}`}>
          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-[#1E293B]" />
          <span>Under Analysis</span>
        </span>
      );

    case 'Evidence Review':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0] ${pad} ${className}`}>
          <FileText className="w-3.5 h-3.5 shrink-0 text-[#475569]" />
          <span>Evidence Review</span>
        </span>
      );

    case 'Closed':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1] ${pad} ${className}`}>
          <Lock className="w-3.5 h-3.5 shrink-0 text-[#64748B]" />
          <span>Closed</span>
        </span>
      );

    case 'New':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 rounded bg-[#F8FAFC] text-[#334155] border border-[#E2E8F0] ${pad} ${className}`}>
          <Clock className="w-3.5 h-3.5 shrink-0 text-[#334155]" />
          <span>{status || 'New'}</span>
        </span>
      );
  }
};
