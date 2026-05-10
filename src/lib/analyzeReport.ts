/**
 * Client-side lab report analyzer using ClinicalBERT (Hugging Face Inference API)
 * + regex-based numeric value extraction.
 *
 * This replaces the Supabase Edge Function `analyze-report` so the app works
 * without needing to deploy Edge Functions (which require Docker).
 */

import { supabase } from "@/integrations/supabase/client";

type Status = "low" | "normal" | "high";
type MetricValue = { value: number; unit: string; status: Status } | null;

export interface AnalysisResult {
  values: Record<string, MetricValue>;
  summary: string;
  risks: string[];
  possible_conditions: { name: string; confidence: number; rationale: string }[];
  findings?: { text: string; label: string | null; score: number | null }[];
}

// ── Regex-based value extraction ───────────────────────────────────────────

function findValue(text: string, keys: string[]): number | null {
  // Robust search: check line-by-line for keyword + number pairs, and also try global patterns
  if (!text) return null;
  const escapedKeys = keys.map(k => k.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&"));
  const keyPattern = escapedKeys.join("|");

  // normalize commas in numbers (e.g., 1,234.5)
  const normText = text.replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1");

  const lines = normText.split(/\r?\n/);
  for (const line of lines) {
    const l = line.toLowerCase();
    if (new RegExp(`\\b(?:${keyPattern})\\b`).test(l)) {
      // keyword before number
      const m1 = l.match(new RegExp(`\\b(?:${keyPattern})\\b[^0-9\n]{0,60}([0-9]+(?:\\.[0-9]+)?)`));
      if (m1) return parseFloat(m1[1]);
      // number before keyword on same line
      const m2 = l.match(new RegExp(`([0-9]+(?:\\.[0-9]+)?)[^0-9\\n]{0,60}\\b(?:${keyPattern})\\b`));
      if (m2) return parseFloat(m2[1]);
      // any number on the line
      const m3 = l.match(/([0-9]+(?:\.[0-9]+)?)/);
      if (m3) return parseFloat(m3[1]);
    }
  }

  // Fallback global patterns
  const g1 = normText.match(new RegExp(`\\b(?:${keyPattern})\\b[^0-9\n]{0,120}([0-9]+(?:\\.[0-9]+)?)`, "i"));
  if (g1) return parseFloat(g1[1]);
  const g2 = normText.match(new RegExp(`([0-9]+(?:\\.[0-9]+)?)[^0-9\\n]{0,120}\\b(?:${keyPattern})\\b`, "i"));
  if (g2) return parseFloat(g2[1]);

  return null;
}

function extractValues(text: string): Record<string, MetricValue> {
  return {
    hemoglobin: (() => {
      const v = findValue(text, ["hemoglobin", "hb", "hgb"]);
      return v == null ? null : { value: v, unit: "g/dL", status: (v < 12 ? "low" : v > 17.5 ? "high" : "normal") as Status };
    })(),
    wbc: (() => {
      const v = findValue(text, ["wbc", "white blood cell", "white blood cells", "total wbc", "total leucocyte"]);
      return v == null ? null : { value: v, unit: "x10^9/L", status: (v < 4 ? "low" : v > 11 ? "high" : "normal") as Status };
    })(),
    rbc: (() => {
      const v = findValue(text, ["rbc", "red blood cell", "red blood cells", "total rbc"]);
      return v == null ? null : { value: v, unit: "10^12/L", status: (v < 4 ? "low" : v > 5.9 ? "high" : "normal") as Status };
    })(),
    platelets: (() => {
      const v = findValue(text, ["platelets", "platelet", "platelet count"]);
      return v == null ? null : { value: v, unit: "10^9/L", status: (v < 150 ? "low" : v > 450 ? "high" : "normal") as Status };
    })(),
    glucose: (() => {
      const v = findValue(text, ["glucose", "blood sugar", "fasting glucose", "random glucose"]);
      return v == null ? null : { value: v, unit: "mg/dL", status: (v < 70 ? "low" : v > 140 ? "high" : "normal") as Status };
    })(),
  };
}

// ── Rule-based condition detection ─────────────────────────────────────────

function detectConditions(values: Record<string, MetricValue>): { name: string; confidence: number; rationale: string }[] {
  const conditions: { name: string; confidence: number; rationale: string }[] = [];

  if (values.hemoglobin?.status === "low") {
    conditions.push({
      name: "Possible anemia",
      confidence: 35,
      rationale: `Low hemoglobin (${values.hemoglobin.value} ${values.hemoglobin.unit}) — requires clinical confirmation`,
    });
  }
  if (values.hemoglobin?.status === "high") {
    conditions.push({
      name: "Possible polycythemia",
      confidence: 25,
      rationale: `Elevated hemoglobin (${values.hemoglobin.value} ${values.hemoglobin.unit}) — requires clinical confirmation`,
    });
  }
  if (values.wbc?.status === "high") {
    conditions.push({
      name: "Possible infection/inflammation",
      confidence: 30,
      rationale: `Elevated WBC (${values.wbc.value} ${values.wbc.unit}) — requires clinical confirmation`,
    });
  }
  if (values.wbc?.status === "low") {
    conditions.push({
      name: "Possible immune suppression (leukopenia)",
      confidence: 30,
      rationale: `Low WBC (${values.wbc.value} ${values.wbc.unit}) — requires clinical confirmation`,
    });
  }
  if (values.platelets?.status === "low") {
    conditions.push({
      name: "Possible thrombocytopenia (bleeding risk)",
      confidence: 30,
      rationale: `Low platelets (${values.platelets.value} ${values.platelets.unit}) — requires clinical confirmation`,
    });
  }
  if (values.platelets?.status === "high") {
    conditions.push({
      name: "Possible thrombocytosis (clotting risk)",
      confidence: 25,
      rationale: `High platelets (${values.platelets.value} ${values.platelets.unit}) — requires clinical confirmation`,
    });
  }
  if (values.glucose?.status === "high") {
    conditions.push({
      name: "Possible diabetes/pre-diabetes",
      confidence: 30,
      rationale: `High glucose (${values.glucose.value} ${values.glucose.unit}) — requires clinical confirmation`,
    });
  }

  return conditions;
}

// ── Summary generation ─────────────────────────────────────────────────────

function buildSummary(values: Record<string, MetricValue>): string {
  const parts: string[] = [];
  Object.entries(values).forEach(([key, v]) => {
    if (v) parts.push(`${key.toUpperCase()}: ${v.value} ${v.unit} (${v.status})`);
  });

  if (parts.length === 0) {
    return "No common lab values were detected in the uploaded report. Please ensure the file contains readable text with lab results.";
  }

  const abnormal = Object.entries(values).filter(([, v]) => v && v.status !== "normal");
  let summary = `Detected values — ${parts.join("; ")}.`;

  if (abnormal.length === 0) {
    summary += " All detected values appear to be within normal reference ranges. Great news!";
  } else {
    summary += ` ${abnormal.length} value(s) appear outside normal ranges and may warrant follow-up.`;
  }

  summary += " Please consult a healthcare professional for proper interpretation.";
  return summary;
}

// ── ClinicalBERT HF API call (optional enrichment) ────────────────────────

async function callClinicalBERT(text: string, apiKey: string): Promise<{ text: string; label: string | null; score: number | null }[]> {
  // Prefer calling the server-side Supabase Edge Function (or other backend) to avoid CORS when
  // running in the browser. The repo includes a Supabase function named `analyze-report`.
  try {
    const useEdge = import.meta.env.VITE_USE_EDGE_FUNCTION === 'true' || import.meta.env.VITE_USE_SUPABASE_FUNCTION === 'true' || Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    if (useEdge) {
      try {
        const fnName = 'analyze-report';
        const res = await supabase.functions.invoke(fnName, {
          body: JSON.stringify({ rawText: text, fileName: '' }),
        });
        if ((res as any).error) {
          console.warn('Supabase function returned error', (res as any).error);
        } else {
          const data = (res as any).data ?? (res as any).body ?? (res as any);
          // Expecting { findings: [...] } or array
          if (Array.isArray(data.findings)) return data.findings;
          if (Array.isArray(data)) return data as any;
        }
      } catch (e) {
        console.warn('Calling supabase function failed, falling back to direct HF call:', e);
      }
    }

    // Fallback: direct HuggingFace inference API (may be blocked by CORS in browsers)
    const HF_URL = "https://api-inference.huggingface.co/models/emilyalsentzer/Bio_ClinicalBERT";
    const truncated = text.slice(0, 2000);

    const resp = await fetch(HF_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: truncated, options: { wait_for_model: true } }),
    });

    if (!resp.ok) {
      console.warn("ClinicalBERT API returned non-OK status:", resp.status);
      return [];
    }

    const data = await resp.json();
    const entities = Array.isArray(data) ? data : data?.[0] ? data[0] : [];
    return (entities || []).map((e: any) => ({ text: e.word || e.token || e.entity || e.label || "", label: e.entity_group || e.entity || e.label || null, score: e.score || e.confidence || null }));
  } catch (err) {
    console.warn("ClinicalBERT API call failed (will continue with regex-only analysis):", err);
    return [];
  }
}

