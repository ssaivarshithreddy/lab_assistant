const RULES = [
  { key: "hemoglobin", label: "Hemoglobin", unit: "g/dL", aliases: ["hemoglobin", "haemoglobin", "hgb", "hb"], low: 12, high: 17.5 },
  { key: "wbc", label: "WBC", unit: "x10^9/L", aliases: ["wbc", "white blood cell", "white blood cells", "leukocyte", "leucocyte"], low: 4, high: 11 },
  { key: "rbc", label: "RBC", unit: "10^12/L", aliases: ["rbc", "red blood cell", "red blood cells"], low: 4, high: 5.9 },
  { key: "platelets", label: "Platelets", unit: "10^9/L", aliases: ["platelets", "platelet", "plt", "platelet count"], low: 150, high: 450 },
  { key: "glucose", label: "Glucose", unit: "mg/dL", aliases: ["glucose", "blood sugar", "fasting glucose", "random glucose"], low: 70, high: 140 },
  { key: "hematocrit", label: "Hematocrit", unit: "%", aliases: ["hematocrit", "hct", "pcv"], low: 36, high: 52 },
  { key: "mcv", label: "MCV", unit: "fL", aliases: ["mcv", "mean corpuscular volume"], low: 80, high: 100 },
  { key: "mch", label: "MCH", unit: "pg", aliases: ["mch", "mean corpuscular hemoglobin"], low: 27, high: 33 },
  { key: "mchc", label: "MCHC", unit: "g/dL", aliases: ["mchc", "mean corpuscular hemoglobin concentration"], low: 32, high: 36 },
  { key: "sodium", label: "Sodium", unit: "mmol/L", aliases: ["sodium", "na+"], low: 135, high: 145 },
  { key: "potassium", label: "Potassium", unit: "mmol/L", aliases: ["potassium", "k+"], low: 3.5, high: 5.1 },
  { key: "chloride", label: "Chloride", unit: "mmol/L", aliases: ["chloride", "cl-"], low: 98, high: 107 },
  { key: "calcium", label: "Calcium", unit: "mg/dL", aliases: ["calcium", "ca++"], low: 8.5, high: 10.5 },
  { key: "hba1c", label: "HbA1c", unit: "%", aliases: ["hba1c", "a1c", "glycated hemoglobin", "hemoglobin a1c"], low: 4, high: 5.6 },
];

function preprocess(text) {
  return (text || "")
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/([A-Za-z])\n([0-9])/g, "$1 $2")
    .replace(/([0-9])\n([A-Za-z])/g, "$1 $2");
}

function classify(value, low, high) {
  if (value < low * 0.6 || value > high * 1.5) return "critical";
  if (value < low) return "low";
  if (value > high) return "high";
  return "normal";
}

function scoreConfidence(distance) {
  return Math.max(0.55, Math.min(0.99, 0.92 - distance * 0.02));
}

function findMetricValue(text, aliases) {
  const normalized = text.toLowerCase();
  let best = null;

  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?:\\b${escaped}\\b)[^0-9\\n]{0,30}([0-9]+(?:\\.[0-9]+)?)`, "ig");
    for (const match of normalized.matchAll(pattern)) {
      const num = Number(match[1]);
      if (!Number.isFinite(num)) continue;
      const distance = Math.min(10, (match.index ?? 0) / Math.max(1, normalized.length));
      const candidate = { value: num, confidence: scoreConfidence(distance) };
      if (!best || candidate.confidence > best.confidence) best = candidate;
    }
  }

  return best;
}

export function parseReportText(rawText) {
  const text = preprocess(rawText);
  const metrics = {};

  for (const rule of RULES) {
    const hit = findMetricValue(text, rule.aliases);
    if (!hit) continue;
    metrics[rule.key] = {
      name: rule.label,
      value: hit.value,
      unit: rule.unit,
      status: classify(hit.value, rule.low, rule.high),
      confidence: Number(hit.confidence.toFixed(2)),
      source: "regex",
    };
  }

  const risks = Object.values(metrics)
    .filter((m) => m.status && m.status !== "normal")
    .map((m) => `${m.name}: ${m.status}`);

  const summary = Object.values(metrics).length
    ? `Detected values — ${Object.values(metrics).map((m) => `${m.name.toUpperCase()}: ${m.value} ${m.unit} (${m.status})`).join("; ")}. ${risks.length} value(s) outside normal ranges.`
    : "No common lab values were detected in the uploaded report.";

  const riskLevel = risks.length >= 3 ? "High Risk" : risks.length > 0 ? "Mild Risk" : "Normal";

  return { metrics, summary, riskLevel, extractedText: text, risks };
}
