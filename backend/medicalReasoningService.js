/**
 * Server-Side Clinical Medical Reasoning Engine
 * Evaluates extracted lab parameters and builds a 4-Step Medical Reasoning Chain:
 * 1. Biomarker Observation & Triaging
 * 2. Pathophysiological Mechanisms
 * 3. Differential Risk Considerations
 * 4. Clinical Action Plan & Physician Questions
 */

function normalizeValues(valuesContext) {
  let values = valuesContext || {};
  if (typeof values === "string") {
    try { values = JSON.parse(values); } catch (e) { values = {}; }
  }

  const normalized = {};
  const aliasMap = {
    hgb: "hemoglobin",
    hb: "hemoglobin",
    plt: "platelets",
    platelet: "platelets",
    a1c: "hba1c",
    cr: "creatinine",
    glu: "glucose",
    sgpt: "alt",
    sgot: "ast",
    bili: "bilirubin",
  };

  Object.entries(values).forEach(([rawKey, val]) => {
    if (val && typeof val === "object") {
      const lowerKey = rawKey.toLowerCase().trim();
      const canonicalKey = aliasMap[lowerKey] || lowerKey;
      normalized[canonicalKey] = {
        ...val,
        status: (val.status || "normal").toLowerCase(),
      };
    }
  });

  return normalized;
}

