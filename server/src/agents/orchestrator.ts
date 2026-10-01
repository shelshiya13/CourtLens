import crypto from 'crypto';
import { getDb } from '../db/client.js';
import { extractDocumentText } from '../documents/extractText.js';
import { chunkPageText } from '../documents/chunk.js';
import { extractEvidenceFromDocument } from './evidenceAgent.js';
import { evaluateDeterministicConflicts } from './rules/conflictRules.js';
import { evaluateMissingEvidenceRules } from './rules/requirementRules.js';
import { runReconciliationAgent } from './reconciliationAgent.js';
import { getActiveStateAdapter } from './state/omegaAdapter.js';
import { buildCaseStateFromDb, CaseState } from './state/caseState.js';
import { recordTimelineEvent } from './timelineAgent.js';
import { createNotification } from '../notifications/service.js';
import { updateCaseStatusIfNeeded } from '../cases/status.js';
import { logAudit } from '../audit/auditLog.js';

export type JobStep =
  | 'uploading'
  | 'extracting'
  | 'structuring'
  | 'validating'
  | 'checking_conflicts'
  | 'updating_case_state'
  | 'generating_analysis'
  | 'done';

export async function setJobStep(jobId: string, step: JobStep, logMessage: string) {
  const db = await getDb();
  const job = db.prepare<any>('SELECT step_log_json FROM jobs WHERE id = ?').get(jobId);
  const logs = job?.step_log_json ? JSON.parse(job.step_log_json) : [];
  logs.push({ step, timestamp: new Date().toISOString(), message: logMessage });

  db.prepare(`
    UPDATE jobs SET step = ?, step_log_json = ?, started_at = COALESCE(started_at, ?)
    WHERE id = ?
  `).run(step, JSON.stringify(logs), new Date().toISOString(), jobId);
}

