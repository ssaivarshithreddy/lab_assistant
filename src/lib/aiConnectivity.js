import { supabase } from "@/integrations/supabase/client";

function getEnv(name) {
  const v = import.meta.env[name];
  return (v || "").trim();
}

export async function runAiConnectivityTest() {
  const checks = [];

  const supabaseUrl = getEnv("VITE_SUPABASE_URL");
  const supabaseKey = getEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  const hfUrl = getEnv("VITE_AI_GATEWAY_URL");
  const hfKey = getEnv("VITE_AI_GATEWAY_KEY");
  const groqKey = getEnv("VITE_GROQ_API_KEY");

  checks.push({
    name: "Environment variables",
    ok: Boolean(groqKey || (supabaseUrl && supabaseKey && hfUrl && hfKey)),
    details: groqKey
      ? "Groq API key is configured ✓"
      : !supabaseUrl || !supabaseKey || !hfUrl || !hfKey
      ? "Missing env vars: Need either GROQ_API_KEY or (SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY + AI_GATEWAY_URL + AI_GATEWAY_KEY)."
      : "All required env vars are present.",
  });

  try {
    const { error } = await supabase.from("reports").select("id").limit(1);
    checks.push({
      name: "Supabase DB connectivity",
      ok: !error,
      details: error ? `${error.message}` : "Connected to reports table.",
    });
  } catch (e) {
    checks.push({
      name: "Supabase DB connectivity",
      ok: false,
      details: `Request failed: ${String(e?.message || e)}`,
    });
  }

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/chat-assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
        reportContext: "Diagnostics check",
      }),
    });

    const ctype = resp.headers.get("content-type") || "";
    if (!resp.ok) {
      const t = await resp.text();
      checks.push({
        name: "chat-assistant function",
        ok: false,
        details: `HTTP ${resp.status}: ${t.slice(0, 250)}`,
      });
    } else if (ctype.includes("text/event-stream")) {
      checks.push({
        name: "chat-assistant function",
        ok: true,
        details: "Function reachable (streaming response).",
      });
    } else {
      const j = await resp.json().catch(() => ({}));
      checks.push({
        name: "chat-assistant function",
        ok: Boolean(j?.reply || j?.message),
        details: j?.reply || j?.message
          ? "Function reachable (JSON response)."
          : "Function responded but no assistant text field found.",
      });
    }
  } catch (e) {
    checks.push({
      name: "chat-assistant function",
      ok: false,
      details: `Request failed: ${String(e?.message || e)}`,
    });
  }

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
          Authorization: `Bearer ${hfKey}`,
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
        details: `Reachable via ${candidate}. Returned ${Array.isArray(entities) ? entities.length : 0} entity records.`,
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
      details: `All HF endpoints failed: ${hfErrors.join(" | ").slice(0, 500)}`,
    });
  }

  // Test Groq connectivity
  if (groqKey) {
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "Reply with: OK" }],
          max_tokens: 10,
          stream: false,
        }),
      });

      const ctype = resp.headers.get("content-type") || "";
      if (!resp.ok) {
        const text = await resp.text();
        checks.push({
          name: "Groq API (llama-3.3-70b-versatile)",
          ok: false,
          details: `HTTP ${resp.status}: ${text.slice(0, 250)}`,
        });
      } else if (ctype.includes("application/json")) {
        const data = await resp.json().catch(() => ({}));
        const hasContent = Boolean(data.choices?.[0]?.message?.content);
        checks.push({
          name: "Groq API (llama-3.3-70b-versatile)",
          ok: hasContent,
          details: hasContent ? "✓ Groq API is fully operational" : "Groq responded but no message content",
        });
      } else {
        checks.push({
          name: "Groq API (llama-3.3-70b-versatile)",
          ok: false,
          details: `Unexpected response type: ${ctype}`,
        });
      }
    } catch (e) {
      checks.push({
        name: "Groq API (llama-3.3-70b-versatile)",
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
