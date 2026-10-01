import { Type } from '@google/genai';
import { getGeminiClient } from './geminiClient.js';
import { EVIDENCE_EXTRACTION_SYSTEM_INSTRUCTION } from './prompts/evidence.js';
import { env } from '../config/env.js';

export interface ExtractedEvidenceItem {
  evidenceType: string;
  factLabel: string;
  factText: string;
  entity?: string | null;
  dateValue?: string | null;
  dateRaw?: string | null;
  amountValue?: number | null;
  currency?: string | null;
  amountRaw?: string | null;
  sourceQuote: string;
  pageNo: number;
  confidence: number | null;
  confidenceBasis: Record<string, any>;
  validationNotes?: string | null;
}

export interface ExtractedClaimItem {
  claimText: string;
  claimKind: 'payment_completed' | 'delivery_completed' | 'contract_exists' | 'amount_owed' | 'other';
  sourceQuote: string;
  pageNo: number;
}

export interface EvidenceExtractionResult {
  evidence: ExtractedEvidenceItem[];
  claims: ExtractedClaimItem[];
  rejectionCount: number;
}

export function parseIndianAmount(rawStr: string): { value: number | null; currency: string | null } {
  if (!rawStr) return { value: null, currency: null };
  const cleaned = rawStr.replace(/[,\s]/g, '');

  let currency = 'INR';
  if (rawStr.includes('$')) currency = 'USD';
  else if (rawStr.includes('€')) currency = 'EUR';
  else if (rawStr.includes('£')) currency = 'GBP';
  else if (rawStr.includes('₹') || rawStr.toLowerCase().includes('rs') || rawStr.toLowerCase().includes('inr')) currency = 'INR';

  // Match numbers with possible decimals
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return { value: null, currency };

  const num = parseFloat(match[1]);
  // convert to minor units (paisa/cents)
  return { value: Math.round(num * 100), currency };
}

