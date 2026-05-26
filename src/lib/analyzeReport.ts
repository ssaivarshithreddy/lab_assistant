/**
 * Client-side lab report analyzer using ClinicalBERT (Hugging Face Inference API)
 * + regex-based numeric value extraction.
 *
 * This replaces the Supabase Edge Function `analyze-report` so the app works
 * without needing to deploy Edge Functions (which require Docker).
 */

import { supabase } from "@/integrations/supabase/client";
import { cloudEnabled } from "@/lib/cloudMode";

type Status = "low" | "normal" | "high";
type MetricValue = { value: number; unit: string; status: Status } | null;

export interface AnalysisResult {
  values: Record<string, MetricValue>;
  summary: string;
  risks: string[];
  possible_conditions: { name: string; confidence: number; rationale: string }[];
  findings?: { text: string; label: string | null; score: number | null }[];
  ai_engine?: {
    clinicalbert_used: boolean;
    source: "edge-function" | "huggingface-direct" | "regex-only";
    entities_detected: number;
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Regex-based value extraction ───────────────────────────────────────────

function findValue(text: string, keys: string[]): number | null {
  // Robust search: check line-by-line for keyword + number pairs, and also try global patterns
  if (!text) return null;
  const escapedKeys = keys.map((k) => escapeRegex(k));
  const keyPattern = escapedKeys.join("|");
  const numPattern = "([0-9]+(?:\\.[0-9]+)?)(?!\\s*[-–]\\s*[0-9])";

  // normalize commas in numbers (e.g., 1,234.5)
  const normText = text.replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1");

  const lines = normText.split(/\r?\n/);
  for (const line of lines) {
    const l = line.toLowerCase();
    if (new RegExp(`\\b(?:${keyPattern})\\b`).test(l)) {
      // keyword before number
      const m1 = l.match(new RegExp(`\\b(?:${keyPattern})\\b[^0-9\\n]{0,40}${numPattern}`));
      if (m1) return parseFloat(m1[1]);
      // number before keyword on same line
      const m2 = l.match(new RegExp(`${numPattern}[^0-9\\n]{0,40}\\b(?:${keyPattern})\\b`));
      if (m2) return parseFloat(m2[1]);
    }
  }

  // Fallback global patterns
  const g1 = normText.match(new RegExp(`\\b(?:${keyPattern})\\b[^0-9\\n]{0,50}${numPattern}`, "i"));
  if (g1) return parseFloat(g1[1]);
  const g2 = normText.match(new RegExp(`${numPattern}[^0-9\\n]{0,50}\\b(?:${keyPattern})\\b`, "i"));
  if (g2) return parseFloat(g2[1]);

  return null;
}

function normalizeWbc(v: number): number {
  if (v > 200) return v / 1000;
  if (v > 0 && v < 1) return v * 10;
  return v;
}

function normalizePlatelets(v: number): number {
  if (v > 10000) return v / 1000;
  if (v > 0 && v < 50) return v * 10;
  return v;
}

function normalizeGeneric(metric: string, v: number): number | null {
  if (!Number.isFinite(v)) return null;
  let x = v;
  if (metric === "glucose" && x > 0 && x < 20) x *= 10;
  if (metric === "hematocrit" && x > 0 && x < 10) x *= 10;
  if (metric === "mcv" && x > 0 && x < 20) x *= 10;
  if ((metric === "sodium" || metric === "chloride") && x > 0 && x < 40) x *= 10;
  if (metric === "potassium" && x > 0 && x < 1) x *= 10;
  if (metric === "creatinine" && x > 10) return null;
  if (metric === "bilirubin" && x > 20) return null;
  return x;
}

function extractValues(text: string): Record<string, MetricValue> {
  return {
    hemoglobin: (() => {
      const v = findValue(text, ["hemoglobin", "hb", "hgb"]);
      return v == null ? null : { value: v, unit: "g/dL", status: (v < 12 ? "low" : v > 17.5 ? "high" : "normal") as Status };
    })(),
    wbc: (() => {
      const raw = findValue(text, ["wbc", "white blood cell", "white blood cells", "total wbc", "total leucocyte"]);
      const v = raw == null ? null : normalizeWbc(raw);
      return v == null ? null : { value: v, unit: "x10^9/L", status: (v < 4 ? "low" : v > 11 ? "high" : "normal") as Status };
    })(),
    rbc: (() => {
      const v = findValue(text, ["rbc", "red blood cell", "red blood cells", "total rbc"]);
      return v == null ? null : { value: v, unit: "10^12/L", status: (v < 4 ? "low" : v > 5.9 ? "high" : "normal") as Status };
    })(),
    platelets: (() => {
      const raw = findValue(text, ["platelets", "platelet", "platelet count"]);
      const v = raw == null ? null : normalizePlatelets(raw);
      return v == null ? null : { value: v, unit: "10^9/L", status: (v < 150 ? "low" : v > 450 ? "high" : "normal") as Status };
    })(),
    glucose: (() => {
      const raw = findValue(text, ["glucose", "blood sugar", "fasting glucose", "random glucose"]);
      const v = raw == null ? null : normalizeGeneric("glucose", raw);
      return v == null ? null : { value: v, unit: "mg/dL", status: (v < 70 ? "low" : v > 140 ? "high" : "normal") as Status };
    })(),
    hematocrit: (() => {
      const raw = findValue(text, ["hematocrit", "hct", "pcv"]);
      const v = raw == null ? null : normalizeGeneric("hematocrit", raw);
      return v == null ? null : { value: v, unit: "%", status: (v < 36 ? "low" : v > 52 ? "high" : "normal") as Status };
    })(),
    mcv: (() => {
      const raw = findValue(text, ["mcv", "mean corpuscular volume"]);
      const v = raw == null ? null : normalizeGeneric("mcv", raw);
      return v == null ? null : { value: v, unit: "fL", status: (v < 80 ? "low" : v > 100 ? "high" : "normal") as Status };
    })(),
    mch: (() => {
      const v = findValue(text, ["mch", "mean corpuscular hemoglobin"]);
      return v == null ? null : { value: v, unit: "pg", status: (v < 27 ? "low" : v > 33 ? "high" : "normal") as Status };
    })(),
    mchc: (() => {
      const v = findValue(text, ["mchc", "mean corpuscular hemoglobin concentration"]);
      return v == null ? null : { value: v, unit: "g/dL", status: (v < 32 ? "low" : v > 36 ? "high" : "normal") as Status };
    })(),
    neutrophils: (() => {
      const v = findValue(text, ["neutrophils", "neutrophil"]);
      return v == null ? null : { value: v, unit: "%", status: (v < 40 ? "low" : v > 75 ? "high" : "normal") as Status };
    })(),
    lymphocytes: (() => {
      const v = findValue(text, ["lymphocytes", "lymphocyte"]);
      return v == null ? null : { value: v, unit: "%", status: (v < 20 ? "low" : v > 45 ? "high" : "normal") as Status };
    })(),
    monocytes: (() => {
      const v = findValue(text, ["monocytes", "monocyte"]);
      return v == null ? null : { value: v, unit: "%", status: (v < 2 ? "low" : v > 10 ? "high" : "normal") as Status };
    })(),
    eosinophils: (() => {
      const v = findValue(text, ["eosinophils", "eosinophil"]);
      return v == null ? null : { value: v, unit: "%", status: (v < 1 ? "low" : v > 6 ? "high" : "normal") as Status };
    })(),
    basophils: (() => {
      const v = findValue(text, ["basophils", "basophil"]);
      return v == null ? null : { value: v, unit: "%", status: (v < 0 ? "low" : v > 2 ? "high" : "normal") as Status };
    })(),
    creatinine: (() => {
      const raw = findValue(text, ["creatinine", "serum creatinine"]);
      const v = raw == null ? null : normalizeGeneric("creatinine", raw);
      return v == null ? null : { value: v, unit: "mg/dL", status: (v < 0.6 ? "low" : v > 1.3 ? "high" : "normal") as Status };
    })(),
    urea: (() => {
      const v = findValue(text, ["urea", "blood urea"]);
      return v == null ? null : { value: v, unit: "mg/dL", status: (v < 15 ? "low" : v > 40 ? "high" : "normal") as Status };
    })(),
    bun: (() => {
      const v = findValue(text, ["bun", "blood urea nitrogen"]);
      return v == null ? null : { value: v, unit: "mg/dL", status: (v < 7 ? "low" : v > 20 ? "high" : "normal") as Status };
    })(),
    sodium: (() => {
      const raw = findValue(text, ["sodium", "na+"]);
      const v = raw == null ? null : normalizeGeneric("sodium", raw);
      return v == null ? null : { value: v, unit: "mmol/L", status: (v < 135 ? "low" : v > 145 ? "high" : "normal") as Status };
    })(),
    potassium: (() => {
      const raw = findValue(text, ["potassium", "k+"]);
      const v = raw == null ? null : normalizeGeneric("potassium", raw);
      return v == null ? null : { value: v, unit: "mmol/L", status: (v < 3.5 ? "low" : v > 5.1 ? "high" : "normal") as Status };
    })(),
    chloride: (() => {
      const raw = findValue(text, ["chloride", "cl-"]);
      const v = raw == null ? null : normalizeGeneric("chloride", raw);
      return v == null ? null : { value: v, unit: "mmol/L", status: (v < 98 ? "low" : v > 107 ? "high" : "normal") as Status };
    })(),
    calcium: (() => {
      const v = findValue(text, ["calcium", "ca++"]);
      return v == null ? null : { value: v, unit: "mg/dL", status: (v < 8.5 ? "low" : v > 10.5 ? "high" : "normal") as Status };
    })(),
    bilirubin: (() => {
      const v = findValue(text, ["bilirubin", "total bilirubin"]);
      return v == null ? null : { value: v, unit: "mg/dL", status: (v < 0.2 ? "low" : v > 1.2 ? "high" : "normal") as Status };
    })(),
    ast: (() => {
      const v = findValue(text, ["ast", "sgot"]);
      return v == null ? null : { value: v, unit: "U/L", status: (v < 10 ? "low" : v > 40 ? "high" : "normal") as Status };
    })(),
    alt: (() => {
      const v = findValue(text, ["alt", "sgpt"]);
      return v == null ? null : { value: v, unit: "U/L", status: (v < 7 ? "low" : v > 56 ? "high" : "normal") as Status };
    })(),
    alp: (() => {
      const v = findValue(text, ["alp", "alkaline phosphatase"]);
      return v == null ? null : { value: v, unit: "U/L", status: (v < 44 ? "low" : v > 147 ? "high" : "normal") as Status };
    })(),
    crp: (() => {
      const v = findValue(text, ["crp", "c-reactive protein", "c reactive protein"]);
      return v == null ? null : { value: v, unit: "mg/L", status: (v < 0 ? "low" : v > 5 ? "high" : "normal") as Status };
    })(),
    hba1c: (() => {
      const v = findValue(text, ["hba1c", "glycated hemoglobin", "hemoglobin a1c"]);
      return v == null ? null : { value: v, unit: "%", status: (v < 4 ? "low" : v > 5.6 ? "high" : "normal") as Status };
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
  if (values.creatinine?.status === "high" || values.urea?.status === "high" || values.bun?.status === "high") {
    conditions.push({
      name: "Possible kidney function stress",
      confidence: 28,
      rationale: "Renal markers are above reference range — requires clinical confirmation",
    });
  }
  if (values.alt?.status === "high" || values.ast?.status === "high" || values.bilirubin?.status === "high") {
    conditions.push({
      name: "Possible liver function abnormality",
      confidence: 28,
      rationale: "Liver-related markers are above reference range — requires clinical confirmation",
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

function looksLikeRadiologyReport(text: string): boolean {
  const t = (text || "").toLowerCase();
  const signals = ["impression", "observation", "technique", "appendix", "liver", "kidney", "ct "];
  const score = signals.reduce((n, s) => n + (t.includes(s) ? 1 : 0), 0);
  return score >= 3;
}

function buildRadiologySummary(text: string): {
  summary: string;
  risks: string[];
  possible_conditions: { name: string; confidence: number; rationale: string }[];
} {
  const normalized = text.replace(/\s+/g, " ").trim();
  const match = normalized.match(/impression[:\s-]+(.+)/i);
  const block = match ? match[1] : normalized.slice(0, 1200);
  const findings = block
    .split(/(?:•|- )/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, 6);
  const selected = findings.length > 0 ? findings : [block.slice(0, 450)];

  const risks: string[] = [];
  const possible_conditions: { name: string; confidence: number; rationale: string }[] = [];
  const joined = selected.join(" ").toLowerCase();

  if (/no ct evidence of acute appendicitis|no evidence of acute appendicitis/.test(joined)) {
    possible_conditions.push({
      name: "No radiologic evidence of acute appendicitis",
      confidence: 80,
      rationale: "Impression explicitly states no CT evidence of appendicitis.",
    });
  }
  if (/hepatomegaly|liver.*enlarged/.test(joined)) {
    risks.push("Mild hepatomegaly");
    possible_conditions.push({
      name: "Possible hepatomegaly",
      confidence: 65,
      rationale: "Impression/observation indicates enlarged liver.",
    });
  }
  if (/free fluid.*pouch of douglas/.test(joined)) {
    risks.push("Mild pelvic free fluid");
  }
  if (risks.length === 0 && possible_conditions.length === 0) {
    risks.push("Radiology findings present - requires clinician interpretation");
  }

  return {
    summary: `Radiology impression extracted: ${selected.join(" | ")} Please review with your treating doctor for clinical correlation.`,
    risks,
    possible_conditions,
  };
}

// ── ClinicalBERT HF API call (optional enrichment) ────────────────────────

async function callClinicalBERT(text: string, apiKey: string): Promise<{ text: string; label: string | null; score: number | null }[]> {
  // Prefer calling the server-side Supabase Edge Function (or other backend) to avoid CORS when
  // running in the browser. The repo includes a Supabase function named `analyze-report`.
  try {
    const useEdge =
      cloudEnabled() &&
      (import.meta.env.VITE_USE_EDGE_FUNCTION === "true" || import.meta.env.VITE_USE_SUPABASE_FUNCTION === "true");
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
    const configuredUrl = import.meta.env.VITE_AI_GATEWAY_URL as string | undefined;
    const fallbackUrls = [
      "https://router.huggingface.co/hf-inference/models/d4data/biomedical-ner-all",
      "https://router.huggingface.co/hf-inference/models/emilyalsentzer/Bio_ClinicalBERT",
      "https://api-inference.huggingface.co/models/medicalai/ClinicalBERT",
      "https://api-inference.huggingface.co/models/emilyalsentzer/Bio_ClinicalBERT",
      // Reliable biomedical NER fallback when a ClinicalBERT endpoint does not expose token-classification output.
      "https://api-inference.huggingface.co/models/d4data/biomedical-ner-all",
    ];
    const urlsToTry = [configuredUrl, ...fallbackUrls].filter((u, i, arr): u is string => !!u && arr.indexOf(u) === i);
    const truncated = text.slice(0, 2000);

    for (const url of urlsToTry) {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: truncated, options: { wait_for_model: true } }),
      });

      if (!resp.ok) {
        console.warn("ClinicalBERT API returned non-OK status:", resp.status, "for", url);
        continue;
      }

      const data = await resp.json();
      const entities = Array.isArray(data) ? data : data?.[0] ? data[0] : [];
      const normalized = (entities || [])
        .map((e: any) => ({
          text: e.word || e.token || e.entity || e.label || "",
          label: e.entity_group || e.entity || e.label || null,
          score: e.score || e.confidence || null,
        }))
        .filter((e: any) => !!e.text);

      if (normalized.length > 0) return normalized;
    }

    return [];
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

  // 5. Optionally call ClinicalBERT for entity enrichment
  const apiKey = import.meta.env.VITE_AI_GATEWAY_KEY;
  let findings: { text: string; label: string | null; score: number | null }[] = [];
  let aiEngine: AnalysisResult["ai_engine"] = {
    clinicalbert_used: false,
    source: "regex-only",
    entities_detected: 0,
  };
  if (apiKey && text.trim().length > 0) {
    findings = await callClinicalBERT(text, apiKey);
    aiEngine = {
      clinicalbert_used: findings.length > 0,
      source: findings.length > 0 ? "huggingface-direct" : "regex-only",
      entities_detected: findings.length,
    };

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

  const hasAnyLabValue = Object.values(values).some((v) => !!v);
  if (looksLikeRadiologyReport(text) && !hasAnyLabValue) {
    const radiology = buildRadiologySummary(text);
    return {
      values,
      summary: radiology.summary,
      risks: radiology.risks,
      possible_conditions: radiology.possible_conditions,
      findings,
      ai_engine: aiEngine,
    };
  }

  const possible_conditions = detectConditions(values);
  const summary = buildSummary(values);
  const risks = possible_conditions.map((c) => c.name);

  return { values, summary, risks, possible_conditions, findings, ai_engine: aiEngine };
}