// ── Main entry point ───────────────────────────────────────────────────────

export async function analyzeReport(rawText: string, fileName: string): Promise<AnalysisResult> {
  const text = rawText || "";

  // 1. Extract numeric values via regex
  const values = extractValues(text);

  // 2. Detect possible conditions based on extracted values
  const possible_conditions = detectConditions(values);

  // 3. Build human-readable summary
  const summary = buildSummary(values);

  // 4. Build risks array
  const risks = possible_conditions.map((c) => c.name);

  // 5. Optionally call ClinicalBERT for entity enrichment
  const apiKey = import.meta.env.VITE_AI_GATEWAY_KEY;
  let findings: { text: string; label: string | null; score: number | null }[] = [];
  if (apiKey && text.trim().length > 0) {
    findings = await callClinicalBERT(text, apiKey);

    // Entity-guided fallback: use the improved findValue to extract numbers near detected entity labels
    const mapEntityToKeys: Record<string, string[]> = {
      hemoglobin: ['hemoglobin','hgb','hb','haemoglobin','h b'],
      wbc: ['wbc','white blood cell','white blood cells','total wbc','leukocyte','leucocyte'],
      rbc: ['rbc','red blood cell','red blood cells'],
      platelets: ['platelets','platelet','plt','platelet count'],
      glucose: ['glucose','blood sugar','fasting glucose','random glucose']
    };

    findings.forEach((f) => {
      if (!f?.text) return;
      const key = f.text.toLowerCase();
      let val: number | null = null;

      if (/hgb|hemoglobin|\bhb\b|haemoglobin/.test(key)) val = findValue(text, mapEntityToKeys.hemoglobin);
      else if (/wbc|white blood|leukocyte|leucocyte/.test(key)) val = findValue(text, mapEntityToKeys.wbc);
      else if (/rbc|red blood/.test(key)) val = findValue(text, mapEntityToKeys.rbc);
      else if (/platelet|plt/.test(key)) val = findValue(text, mapEntityToKeys.platelets);
      else if (/glucose|blood sugar/.test(key)) val = findValue(text, mapEntityToKeys.glucose);

      if (val != null) {
        if (!values.hemoglobin && /hgb|hemoglobin|\bhb\b|haemoglobin/.test(key)) values.hemoglobin = { value: val, unit: 'g/dL', status: (val < 12 ? 'low' : val > 17.5 ? 'high' : 'normal') };
        if (!values.wbc && /wbc|white blood|leukocyte|leucocyte/.test(key)) values.wbc = { value: val, unit: 'x10^9/L', status: (val < 4 ? 'low' : val > 11 ? 'high' : 'normal') };
        if (!values.rbc && /rbc|red blood/.test(key)) values.rbc = { value: val, unit: '10^12/L', status: (val < 4 ? 'low' : val > 5.9 ? 'high' : 'normal') };
        if (!values.platelets && /platelet|plt/.test(key)) values.platelets = { value: val, unit: '10^9/L', status: (val < 150 ? 'low' : val > 450 ? 'high' : 'normal') };
        if (!values.glucose && /glucose|blood sugar/.test(key)) values.glucose = { value: val, unit: 'mg/dL', status: (val < 70 ? 'low' : val > 140 ? 'high' : 'normal') };
      }
    });
  }

  console.log(`[analyzeReport] File: ${fileName} | ClinicalBERT entities: ${findings.length} | Extracted values:`, values);

  return { values, summary, risks, possible_conditions, findings };
}
