export type MetricStatus = "low" | "high" | "normal" | "critical";

export interface LabMetric {
  name: string;
  value: string | number;
  unit?: string;
  status?: MetricStatus;
  confidence?: number;
  source?: "regex" | "clinicalbert" | "ocr";
}

export interface MetricValue {
  value: number;
  unit?: string;
  status: MetricStatus;
}

export interface ParsedReport {
  metrics: Record<string, LabMetric>;
  summary: string;
  riskLevel: "Normal" | "Mild Risk" | "High Risk";
  extractedText: string;
  risks: string[];
}

// ── UI Display Types ──
export interface ValueObj {
  value?: number;
  unit?: string;
  status?: "low" | "normal" | "high";
}

export interface PredictionData {
  risk_level?: "Normal" | "Mild Risk" | "High Risk";
  abnormal_parameters?: string[];
  insights?: string[];
  score?: number;
  confidence?: number;
  ai_engine?: {
    clinicalbert_used?: boolean;
    source?: string;
    entities_detected?: number;
  };
}

export interface ReportData {
  id: string;
  file_name: string;
  created_at: string;
  summary: string | null;
  values: Record<string, ValueObj> | null;
  prediction: PredictionData | null;
  raw_text?: string;
  file_path?: string;
  local_only?: boolean;
}