export async function processDocumentPipeline(jobId: string, caseId: string, documentId: string) {
  const db = await getDb();
  const adapter = getActiveStateAdapter();

  try {
    const doc = db.prepare<any>('SELECT * FROM documents WHERE id = ?').get(documentId);
    if (!doc) throw new Error('Document not found');
    const caseRow = db.prepare<any>('SELECT * FROM cases WHERE id = ?').get(caseId);

    // Step 1: Extracting
    await setJobStep(jobId, 'extracting', `Extracting text layers from ${doc.filename}...`);
    db.prepare("UPDATE documents SET processing_status = 'extracting' WHERE id = ?").run(documentId);

    const extraction = await extractDocumentText(doc.storage_path, doc.mime, doc.filename);
    if (extraction.pages.length === 0 || extraction.totalChars === 0) {
      db.prepare("UPDATE documents SET processing_status = 'failed', failure_reason = ? WHERE id = ?").run(
        'No readable text could be extracted',
        documentId
      );
      throw new Error('No readable text could be extracted from document');
    }

    // Save pages & chunks
    db.prepare('DELETE FROM document_pages WHERE document_id = ?').run(documentId);
    db.prepare('DELETE FROM chunks WHERE document_id = ?').run(documentId);

    for (const page of extraction.pages) {
      const pageId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO document_pages (id, document_id, page_no, text, extraction_method, char_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(pageId, documentId, page.pageNo, page.text, page.method, page.text.length);

      const chunks = chunkPageText(page.text, page.pageNo);
      for (const ch of chunks) {
        db.prepare(`
          INSERT INTO chunks (id, document_id, page_no, chunk_index, text, char_start, char_end)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), documentId, page.pageNo, ch.chunkIndex, ch.text, ch.charStart, ch.charEnd);
      }
    }

    db.prepare('UPDATE documents SET page_count = ? WHERE id = ?').run(extraction.pages.length, documentId);

    // Step 2: Structuring (Agent 1)
    await setJobStep(jobId, 'structuring', 'Evidence Intelligence Agent extracting structured facts & verbatim quotes...');
    db.prepare("UPDATE documents SET processing_status = 'structuring' WHERE id = ?").run(documentId);

    const extractionResult = await extractEvidenceFromDocument(extraction.pages);

    // Step 3: Validating
    await setJobStep(jobId, 'validating', `Validating grounding for ${extractionResult.evidence.length} evidence candidate(s)...`);
    db.prepare("UPDATE documents SET processing_status = 'validating' WHERE id = ?").run(documentId);

    // Determine starting evidence ref
    const existingEvCount = db.prepare<any>('SELECT COUNT(*) as c FROM evidence WHERE case_id = ?').get(caseId)?.c || 0;
    let nextEvIndex = existingEvCount + 1;

    for (const item of extractionResult.evidence) {
      const evId = crypto.randomUUID();
      const evRef = `E-${String(nextEvIndex).padStart(3, '0')}`;
      nextEvIndex++;

      db.prepare(`
        INSERT INTO evidence (
          id, case_id, evidence_ref, document_id, page_no, evidence_type,
          fact_label, fact_text, entity, date_value, date_raw,
          amount_value, currency, amount_raw, source_quote, confidence,
          confidence_basis, status, created_by, validation_notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'evidence_agent', ?, ?)
      `).run(
        evId,
        caseId,
        evRef,
        documentId,
        item.pageNo,
        item.evidenceType,
        item.factLabel,
        item.factText,
        item.entity || null,
        item.dateValue || null,
        item.dateRaw || null,
        item.amountValue ?? null,
        item.currency || null,
        item.amountRaw || null,
        item.sourceQuote,
        item.confidence ?? null,
        item.confidenceBasis ? JSON.stringify(item.confidenceBasis) : null,
        item.validationNotes || null,
        new Date().toISOString()
      );

      // Check if item has claim counterpart
      const matchingClaim = extractionResult.claims.find(c => c.pageNo === item.pageNo);
      if (matchingClaim) {
        db.prepare(`
          INSERT INTO claims (id, case_id, claim_text, claim_source_evidence_id, claim_kind, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'unverified', ?, ?)
        `).run(crypto.randomUUID(), caseId, matchingClaim.claimText, evId, matchingClaim.claimKind, new Date().toISOString(), new Date().toISOString());
      }
    }

    db.prepare("UPDATE documents SET processing_status = 'done' WHERE id = ?").run(documentId);

    await recordTimelineEvent({
      caseId,
      eventType: 'evidence_structured',
      description: `Extracted ${extractionResult.evidence.length} grounded evidence items from ${doc.filename}.`,
      source: doc.filename,
      actorType: 'system',
      guardianVisible: false,
      meta: { documentId, count: extractionResult.evidence.length }
    });

    // Step 4: Checking Conflicts & Missing Evidence
    await setJobStep(jobId, 'checking_conflicts', 'Executing deterministic conflict rules and corroboration engines...');
    const allCaseEvidence = (await buildCaseStateFromDb(caseId)).evidence;
    const allClaims = (await buildCaseStateFromDb(caseId)).claims;

    const evaluatedConflicts = evaluateDeterministicConflicts(allCaseEvidence);
    const evaluatedMissing = evaluateMissingEvidenceRules(allClaims, allCaseEvidence);

    // Persist conflicts
    const priorVersionNo = db.prepare<any>('SELECT MAX(version_no) as v FROM analysis_versions WHERE case_id = ?').get(caseId)?.v || 0;
    let nextConflictIndex = (db.prepare<any>('SELECT COUNT(*) as c FROM conflicts WHERE case_id = ?').get(caseId)?.c || 0) + 1;

    for (const ec of evaluatedConflicts) {
      const existing = db.prepare<any>(`
        SELECT id FROM conflicts
        WHERE case_id = ? AND conflict_type = ?
          AND ((evidence_a_id = ? AND evidence_b_id = ?) OR (evidence_a_id = ? AND evidence_b_id = ?))
      `).get(caseId, ec.conflictType, ec.evidenceAId, ec.evidenceBId, ec.evidenceBId, ec.evidenceAId);

      if (!existing) {
        const cRef = `C-${String(nextConflictIndex).padStart(3, '0')}`;
        nextConflictIndex++;
        const confId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO conflicts (
            id, case_id, conflict_ref, conflict_type, evidence_a_id, evidence_b_id,
            description, why_it_matters, severity, severity_basis, status,
            detected_in_version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
        `).run(
          confId,
          caseId,
          cRef,
          ec.conflictType,
          ec.evidenceAId,
          ec.evidenceBId,
          ec.description,
          ec.whyItMatters,
          ec.severity,
          ec.severityBasis,
          priorVersionNo + 1,
          new Date().toISOString(),
          new Date().toISOString()
        );

        await recordTimelineEvent({
          caseId,
          eventType: 'conflict_detected',
          description: `Conflict ${cRef} detected: ${ec.description}`,
          source: cRef,
          actorType: 'system',
          guardianVisible: false,
          meta: { conflictRef: cRef, type: ec.conflictType }
        });

        if (caseRow) {
          await createNotification({
            userId: caseRow.assigned_lawyer_id,
            caseId,
            kind: 'conflict_detected',
            title: `Conflict Detected: ${cRef}`,
            body: `${ec.description} (Severity: ${ec.severity})`
          });
        }
      }
    }

    // Persist Missing Evidence items
    let nextMissingIndex = (db.prepare<any>('SELECT COUNT(*) as c FROM missing_evidence WHERE case_id = ?').get(caseId)?.c || 0) + 1;
    for (const em of evaluatedMissing) {
      const existing = db.prepare<any>(`
        SELECT id, status FROM missing_evidence
        WHERE case_id = ? AND claim_id = ? AND required_item = ?
      `).get(caseId, em.claimId, em.requiredItem);

      if (!existing && em.status === 'open') {
        const mRef = `M-${String(nextMissingIndex).padStart(3, '0')}`;
        nextMissingIndex++;
        db.prepare(`
          INSERT INTO missing_evidence (
            id, case_id, missing_ref, claim_id, required_item, rationale,
            basis_evidence_ids, status, detected_in_version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          caseId,
          mRef,
          em.claimId || null,
          em.requiredItem,
          em.rationale,
          JSON.stringify(em.basisEvidenceIds),
          priorVersionNo + 1,
          new Date().toISOString(),
          new Date().toISOString()
        );

        await recordTimelineEvent({
          caseId,
          eventType: 'missing_evidence_identified',
          description: `Missing evidence item ${mRef}: ${em.requiredItem}`,
          source: mRef,
          actorType: 'system',
          guardianVisible: false
        });
      } else if (existing && existing.status === 'open' && em.status === 'satisfied') {
        db.prepare("UPDATE missing_evidence SET status = 'satisfied', updated_at = ? WHERE id = ?").run(
          new Date().toISOString(),
          existing.id
        );

        await recordTimelineEvent({
          caseId,
          eventType: 'missing_evidence_satisfied',
          description: `Missing evidence item satisfied by new corroborating upload.`,
          actorType: 'system',
          guardianVisible: false
        });
      }
    }

    // Step 5: Updating Case State (Adapter)
    await setJobStep(jobId, 'updating_case_state', 'Synchronizing CaseState to persistent store...');
    const intermediateState = await buildCaseStateFromDb(caseId);
    await adapter.save(caseId, intermediateState);

    // Step 6: Generating Analysis (Agent 2)
    await setJobStep(jobId, 'generating_analysis', 'Reconciliation Agent generating auditable legal reasoning trace...');

    const latestState = await buildCaseStateFromDb(caseId);
    const activeEv = latestState.evidence.filter(e => e.status === 'active');
    const openConfs = latestState.conflicts.filter(c => c.status === 'open');
    const openMiss = latestState.missingEvidence.filter(m => m.status === 'open');

    const reasoningResult = await runReconciliationAgent(
      latestState,
      activeEv,
      openConfs,
      openMiss,
      { trigger: 'document_processed', triggerRef: doc.filename, detail: `Document ${doc.filename} added.` }
    );

    const newVersionNo = priorVersionNo + 1;
    const versionId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO analysis_versions (
        id, case_id, version_no, trigger, trigger_ref, summary_text,
        assessment_status, reasoning_json, evidence_snapshot_json,
        conflict_snapshot_json, missing_snapshot_json, state_diff_json,
        model_used, created_at
      ) VALUES (?, ?, ?, 'document_processed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      versionId,
      caseId,
      newVersionNo,
      doc.filename,
      reasoningResult.summary,
      reasoningResult.assessment_status,
      JSON.stringify({
        findings: reasoningResult.findings,
        open_questions: reasoningResult.open_questions
      }),
      JSON.stringify(activeEv.map(e => ({ id: e.id, ref: e.ref, status: e.status }))),
      JSON.stringify(openConfs.map(c => ({ id: c.id, ref: c.ref, status: c.status }))),
      JSON.stringify(openMiss.map(m => ({ id: m.id, ref: m.ref, status: m.status }))),
      JSON.stringify(reasoningResult.changed_since_previous),
      reasoningResult.model_used,
      new Date().toISOString()
    );

    // Final save of state
    const finalState = await buildCaseStateFromDb(caseId);
    await adapter.save(caseId, finalState);

    await recordTimelineEvent({
      caseId,
      eventType: 'assessment_updated',
      description: `Analysis Version v${newVersionNo} generated (${reasoningResult.assessment_status.replace(/_/g, ' ')}).`,
      source: `v${newVersionNo}`,
      actorType: 'system',
      guardianVisible: false,
      meta: { versionNo: newVersionNo, status: reasoningResult.assessment_status }
    });

    // Step 7: Done
    await setJobStep(jobId, 'done', 'Document analysis and case reconciliation completed successfully.');
    db.prepare("UPDATE jobs SET status = 'done', finished_at = ? WHERE id = ?").run(new Date().toISOString(), jobId);

    await updateCaseStatusIfNeeded(caseId);

    await logAudit({
      actorId: doc.uploaded_by,
      action: 'process_document_complete',
      entityType: 'document',
      entityId: documentId,
      caseId,
      details: { versionNo: newVersionNo }
    });

  } catch (err: any) {
    console.error(`[Job ${jobId} Failed]:`, err);
    await setJobStep(jobId, 'done', `Pipeline failed: ${err.message}`);
    db.prepare("UPDATE jobs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?").run(
      err.message || 'Unknown pipeline failure',
      new Date().toISOString(),
      jobId
    );
    await updateCaseStatusIfNeeded(caseId);
  }
}

export async function runManualAnalysis(caseId: string, actorId: string): Promise<string> {
  const db = await getDb();
  const adapter = getActiveStateAdapter();

  const latestState = await buildCaseStateFromDb(caseId);
  const activeEv = latestState.evidence.filter(e => e.status === 'active');
  const openConfs = latestState.conflicts.filter(c => c.status === 'open');
  const openMiss = latestState.missingEvidence.filter(m => m.status === 'open');

  const reasoningResult = await runReconciliationAgent(
    latestState,
    activeEv,
    openConfs,
    openMiss,
    { trigger: 'manual_run', triggerRef: 'lawyer_request', detail: 'Explicit analysis run triggered by counsel.' }
  );

  const priorVersionNo = db.prepare<any>('SELECT MAX(version_no) as v FROM analysis_versions WHERE case_id = ?').get(caseId)?.v || 0;
  const newVersionNo = priorVersionNo + 1;
  const versionId = crypto.randomUUID();

  db.prepare(`
    INSERT INTO analysis_versions (
      id, case_id, version_no, trigger, trigger_ref, summary_text,
      assessment_status, reasoning_json, evidence_snapshot_json,
      conflict_snapshot_json, missing_snapshot_json, state_diff_json,
      model_used, created_at
    ) VALUES (?, ?, ?, 'manual_run', 'counsel_request', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    versionId,
    caseId,
    newVersionNo,
    reasoningResult.summary,
    reasoningResult.assessment_status,
    JSON.stringify({
      findings: reasoningResult.findings,
      open_questions: reasoningResult.open_questions
    }),
    JSON.stringify(activeEv.map(e => ({ id: e.id, ref: e.ref, status: e.status }))),
    JSON.stringify(openConfs.map(c => ({ id: c.id, ref: c.ref, status: c.status }))),
    JSON.stringify(openMiss.map(m => ({ id: m.id, ref: m.ref, status: m.status }))),
    JSON.stringify(reasoningResult.changed_since_previous),
    reasoningResult.model_used,
    new Date().toISOString()
  );

  const finalState = await buildCaseStateFromDb(caseId);
  await adapter.save(caseId, finalState);

  await recordTimelineEvent({
    caseId,
    eventType: 'reanalysis_completed',
    description: `Analysis Version v${newVersionNo} generated via manual review.`,
    source: `v${newVersionNo}`,
    actorType: 'lawyer',
    actorId,
    guardianVisible: false,
    meta: { versionNo: newVersionNo }
  });

  await updateCaseStatusIfNeeded(caseId, actorId);
  return versionId;
}
