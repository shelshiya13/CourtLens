import crypto from 'crypto';
import { getDb } from '../db/client.js';
import { processDocumentPipeline } from '../agents/orchestrator.js';
import { runHumanReviewReanalysis } from '../review/service.js';

export async function enqueueJob(
  caseId: string,
  kind: 'process_document' | 'run_analysis' | 'reanalyze_after_review',
  documentId?: string | null
): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const stepLog = JSON.stringify([{ step: 'uploading', timestamp: now, message: 'Job registered in queue.' }]);

  db.prepare(`
    INSERT INTO jobs (id, case_id, document_id, kind, status, step, step_log_json, created_at)
    VALUES (?, ?, ?, ?, 'queued', 'uploading', ?, ?)
  `).run(id, caseId, documentId || null, kind, stepLog, now);

  // Trigger worker loop asynchronously
  setImmediate(() => {
    processNextJob().catch(err => console.error('[Worker Error]', err));
  });

  return id;
}

let isProcessing = false;

export async function processNextJob() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const db = await getDb();
    const nextJob = db.prepare<any>(`
      SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1
    `).get();

    if (!nextJob) {
      isProcessing = false;
      return;
    }

    db.prepare("UPDATE jobs SET status = 'running', started_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      nextJob.id
    );

    if (nextJob.kind === 'process_document' && nextJob.document_id) {
      await processDocumentPipeline(nextJob.id, nextJob.case_id, nextJob.document_id);
    } else if (nextJob.kind === 'reanalyze_after_review') {
      await runHumanReviewReanalysis(nextJob.id, nextJob.case_id);
    }

  } catch (err) {
    console.error('[Worker Loop Exception]', err);
  } finally {
    isProcessing = false;
  }
}

export function startBackgroundWorker() {
  setInterval(() => {
    processNextJob().catch(err => console.error('[Worker Periodic Error]', err));
  }, 1000);
}
