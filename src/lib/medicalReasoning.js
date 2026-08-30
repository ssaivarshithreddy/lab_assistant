/**
 * Clinical Medical Reasoning Engine
 * Analyzes extracted lab parameters and builds a 4-Step Medical Reasoning Chain:
 * 1. Biomarker Observation & Triaging
 * 2. Pathophysiological Mechanisms
 * 3. Differential Risk Considerations
 * 4. Clinical Action Plan & Physician Questions
 */

export function generateMedicalReasoning(valuesContext = {}, summaryText = "") {
  let values = valuesContext || {};
  if (typeof values === "string") {
    try { values = JSON.parse(values); } catch (e) { values = {}; }
  }

  const detectedEntries = Object.entries(values).filter(([, v]) => v?.value != null);
  const abnormalEntries = detectedEntries.filter(([, v]) => v.status === "low" || v.status === "high");

  // Step 1: Biomarker Observation & Triaging
  const step1 = {
    title: "1. Biomarker Observation & Clinical Triaging",
    status: abnormalEntries.length > 0 ? "attention" : "normal",
    totalDetected: detectedEntries.length,
    abnormalCount: abnormalEntries.length,
    observations: detectedEntries.map(([key, v]) => ({
      marker: key.toUpperCase(),
      value: `${v.value} ${v.unit || ""}`,
      status: v.status || "normal",
      isAbnormal: v.status === "low" || v.status === "high",
    })),
  };

  // Step 2: Pathophysiological Mechanism Correlation
  const mechanisms = [];
  const hgb = values.hemoglobin;
  const wbc = values.wbc;
  const rbc = values.rbc;
  const plt = values.platelets;
  const glu = values.glucose;
  const alt = values.alt;
  const ast = values.ast;
  const bili = values.bilirubin;
  const cr = values.creatinine;
  const urea = values.urea;
  const bun = values.bun;

  // Anemic / Hematologic Pattern
  if (hgb?.status === "low" || rbc?.status === "low") {
    mechanisms.push({
      pattern: "Hematologic / Erythroid Pattern",
      description: "Low hemoglobin/RBC indicates reduced erythrocyte mass or hemoglobin concentration, impairing systemic oxygen transport capacity.",
      clinicalNote: "May correlate with iron insufficiency, vitamin deficiency (B12/Folate), or blood loss.",
    });
  }

  // Leukocyte / Immunologic Pattern
  if (wbc?.status === "high") {
    mechanisms.push({
      pattern: "Immunologic / Inflammatory Pattern",
      description: "Elevated WBC (leukocytosis) reflects active bone marrow granulopoiesis or peripheral leukocyte recruitment.",
      clinicalNote: "Commonly triggered by acute bacterial/viral response, tissue inflammation, or physiological stress.",
    });
  } else if (wbc?.status === "low") {
    mechanisms.push({
      pattern: "Immunologic Suppression Pattern",
      description: "Decreased total leucocyte count (leukopenia) indicates diminished circulating neutrophil/lymphocyte reserves.",
      clinicalNote: "Warrants review for viral suppression, bone marrow suppression, or medication effects.",
    });
  }

  // Hepatic Biomarker Pattern
  if (alt?.status === "high" || ast?.status === "high" || bili?.status === "high") {
    mechanisms.push({
      pattern: "Hepatobiliary / Transaminase Pattern",
      description: "Elevated transaminases (ALT/AST) reflect hepatocellular membrane permeability or liver tissue stress.",
      clinicalNote: "Can occur with fatty liver changes, medication metabolism, viral exposure, or alcohol consumption.",
    });
  }

  // Renal Biomarker Pattern
  if (cr?.status === "high" || urea?.status === "high" || bun?.status === "high") {
    mechanisms.push({
      pattern: "Renal Filtration Pattern",
      description: "Elevated serum creatinine or urea nitrogen suggests decreased glomerular filtration rate (GFR) or prerenal azotemia.",
      clinicalNote: "Often influenced by hydration state, muscle breakdown, or intrinsic renal tubular workload.",
    });
  }

  // Glycemic Biomarker Pattern
  if (glu?.status === "high") {
    mechanisms.push({
      pattern: "Metabolic / Glycemic Pattern",
      description: "Elevated blood glucose indicates altered peripheral insulin sensitivity or hepatic gluconeogenesis.",
      clinicalNote: "Requires evaluation regarding fasting state, HbA1c correlation, and metabolic health.",
    });
  }

  if (mechanisms.length === 0) {
    mechanisms.push({
      pattern: "Homeostatic Balance",
      description: "All evaluated biomarkers fall within standardized reference intervals, reflecting physiological baseline stability.",
      clinicalNote: "No overt systemic pathophysiological stress detected among extracted parameters.",
    });
  }

  const step2 = {
    title: "2. Pathophysiological Mechanisms & Biological Correlations",
    patterns: mechanisms,
  };

  // Step 3: Differential Risk Assessment
  const differentials = [];
  if (abnormalEntries.length === 0) {
    differentials.push({
      finding: "Optimal Biomarker Panel",
      likelihood: "Low Risk",
      explanation: "No parameter deviations observed. Reassuring baseline health profile.",
    });
  } else {
    abnormalEntries.forEach(([key, v]) => {
      differentials.push({
        finding: `${key.toUpperCase()} (${v.value} ${v.unit || ""}) - ${v.status.toUpperCase()}`,
        likelihood: v.status === "high" ? "Elevated Parameter" : "Reduced Parameter",
        explanation: `Requires clinical correlation with patient symptoms, physical exam, and baseline history.`,
      });
    });
  }

  const step3 = {
    title: "3. Differential Risk Considerations & Considerations",
    differentials,
  };

  // Step 4: Clinical Action Plan & Physician Questions
  const physicianQuestions = [];
  if (abnormalEntries.length > 0) {
    physicianQuestions.push("What underlying physiological factors could be contributing to these specific out-of-range lab results?");
    physicianQuestions.push("Do you recommend any repeat testing or follow-up panels (e.g. Iron profile, Liver Ultrasound, or HbA1c)?");
    physicianQuestions.push("Are any dietary, lifestyle, or supplement adjustments recommended based on this report?");
  } else {
    physicianQuestions.push("Are all my current lab results optimal for my age and health goals?");
    physicianQuestions.push("When do you recommend scheduling my next routine screening panel?");
  }

  const step4 = {
    title: "4. Recommended Clinical Action Plan & Physician Questions",
    questions: physicianQuestions,
    nextSteps: [
      "Bring a printed or digital copy of this report to your next physician appointment.",
      "Track biomarker trends across future reports to monitor longitudinal health progression.",
      "Stay adequately hydrated prior to any repeat venous blood sample collection.",
    ],
  };

  return {
    step1,
    step2,
    step3,
    step4,
  };
}
