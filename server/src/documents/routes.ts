import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db/client.js';
import { requireAuth } from '../auth/middleware.js';
import { canAccessCase } from '../access/policy.js';
import { enqueueJob } from '../jobs/queue.js';
import { recordTimelineEvent } from '../agents/timelineAgent.js';
import { logAudit } from '../audit/auditLog.js';
import { updateCaseStatusIfNeeded } from '../cases/status.js';

export const documentsRouter = Router();

const upload = multer({
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  storage: multer.memoryStorage()
});

// POST /api/cases/:id/documents - Upload document
documentsRouter.post('/:id/documents', requireAuth, upload.array('files'), async (req: Request, res: Response) => {
  const caseId = req.params.id;
  const hasAccess = await canAccessCase(req.user, caseId, 'upload');
  if (!hasAccess) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found or closed for uploads' } });
  }

  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: { code: 'NO_FILES', message: 'No files provided for upload' } });
  }

  const db = await getDb();
  const allowDuplicate = req.body.allowDuplicate === 'true' || req.body.allowDuplicate === true;
  const shareWithGuardian = req.body.shareWithGuardian === 'true' || req.body.shareWithGuardian === true ? 1 : 0;
  const docTypeGuess = req.body.docType || null;

  const uploadedJobs: Array<{ docId: string; filename: string; jobId: string }> = [];

  for (const file of files) {
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Duplicate check
    const existingDoc = db.prepare<any>(`
      SELECT id, filename FROM documents WHERE case_id = ? AND sha256 = ?
    `).get(caseId, sha256);

    if (existingDoc && !allowDuplicate) {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_DOCUMENT',
          message: `Document "${file.originalname}" is identical to already uploaded "${existingDoc.filename}". Confirmation required.`,
          existingDocId: existingDoc.id
        }
      });
    }

    const docId = crypto.randomUUID();
    const storageDir = path.resolve(process.env.DATA_DIR || './data', 'uploads', caseId, docId);
    fs.mkdirSync(storageDir, { recursive: true });

    const safeExt = path.extname(file.originalname) || '.bin';
    const storagePath = path.join(storageDir, `original${safeExt}`);
    fs.writeFileSync(storagePath, file.buffer);

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO documents (
        id, case_id, filename, mime, size_bytes, sha256, storage_path,
        doc_type_guess, page_count, shared_with_guardian, uploaded_by,
        uploaded_at, processing_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'uploaded')
    `).run(
      docId,
      caseId,
      file.originalname,
      file.mimetype || 'application/octet-stream',
      file.size,
      sha256,
      storagePath,
      docTypeGuess,
      shareWithGuardian,
      req.user!.userId,
      now
    );

    await recordTimelineEvent({
      caseId,
      eventType: 'document_uploaded',
      description: `Document "${file.originalname}" uploaded by ${req.user!.name}.`,
      source: file.originalname,
      actorType: req.user!.role,
      actorId: req.user!.userId,
      guardianVisible: shareWithGuardian === 1
    });

    const jobId = await enqueueJob(caseId, 'process_document', docId);
    uploadedJobs.push({ docId, filename: file.originalname, jobId });

    await logAudit({
      actorId: req.user!.userId,
      action: 'document_upload',
      entityType: 'document',
      entityId: docId,
      caseId,
      details: { filename: file.originalname, size: file.size }
    });
  }

  await updateCaseStatusIfNeeded(caseId, req.user!.userId);

  return res.json({
    success: true,
    documents: uploadedJobs
  });
});

// GET /api/cases/:id/documents - List documents
documentsRouter.get('/:id/documents', requireAuth, async (req: Request, res: Response) => {
  const caseId = req.params.id;
  const hasAccess = await canAccessCase(req.user, caseId, 'read_case_summary');
  if (!hasAccess) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } });

  const db = await getDb();
  let query = 'SELECT * FROM documents WHERE case_id = ? ORDER BY uploaded_at DESC';
  if (req.user!.role === 'guardian') {
    query = 'SELECT * FROM documents WHERE case_id = ? AND shared_with_guardian = 1 ORDER BY uploaded_at DESC';
  }

  const docs = db.prepare<any>(query).all(caseId);
  return res.json({ documents: docs });
});

// GET /api/documents/:docId/file - Download file
documentsRouter.get('/file/:docId', requireAuth, async (req: Request, res: Response) => {
  const docId = req.params.docId;
  const db = await getDb();
  const doc = db.prepare<any>('SELECT * FROM documents WHERE id = ?').get(docId);
  if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });

  const cap = req.user!.role === 'guardian' ? 'read_documents_shared' : 'read_internal';
  const hasAccess = await canAccessCase(req.user, doc.case_id, cap);
  if (!hasAccess || (req.user!.role === 'guardian' && !doc.shared_with_guardian)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
  }

  if (!fs.existsSync(doc.storage_path)) {
    return res.status(404).json({ error: { code: 'FILE_MISSING', message: 'Stored file not found on disk' } });
  }

  res.setHeader('Content-Type', doc.mime);
  res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
  const stream = fs.createReadStream(doc.storage_path);
  stream.pipe(res);
});

// GET /api/documents/:docId/pages - Extracted text pages
documentsRouter.get('/pages/:docId', requireAuth, async (req: Request, res: Response) => {
  const docId = req.params.docId;
  const db = await getDb();
  const doc = db.prepare<any>('SELECT * FROM documents WHERE id = ?').get(docId);
  if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });

  const hasAccess = await canAccessCase(req.user, doc.case_id, 'read_internal');
  if (!hasAccess) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });

  const pages = db.prepare<any>('SELECT * FROM document_pages WHERE document_id = ? ORDER BY page_no ASC').all(docId);
  return res.json({ pages, document: doc });
});

// PATCH /api/documents/:docId - Toggle guardian sharing
documentsRouter.patch('/:docId', requireAuth, async (req: Request, res: Response) => {
  const docId = req.params.docId;
  const db = await getDb();
  const doc = db.prepare<any>('SELECT * FROM documents WHERE id = ?').get(docId);
  if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });

  const hasAccess = await canAccessCase(req.user, doc.case_id, 'edit');
  if (!hasAccess) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found' } });

  if (req.body.shared_with_guardian !== undefined) {
    const val = req.body.shared_with_guardian ? 1 : 0;
    db.prepare('UPDATE documents SET shared_with_guardian = ? WHERE id = ?').run(val, docId);

    await recordTimelineEvent({
      caseId: doc.case_id,
      eventType: 'document_shared_with_guardian',
      description: val === 1
        ? `Document "${doc.filename}" made visible to client/guardian.`
        : `Document "${doc.filename}" hidden from client/guardian.`,
      actorType: 'lawyer',
      actorId: req.user!.userId,
      guardianVisible: val === 1
    });
  }

  return res.json({ success: true });
});

// POST /api/documents/:docId/reprocess - Reprocess document
documentsRouter.post('/:docId/reprocess', requireAuth, async (req: Request, res: Response) => {
  const docId = req.params.docId;
  const db = await getDb();
  const doc = db.prepare<any>('SELECT * FROM documents WHERE id = ?').get(docId);
  if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });

  const hasAccess = await canAccessCase(req.user, doc.case_id, 'upload');
  if (!hasAccess) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found or closed' } });

  db.prepare("UPDATE documents SET processing_status = 'uploaded', failure_reason = NULL WHERE id = ?").run(docId);
  const jobId = await enqueueJob(doc.case_id, 'process_document', docId);

  return res.json({ success: true, jobId });
});
