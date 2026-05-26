import { supabase } from "@/integrations/supabase/client";

export type ConnectivityCheck = {
  name: string;
  ok: boolean;
  details: string;
};

export type ConnectivityReport = {
  ok: boolean;
  checks: ConnectivityCheck[];
  timestamp: string;
};

function getEnv(name: string): string {
  const v = (import.meta.env as Record<string, string | undefined>)[name];
  return (v || "").trim();
}

export async function runAiConnectivityTest(): Promise<ConnectivityReport> {
  const checks: ConnectivityCheck[] = [];

  const supabaseUrl = getEnv("VITE_SUPABASE_URL");
  const supabaseKey = getEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  const hfUrl = getEnv("VITE_AI_GATEWAY_URL");
  const hfKey = getEnv("VITE_AI_GATEWAY_KEY");

  checks.push({
    name: "Environment variables",
    ok: Boolean(supabaseUrl && supabaseKey && hfUrl && hfKey),
    details: !supabaseUrl || !supabaseKey || !hfUrl || !hfKey
      ? "Missing one or more of VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_AI_GATEWAY_URL, VITE_AI_GATEWAY_KEY."
      : "All required env vars are present.",
  });

  try {
    const { error } = await supabase.from("reports").select("id").limit(1);
    checks.push({
      name: "Supabase DB connectivity",
      ok: !error,
      details: error ? `${error.message}` : "Connected to reports table.",
    });
  } catch (e: any) {
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
  } catch (e: any) {
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
  ].filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i);

  let hfSuccess = false;
  const hfErrors: string[] = [];
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
    } catch (e: any) {
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

  return {
    ok: checks.every((c) => c.ok),
    checks,
    timestamp: new Date().toISOString(),
  };
}
