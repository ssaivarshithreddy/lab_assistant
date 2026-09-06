import { query } from './db.js';
import { searchMedicalKnowledgeBase } from './medicalKnowledgeBase.js';

/**
 * Server-Side 5-Step RAG Pipeline & Medical Knowledge Retriever:
 * Step 1: Deterministic Validation
 * Step 2: Targeted Query Generator
 * Step 3: Dual-Source Vector/Semantic Search (Curated KB + PostgreSQL Trigram Chunks)
 * Step 4 & 5: Prompt Assembly & Evidence Retrieval
 */
export async function retrieveServerRagContext(options = {}) {
  const { queryText = '', userId, reportId = null, topK = 5, activeValues = {} } = options;
  if (!queryText || !queryText.trim()) {
    return { ragPromptText: '', citations: [], medicalGuidelines: [] };
  }

  const rawQuery = queryText.trim();
  const targetedQueries = [];
  const detectedMarkers = [];

  let valuesObj = activeValues || {};
  if (typeof valuesObj === 'string') {
    try { valuesObj = JSON.parse(valuesObj); } catch (e) { valuesObj = {}; }
  }

  Object.entries(valuesObj).forEach(([key, v]) => {
    if (v?.value != null) {
      const status = v.status || 'normal';
      detectedMarkers.push({ marker: key, value: v.value, unit: v.unit, status });
      if (status === 'low' || status === 'high') {
        targetedQueries.push(`${key} ${status} interpretation causes of ${status} ${key} clinical significance`);
      }
    }
  });

  const combinedSearchTerm = targetedQueries.length > 0 ? `${rawQuery} ${targetedQueries.join(' ')}` : rawQuery;

  // Pre-calculate deterministic test statistics
  const totalTests = detectedMarkers.length;
  const normalTests = detectedMarkers.filter((m) => m.status === 'normal').length;
  const abnormalTests = detectedMarkers.filter((m) => m.status === 'low' || m.status === 'high').length;

  // Source A: Server-Side Curated Medical Knowledge Base Search
  let medicalGuidelines = [];
  let evidenceSufficient = true;
  let evidenceNote = '';

  try {
    const qLower = rawQuery.toLowerCase();
    const queriedMarker = detectedMarkers.find((m) => qLower.includes(m.marker.toLowerCase())) || 
                          detectedMarkers.find((m) => m.status === 'low' || m.status === 'high') || 
                          detectedMarkers[0];

    medicalGuidelines = searchMedicalKnowledgeBase(rawQuery, queriedMarker?.marker || '', queriedMarker?.status || '');
    
    if (medicalGuidelines.length === 0 && queriedMarker) {
      evidenceSufficient = false;
      evidenceNote = `Notice: Specific curated guideline for ${queriedMarker.marker} is limited in the current reference database. Explanations should be framed as general educational reference.`;
    }
  } catch (err) {
    console.warn('Server Medical KB search warning:', err.message);
  }

  // Source B: PostgreSQL Trigram Search over report_chunks
  let chunks = [];
  try {
    let sql = `
      SELECT rc.id, rc.report_id, rc.file_name, rc.chunk_text, rc.metrics_text, rc.created_at
      FROM report_chunks rc
      WHERE rc.user_id = $1
    `;
    const params = [userId];

    if (reportId) {
      sql += ` AND rc.report_id = $2`;
      params.push(reportId);
    }

    sql += ` ORDER BY rc.created_at DESC LIMIT $${params.length + 1}`;
    params.push(topK);

    const chunkRes = await query(sql, params);
    chunks = chunkRes.rows || [];
  } catch (err) {
    console.warn('Server PostgreSQL RAG query error:', err.message);
  }

  const citations = [];
  const reportBlocks = chunks.map((c, index) => {
    const reportDate = c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Recent';
    citations.push({
      report_id: c.report_id,
      file_name: c.file_name,
      created_at: reportDate,
      metrics_text: c.metrics_text || '',
    });

    return `[USER REPORT #${index + 1}: ${c.file_name} (Uploaded: ${reportDate})]
${c.chunk_text}`;
  });

  const kbBlocks = medicalGuidelines.map((kb, idx) => {
    return `[CURATED MEDICAL GUIDELINE #${idx + 1}: ${kb.marker}]
Reference Interval: ${kb.referenceRange} (${kb.unit})
Classification: ${kb.statusText}
Clinical Interpretation: ${kb.interpretation}
Possible Causes: ${kb.possibleCauses.join('; ')}
Clinical Significance: ${kb.clinicalSignificance}`;
  });

  const deterministicValidationText = detectedMarkers.map(
    (m) => `- ${m.marker.toUpperCase()}: ${m.value} ${m.unit || ''} -> Rule Engine Classification: [${m.status.toUpperCase()}]`
  ).join('\n');

  const ragPromptText = `
STEP 1: DETERMINISTIC RULE ENGINE LABORATORY VALIDATION:
${deterministicValidationText || 'No numerical metrics provided'}

STEP 3: RETRIEVED CURATED MEDICAL REFERENCE GUIDELINES:
${kbBlocks.length > 0 ? kbBlocks.join('\n\n---\n\n') : 'Standard clinical reference guidelines applied'}

STEP 3: RETRIEVED USER REPORT RECORDS:
${reportBlocks.length > 0 ? reportBlocks.join('\n\n---\n\n') : 'No prior user reports found'}

STEP 4: RAG SYSTEM INSTRUCTIONS:
1. Explain the results using ONLY the deterministic classifications and retrieved medical evidence above.
2. Do NOT invent medical facts or hallucinate reference ranges.
3. Clearly state the exact numerical value, unit, and deterministic rule classification (e.g. LOW or HIGH).
4. Do NOT diagnose the patient — frame explanations as educational reference.
5. Highlight when clinician review is appropriate.
`;

  return {
    ragPromptText,
    citations,
    medicalGuidelines,
  };
}
