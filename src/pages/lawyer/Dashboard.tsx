import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  AlertTriangle,
  FileQuestion,
  UserCheck,
  PlusCircle,
  Calendar,
  Clock,
  Search,
  Database,
  Filter,
  ArrowRight,
  Sparkles,
  FileText
} from 'lucide-react';
import { apiRequest } from '../../lib/api.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { EmptyState } from '../../components/EmptyState.js';
import { DemoBadge } from '../../components/DemoBadge.js';
import { formatDate, formatDateTime } from '../../lib/format.js';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [conflictOnly, setConflictOnly] = useState(false);
  const navigate = useNavigate();

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/api/dashboard/lawyer');
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleLoadDemo = async () => {
    try {
      setLoadingDemo(true);
      const res = await apiRequest('/api/demo/load', { method: 'POST' });
      await loadDashboard();
      if (res.caseId) {
        navigate(`/lawyer/cases/${res.caseId}`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to seed demo case');
    } finally {
      setLoadingDemo(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-xs text-[#5C5E66]">
        Loading case management metrics...
      </div>
    );
  }

  const summary = data?.summary || {
    activeCases: 0,
    pendingCases: 0,
    casesWithConflicts: 0,
    casesWithMissingEvidence: 0,
    casesAwaitingReview: 0,
    totalCases: 0
  };

  const cases: any[] = data?.recentlyUpdatedCases || [];
  const upcomingHearings: any[] = data?.upcomingHearings || [];
  const recentEvidence: any[] = data?.recentEvidence || [];
  const statusDist: Record<string, number> = data?.statusDistribution || {};

  const filteredCases = cases.filter(c => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.case_ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.court && c.court.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesConflict = !conflictOnly || c.open_conflicts > 0;

    return matchesSearch && matchesStatus && matchesConflict;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4DFD3]">
        <div>
          <h1 className="font-legal-heading text-2xl font-bold text-[#14213D]">Counsel Dashboard</h1>
          <p className="text-xs text-[#5C5E66] mt-0.5">
            Active Legal Matters & Live Evidence Metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          {summary.totalCases === 0 && (
            <button
              onClick={handleLoadDemo}
              disabled={loadingDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#B08D57] hover:bg-[#9B7743] text-white rounded shadow-sm transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{loadingDemo ? 'Seeding Demo Case...' : 'Load DEMO CASE'}</span>
            </button>
          )}

          <Link
            to="/lawyer/cases/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#14213D] hover:bg-[#1E2D4A] text-white rounded shadow-sm transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Case</span>
          </Link>
        </div>
      </div>

      {/* 1. Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 border border-[#E4DFD3] rounded card-brass-top">
          <div className="text-[11px] uppercase tracking-wider text-[#5C5E66] font-semibold">Active Cases</div>
          <div className="mt-2 text-2xl font-mono font-bold text-[#14213D]">{summary.activeCases}</div>
          <div className="text-[10px] text-[#5C5E66] mt-1">Matters currently open</div>
        </div>

        <div className="bg-white p-4 border border-[#E4DFD3] rounded card-brass-top">
          <div className="text-[11px] uppercase tracking-wider text-[#5C5E66] font-semibold">Pending / New</div>
          <div className="mt-2 text-2xl font-mono font-bold text-[#14213D]">{summary.pendingCases}</div>
          <div className="text-[10px] text-[#5C5E66] mt-1">Awaiting initial upload</div>
        </div>

        <div className="bg-white p-4 border border-[#E4DFD3] rounded card-brass-top">
          <div className="text-[11px] uppercase tracking-wider text-[#9B2C2C] font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>With Conflicts</span>
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-[#9B2C2C]">{summary.casesWithConflicts}</div>
          <div className="text-[10px] text-[#5C5E66] mt-1">Inconsistencies detected</div>
        </div>

        <div className="bg-white p-4 border border-[#E4DFD3] rounded card-brass-top">
          <div className="text-[11px] uppercase tracking-wider text-[#B7791F] font-semibold flex items-center gap-1">
            <FileQuestion className="w-3.5 h-3.5" />
            <span>Missing Evidence</span>
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-[#B7791F]">{summary.casesWithMissingEvidence}</div>
          <div className="text-[10px] text-[#5C5E66] mt-1">Uncorroborated claims</div>
        </div>

        <div className="bg-white p-4 border border-[#E4DFD3] rounded card-brass-top">
          <div className="text-[11px] uppercase tracking-wider text-[#475569] font-semibold flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Awaiting Review</span>
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-[#14213D]">{summary.casesAwaitingReview}</div>
          <div className="text-[10px] text-[#5C5E66] mt-1">Human counsel queue</div>
        </div>
      </div>

      {/* Grid: Upcoming Hearings + Case Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Upcoming Hearings */}
        <div className="lg:col-span-2 bg-white border border-[#E4DFD3] rounded p-5">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E4DFD3]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#B08D57]" />
              <h2 className="text-sm font-semibold text-[#14213D]">Upcoming Court Hearings</h2>
            </div>
            <span className="text-xs text-[#5C5E66] font-mono">{upcomingHearings.length} scheduled</span>
          </div>

          {upcomingHearings.length === 0 ? (
            <EmptyState
              title="No upcoming hearings"
              description="Hearings scheduled in active cases will appear here."
              icon={Calendar}
            />
          ) : (
            <div className="divide-y divide-[#E4DFD3]">
              {upcomingHearings.map(h => {
                const hearingDate = new Date(h.next_hearing_at);
                const isWithin48h = hearingDate.getTime() - Date.now() < 48 * 60 * 60 * 1000 && hearingDate.getTime() > Date.now();

                return (
                  <div key={h.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/lawyer/cases/${h.id}`}
                          className="font-mono font-semibold text-[#14213D] hover:underline"
                        >
                          {h.case_ref}
                        </Link>
                        <span className="text-[#2B2D33] font-medium">{h.title}</span>
                      </div>
                      <div className="text-[#5C5E66] mt-0.5 flex items-center gap-2">
                        <span>{h.next_hearing_type || 'General Hearing'}</span>
                        {isWithin48h && (
                          <span className="px-1.5 py-0.2 bg-[#FEFCE8] text-[#B7791F] border border-[#FCE96A] rounded text-[10px] font-semibold">
                            Within 48h
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[#14213D] font-semibold">{formatDate(h.next_hearing_at)}</div>
                      <StatusBadge status={h.status} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Status Distribution */}
        <div className="bg-white border border-[#E4DFD3] rounded p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E4DFD3]">
              <h2 className="text-sm font-semibold text-[#14213D]">Status Distribution</h2>
              <span className="text-xs text-[#5C5E66] font-mono">{summary.totalCases} total</span>
            </div>

            {summary.totalCases === 0 ? (
              <div className="py-12 text-center text-xs text-[#5C5E66]">No case status data available</div>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(statusDist).map(([st, count]) => {
                  const pct = summary.totalCases > 0 ? (count / summary.totalCases) * 100 : 0;
                  return (
                    <div key={st}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#2B2D33] font-medium">{st}</span>
                        <span className="font-mono text-[#5C5E66]">
                          {count} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#FAF7F0] rounded overflow-hidden border border-[#E4DFD3]">
                        <div
                          className="h-full bg-[#14213D]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#E4DFD3] mt-4 text-[11px] text-[#5C5E66]">
            Case statuses update deterministically based on verified evidence records.
          </div>
        </div>
      </div>

      {/* 4. Recently Added Evidence */}
      <div className="bg-white border border-[#E4DFD3] rounded p-5">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E4DFD3]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#B08D57]" />
            <h2 className="text-sm font-semibold text-[#14213D]">Recently Structured Evidence</h2>
          </div>
          <span className="text-xs text-[#5C5E66] font-mono">Live Grounded Feed</span>
        </div>

        {recentEvidence.length === 0 ? (
          <EmptyState
            title="No evidence uploaded"
            description="Uploaded documents processed by Agent 1 will record structured facts here."
            icon={FileText}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentEvidence.map(e => (
              <div
                key={e.id}
                className="p-3 bg-[#FAF7F0] border border-[#E4DFD3] rounded text-xs hover:border-[#14213D] transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-semibold text-[#14213D]">{e.evidence_ref}</span>
                  <span className="text-[10px] text-[#5C5E66] truncate max-w-[100px]">{e.case_ref}</span>
                </div>
                <div className="font-medium text-[#2B2D33] line-clamp-1">{e.fact_label}</div>
                <p className="text-[11px] text-[#5C5E66] mt-1 line-clamp-2">{e.fact_text}</p>
                <div className="mt-2 pt-1 border-t border-[#E4DFD3]/80 text-[10px] text-[#5C5E66] flex justify-between">
                  <span className="truncate">{e.document_filename}</span>
                  <span>{formatDateTime(e.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Filterable Cases Table */}
      <div className="bg-white border border-[#E4DFD3] rounded p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-[#E4DFD3]">
          <div>
            <h2 className="text-sm font-semibold text-[#14213D]">Case Directory</h2>
            <p className="text-xs text-[#5C5E66]">Filter and access case evidence workspaces</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#5C5E66]" />
              <input
                type="text"
                placeholder="Search case ref, title, court..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs border border-[#E4DFD3] rounded bg-white focus:outline-none focus:border-[#14213D] w-52"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 text-xs border border-[#E4DFD3] rounded bg-white focus:outline-none focus:border-[#14213D]"
            >
              <option value="ALL">All Statuses</option>
              <option value="New">New</option>
              <option value="Under Analysis">Under Analysis</option>
              <option value="Evidence Review">Evidence Review</option>
              <option value="Conflict Detected">Conflict Detected</option>
              <option value="Missing Evidence">Missing Evidence</option>
              <option value="Human Review">Human Review</option>
              <option value="Decision/Assessment Generated">Assessment Generated</option>
              <option value="Closed">Closed</option>
            </select>

            <button
              onClick={() => setConflictOnly(!conflictOnly)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                conflictOnly
                  ? 'bg-[#FDF2F2] border-[#F8B4B4] text-[#9B2C2C] font-semibold'
                  : 'bg-white border-[#E4DFD3] text-[#5C5E66] hover:bg-[#FAF7F0]'
              }`}
            >
              Conflicts Only
            </button>
          </div>
        </div>

        {filteredCases.length === 0 ? (
          <EmptyState
            title="No cases available"
            description={
              searchQuery
                ? 'No cases match your search filters.'
                : 'Get started by creating a new case or loading the demo matter.'
            }
            actionLabel={summary.totalCases === 0 ? 'Load DEMO CASE' : undefined}
            onAction={summary.totalCases === 0 ? handleLoadDemo : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7F0] border-b border-[#E4DFD3] text-[#5C5E66] uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Case ID</th>
                  <th className="py-2.5 px-3">Case Title</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Court / Number</th>
                  <th className="py-2.5 px-3 text-center">Docs</th>
                  <th className="py-2.5 px-3 text-center">Conflicts</th>
                  <th className="py-2.5 px-3 text-center">Missing</th>
                  <th className="py-2.5 px-3 text-right">Updated</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4DFD3]">
                {filteredCases.map(c => (
                  <tr key={c.id} className="hover:bg-[#FAF7F0]/60 transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-[#14213D]">
                      {c.case_ref}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-[#2B2D33] flex items-center gap-1.5">
                        <Link to={`/lawyer/cases/${c.id}`} className="hover:underline">
                          {c.title}
                        </Link>
                        {c.is_demo === 1 && <DemoBadge />}
                      </div>
                      <div className="text-[11px] text-[#5C5E66]">{c.case_type}</div>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={c.status} size="sm" />
                    </td>
                    <td className="py-3 px-3 text-[#5C5E66]">
                      <div>{c.court || '—'}</div>
                      <div className="font-mono text-[10px]">{c.case_number || ''}</div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">{c.document_count || 0}</td>
                    <td className="py-3 px-3 text-center font-mono">
                      {c.open_conflicts > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-[#FDF2F2] text-[#9B2C2C] font-semibold">
                          {c.open_conflicts}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {c.open_missing > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-[#FEFCE8] text-[#B7791F] font-semibold">
                          {c.open_missing}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-[#5C5E66] font-mono text-[11px]">
                      {formatDateTime(c.updated_at)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/lawyer/cases/${c.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-[#14213D] text-white rounded hover:bg-[#1E2D4A] transition-colors"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
