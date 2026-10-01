import crypto from 'crypto';
import { getDb } from '../db/client.js';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  caseId?: string | null;
  details?: Record<string, any>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const db = await getDb();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, case_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entry.actorId || null,
      entry.action,
      entry.entityType,
      entry.entityId || null,
      entry.caseId || null,
      entry.details ? JSON.stringify(entry.details) : null,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
