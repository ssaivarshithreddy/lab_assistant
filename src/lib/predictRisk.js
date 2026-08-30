/**
 * Predictive Health Risk Engine
 * Computes disease and biomarker risk indicators based on lab values.
 */

const RANGES = {
  hemoglobin:  { low: 12.0, high: 17.5, unit: "g/dL",    lowMsg: "Possible anemia risk",                    highMsg: "Possible polycythemia",            weight: 2 },
  wbc:         { low: 4.0,  high: 11.0, unit: "10^3/uL",  lowMsg: "Possible immune suppression (leukopenia)", highMsg: "Possible infection or inflammation", weight: 2 },
  rbc:         { low: 4.2,  high: 5.9,  unit: "10^6/uL",  lowMsg: "Low red blood cell count",                highMsg: "Elevated red blood cell count",     weight: 1 },
  platelets:   { low: 150,  high: 450,  unit: "10^3/uL",  lowMsg: "Low platelets — bleeding risk",           highMsg: "High platelets — clotting risk",    weight: 2 },
  glucose:     { low: 70,   high: 140,  unit: "mg/dL",    lowMsg: "Low blood sugar (hypoglycemia)",           highMsg: "High blood sugar — possible diabetes risk", weight: 2 },
};

function classify(v, low, high) {
  if (v < low) return "low";
  if (v > high) return "high";
  return "normal";
}

function severity(v, low, high) {
  const span = high - low;
  if (v < low) return Math.min(3, (low - v) / (span * 0.25));
  if (v > high) return Math.min(3, (v - high) / (span * 0.25));
  return 0;
}

function labelOf(k) {
  return { hemoglobin: "Hemoglobin", wbc: "WBC", rbc: "RBC", platelets: "Platelets", glucose: "Blood sugar" }[k] ?? k;
}

export function predictRisk(values) {
  const abnormal_parameters = [];
  const insights = [];
  const enriched = {};
  let riskScore = 0;
  let weightSum = 0;

  for (const [key, ref] of Object.entries(RANGES)) {
    const m = values[key];
    if (!m || typeof m.value !== "number") continue;
    const status = classify(m.value, ref.low, ref.high);
    const sev = severity(m.value, ref.low, ref.high);
    enriched[key] = { value: m.value, unit: m.unit ?? ref.unit, status };
    weightSum += ref.weight;
    if (status !== "normal") {
      riskScore += ref.weight * sev;
      abnormal_parameters.push(key);
      insights.push(`${labelOf(key)}: ${status === "low" ? ref.lowMsg : ref.highMsg}`);
    }
  }

  const norm = weightSum > 0 ? riskScore / (weightSum * 1.5) : 0;
  let risk_level;
  if (norm < 0.15 || abnormal_parameters.length === 0) risk_level = "Normal";
  else if (norm < 0.6 && abnormal_parameters.length <= 2) risk_level = "Mild Risk";
  else risk_level = "High Risk";

  const confidence = Math.max(0.55, Math.min(0.98, 1 - Math.abs(0.5 - norm)));

  return {
    risk_level,
    abnormal_parameters,
    insights,
    enriched_values: enriched,
    score: Number(norm.toFixed(3)),
    confidence: Number(confidence.toFixed(2)),
    disclaimer: "This is not medical advice.",
  };
}
