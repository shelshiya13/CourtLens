import React, { useState } from 'react';
import { FileQuestion, CheckCircle2, ShieldAlert, ExternalLink, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../../lib/api.js';
import { EmptyState } from '../../../components/EmptyState.js';

interface MissingEvidenceTabProps {
  caseId: string;
  missingEvidence: any[];
  hasAnalysis: boolean;
  isClosed: boolean;
  onRefresh: () => void;
  onOpenSourceViewer: (eid: string) => void;
}

export const MissingEvidenceTab: React.FC<MissingEvidenceTabProps> = ({
  caseId,
  missingEvidence,
  hasAnalysis,
  isClosed,
  onRefresh,
  onOpenSourceViewer
}) => {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dismissTarget, setDismissTarget] = useState<any | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = missingEvidence.filter(m => {
    if (statusFilter === 'ALL') return true;
    return m.status === statusFilter;
  });

  const handleDismiss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dismissTarget || !dismissReason.trim()) return;
    setSubmitting(true);

    try {
      await apiRequest(`/api/missing-evidence/${dismissTarget.id}/dismiss`, {
        method: 'POST',
        body: JSON.stringify({ reason: dismissReason.trim() })
      });
      setDismissTarget(null);
      setDismissReason('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to dismiss missing evidence item');
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasAnalysis && missingEvidence.length === 0) {
    return (
      <EmptyState
        title="Analysis has not been run."
        description="Run analysis to evaluate factual claims against requirement rules (e.g. proof of payment, delivery challans, signed agreements)."
        icon={FileQuestion}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 border border-[#E4DFD3] rounded flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#14213D]">Corroboration & Missing Evidence Registry</h2>
          <p className="text-xs text-[#5C5E66]">
            Every item corresponds to an asserted claim that lacks statutory or contractual corroboration in the uploaded record.
          </p>
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-2.5 py-1 text-xs border border-[#E4DFD3] rounded bg-white focus:outline-none focus:border-[#14213D]"
        >
          <option value="ALL">All Items</option>
          <option value="open">Open Corroboration Gaps</option>
          <option value="satisfied">Satisfied by Records</option>
          <option value="dismissed_by_human">Dismissed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No missing evidence items identified."
          description="All claims identified in documents currently possess corroborating evidence in the record."
          icon={CheckCircle2}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(m => {
            const isOpen = m.status === 'open';
            const isSatisfied = m.status === 'satisfied';

            return (
              <div
                key={m.id}
                className={`bg-white border rounded p-5 space-y-3 ${
                  isOpen
                    ? 'border-[#FCE96A] bg-white card-brass-top'
                    : 'border-[#E4DFD3] bg-[#FAF7F0]/40 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#E4DFD3]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#B7791F] bg-[#FEFCE8] border border-[#FCE96A] px-2 py-0.5 rounded">
                      {m.missing_ref}
                    </span>
                    <h3 className="text-sm font-bold text-[#14213D]">
                      {m.required_item}
                    </h3>
                  </div>

                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                      isOpen
                        ? 'bg-[#FEFCE8] text-[#B7791F] border border-[#FCE96A]'
                        : isSatisfied
                        ? 'bg-[#F0FDF4] text-[#2F6B4F] border border-[#BCF0DA]'
                        : 'bg-[#F1F5F9] text-[#64748B]'
                    }`}
                  >
                    {m.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="text-xs space-y-2">
                  <div className="p-3 bg-[#FAF7F0] border border-[#E4DFD3] rounded">
                    <span className="font-semibold text-[#2B2D33] block mb-1">Audit Rationale:</span>
                    <p className="text-[#5C5E66] leading-relaxed">{m.rationale}</p>
                  </div>

                  {m.basis_evidence_ids && m.basis_evidence_ids.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[#5C5E66]">Claim Basis:</span>
                      {m.basis_evidence_ids.map((bid: string) => (
                        <button
                          key={bid}
                          onClick={() => onOpenSourceViewer(bid)}
                          className="px-2 py-0.5 rounded bg-white border border-[#E4DFD3] hover:border-[#14213D] text-[#14213D] font-mono text-[11px] inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Evidence {bid.slice(0, 8)}</span>
                          <ExternalLink className="w-3 h-3 text-[#B08D57]" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {isOpen && !isClosed && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => setDismissTarget(m)}
                      className="px-3 py-1 text-xs border border-[#E4DFD3] hover:bg-[#FAF7F0] text-[#5C5E66] rounded transition-colors"
                    >
                      Dismiss Requirement...
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dismiss Modal */}
      {dismissTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-[#E4DFD3] shadow-2xl max-w-md w-full p-6 space-y-4 card-brass-top">
            <h3 className="font-legal-heading text-base font-bold text-[#14213D]">
              Dismiss Corroboration Requirement
            </h3>
            <p className="text-xs text-[#5C5E66]">
              Provide counsel rationale for dismissing {dismissTarget.missing_ref} ({dismissTarget.required_item}):
            </p>

            <form onSubmit={handleDismiss} className="space-y-3.5 text-xs">
              <textarea
                required
                rows={3}
                value={dismissReason}
                onChange={e => setDismissReason(e.target.value)}
                placeholder="e.g., Factual point conceded in opposing party's pleadings or admitted during interrogatories..."
                className="w-full px-2.5 py-1.5 border border-[#E4DFD3] rounded bg-white focus:outline-none focus:border-[#14213D]"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDismissTarget(null)}
                  className="px-3 py-1.5 border border-[#E4DFD3] rounded hover:bg-[#FAF7F0] text-[#5C5E66]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#14213D] text-white rounded font-medium hover:bg-[#1E2D4A] disabled:opacity-50"
                >
                  {submitting ? 'Dismissing...' : 'Confirm Dismissal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