export function parseLegalDate(rawStr: string): string | null {
  if (!rawStr) return null;
  const trimmed = rawStr.trim();

  // Try standard ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Try natural date parsing e.g. "12 August 2026" or "10 Aug 2026"
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return d.toISOString().split('T')[0];
  }

  // Common Indian/UK format: DD/MM/YYYY
  const parts = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (parts) {
    const day = parts[1].padStart(2, '0');
    const month = parts[2].padStart(2, '0');
    const year = parts[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

function verifyQuoteGrounding(pageText: string, quote: string): boolean {
  if (!quote || quote.trim().length === 0) return false;
  const normalize = (s: string) => s.toLowerCase().replace(/[\s\r\n]+/g, ' ').replace(/[^\w\s]/g, '').trim();
  const normPage = normalize(pageText);
  const normQuote = normalize(quote);

  if (normQuote.length === 0) return false;
  return normPage.includes(normQuote) || normQuote.includes(normPage) || (normQuote.length > 20 && normPage.includes(normQuote.slice(0, 20)));
}

export async function extractEvidenceFromDocument(
  pages: Array<{ pageNo: number; text: string; method: string }>
): Promise<EvidenceExtractionResult> {
  const ai = getGeminiClient();
  const allEvidence: ExtractedEvidenceItem[] = [];
  const allClaims: ExtractedClaimItem[] = [];
  let rejectionCount = 0;

  for (const page of pages) {
    const pageText = page.text.trim();
    if (!pageText || pageText.length < 15) continue;

    let rawEvidenceList: any[] = [];
    let rawClaimsList: any[] = [];

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: env.GEMINI_MODEL,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Analyze the following document text from page ${page.pageNo} and extract structured legal evidence and explicit factual claims.\n\nDOCUMENT TEXT (PAGE ${page.pageNo}):\n"""\n${pageText}\n"""`
                }
              ]
            }
          ],
          config: {
            systemInstruction: EVIDENCE_EXTRACTION_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                evidence: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      evidenceType: { type: Type.STRING },
                      factLabel: { type: Type.STRING },
                      factText: { type: Type.STRING },
                      entity: { type: Type.STRING },
                      dateRaw: { type: Type.STRING },
                      amountRaw: { type: Type.STRING },
                      sourceQuote: { type: Type.STRING }
                    },
                    required: ['evidenceType', 'factLabel', 'factText', 'sourceQuote']
                  }
                },
                claims: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      claimText: { type: Type.STRING },
                      claimKind: { type: Type.STRING },
                      sourceQuote: { type: Type.STRING }
                    },
                    required: ['claimText', 'claimKind', 'sourceQuote']
                  }
                }
              },
              required: ['evidence']
            }
          }
        });

        const outputText = response.text || '{}';
        const parsed = JSON.parse(outputText);
        rawEvidenceList = parsed.evidence || [];
        rawClaimsList = parsed.claims || [];
      } catch (llmErr) {
        console.warn(`[EvidenceAgent] Gemini extraction call failed on page ${page.pageNo}:`, llmErr);
        // Fall back to rule-based parser below
      }
    }

    // Fallback/Deterministic heuristic extractor if LLM is unavailable or returned empty on legal patterns
    if (rawEvidenceList.length === 0) {
      rawEvidenceList = extractDeterministicHeuristics(pageText, page.pageNo);
      rawClaimsList = extractDeterministicClaims(pageText, page.pageNo);
    }

    // Verify grounding and compute confidence for each item
    for (const item of rawEvidenceList) {
      const quote = (item.sourceQuote || '').trim();
      const isGrounded = verifyQuoteGrounding(pageText, quote);

      if (!isGrounded) {
        console.warn(`[Evidence Grounding] Rejected ungrounded extraction on page ${page.pageNo}: "${quote.slice(0, 60)}..."`);
        rejectionCount++;
        continue;
      }

      const dateValue = item.dateRaw ? parseLegalDate(item.dateRaw) : null;
      let amountValue: number | null = null;
      let currency: string | null = null;

      if (item.amountRaw) {
        const amt = parseIndianAmount(item.amountRaw);
        amountValue = amt.value;
        currency = amt.currency;
      }

      // Compute rule-based confidence
      const basis: Record<string, number> = {};
      let confScore = 0.0;

      // 1. Verbatim quote match
      if (pageText.includes(quote)) {
        confScore += 0.40;
        basis['exact_quote_match'] = 0.40;
      } else {
        confScore += 0.25;
        basis['normalized_quote_match'] = 0.25;
      }

      // 2. Extraction source method
      if (page.method === 'text_layer' || page.method === 'plain_text') {
        confScore += 0.25;
        basis['clean_text_layer'] = 0.25;
      } else {
        confScore += 0.10;
        basis['ocr_extraction'] = 0.10;
      }

      // 3. Clear date/amount parsing
      if (dateValue || amountValue != null) {
        confScore += 0.20;
        basis['parsed_structured_scalar'] = 0.20;
      }

      // 4. Entity presence
      if (item.entity && item.entity.trim().length > 0) {
        confScore += 0.15;
        basis['entity_identified'] = 0.15;
      }

      const finalConfidence = Math.min(1.0, Math.round(confScore * 100) / 100);

      allEvidence.push({
        evidenceType: item.evidenceType || 'statement',
        factLabel: item.factLabel || 'Document Fact',
        factText: item.factText || quote,
        entity: item.entity || null,
        dateValue,
        dateRaw: item.dateRaw || null,
        amountValue,
        currency,
        amountRaw: item.amountRaw || null,
        sourceQuote: quote.slice(0, 300),
        pageNo: page.pageNo,
        confidence: finalConfidence,
        confidenceBasis: basis
      });
    }

    for (const c of rawClaimsList) {
      if (verifyQuoteGrounding(pageText, c.sourceQuote)) {
        allClaims.push({
          claimText: c.claimText,
          claimKind: c.claimKind || 'other',
          sourceQuote: c.sourceQuote.slice(0, 300),
          pageNo: page.pageNo
        });
      }
    }
  }

  return {
    evidence: allEvidence,
    claims: allClaims,
    rejectionCount
  };
}

function extractDeterministicHeuristics(text: string, pageNo: number): any[] {
  const items: any[] = [];

  // Match Invoice Total
  const invTotalMatch = text.match(/(?:invoice\s+total|total\s+amount|grand\s+total)[^\d₹Rs]*([₹Rs\$\.\d,\s]+)/i);
  if (invTotalMatch) {
    const rawAmt = invTotalMatch[1].trim();
    items.push({
      evidenceType: 'invoice_total',
      factLabel: 'Invoice Total Amount',
      factText: `Invoice total of ${rawAmt}`,
      amountRaw: rawAmt,
      sourceQuote: invTotalMatch[0].slice(0, 200)
    });
  }

  // Match Payment amount
  const paymentMatch = text.match(/(?:payment\s+received|amount\s+paid|transferred\s+sum\s+of|credit\s+of)[^\d₹Rs]*([₹Rs\$\.\d,\s]+)/i);
  if (paymentMatch) {
    const rawAmt = paymentMatch[1].trim();
    items.push({
      evidenceType: 'payment',
      factLabel: 'Recorded Payment Amount',
      factText: `Payment record indicates ${rawAmt}`,
      amountRaw: rawAmt,
      sourceQuote: paymentMatch[0].slice(0, 200)
    });
  }

  // Match Delivery Date
  const deliveryMatch = text.match(/(?:delivery\s+date|delivered\s+on|consignment\s+received\s+on)[^\d\w]*([0-9]{1,2}[a-z\s]+[0-9]{4}|[0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{4})/i);
  if (deliveryMatch) {
    const rawDate = deliveryMatch[1].trim();
    items.push({
      evidenceType: 'delivery',
      factLabel: 'Recorded Delivery Date',
      factText: `Delivery recorded on ${rawDate}`,
      dateRaw: rawDate,
      sourceQuote: deliveryMatch[0].slice(0, 200)
    });
  }

  // Match Contract Term Delivery Date
  const contractDeliveryMatch = text.match(/(?:delivery\s+shall\s+be\s+completed\s+on\s+or\s+before|agreed\s+delivery\s+date)[^\d\w]*([0-9]{1,2}[a-z\s]+[0-9]{4}|[0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{4})/i);
  if (contractDeliveryMatch) {
    const rawDate = contractDeliveryMatch[1].trim();
    items.push({
      evidenceType: 'contract_term',
      factLabel: 'Contractual Delivery Schedule',
      factText: `Agreed delivery schedule is ${rawDate}`,
      dateRaw: rawDate,
      sourceQuote: contractDeliveryMatch[0].slice(0, 200)
    });
  }

  return items;
}

function extractDeterministicClaims(text: string, pageNo: number): ExtractedClaimItem[] {
  const claims: ExtractedClaimItem[] = [];

  if (/(?:payment\s+(?:was|has\s+been|is)\s+completed|we\s+have\s+paid\s+the\s+invoice|full\s+payment\s+made)/i.test(text)) {
    const match = text.match(/([^\.\n]*(?:payment|paid)[^\.\n]*)/i);
    claims.push({
      claimText: match ? match[1].trim() : 'Payment completed as asserted by client',
      claimKind: 'payment_completed',
      sourceQuote: match ? match[0].trim().slice(0, 250) : 'Payment completed',
      pageNo
    });
  }

  return claims;
}
