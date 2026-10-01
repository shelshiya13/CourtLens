import React, { useState } from 'react';
import {
  Clock,
  Calendar,
  FileText,
  User,
  Shield,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { formatDate, formatDateTime } from '../../../lib/format.js';
import { EmptyState } from '../../../components/EmptyState.js';

interface TimelineTabProps {
  timeline: {
    activityEvents: any[];
    documentDatedEvents: any[];
  };
  onOpenSourceViewer: (eid: string) => void;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({ timeline, onOpenSourceViewer }) => {
  const [filter, setFilter] = useState<'all' | 'system' | 'lawyer' | 'document'>('all');

  const activityEvents = timeline?.activityEvents || [];
  const documentEvents = timeline?.documentDatedEvents || [];

  const filteredActivity = activityEvents.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'system') return e.actor_type === 'system';
    if (filter === 'lawyer') return e.actor_type === 'lawyer';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="bg-white p-4 border border-[#E4DFD3] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#14213D]">Auditable Case Timeline</h2>
          <p className="text-xs text-[#5C5E66]">
            Immutable record of procedural activity, evidence ingestion, and chronological document events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              filter === 'all'
                ? 'bg-[#14213D] text-white border-[#14213D]'
                : 'bg-white text-[#5C5E66] border-[#E4DFD3] hover:bg-[#FAF7F0]'
            }`}
          >
            All Activity
          </button>
          <button
            onClick={() => setFilter('lawyer')}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              filter === 'lawyer'
                ? 'bg-[#14213D] text-white border-[#14213D]'
                : 'bg-white text-[#5C5E66] border-[#E4DFD3] hover:bg-[#FAF7F0]'
            }`}
          >
            Human Actions
          </button>
          <button
            onClick={() => setFilter('system')}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              filter === 'system'
                ? 'bg-[#14213D] text-white border-[#14213D]'
                : 'bg-white text-[#5C5E66] border-[#E4DFD3] hover:bg-[#FAF7F0]'
            }`}
          >
            System & Agent Events
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Activity Timeline */}
        <div className="lg:col-span-2 bg-white border border-[#E4DFD3] rounded p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5C5E66] pb-2 border-b border-[#E4DFD3]">
            Procedural & Agent Activity Stream ({filteredActivity.length})
          </h3>

          {filteredActivity.length === 0 ? (
            <EmptyState
              title="No activity events recorded."
              description="Events logged during document ingestion, reviews, and status changes appear here."
              icon={Clock}
            />
          ) : (
            <div className="relative border-l border-[#E4DFD3] ml-3 pl-6 space-y-5">
              {filteredActivity.map(e => {
                const isLawyer = e.actor_type === 'lawyer';
                const isConflict = e.event_type.includes('conflict');
                const isCorrection = e.event_type.includes('corrected');

                return (
                  <div key={e.id} className="relative group text-xs">
                    {/* Circle Node */}
                    <div
                      className={`absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full border-2 bg-white ${
                        isConflict
                          ? 'border-[#9B2C2C] bg-[#FDF2F2]'
                          : isCorrection
                          ? 'border-[#B08D57] bg-[#FAF7F0]'
                          : isLawyer
                          ? 'border-[#14213D]'
                          : 'border-[#5C5E66]'
                      }`}
                    />

                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-[#14213D]">
                          {e.event_type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-[11px] text-[#5C5E66] font-mono">
                          {formatDateTime(e.occurred_at)}
                        </span>
                        {e.guardian_visible === 1 && (
                          <span className="px-1.5 py-0.2 rounded bg-[#F0FDF4] text-[#2F6B4F] text-[10px] border border-[#BCF0DA]">
                            Shared with Client
                          </span>
                        )}
                      </div>

                      <p className="text-[#2B2D33] leading-relaxed">{e.description}</p>

                      <div className="mt-1 flex items-center gap-3 text-[11px] text-[#5C5E66]">
                        <span>Actor: <strong className="font-medium text-[#14213D] capitalize">{e.actor_type}</strong></span>
                        {e.source && <span className="font-mono">Ref: {e.source}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Dated Events Found Inside Documents */}
        <div className="bg-white border border-[#E4DFD3] rounded p-5 space-y-4">
          <div className="pb-2 border-b border-[#E4DFD3]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5C5E66]">
              Chronological Events in Documents
            </h3>
            <span className="text-[11px] text-[#5C5E66]">Extracted from verified date evidence</span>
          </div>

          {documentEvents.length === 0 ? (
            <div className="text-center py-10 text-xs text-[#5C5E66]">
              No dated factual milestones extracted from documents yet.
            </div>
          ) : (
            <div className="space-y-3">
              {documentEvents.map(de => (
                <div
                  key={de.id}
                  onClick={() => onOpenSourceViewer(de.id)}
                  className="p-3 bg-[#FAF7F0] border border-[#E4DFD3] rounded text-xs cursor-pointer hover:border-[#14213D] transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-mono font-bold text-[#14213D]">{formatDate(de.date_value)}</span>
                    <span className="font-mono text-[#B08D57] font-semibold">{de.evidence_ref}</span>
                  </div>
                  <div className="font-medium text-[#2B2D33]">{de.fact_label}</div>
                  <p className="text-[#5C5E66] text-[11px] mt-1 line-clamp-2 italic">
                    "{de.source_quote}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
