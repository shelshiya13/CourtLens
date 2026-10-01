import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Database,
  Mail,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Server
} from 'lucide-react';
import { apiRequest } from '../../lib/api.js';

export const SystemStatusPage: React.FC = () => {
  const [status, setStatus] = useState<any | null>(null);
  const [demoFiles, setDemoFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const sRes = await apiRequest('/api/system/status');
      setStatus(sRes.status);

      const fRes = await apiRequest('/api/demo/files');
      setDemoFiles(fRes.files || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSeedDemo = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const res = await apiRequest('/api/demo/load', {
        method: 'POST',
        body: JSON.stringify({ force: true })
      });
      setSeedMessage(`Demo case created successfully (${res.caseRef}). Credentials: ${res.lawyerCredentials?.email}`);
      await loadData();
    } catch (err: any) {
      setSeedMessage(`Error: ${err.message || 'Failed to seed demo case'}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="pb-4 border-b border-[#E4DFD3]">
        <h1 className="font-legal-heading text-2xl font-bold text-[#14213D]">
          System Integrations & Verification
        </h1>
        <p className="text-xs text-[#5C5E66] mt-0.5">
          Real-time status of server-side intelligence engines, persistent memory adapters, and test exhibits.
        </p>
      </div>

      {/* Integration Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gemini */}
        <div className="bg-white p-5 border border-[#E4DFD3] rounded card-brass-top space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#14213D]">Google Gemini API</span>
            {status?.gemini?.configured ? (
              <span className="px-2 py-0.5 bg-[#F0FDF4] text-[#2F6B4F] text-[10px] font-bold rounded border border-[#BCF0DA]">
                ACTIVE
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-[#FEFCE8] text-[#B7791F] text-[10px] font-bold rounded border border-[#FCE96A]">
                FALLBACK ENGINE
              </span>
            )}
          </div>
          <div className="text-xs text-[#5C5E66] space-y-1">
            <div>Model: <strong className="font-mono text-[#14213D]">{status?.gemini?.model}</strong></div>
            <div>Status: <span className="font-medium text-[#2B2D33]">{status?.gemini?.status}</span></div>
          </div>
          <p className="text-[11px] text-[#5C5E66] pt-2 border-t border-[#E4DFD3]">
            Executes structured schema fact extraction, multimodal scanned PDF transcription, and legal reconciliation.
          </p>
        </div>

        {/* Omega */}
        <div className="bg-white p-5 border border-[#E4DFD3] rounded card-brass-top space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#14213D]">Agent State (Omega)</span>
            {status?.omega?.configured ? (
              <span className="px-2 py-0.5 bg-[#F0FDF4] text-[#2F6B4F] text-[10px] font-bold rounded border border-[#BCF0DA]">
                CONNECTED
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold rounded border border-[#CBD5E1]">
                LOCAL STORE
              </span>
            )}
          </div>
          <div className="text-xs text-[#5C5E66] space-y-1">
            <div>Backend: <span className="font-medium text-[#2B2D33]">{status?.omega?.status}</span></div>
          </div>
          <p className="text-[11px] text-[#5C5E66] pt-2 border-t border-[#E4DFD3]">
            Maintains persistent case state across sessions and restarts without loss of legal context.
          </p>
        </div>

        {/* OTP Provider */}
        <div className="bg-white p-5 border border-[#E4DFD3] rounded card-brass-top space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#14213D]">Client OTP Dispatcher</span>
            <span className="px-2 py-0.5 bg-[#FAF7F0] text-[#14213D] text-[10px] font-mono font-bold rounded border border-[#E4DFD3]">
              {status?.otp?.provider}
            </span>
          </div>
          <div className="text-xs text-[#5C5E66] space-y-1">
            <div>Mode: <span className="font-medium text-[#2B2D33]">{status?.otp?.description}</span></div>
          </div>
          <p className="text-[11px] text-[#5C5E66] pt-2 border-t border-[#E4DFD3]">
            Generates 6-digit cryptographic verification passcodes for client portal login.
          </p>
        </div>
      </div>

      {/* Demo Exhibit Files Download Center */}
      <div className="bg-white p-5 border border-[#E4DFD3] rounded card-brass-top space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E4DFD3]">
          <div>
            <h2 className="text-sm font-semibold text-[#14213D]">
              Demo Case Exhibit Documents (Live Testing Kit)
            </h2>
            <p className="text-xs text-[#5C5E66]">
              Download these real files to test the live document intelligence, conflict detection, and reconciliation workflow.
            </p>
          </div>

          <button
            onClick={handleSeedDemo}
            disabled={seeding}
            className="px-3.5 py-1.5 text-xs font-semibold bg-[#B08D57] hover:bg-[#9B7743] text-white rounded shadow-sm transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{seeding ? 'Seeding...' : 'Reset / Seed DEMO CASE'}</span>
          </button>
        </div>

        {seedMessage && (
          <div className="p-3 bg-[#FAF7F0] border border-[#E4DFD3] rounded text-xs text-[#14213D] font-mono">
            {seedMessage}
          </div>
        )}

        <div className="divide-y divide-[#E4DFD3]">
          {demoFiles.map(f => (
            <div key={f.filename} className="py-3 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#B08D57]" />
                  <span className="font-mono font-bold text-[#14213D]">{f.filename}</span>
                  <span className="text-[10px] text-[#5C5E66] font-mono">({(f.size / 1024).toFixed(1)} KB)</span>
                </div>
                <p className="text-[11px] text-[#5C5E66]">{f.description}</p>
              </div>

              <a
                href={`/api/demo/files/${f.filename}`}
                download
                className="px-3 py-1 bg-white hover:bg-[#FAF7F0] border border-[#E4DFD3] text-[#14213D] rounded font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>Download</span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
