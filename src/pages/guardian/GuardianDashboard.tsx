import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, FileText, Clock, ArrowRight, ShieldCheck, Landmark } from 'lucide-react';
import { apiRequest } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';
import { EmptyState } from '../../components/EmptyState.js';

export const GuardianDashboard: React.FC = () => {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await apiRequest<{ cases: any[] }>('/api/dashboard/guardian');
        setCases(res.cases || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCases();
  }, []);

  if (loading) {
    return <div className="text-center py-16 text-xs text-[#5C5E66]">Loading your legal matters...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-[#E4DFD3]">
        <h1 className="font-legal-heading text-2xl font-bold text-[#14213D]">
          Your Legal Matters
        </h1>
        <p className="text-xs text-[#5C5E66] mt-0.5">
          Review court hearing schedules and documents shared by your legal counsel.
        </p>
      </div>

      {cases.length === 0 ? (
        <EmptyState
          title="No cases are linked to this identifier."
          description="If you are expecting case access, please contact your lawyer to link your email address or mobile number."
          icon={Landmark}
        />
      ) : (
        <div className="space-y-4">
          {cases.map(c => (
            <div
              key={c.id}
              className="bg-white border border-[#E4DFD3] rounded-md p-6 shadow-sm hover:border-[#14213D] transition-all card-brass-top space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E4DFD3]">
                <div>
                  <h2 className="font-legal-heading text-lg font-bold text-[#14213D]">
                    {c.displayTitle}
                  </h2>
                  <div className="text-xs text-[#5C5E66] mt-0.5 flex items-center gap-2">
                    <span>{c.court || 'Court Proceedings'}</span>
                    <span>·</span>
                    <span>Role: <strong>{c.relationship}</strong></span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded bg-[#FAF7F0] border border-[#E4DFD3] text-xs font-semibold text-[#14213D]">
                    {c.plainStatus}
                  </span>
                </div>
              </div>

              {/* Hearing Notification Banner (Only if scheduled) */}
              {c.hasUpcomingHearing && (
                <div className="p-4 bg-[#FEFCE8] border border-[#FCE96A] rounded-md flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-[#B7791F] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="text-[#B7791F] font-bold block text-sm">Upcoming Court Hearing</strong>
                    <p className="text-[#2B2D33] mt-0.5">
                      The case has a hearing scheduled on <strong>{formatDate(c.nextHearingAt)}</strong> ({c.nextHearingType || 'General Hearing'}).
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-[#5C5E66]">
                  Last status update: {formatDate(c.updatedAt)}
                </span>

                <Link
                  to={`/guardian/cases/${c.id}`}
                  className="px-4 py-2 bg-[#14213D] hover:bg-[#1E2D4A] text-white rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>View Case Documents</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
