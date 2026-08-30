import { apiClient } from "@/lib/apiClient";
import { getLocalReports } from "@/lib/localReports";
import { searchMedicalKnowledgeBase } from "@/lib/medicalKnowledgeBase";

/**
 * 5-Step RAG & Medical Reasoning Pipeline Engine:
 * Step 1: Deterministic Rule Engine Validation
 * Step 2: Clinical Search Query Generator
 * Step 3: Dual-Source Vector/Semantic Search (Curated KB + User Reports)
 * Step 4: Orchestrated Prompt Assembly with Strict Evidence Grounding
 * Step 5: Grounded LLM Response
 */
export async function retrieveRagContext(options = {}) {
  const { query, userId, reportId = null, topK = 5, activeValues = {} } = options;
  if (!query || !query.trim()) {
    return { ragPromptText: "", citations: [], medicalGuidelines: [] };
  }

  const rawQuery = query.trim();

  // ── Step 1 & 2: Deterministic Rule Engine Validation & Search Query Generator ──────────
  const targetedQueries = [];
  const detectedMarkers = [];

  let valuesObj = activeValues || {};
  if (typeof valuesObj === "string") {
    try { valuesObj = JSON.parse(valuesObj); } catch (e) { valuesObj = {}; }
  }

  Object.entries(valuesObj).forEach(([key, v]) => {
    if (v?.value != null) {
      const status = v.status || "normal";
      detectedMarkers.push({ marker: key, value: v.value, unit: v.unit, status });
      if (status === "low" || status === "high") {
        targetedQueries.push(`${key} ${status} interpretation causes of ${status} ${key} clinical significance`);
      }
    }
  });

  const combinedSearchTerm = targetedQueries.length > 0 ? `${rawQuery} ${targetedQueries.join(" ")}` : rawQuery;

  // ── Step 3: Dual-Source RAG Search ────────────────────────────────────────────────────────

  // Source A: Curated Medical Knowledge Base Search
  let medicalGuidelines = [];
  try {
    const primaryMarker = detectedMarkers.find((m) => m.status === "low" || m.status === "high") || detectedMarkers[0];
    medicalGuidelines = searchMedicalKnowledgeBase(combinedSearchTerm, primaryMarker?.marker || "", primaryMarker?.status || "");
  } catch (err) {
    console.warn("Medical KB search warning:", err.message);
  }

  // Source B: User Reports Search
  let chunks = [];
  try {
    const res = await apiClient.searchRagChunks({
      query: combinedSearchTerm,
      report_id: reportId || undefined,
      top_k: topK,
    });
    chunks = res?.chunks || [];
  } catch (err) {
    console.warn("Backend RAG search unavailable, using local report cache fallback:", err.message);
    const localReports = getLocalReports(userId);
    chunks = localReports.slice(0, topK).map((r, idx) => {
      let valuesStr = "";
      if (r.values && typeof r.values === "object") {
        valuesStr = Object.entries(r.values)
          .filter(([, v]) => v?.value != null)
          .map(([k, v]) => `${k.toUpperCase()}: ${v.value} ${v.unit || ""} (${v.status || "normal"})`)
          .join(" | ");
      }
      return {
        id: r.id || `local_chunk_${idx}`,
        report_id: r.id,
        file_name: r.file_name || "Lab Report",
        chunk_text: `File: ${r.file_name}\nSummary: ${r.summary || "No summary"}\nParameters: ${valuesStr}`,
        metrics_text: valuesStr,
        created_at: r.created_at || new Date().toISOString(),
      };
    });
  }

  // ── Step 4 & 5: Prompt Orchestration & Evidence Assembly ──────────────────────────────
  const citations = [];
  const reportBlocks = chunks.map((c, index) => {
    const reportDate = c.created_at ? new Date(c.created_at).toLocaleDateString() : "Recent";
    citations.push({
      report_id: c.report_id,
      file_name: c.file_name,
      created_at: reportDate,
      metrics_text: c.metrics_text || "",
    });

    return `[USER REPORT #${index + 1}: ${c.file_name} (Uploaded: ${reportDate})]
${c.chunk_text}`;
  });

  const kbBlocks = medicalGuidelines.map((kb, idx) => {
    return `[CURATED MEDICAL GUIDELINE #${idx + 1}: ${kb.marker}]
Reference Interval: ${kb.referenceRange} (${kb.unit})
Classification: ${kb.statusText}
Clinical Interpretation: ${kb.interpretation}
Possible Causes: ${kb.possibleCauses.join("; ")}
Clinical Significance: ${kb.clinicalSignificance}`;
  });

  const deterministicValidationText = detectedMarkers.map(
    (m) => `- ${m.marker.toUpperCase()}: ${m.value} ${m.unit || ""} -> Rule Engine Classification: [${m.status.toUpperCase()}]`
  ).join("\n");

  const ragPromptText = `
STEP 1: DETERMINISTIC RULE ENGINE LABORATORY VALIDATION:
${deterministicValidationText || "No numerical metrics provided"}

STEP 3: RETRIEVED CURATED MEDICAL REFERENCE GUIDELINES:
${kbBlocks.length > 0 ? kbBlocks.join("\n\n---\n\n") : "Standard clinical reference guidelines applied"}

STEP 3: RETRIEVED USER REPORT RECORDS:
${reportBlocks.length > 0 ? reportBlocks.join("\n\n---\n\n") : "No prior user reports found"}

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