export function generateMedicalReasoning(valuesContext = {}, summaryText = "") {
  const values = normalizeValues(valuesContext);

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
      value: `${v.value} ${v.unit || ""}`.trim(),
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
  const hba1c = values.hba1c;
  const alt = values.alt;
  const ast = values.ast;
  const bili = values.bilirubin;
  const cr = values.creatinine;
  const urea = values.urea;
  const bun = values.bun;
  const crp = values.crp;
  const na = values.sodium;
  const k = values.potassium;
  const ca = values.calcium;

  if (hgb?.status === "low" || rbc?.status === "low") {
    mechanisms.push({
      pattern: "Hematologic / Erythroid Pattern",
      description: "Low hemoglobin/RBC indicates reduced erythrocyte mass or hemoglobin concentration, impairing systemic oxygen transport capacity.",
      clinicalNote: "May correlate with iron insufficiency, vitamin deficiency (B12/Folate), or blood loss.",
    });
  } else if (hgb?.status === "high" || rbc?.status === "high") {
    mechanisms.push({
      pattern: "Erythrocytosis / Hemoconcentration Pattern",
      description: "Elevated hemoglobin or red blood cell count reflects hemoconcentration or expanded erythroid mass.",
      clinicalNote: "Often associated with dehydration, hypoxia, or elevated altitude.",
    });
  }

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

  if (plt?.status === "low") {
    mechanisms.push({
      pattern: "Hemostatic / Thrombocytopenia Pattern",
      description: "Decreased platelet count reduces primary hemostatic plug formation capacity.",
      clinicalNote: "Warrants review for viral clearance, immune consumption, or medication effects.",
    });
  } else if (plt?.status === "high") {
    mechanisms.push({
      pattern: "Reactive Thrombocytosis Pattern",
      description: "Elevated platelet count commonly occurs as a reactive acute-phase inflammatory response or iron deficiency compensation.",
      clinicalNote: "Evaluate alongside systemic inflammatory markers.",
    });
  }

  if (alt?.status === "high" || ast?.status === "high" || bili?.status === "high") {
    mechanisms.push({
      pattern: "Hepatobiliary / Transaminase Pattern",
      description: "Elevated transaminases (ALT/AST) reflect hepatocellular membrane permeability or liver tissue stress.",
      clinicalNote: "Can occur with fatty liver changes, medication metabolism, viral exposure, or alcohol consumption.",
    });
  }

  if (cr?.status === "high" || urea?.status === "high" || bun?.status === "high") {
    mechanisms.push({
      pattern: "Renal Filtration Pattern",
      description: "Elevated serum creatinine or urea nitrogen suggests decreased glomerular filtration rate (GFR) or prerenal azotemia.",
      clinicalNote: "Often influenced by hydration state, muscle breakdown, or intrinsic renal tubular workload.",
    });
  }

  if (glu?.status === "high" || hba1c?.status === "high") {
    mechanisms.push({
      pattern: "Metabolic / Glycemic Pattern",
      description: "Elevated blood glucose or HbA1c indicates altered peripheral insulin sensitivity, impaired glucose clearance, or chronic hyperglycemia.",
      clinicalNote: "Requires evaluation regarding fasting state, HbA1c 3-month glycation trends, and metabolic health.",
    });
  } else if (glu?.status === "low" || hba1c?.status === "low") {
    mechanisms.push({
      pattern: "Hypoglycemic / Energy Deficit Pattern",
      description: "Subnormal blood glucose or glycated hemoglobin indicates circulating energy substrate deficit.",
      clinicalNote: "Evaluate regarding nutritional intake, medication dosage, or accelerated RBC turnover.",
    });
  }

  if (crp?.status === "high") {
    mechanisms.push({
      pattern: "Systemic Acute-Phase Inflammatory Pattern",
      description: "Elevated C-reactive protein indicates hepatic acute-phase synthesis responding to circulating cytokines.",
      clinicalNote: "Non-specific inflammatory marker warranting clinical correlation with infectious or autoimmune origins.",
    });
  }

  if (na?.status === "low" || na?.status === "high" || k?.status === "low" || k?.status === "high" || ca?.status === "low" || ca?.status === "high") {
    mechanisms.push({
      pattern: "Fluid & Electrolyte Homeostatic Pattern",
      description: "Serum electrolyte deviation indicates altered renal tubular electrolyte handling, hydration variance, or neurohormonal balance.",
      clinicalNote: "Recommend assessing dietary intake, hydration volume, and diuretic/medication use.",
    });
  }

  if (mechanisms.length === 0) {
    if (abnormalEntries.length > 0) {
      mechanisms.push({
        pattern: "Biomarker Variance Under Clinical Review",
        description: `Variance observed in ${abnormalEntries.map(([k]) => k.toUpperCase()).join(", ")} outside standard reference thresholds.`,
        clinicalNote: "Correlate with clinical history, physical findings, and prior lab trends.",
      });
    } else {
      mechanisms.push({
        pattern: "Homeostatic Balance",
        description: "All evaluated biomarkers fall within standardized reference intervals, reflecting physiological baseline stability.",
        clinicalNote: "No overt systemic pathophysiological stress detected among extracted parameters.",
      });
    }
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
      let specificExplanation = `Requires clinical correlation with patient symptoms, physical exam, and baseline history.`;
      
      if (key === "hemoglobin" || key === "rbc") {
        specificExplanation = v.status === "low" 
          ? "Differential considerations include iron deficiency, B12/folate insufficiency, blood loss, or anemia of chronic inflammation."
          : "Differential considerations include dehydration, chronic hypoxia, or polycythemic erythrocytosis.";
      } else if (key === "glucose" || key === "hba1c") {
        specificExplanation = v.status === "high"
          ? "Differential considerations include impaired fasting glucose, insulin resistance, metabolic syndrome, or diabetes mellitus."
          : "Differential considerations include prolonged fasting, strenuous exertion, or excess medication effect.";
      } else if (key === "wbc") {
        specificExplanation = v.status === "high"
          ? "Differential considerations include acute bacterial/viral infection, tissue inflammation, or physiological stress."
          : "Differential considerations include viral suppression, bone marrow suppression, or medication side effects.";
      } else if (key === "platelets") {
        specificExplanation = v.status === "low"
          ? "Differential considerations include immune thrombocytopenia, viral infection, or medication-induced clearance."
          : "Differential considerations include reactive thrombocytosis secondary to inflammation or iron deficiency.";
      } else if (key === "creatinine" || key === "urea" || key === "bun") {
        specificExplanation = v.status === "high"
          ? "Differential considerations include prerenal azotemia/dehydration, reduced GFR, or renal parenchymal workload."
          : "Low level may correlate with decreased muscle mass or increased renal plasma flow.";
      } else if (key === "alt" || key === "ast" || key === "bilirubin") {
        specificExplanation = "Differential considerations include metabolic liver changes (fatty liver), medication hepatotoxicity, or viral hepatitis.";
      } else if (key === "crp") {
        specificExplanation = "Differential considerations include active bacterial/viral infection, rheumatologic/autoimmune conditions, or tissue stress.";
      }

      differentials.push({
        finding: `${key.toUpperCase()} (${v.value} ${v.unit || ""}) - ${v.status.toUpperCase()}`.trim(),
        likelihood: v.status === "high" ? "Elevated Parameter" : "Reduced Parameter",
        explanation: specificExplanation,
      });
    });
  }

  const step3 = {
    title: "3. Differential Risk Considerations",
    differentials,
  };

  // Step 4: Clinical Action Plan & Physician Questions
  const physicianQuestions = [];
  if (abnormalEntries.length > 0) {
    if (values.hba1c?.status === "high" || values.glucose?.status === "high") {
      physicianQuestions.push("Does my blood glucose / HbA1c elevation indicate pre-diabetes or diabetes, and what dietary adjustments are recommended?");
    }
    if (values.hemoglobin?.status === "low" || values.rbc?.status === "low") {
      physicianQuestions.push("Should I check an iron profile (ferritin/TIBC) or vitamin B12 levels to investigate low hemoglobin?");
    }
    if (values.alt?.status === "high" || values.ast?.status === "high") {
      physicianQuestions.push("Do you recommend a liver ultrasound or reviewing my medications to evaluate elevated liver enzymes?");
    }
    if (values.creatinine?.status === "high") {
      physicianQuestions.push("What is my estimated GFR (eGFR), and should we repeat kidney function tests with adequate hydration?");
    }
    if (values.wbc?.status === "high" || values.crp?.status === "high") {
      physicianQuestions.push("Does this inflammatory/WBC elevation indicate an active infection or systemic inflammation?");
    }
    if (physicianQuestions.length === 0) {
      physicianQuestions.push("What underlying physiological factors could be contributing to these specific out-of-range lab results?");
      physicianQuestions.push("Do you recommend any repeat testing or follow-up panels to confirm these readings?");
    }
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
    generatedAt: new Date().toISOString(),
    isServerGenerated: true,
  };
}
