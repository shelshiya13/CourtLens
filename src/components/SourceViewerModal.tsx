import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Check, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiRequest } from '../lib/api.js';
import { formatDate, formatCurrency } from '../lib/format.js';

interface SourceViewerModalProps {
  evidenceId: string | null;
  documentId?: string | null;
  onClose: () => void;
  onSelectEvidence?: (eid: string) => void;
}

export const SourceViewerModal: React.FC<SourceViewerModalProps> = ({
  evidenceId,
  documentId: initialDocId,
  onClose
}) => {
  const [evidence, setEvidence] = useState<any | null>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [selectedPageNo, setSelectedPageNo] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'text' | 'original'>('text');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        let docId = initialDocId;
        if (evidenceId) {
          const evRes = await apiRequest<{ evidence: any }>(`/api/evidence/${evidenceId}`);
          if (!isMounted) return;
          setEvidence(evRes.evidence);
          docId = evRes.evidence.document_id;
          setSelectedPageNo(evRes.evidence.page_no || 1);
        }

        if (docId) {
          const pageRes = await apiRequest<{ pages: any[]; document: any }>(`/api/documents/pages/${docId}`);
          if (!isMounted) return;
          setPages(pageRes.pages || []);
        }
      } catch (err) {
        console.error('Failed to load source evidence data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [evidenceId, initialDocId]);

  if (!evidenceId && !initialDocId) return null;

  const currentPage = pages.find(p => p.page_no === selectedPageNo) || pages[0];
  const targetQuote = evidence?.source_quote || '';

  const renderHighlightedText = (fullText: string, quote: string) => {
    if (!fullText) return <p className="text-[#5C5E66] italic">No extracted text available for this page.</p>;
    if (!quote || quote.length < 5) return <pre className="font-mono text-xs whitespace-pre-wrap">{fullText}</pre>;

    const normFull = fullText.toLowerCase();
    const normQuote = quote.toLowerCase();
    const idx = normFull.indexOf(normQuote);

    if (idx === -1) {
      return (
        <div>
          <div className="mb-3 p-2 bg-[#FEFCE8] border border-[#FCE96A] text-[#B7791F] text-xs rounded">
            <strong>Cited Snippet:</strong> "{quote}"
          </div>
          <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-[#2B2D33]">{fullText}</pre>
        </div>
      );
    }

    const before = fullText.slice(0, idx);
    const match = fullText.slice(idx, idx + quote.length);
    const after = fullText.slice(idx + quote.length);

    return (
      <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-[#2B2D33]">
        {before}
        <mark className="bg-[#DFCEB0] text-[#14213D] font-bold px-1 py-0.5 rounded border border-[#B08D57]">
          {match}
        </mark>
        {after}
      </pre>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-md shadow-2xl border border-[#E4DFD3] w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#14213D] text-white flex items-center justify-between border-b border-[#E4DFD3]">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#B08D57]" />
            <div>
              <h2 className="text-sm font-semibold tracking-wide">
                Evidence Source Document Viewer
                {evidence && <span className="ml-2 font-mono text-[#DFCEB0]">[{evidence.evidence_ref}]</span>}
              </h2>
              <p className="text-xs text-[#E4DFD3]/80">
                {evidence?.document_filename || 'Case Document'} · Page {selectedPageNo} of {pages.length || 1}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {evidence?.document_id && (
              <a
                href={`/api/documents/file/${evidence.document_id}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded inline-flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Original File</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 text-white/80 hover:text-white rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Mode Bar */}
        <div className="px-5 py-2 bg-[#FAF7F0] border-b border-[#E4DFD3] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#5C5E66] font-medium">Pages:</span>
            {pages.map(p => (
              <button
                key={p.page_no}
                onClick={() => setSelectedPageNo(p.page_no)}
                className={`px-2 py-0.5 rounded font-mono text-xs ${
                  selectedPageNo === p.page_no
                    ? 'bg-[#14213D] text-white'
                    : 'bg-white text-[#2B2D33] border border-[#E4DFD3] hover:bg-[#F1F5F9]'
                }`}
              >
                Page {p.page_no}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('text')}
              className={`px-2.5 py-1 rounded text-xs ${
                viewMode === 'text' ? 'bg-[#14213D] text-white' : 'bg-white text-[#2B2D33] border border-[#E4DFD3]'
              }`}
            >
              Extracted Grounded Text
            </button>
            <button
              onClick={() => setViewMode('original')}
              className={`px-2.5 py-1 rounded text-xs ${
                viewMode === 'original' ? 'bg-[#14213D] text-white' : 'bg-white text-[#2B2D33] border border-[#E4DFD3]'
              }`}
            >
              Embedded Document File
            </button>
          </div>
        </div>

        {/* Two-Pane Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Document / Extracted Text */}
          <div className="flex-1 p-5 overflow-y-auto bg-[#FAF7F0] border-r border-[#E4DFD3]">
            {loading ? (
              <div className="text-center py-16 text-sm text-[#5C5E66]">Loading source pages...</div>
            ) : viewMode === 'text' ? (
              <div className="bg-white p-5 rounded border border-[#E4DFD3] shadow-sm">
                <div className="text-xs text-[#5C5E66] mb-3 pb-2 border-b border-[#E4DFD3] flex items-center justify-between">
                  <span>Extraction method: <strong className="font-mono text-[#14213D]">{currentPage?.extraction_method || 'text_layer'}</strong></span>
                  <span className="font-mono">{currentPage?.char_count || 0} characters</span>
                </div>
                {renderHighlightedText(currentPage?.text || '', targetQuote)}
              </div>
            ) : (
              <iframe
                src={`/api/documents/file/${evidence?.document_id}#page=${selectedPageNo}`}
                className="w-full h-full min-h-[500px] border border-[#E4DFD3] rounded bg-white"
                title="Document preview"
              />
            )}
          </div>

          {/* Right Pane: Structured Evidence Fact Sheet */}
          <div className="w-80 lg:w-96 p-5 overflow-y-auto bg-white flex flex-col justify-between">
            <div>
              <div className="pb-3 border-b border-[#E4DFD3] mb-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-sm text-[#14213D]">{evidence?.evidence_ref || 'Evidence Item'}</span>
                  <span className="px-2 py-0.5 text-xs bg-[#F1F5F9] text-[#475569] rounded border border-[#E2E8F0]">
                    {evidence?.evidence_type || 'fact'}
                  </span>
                </div>
                <h3 className="font-legal-heading text-base text-[#2B2D33] mt-1">{evidence?.fact_label || 'Extracted Fact'}</h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-[#5C5E66] block mb-0.5">Fact Statement:</span>
                  <p className="text-[#2B2D33] font-medium leading-relaxed bg-[#FAF7F0] p-2.5 rounded border border-[#E4DFD3]">
                    {evidence?.fact_text || '—'}
                  </p>
                </div>

                {evidence?.amount_raw && (
                  <div className="flex justify-between items-center py-1.5 border-b border-[#E4DFD3]">
                    <span className="text-[#5C5E66]">Amount:</span>
                    <span className="font-mono font-semibold text-[#14213D] text-sm">
                      {evidence.amount_raw} {evidence.amount_value != null && `(${formatCurrency(evidence.amount_value, evidence.currency)})`}
                    </span>
                  </div>
                )}

                {evidence?.date_raw && (
                  <div className="flex justify-between items-center py-1.5 border-b border-[#E4DFD3]">
                    <span className="text-[#5C5E66]">Date:</span>
                    <span className="font-mono font-medium text-[#2B2D33]">
                      {evidence.date_raw} {evidence.date_value && `(${formatDate(evidence.date_value)})`}
                    </span>
                  </div>
                )}

                {evidence?.entity && (
                  <div className="flex justify-between items-center py-1.5 border-b border-[#E4DFD3]">
                    <span className="text-[#5C5E66]">Entity:</span>
                    <span className="font-medium text-[#2B2D33]">{evidence.entity}</span>
                  </div>
                )}

                <div>
                  <span className="text-[#5C5E66] block mb-1">Verbatim Source Quote (Grounding):</span>
                  <div className="bg-[#FEFCE8] text-[#2B2D33] p-2.5 rounded border border-[#FCE96A] font-mono text-[11px] leading-relaxed">
                    "{evidence?.source_quote || '—'}"
                  </div>
                </div>

                {evidence?.confidence != null && (
                  <div className="p-2.5 bg-[#F0FDF4] border border-[#BCF0DA] rounded text-xs text-[#2F6B4F]">
                    <div className="flex items-center justify-between font-medium">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Confidence Score:
                      </span>
                      <span className="font-mono font-bold">{(evidence.confidence * 100).toFixed(0)}%</span>
                    </div>
                    {evidence.confidence_basis && (
                      <div className="mt-1 pt-1 border-t border-[#BCF0DA]/60 text-[10px] space-y-0.5 font-mono text-[#5C5E66]">
                        {Object.entries(evidence.confidence_basis).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span>{k.replace(/_/g, ' ')}:</span>
                            <span>+{((v as number) * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E4DFD3] text-center">
              <button
                onClick={onClose}
                className="w-full py-2 bg-[#14213D] text-white rounded text-xs font-medium hover:bg-[#1E2D4A] transition-colors"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
