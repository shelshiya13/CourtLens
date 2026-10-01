import React from 'react';
import { LucideIcon, FileText } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = FileText,
  actionLabel,
  onAction,
  className = ''
}) => {
  return (
    <div className={`p-8 text-center bg-white border border-[#E4DFD3] rounded-md ${className}`}>
      <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center rounded-full bg-[#FAF7F0] border border-[#E4DFD3] text-[#5C5E66]">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-medium text-[#2B2D33]">{title}</h3>
      {description && <p className="mt-1 text-sm text-[#5C5E66] max-w-md mx-auto">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-3.5 py-1.5 text-xs font-medium bg-[#14213D] text-white rounded hover:bg-[#1E2D4A] transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
