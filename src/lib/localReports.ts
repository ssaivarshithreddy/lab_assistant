type ValueObj = { value?: number; unit?: string; status?: "low" | "normal" | "high" };
type Prediction = {
  risk_level?: "Normal" | "Mild Risk" | "High Risk";
  abnormal_parameters?: string[];
  insights?: string[];
  score?: number;
  confidence?: number;
};

export type LocalReport = {
  id: string;
  file_name: string;
  created_at: string;
  summary: string | null;
  values: Record<string, ValueObj> | null;
  prediction: Prediction | null;
  raw_text?: string;
  file_path?: string;
  local_only: true;
};

function getKey(userId?: string | null): string {
  return `lab_assistant_local_reports:${userId || "anonymous"}`;
}

function read(userId?: string | null): LocalReport[] {
  try {
    const raw = localStorage.getItem(getKey(userId));
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function write(rows: LocalReport[], userId?: string | null) {
  localStorage.setItem(getKey(userId), JSON.stringify(rows));
}

export function getLocalReports(userId?: string | null): LocalReport[] {
  return read(userId).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export function getLocalReportById(id: string, userId?: string | null): LocalReport | null {
  return read(userId).find((r) => r.id === id) ?? null;
}

export function createLocalReport(
  input: Omit<LocalReport, "id" | "created_at" | "local_only">,
  userId?: string | null,
): LocalReport {
  const report: LocalReport = {
    ...input,
    id: `local_${crypto.randomUUID()}`,
    created_at: new Date().toISOString(),
    local_only: true,
  };
  const rows = read(userId);
  rows.unshift(report);
  write(rows.slice(0, 50), userId);
  return report;
}
