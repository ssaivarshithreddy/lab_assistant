/**
 * Server-Side Curated Medical Knowledge Base
 * Trusted clinical reference guidelines, physiological interpretations,
 * causes of abnormal biomarkers, and clinical significance.
 */

export const MEDICAL_KNOWLEDGE_BASE = {
  hemoglobin: {
    marker: "Hemoglobin (Hgb / Hb)",
    unit: "g/dL",
    referenceRange: "12.0 - 17.5 g/dL (Adults)",
    description: "Hemoglobin is an iron-containing metalloprotein in red blood cells that transports oxygen from the lungs to peripheral tissues.",
    low: {
      status: "LOW (Decreased Hemoglobin)",
      interpretation: "Decreased hemoglobin reduces circulating arterial oxygen content.",
      possibleCauses: [
        "Iron deficiency anemia (microcytic pattern)",
        "Vitamin B12 or Folate deficiency (macrocytic pattern)",
        "Acute or chronic blood loss (gastrointestinal, surgical, menstrual)",
        "Chronic kidney disease (reduced renal erythropoietin secretion)",
        "Hemolytic anemia or chronic disease inflammation",
      ],
      clinicalSignificance: "Mild decreases may cause fatigue, dyspnea on exertion, or paleness. Severe drops (< 8.0 g/dL) warrant urgent evaluation.",
      questionsForDoctor: ["Should I take an iron or B12 supplement?", "Do I need a ferritin or iron panel test?"],
    },
    high: {
      status: "HIGH (Elevated Hemoglobin)",
      interpretation: "Elevated hemoglobin indicates increased red blood cell concentration or reduced plasma volume.",
      possibleCauses: [
        "Hemoconcentration / Dehydration",
        "Chronic hypoxia (smoking, COPD, high altitude)",
        "Polycythemia vera (myeloproliferative disorder)",
      ],
      clinicalSignificance: "Increases blood viscosity and may increase cardiovascular workload.",
      questionsForDoctor: ["Could dehydration or smoking affect this reading?", "Should we recheck hematocrit levels?"],
    },
  },

  wbc: {
    marker: "White Blood Cell Count (WBC / Leukocytes)",
    unit: "x10^9/L",
    referenceRange: "4.0 - 11.0 x10^9/L",
    description: "Leukocytes are immune system cells involved in defending the body against infectious disease and foreign materials.",
    low: {
      status: "LOW (Leukopenia)",
      interpretation: "Decreased circulating leukocytes impair immune defense.",
      possibleCauses: [
        "Viral infections (HIV, Epstein-Barr, Hepatitis)",
        "Bone marrow suppression or autoimmune conditions",
        "Drug-induced leukopenia (chemotherapy, immunosuppressants)",
        "Severe sepsis (consumption outstripping production)",
      ],
      clinicalSignificance: "Increases susceptibility to opportunistic bacterial and fungal infections.",
      questionsForDoctor: ["Am I at increased risk for infections?", "Should we run a differential WBC breakdown?"],
    },
    high: {
      status: "HIGH (Leukocytosis)",
      interpretation: "Elevated total leukocytes indicate systemic inflammatory or infectious recruitment.",
      possibleCauses: [
        "Acute bacterial or fungal infection",
        "Tissue necrosis or physical trauma",
        "Glucocorticoid therapy or systemic stress",
        "Leukemia or myeloproliferative disorders",
      ],
      clinicalSignificance: "Signals active immune mobilization or tissue inflammation.",
      questionsForDoctor: ["Does this suggest an active infection?", "Do I need a C-reactive protein (CRP) test?"],
    },
  },

  platelets: {
    marker: "Platelet Count (Plt)",
    unit: "10^9/L",
    referenceRange: "150 - 450 10^9/L",
    description: "Platelets (thrombocytes) are cytoplasmic fragments essential for primary hemostasis and blood clotting.",
    low: {
      status: "LOW (Thrombocytopenia)",
      interpretation: "Reduced platelet count impairs primary clot formation.",
      possibleCauses: [
        "Immune thrombocytopenic purpura (ITP)",
        "Medication-induced destruction (heparin, NSAIDs)",
        "Hypersplenism or viral infection (Dengue, Hepatitis)",
        "Bone marrow disorders",
      ],
      clinicalSignificance: "Increases risk of mucocutaneous bleeding, petechiae, or prolonged bleeding time.",
      questionsForDoctor: ["Should I avoid blood-thinning medications like aspirin?", "Do I need a coagulation test?"],
    },
    high: {
      status: "HIGH (Thrombocytosis)",
      interpretation: "Elevated platelets increase circulating thrombocytes.",
      possibleCauses: [
        "Reactive thrombocytosis (acute infection, inflammation, iron deficiency)",
        "Essential thrombocythemia",
        "Post-splenectomy state",
      ],
      clinicalSignificance: "May elevate vascular thrombosis risk in high-risk patients.",
      questionsForDoctor: ["Is this a reactive response to inflammation?", "Should we check inflammatory markers?"],
    },
  },

  glucose: {
    marker: "Fasting Blood Glucose",
    unit: "mg/dL",
    referenceRange: "70 - 100 mg/dL (Fasting)",
    description: "Serum glucose measures circulating blood sugar levels, regulated primarily by pancreatic insulin and glucagon.",
    low: {
      status: "LOW (Hypoglycemia)",
      interpretation: "Abnormally low blood sugar impairs cellular energy metabolism.",
      possibleCauses: [
        "Excess insulin or diabetic medication dosage",
        "Prolonged fasting or intense physical exertion",
        "Adrenal insufficiency or hepatic failure",
      ],
      clinicalSignificance: "Can cause tremors, diaphoresis, confusion, or syncope.",
      questionsForDoctor: ["How should I adjust my dietary intake?", "Should we review diabetic medications?"],
    },
    high: {
      status: "HIGH (Hyperglycemia)",
      interpretation: "Elevated blood glucose indicates insulin resistance or impaired pancreatic insulin secretion.",
      possibleCauses: [
        "Impaired fasting glucose / Pre-diabetes (100-125 mg/dL)",
        "Diabetes mellitus (Fasting >= 126 mg/dL)",
        "Acute physiological stress or corticosteroid use",
      ],
      clinicalSignificance: "Chronic elevation leads to microvascular and macrovascular complications.",
      questionsForDoctor: ["Should I get an HbA1c test?", "What fasting glucose target is ideal for me?"],
    },
  },

  creatinine: {
    marker: "Serum Creatinine",
    unit: "mg/dL",
    referenceRange: "0.6 - 1.3 mg/dL",
    description: "Creatinine is a breakdown product of creatine phosphate in muscle, excreted by glomerular filtration.",
    low: {
      status: "LOW (Decreased Creatinine)",
      interpretation: "Low creatinine reflects reduced muscle mass or hyperfiltration.",
      possibleCauses: ["Decreased muscle mass / sarcopenia", "Pregnancy (increased renal plasma flow)"],
      clinicalSignificance: "Generally clinically benign unless associated with severe malnutrition.",
      questionsForDoctor: ["Is my kidney function normal?"],
    },
    high: {
      status: "HIGH (Elevated Creatinine)",
      interpretation: "Elevated creatinine indicates decreased Glomerular Filtration Rate (eGFR).",
      possibleCauses: [
        "Prerenal azotemia (dehydration, decreased renal perfusion)",
        "Intrinsic acute kidney injury (AKI)",
        "Chronic kidney disease (CKD)",
        "Urinary tract obstruction",
      ],
      clinicalSignificance: "Sensitive indicator of renal functional impairment requiring clinical correlation.",
      questionsForDoctor: ["What is my estimated GFR (eGFR)?", "Do I need a renal ultrasound or urine protein test?"],
    },
  },

  alt: {
    marker: "ALT (Alanine Aminotransferase / SGPT)",
    unit: "U/L",
    referenceRange: "7 - 56 U/L",
    description: "ALT is a cytosolic enzyme concentrated primarily in hepatocytes, serving as a specific marker for hepatic injury.",
    high: {
      status: "HIGH (Elevated ALT)",
      interpretation: "Hepatocyte membrane injury causing transaminase leakage into bloodstream.",
      possibleCauses: [
        "Metabolic dysfunction-associated steatotic liver disease (MASLD / Fatty Liver)",
        "Viral hepatitis (Hepatitis A, B, C)",
        "Medication / Supplement hepatotoxicity (Acetaminophen, Statin)",
        "Alcoholic liver injury",
      ],
      clinicalSignificance: "Indicates hepatocellular injury. Marked elevations (> 5x upper limit) warrant urgent workup.",
      questionsForDoctor: ["Should we perform a liver ultrasound?", "Could any of my current medications cause this?"],
    },
  },

  ast: {
    marker: "AST (Aspartate Aminotransferase / SGOT)",
    unit: "U/L",
    referenceRange: "10 - 40 U/L",
    description: "AST is a mitochondrial enzyme present in liver, cardiac, skeletal muscle, and renal tissues.",
    high: {
      status: "HIGH (Elevated AST)",
      interpretation: "Transaminase release due to hepatic, cardiac, or skeletal muscle damage.",
      possibleCauses: [
        "Alcoholic liver disease (AST/ALT ratio > 2)",
        "Hepatic steatosis / Hepatitis",
        "Strenuous physical exercise / rhabdomyolysis",
      ],
      clinicalSignificance: "Evaluated alongside ALT to determine hepatic vs non-hepatic etiology.",
      questionsForDoctor: ["Is the AST elevation coming from liver or muscle?", "Do we need an ALT/AST ratio comparison?"],
    },
  },

  crp: {
    marker: "C-Reactive Protein (CRP)",
    unit: "mg/L",
    referenceRange: "< 5.0 mg/L",
    description: "CRP is an acute-phase reactant synthesized by the liver in response to IL-6 and inflammatory cytokines.",
    high: {
      status: "HIGH (Elevated CRP)",
      interpretation: "Indicates systemic acute or chronic inflammatory activation.",
      possibleCauses: [
        "Bacterial or severe viral infection",
        "Autoimmune inflammatory disease (Rheumatoid arthritis, Lupus)",
        "Tissue injury or cardiovascular inflammation",
      ],
      clinicalSignificance: "Non-specific marker for systemic inflammation.",
      questionsForDoctor: ["Does this indicate active infection or autoimmune inflammation?", "Should we recheck CRP in 2 weeks?"],
    },
  },
  hba1c: {
    marker: "HbA1c (Glycated Hemoglobin)",
    unit: "%",
    referenceRange: "4.0 - 5.6 % (Normal)",
    description: "HbA1c reflects average blood glucose levels over the past 2-3 months by measuring the percentage of hemoglobin coated with sugar.",
    low: {
      status: "LOW (Decreased HbA1c)",
      interpretation: "Decreased glycated hemoglobin level, indicating lower average blood sugar or shortened red blood cell lifespan.",
      possibleCauses: [
        "Hemolytic anemia or recent blood transfusion (shortened RBC lifespan)",
        "Chronic kidney disease or erythropoietin therapy",
        "Recent severe acute blood loss",
        "Overtreatment with insulin or sulfonylureas in diabetic patients",
      ],
      clinicalSignificance: "May reflect hypoglycemia risk or conditions accelerating red blood cell turnover.",
      questionsForDoctor: ["Does my low HbA1c reflect low blood sugar or fast red blood cell turnover?", "Do I need an anemia or hemoglobinopathy evaluation?"],
    },
    high: {
      status: "HIGH (Elevated HbA1c)",
      interpretation: "Elevated glycated hemoglobin, reflecting persistent blood glucose elevation over 2-3 months.",
      possibleCauses: [
        "Pre-diabetes (HbA1c 5.7% - 6.4%)",
        "Diabetes mellitus (HbA1c >= 6.5%)",
        "Insulin resistance or impaired glucose tolerance",
        "Uncontrolled dietary carbohydrate intake or medication non-compliance",
      ],
      clinicalSignificance: "Indicates chronic hyperglycemia and increased microvascular risk.",
      questionsForDoctor: ["Does my HbA1c level indicate pre-diabetes or diabetes?", "What lifestyle or dietary modifications do you recommend to lower my HbA1c?"],
    },
  },
};

/**
 * Server-side search of Curated Medical Knowledge Base with strict evidence matching
 */
export function searchMedicalKnowledgeBase(queryText = "", markerKey = "", status = "") {
  const results = [];
  const q = (queryText || "").toLowerCase();
  const mKey = (markerKey || "").toLowerCase();

  // Primary exact marker match
  Object.entries(MEDICAL_KNOWLEDGE_BASE).forEach(([key, info]) => {
    const isExplicitMatch = key === mKey || q.includes(key) || q.includes(info.marker.toLowerCase());
    if (isExplicitMatch) {
      const data = info[status] || info.high || info.low || null;
      if (data) {
        results.push({
          source_id: `kb_${key}`,
          marker: info.marker,
          unit: info.unit,
          referenceRange: info.referenceRange,
          description: info.description,
          statusText: data.status,
          interpretation: data.interpretation,
          possibleCauses: data.possibleCauses || [],
          clinicalSignificance: data.clinicalSignificance,
          questionsForDoctor: data.questionsForDoctor || [],
        });
      }
    }
  });

  return results;
}
