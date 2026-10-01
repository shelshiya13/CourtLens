import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Calendar,
  FileText,
  Download,
  Clock,
  ArrowLeft,
  ShieldCheck,
  User,
  Landmark
} from 'lucide-react';
import { apiRequest } from '../../lib/api.js';
import { formatDate, formatDateTime, formatBytes } from '../../lib/format.js';
import { EmptyState } from '../../components/EmptyState.js';

export const GuardianCase: React.FC = () => {
  const { id: caseId } = useParams<{ id: string }>();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCase = async () => {
      if (!caseId) return;
      try {
        const res = await apiRequest(`/api/guardian/cases/${caseId}`);
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCase();
  }, [caseId]);

  if (loading) {
    return <div className="text-center py-16 text-xs text-[#5C5E66]">Loading case details...</div>;
  }

  if (!data || !data.case) {
    return (
      <div className="p-8 text-center text-xs text-[#5C5E66]">
        Case matter not found or unauthorized.
      </div>
    );
  }

  const { case: c, sharedDocuments = [], updates = [] } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/guardian/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-[#5C5E66] hover:text-[#14213D] mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Your Matters</span>
        </Link>

        <div className="bg-white p-6 border border-[#E4DFD3] rounded-md card-brass-top space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4DFD3]">
            <div>
              <h1 className="font-legal-heading text-xl font-bold text-[#14213D]">
                {c.title}
              </h1>
              <div className="text-xs text-[#5C5E66] mt-0.5">
                Representing Counsel: <strong className="text-[#2B2D33]">{c.lawyerName}</strong>
              </div>
            </div>

            <span className="px-3 py-1 rounded bg-[#FAF7F0] border border-[#E4DFD3] text-xs font-semibold text-[#14213D]">
              {c.status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-[#5C5E66] block">Court / Forum:</span>
              <span className="font-medium text-[#2B2D33]">{c.court || '—'}</span>
            </div>
            <div>
              <span className="text-[#5C5E66] block">Suit / Case Number:</span>
              <span className="font-mono font-medium text-[#2B2D33]">{c.caseNumber || '—'}</span>
            </div>
            <div>
              <span className="text-[#5C5E66] block">Filing Date:</span>
              <span className="font-medium text-[#2B2D33]">{formatDate(c.filingDate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hearing Banner */}
      {c.hasUpcomingHearing && (
        <div className="p-4 bg-[#FEFCE8] border border-[#FCE96A] rounded-md flex items-start gap-3">
          <Calendar className="w-5 h-5 text-[#B7791F] shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="text-[#B7791F] font-bold text-sm block">Upcoming Hearing Scheduled</strong>
            <p className="text-[#2B2D33] mt-0.5">
              The court has scheduled proceedings on <strong>{formatDate(c.nextHearingAt)}</strong> ({c.nextHearingType || 'Hearing'}). Please consult your attorney if your presence is required.
            </p>
          </div>
        </div>
      )}

      {/* Shared Documents Section */}
      <div className="bg-white p-6 border border-[#E4DFD3] rounded-md space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E4DFD3]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#B08D57]" />
            <h2 className="text-sm font-semibold text-[#14213D]">
              Authorized Case Documents ({sharedDocuments.length})
            </h2>
          </div>
          <span className="text-xs text-[#5C5E66]">Shared by Counsel</span>
        </div>

        {sharedDocuments.length === 0 ? (
          <EmptyState
            title="No documents shared yet."
            description="Documents approved for client view by your lawyer will appear here."
            icon={FileText}
          />
        ) : (
          <div className="divide-y divide-[#E4DFD3]">
            {sharedDocuments.map((d: any) => (
              <div key={d.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-[#14213D] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#B08D57]" />
                    <span>{d.filename}</span>
                  </div>
                  <div className="text-[11px] text-[#5C5E66] font-mono mt-0.5">
                    {formatBytes(d.size_bytes)} · Shared on {formatDate(d.uploaded_at)}
                  </div>
                </div>

                <a
                  href={`/api/documents/file/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#14213D] hover:bg-[#1E2D4A] text-white rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Document</span>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Authorized Timeline Updates */}
      <div className="bg-white p-6 border border-[#E4DFD3] rounded-md space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E4DFD3]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#B08D57]" />
            <h2 className="text-sm font-semibold text-[#14213D]">
              Case Milestones & Procedural Updates
            </h2>
          </div>
        </div>

        {updates.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#5C5E66]">
            No milestone updates have been posted for this matter.
          </div>
        ) : (
          <div className="relative border-l border-[#E4DFD3] ml-3 pl-5 space-y-4 text-xs">
            {updates.map((u: any) => (
              <div key={u.id} className="relative">
                <div className="absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-[#14213D] bg-white" />
                <div className="text-[11px] text-[#5C5E66] font-mono">
                  {formatDateTime(u.occurred_at)}
                </div>
                <div className="text-[#2B2D33] font-medium mt-0.5">{u.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
