import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  Scale,
  Briefcase,
  FileText,
  AlertTriangle,
  FileQuestion,
  Cpu,
  History,
  Clock,
  UserCheck,
  Settings,
  ArrowLeft,
  Play,
  Lock,
  Loader2,
  Calendar
} from 'lucide-react';
import { apiRequest } from '../../lib/api.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { DemoBadge } from '../../components/DemoBadge.js';
import { formatDate } from '../../lib/format.js';
import { SourceViewerModal } from '../../components/SourceViewerModal.js';

// Tabs
import { OverviewTab } from './tabs/OverviewTab.js';
import { EvidenceTab } from './tabs/EvidenceTab.js';
import { ConflictsTab } from './tabs/ConflictsTab.js';
import { MissingEvidenceTab } from './tabs/MissingEvidenceTab.js';
import { AiReasoningTab } from './tabs/AiReasoningTab.js';
import { TimelineTab } from './tabs/TimelineTab.js';
import { EvolutionTab } from './tabs/EvolutionTab.js';
import { DocumentsTab } from './tabs/DocumentsTab.js';
import { HumanReviewTab } from './tabs/HumanReviewTab.js';
import { CaseDetailsTab } from './tabs/CaseDetailsTab.js';

export const CaseWorkspace: React.FC = () => {
  const { id: caseId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';

  const [caseData, setCaseData] = useState<any | null>(null);
  const [parties, setParties] = useState<any[]>([]);
  const [counts, setCounts] = useState({ documents: 0, evidence: 0, conflicts: 0, missing: 0 });
  const [latestAnalysis, setLatestAnalysis] = useState<any | null>(null);

  // Tab specific data
  const [documents, setDocuments] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [missingEvidence, setMissingEvidence] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<{ activityEvents: any[]; documentDatedEvents: any[] }>({
    activityEvents: [],
    documentDatedEvents: []
  });
  const [agentState, setAgentState] = useState<any | null>(null);
  const [adapterName, setAdapterName] = useState<string>('local');

  const [loading, setLoading] = useState(true);
  const [analysisRunning, setAnalysisRunning] = useState(false);

  // Source Viewer Modal
  const [sourceViewerEid, setSourceViewerEid] = useState<string | null>(null);
  const [sourceViewerDocId, setSourceViewerDocId] = useState<string | null>(null);

  const fetchCaseCore = async () => {
    if (!caseId) return;
    try {
      const res = await apiRequest(`/api/cases/${caseId}`);
      setCaseData(res.case);
      setParties(res.parties || []);
      setCounts(res.counts || { documents: 0, evidence: 0, conflicts: 0, missing: 0 });
      setLatestAnalysis(res.latestAnalysis);
    } catch (err) {
      console.error('Failed to load case data:', err);
    }
  };

  const fetchTabData = async () => {
    if (!caseId) return;
    try {
      if (currentTab === 'overview' || currentTab === 'documents') {
        const dRes = await apiRequest(`/api/cases/${caseId}/documents`);
        setDocuments(dRes.documents || []);
      }
      if (currentTab === 'overview' || currentTab === 'evidence' || currentTab === 'reasoning' || currentTab === 'review') {
        const eRes = await apiRequest(`/api/cases/${caseId}/evidence`);
        setEvidence(eRes.evidence || []);
      }
      if (currentTab === 'overview' || currentTab === 'conflicts' || currentTab === 'review') {
        const cRes = await apiRequest(`/api/cases/${caseId}/conflicts`);
        setConflicts(cRes.conflicts || []);
      }
      if (currentTab === 'overview' || currentTab === 'missing' || currentTab === 'review') {
        const mRes = await apiRequest(`/api/cases/${caseId}/missing-evidence`);
        setMissingEvidence(mRes.missingEvidence || []);
      }
      if (currentTab === 'overview' || currentTab === 'reasoning' || currentTab === 'evolution') {
        const vRes = await apiRequest(`/api/cases/${caseId}/analysis/versions`);
        setVersions(vRes.versions || []);
      }
      if (currentTab === 'timeline') {
        const tRes = await apiRequest(`/api/cases/${caseId}/timeline`);
        setTimeline(tRes);
      }
      if (currentTab === 'evolution') {
        const sRes = await apiRequest(`/api/cases/${caseId}/agent-state`);
        setAgentState(sRes.caseState);
        setAdapterName(sRes.adapterName);
      }
    } catch (err) {
      console.error('Failed to fetch tab data:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchCaseCore();
      await fetchTabData();
      setLoading(false);
    };
    init();
  }, [caseId, currentTab]);

  const handleTabChange = (tabKey: string) => {
    setSearchParams({ tab: tabKey });
  };

  const handleRunAnalysis = async () => {
    if (!caseId || analysisRunning) return;
    setAnalysisRunning(true);
    try {
      await apiRequest(`/api/cases/${caseId}/analysis/run`, { method: 'POST' });
      await fetchCaseCore();
      await fetchTabData();
    } catch (err: any) {
      alert(err.message || 'Analysis run failed');
    } finally {
      setAnalysisRunning(false);
    }
  };

  const handleCloseCase = async () => {
    if (!caseId) return;
    const reason = prompt('Provide the legal or settlement reason for closing this matter:');
    if (!reason || reason.trim().length === 0) return;

    try {
      await apiRequest(`/api/cases/${caseId}/close`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() })
      });
      await fetchCaseCore();
    } catch (err: any) {
      alert(err.message || 'Failed to close case');
    }
  };

  if (loading && !caseData) {
    return (
      <div className="p-12 text-center text-xs text-[#5C5E66]">
        Opening case evidence workspace...
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="p-12 text-center text-xs text-[#5C5E66]">
        Case not found or access unauthorized.
      </div>
    );
  }

  const isClosed = Boolean(caseData.closed_at);

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Briefcase },
    { key: 'evidence', label: 'Evidence', icon: Scale, count: counts.evidence },
    { key: 'conflicts', label: 'Conflicts', icon: AlertTriangle, count: counts.conflicts, alert: counts.conflicts > 0 },
    { key: 'missing', label: 'Missing Evidence', icon: FileQuestion, count: counts.missing, alert: counts.missing > 0 },
    { key: 'reasoning', label: 'AI Reasoning', icon: Scale },
    { key: 'timeline', label: 'Timeline', icon: Clock },
    { key: 'evolution', label: 'Case Evolution', icon: History },
    { key: 'documents', label: 'Documents', icon: FileText, count: counts.documents },
    { key: 'review', label: 'Human Review', icon: UserCheck },
    { key: 'details', label: 'Case Details', icon: Settings }
  ];

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky Workspace Header */}
      <div className="sticky top-0 z-30 bg-[#FAF7F0] border-b border-[#E4DFD3] shadow-xs">
        <div className="px-6 py-3 bg-white border-b border-[#E4DFD3]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                to="/lawyer/dashboard"
                className="p-1.5 hover:bg-[#FAF7F0] rounded text-[#5C5E66] hover:text-[#14213D] border border-[#E4DFD3]"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-[#14213D] bg-[#FAF7F0] px-2 py-0.5 rounded border border-[#E4DFD3]">
                    {caseData.case_ref}
                  </span>
                  <h1 className="font-legal-heading text-lg font-bold text-[#14213D] truncate max-w-xl">
                    {caseData.title}
                  </h1>
                  {caseData.is_demo === 1 && <DemoBadge />}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#5C5E66] mt-1">
                  <span>Forum: <strong className="text-[#2B2D33]">{caseData.court || '—'}</strong></span>
                  <span>·</span>
                  <span>Suit No: <strong className="font-mono text-[#2B2D33]">{caseData.case_number || '—'}</strong></span>
                  {caseData.next_hearing_at && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-[#14213D] font-medium">
                        <Calendar className="w-3.5 h-3.5 text-[#B08D57]" />
                        <span>Next Hearing: {formatDate(caseData.next_hearing_at)}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Status & Run Analysis Action */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <StatusBadge status={caseData.status} />
                <span className="text-[10px] text-[#5C5E66] mt-0.5">
                  Persistent state: {adapterName === 'omega' ? 'Omega (connected)' : 'Local store (Omega not configured)'}
                </span>
              </div>

              {!isClosed && (
                <button
                  onClick={handleRunAnalysis}
                  disabled={counts.evidence === 0 || analysisRunning}
                  className="px-3.5 py-1.5 bg-[#14213D] hover:bg-[#1E2D4A] text-white rounded text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
                  title={counts.evidence === 0 ? 'Upload evidence first to run analysis' : 'Reconcile case state'}
                >
                  {analysisRunning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-[#B08D57]" />
                  )}
                  <span>{analysisRunning ? 'Evaluating...' : 'Run analysis'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="px-6 bg-[#FAF7F0] flex overflow-x-auto no-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = currentTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`py-3 px-3.5 text-xs font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-[#B08D57] text-[#14213D] font-bold bg-white/40'
                    : 'border-transparent text-[#5C5E66] hover:text-[#14213D] hover:border-[#E4DFD3]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#B08D57]' : 'text-[#5C5E66]'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                      tab.alert
                        ? 'bg-[#FDF2F2] text-[#9B2C2C] font-bold'
                        : 'bg-[#FAF7F0] text-[#5C5E66] border border-[#E4DFD3]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {currentTab === 'overview' && (
          <OverviewTab
            caseData={caseData}
            parties={parties}
            counts={counts}
            latestAnalysis={latestAnalysis}
            onSelectTab={handleTabChange}
            onRunAnalysis={handleRunAnalysis}
            onCloseCase={handleCloseCase}
            analysisRunning={analysisRunning}
          />
        )}

        {currentTab === 'evidence' && (
          <EvidenceTab
            caseId={caseId!}
            evidence={evidence}
            isClosed={isClosed}
            onRefresh={() => {
              fetchCaseCore();
              fetchTabData();
            }}
            onOpenSourceViewer={eid => {
              setSourceViewerEid(eid);
              setSourceViewerDocId(null);
            }}
          />
        )}

        {currentTab === 'conflicts' && (
          <ConflictsTab
            caseId={caseId!}
            conflicts={conflicts}
            hasAnalysis={Boolean(latestAnalysis)}
            isClosed={isClosed}
            onRefresh={() => {
              fetchCaseCore();
              fetchTabData();
            }}
            onOpenSourceViewer={eid => {
              setSourceViewerEid(eid);
              setSourceViewerDocId(null);
            }}
          />
        )}

        {currentTab === 'missing' && (
          <MissingEvidenceTab
            caseId={caseId!}
            missingEvidence={missingEvidence}
            hasAnalysis={Boolean(latestAnalysis)}
            isClosed={isClosed}
            onRefresh={() => {
              fetchCaseCore();
              fetchTabData();
            }}
            onOpenSourceViewer={eid => {
              setSourceViewerEid(eid);
              setSourceViewerDocId(null);
            }}
          />
        )}

        {currentTab === 'reasoning' && (
          <AiReasoningTab
            caseId={caseId!}
            versions={versions}
            evidenceList={evidence}
            onOpenSourceViewer={eid => {
              setSourceViewerEid(eid);
              setSourceViewerDocId(null);
            }}
            onSelectTab={handleTabChange}
          />
        )}

        {currentTab === 'timeline' && (
          <TimelineTab
            timeline={timeline}
            onOpenSourceViewer={eid => {
              setSourceViewerEid(eid);
              setSourceViewerDocId(null);
            }}
          />
        )}

        {currentTab === 'evolution' && (
          <EvolutionTab
            caseId={caseId!}
            versions={versions}
            agentState={agentState}
            adapterName={adapterName}
            onRefresh={() => {
              fetchCaseCore();
              fetchTabData();
            }}
          />
        )}

        {currentTab === 'documents' && (
          <DocumentsTab
            caseId={caseId!}
            documents={documents}
            isClosed={isClosed}
            onRefresh={() => {
              fetchCaseCore();
              fetchTabData();
            }}
            onOpenSourceViewer={(eid, docId) => {
              setSourceViewerEid(eid || null);
              setSourceViewerDocId(docId || null);
            }}
          />
        )}

        {currentTab === 'review' && (
          <HumanReviewTab
            caseId={caseId!}
            evidence={evidence}
            conflicts={conflicts}
            latestAnalysis={latestAnalysis}
            isClosed={isClosed}
            onRefresh={() => {
              fetchCaseCore();
              fetchTabData();
            }}
            onOpenSourceViewer={eid => {
              setSourceViewerEid(eid);
              setSourceViewerDocId(null);
            }}
            onSelectTab={handleTabChange}
          />
        )}

        {currentTab === 'details' && (
          <CaseDetailsTab
            caseId={caseId!}
            caseData={caseData}
            parties={parties}
            isClosed={isClosed}
            onRefresh={() => {
              fetchCaseCore();
              fetchTabData();
            }}
          />
        )}
      </div>

      {/* Global Source Viewer Drawer / Modal */}
      {(sourceViewerEid || sourceViewerDocId) && (
        <SourceViewerModal
          evidenceId={sourceViewerEid}
          documentId={sourceViewerDocId}
          onClose={() => {
            setSourceViewerEid(null);
            setSourceViewerDocId(null);
          }}
        />
      )}
    </div>
  );
};
