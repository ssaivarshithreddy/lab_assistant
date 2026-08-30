import { apiClient } from "@/lib/apiClient";

function getEnv(name) {
  const v = import.meta.env[name];
  return (v || "").trim();
}

export async function runAiConnectivityTest() {
  const checks = [];

  const hfUrl = getEnv("VITE_AI_GATEWAY_URL");
  const hfKey = getEnv("VITE_AI_GATEWAY_KEY");
  const groqKey = getEnv("VITE_GROQ_API_KEY");

  // 1. Environment variables check
  checks.push({
    name: "Environment variables",
    ok: Boolean(groqKey || (hfUrl && hfKey)),
    details: groqKey
      ? "Groq API key is configured ✓"
      : "Missing env vars: VITE_GROQ_API_KEY is recommended for AI Assistant chat.",
  });

  // 2. PostgreSQL DB Connectivity check
  try {
    const reports = await apiClient.getReports();
    checks.push({
      name: "PostgreSQL DB Connectivity",
      ok: Array.isArray(reports),
      details: Array.isArray(reports)
        ? `Connected to PostgreSQL database (retrieved ${reports.length} user reports).`
        : "Database returned unexpected response format.",
    });
  } catch (e) {
    checks.push({
      name: "PostgreSQL DB Connectivity",
      ok: false,
      details: `Request failed: ${String(e?.message || e)}`,
    });
  }

  // 3. Express Backend API Health
  try {
    const me = await apiClient.getMe();
    checks.push({
      name: "Express Backend API Health",
      ok: Boolean(me?.user),
      details: me?.user
        ? `Express server running on http://localhost:5000 (Authenticated as ${me.user.email}).`
        : "Backend server reachable.",
    });
  } catch (e) {
    checks.push({
      name: "Express Backend API Health",
      ok: false,
      details: `Request failed: ${String(e?.message || e)}`,
    });
  }

  // 4. HuggingFace / ClinicalBERT endpoint
  const hfCandidates = [
    hfUrl,
    "https://router.huggingface.co/hf-inference/models/d4data/biomedical-ner-all",
    "https://api-inference.huggingface.co/models/d4data/biomedical-ner-all",
  ].filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);

  let hfSuccess = false;
  const hfErrors = [];
  for (const candidate of hfCandidates) {
    try {
      const resp = await fetch(candidate, {
        method: "POST",
        headers: {
          Authorization: hfKey ? `Bearer ${hfKey}` : undefined,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: "Hemoglobin 11.2 g/dL, WBC 12.8, Creatinine 1.1",
          options: { wait_for_model: true },
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        hfErrors.push(`${candidate} -> HTTP ${resp.status}: ${t.slice(0, 120)}`);
        continue;
      }

      const data = await resp.json().catch(() => null);
      const entities = Array.isArray(data) ? data : data?.[0] ? data[0] : [];
      checks.push({
        name: "HF/ClinicalBERT endpoint",
        ok: true,
        details: `Reachable via ${candidate}. Extracted ${Array.isArray(entities) ? entities.length : 0} entity records.`,
      });
      hfSuccess = true;
      break;
    } catch (e) {
      hfErrors.push(`${candidate} -> ${String(e?.message || e)}`);
    }
  }

  if (!hfSuccess) {
    checks.push({
      name: "HF/ClinicalBERT endpoint",
      ok: false,
      details: `All HF endpoints failed: ${hfErrors.join(" | ").slice(0, 300)}`,
    });
  }

  // 5. Groq API connectivity
  if (groqKey) {
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen/qwen3.6-27b",
          messages: [{ role: "user", content: "Reply with: OK" }],
          max_tokens: 10,
          stream: false,
        }),
      });

      const ctype = resp.headers.get("content-type") || "";
      if (!resp.ok) {
        const text = await resp.text();
        checks.push({
          name: "Groq API (qwen3.6-27b / gpt-oss)",
          ok: false,
          details: `HTTP ${resp.status}: ${text.slice(0, 250)}`,
        });
      } else if (ctype.includes("application/json")) {
        const data = await resp.json().catch(() => ({}));
        const hasContent = Boolean(data.choices?.[0]?.message?.content);
        checks.push({
          name: "Groq API (qwen3.6-27b / gpt-oss)",
          ok: hasContent,
          details: hasContent ? "✓ Groq API is fully operational" : "Groq responded but no message content",
        });
      } else {
        checks.push({
          name: "Groq API (qwen3.6-27b / gpt-oss)",
          ok: false,
          details: `Unexpected response type: ${ctype}`,
        });
      }
    } catch (e) {
      checks.push({
        name: "Groq API (qwen3.6-27b / gpt-oss)",
        ok: false,
        details: `Request failed: ${String(e?.message || e)}`,
      });
    }
  }

  return {
    ok: checks.every((c) => c.ok),
    checks,
    timestamp: new Date().toISOString(),
  };
}
