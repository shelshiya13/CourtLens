import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { getGeminiClient } from '../agents/geminiClient.js';
import { env } from '../config/env.js';

export interface ExtractedPage {
  pageNo: number;
  text: string;
  method: 'text_layer' | 'gemini_ocr' | 'plain_text' | 'docx';
}

export interface ExtractionResult {
  pages: ExtractedPage[];
  totalChars: number;
}

export async function extractDocumentText(
  filePath: string,
  mimeType: string,
  originalFilename: string
): Promise<ExtractionResult> {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(originalFilename).toLowerCase();
  const pages: ExtractedPage[] = [];

  // 1. Plain text / Markdown / EML
  if (
    mimeType.includes('text/plain') ||
    ext === '.txt' ||
    ext === '.eml' ||
    ext === '.md'
  ) {
    const rawText = buffer.toString('utf-8');
    // If multiple pages demarcated by form-feed \f or large page breaks, split; otherwise 1 page
    const rawPages = rawText.split('\f');
    for (let i = 0; i < rawPages.length; i++) {
      const text = rawPages[i].trim();
      if (text.length > 0) {
        pages.push({
          pageNo: i + 1,
          text,
          method: 'plain_text'
        });
      }
    }
    if (pages.length === 0) {
      pages.push({ pageNo: 1, text: rawText.trim(), method: 'plain_text' });
    }
  }

  // 2. DOCX documents
  else if (
    ext === '.docx' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    pages.push({
      pageNo: 1,
      text,
      method: 'docx'
    });
  }

  // 3. PDF documents
  else if (mimeType.includes('pdf') || ext === '.pdf') {
    let pdfText = '';
    let pdfPageCount = 1;
    let pageTexts: string[] = [];

    try {
      // Dynamic import or require pdf-parse
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = (pdfParseModule as any).default || pdfParseModule;

      const data = await pdfParse(buffer, {
        pagerender: function (pageData: any) {
          return pageData.getTextContent().then(function (textContent: any) {
            let lastY: number | null = null;
            let text = '';
            for (const item of textContent.items) {
              if (lastY == null || Math.abs(item.transform[5] - lastY) < 5) {
                text += item.str + ' ';
              } else {
                text += '\n' + item.str + ' ';
              }
              lastY = item.transform[5];
            }
            return text;
          });
        }
      });

      pdfPageCount = data.numpages || 1;
      pdfText = data.text || '';

      // If pdf-parse returned text with form feed or page boundaries
      if (pdfText.includes('\f')) {
        pageTexts = pdfText.split('\f');
      } else {
        pageTexts = [pdfText];
      }
    } catch (parseErr) {
      console.warn('[PDF Extract] pdf-parse failed or had issue:', parseErr);
    }

    // Check if extracted text is sparse (< 40 chars total) -> likely scanned PDF
    const totalExtractedLength = pageTexts.join('').trim().length;
    const ai = getGeminiClient();

    if (totalExtractedLength < 40 && ai) {
      console.log(`[PDF OCR] Sparse or empty text layer (${totalExtractedLength} chars). Invoking Gemini multimodal OCR.`);
      try {
        const base64Pdf = buffer.toString('base64');
        const response = await ai.models.generateContent({
          model: env.GEMINI_MODEL,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: base64Pdf
                  }
                },
                {
                  text: 'Transcribe all text from this scanned legal document verbatim, preserving line breaks, headings, tables, dates, party names, and amount numbers. Do not add commentary or summarize.'
                }
              ]
            }
          ]
        });

        const ocrText = response.text || '';
        pages.push({
          pageNo: 1,
          text: ocrText.trim(),
          method: 'gemini_ocr'
        });
      } catch (ocrErr) {
        console.error('[PDF OCR Error]', ocrErr);
      }
    } else {
      for (let i = 0; i < pageTexts.length; i++) {
        const pt = pageTexts[i].trim();
        if (pt.length > 0 || i === 0) {
          pages.push({
            pageNo: i + 1,
            text: pt,
            method: 'text_layer'
          });
        }
      }
    }
  }

  // 4. Image files (PNG, JPEG, WEBP)
  else if (
    mimeType.startsWith('image/') ||
    ['.png', '.jpg', '.jpeg', '.webp'].includes(ext)
  ) {
    const ai = getGeminiClient();
    if (!ai) {
      pages.push({
        pageNo: 1,
        text: 'Image uploaded. AI OCR transcription requires GEMINI_API_KEY to be configured.',
        method: 'gemini_ocr'
      });
    } else {
      const mime = mimeType.startsWith('image/') ? mimeType : (ext === '.png' ? 'image/png' : 'image/jpeg');
      const base64Image = buffer.toString('base64');
      const response = await ai.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mime,
                  data: base64Image
                }
              },
              {
                text: 'Transcribe the text of this legal document/scan verbatim. Retain all dates, monetary amounts, invoice details, party names, and clauses exactly as written.'
              }
            ]
          }
        ]
      });

      pages.push({
        pageNo: 1,
        text: (response.text || '').trim(),
        method: 'gemini_ocr'
      });
    }
  }

  const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
  return { pages, totalChars };
}
