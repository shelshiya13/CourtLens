import { Router, Request, Response } from 'express';
import { getDb } from '../db/client.js';
import { requireAuth } from '../auth/middleware.js';
import { canAccessCase } from '../access/policy.js';

export const jobsRouter = Router();

// GET /api/jobs/:id - Poll job status & live stepper progress
jobsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const jobId = req.params.id;
  const db = await getDb();

  const job = db.prepare<any>('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
  }

  const hasAccess = await canAccessCase(req.user, job.case_id, 'read_case_summary');
  if (!hasAccess) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
  }

  return res.json({
    job: {
      id: job.id,
      caseId: job.case_id,
      documentId: job.document_id,
      kind: job.kind,
      status: job.status,
      step: job.step,
      error: job.error,
      stepLogs: job.step_log_json ? JSON.parse(job.step_log_json) : [],
      createdAt: job.created_at,
      startedAt: job.started_at,
      finishedAt: job.finished_at
    }
  });
});
