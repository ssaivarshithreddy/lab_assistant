// Streaming AI chat assistant grounded in the user's lab report
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, reportContext } = await req.json();
    const API_KEY = Deno.env.get("AI_GATEWAY_KEY") || Deno.env.get("LOVABLE_API_KEY");
    if (!API_KEY) throw new Error("AI_GATEWAY_KEY or LOVABLE_API_KEY missing");

    const systemPromptBase = `You are a helpful medical lab assistant. Explain lab reports in simple, non-alarming language. Do NOT provide definitive diagnoses. Only provide general health insights. Always suggest consulting a doctor for medical decisions. Keep answers concise and friendly.`;
    const clinicalEnabled = Deno.env.get("ENABLE_CLINICAL_INDICATIONS") === "true" && Deno.env.get("CLINICIAN_APPROVED") === "true";
    if (Deno.env.get("ENABLE_CLINICAL_INDICATIONS") === "true" && Deno.env.get("CLINICIAN_APPROVED") !== "true") {
      console.warn("ENABLE_CLINICAL_INDICATIONS requested but CLINICIAN_APPROVED not set to 'true'; clinical indications will remain disabled.");
    }
    const systemPrompt = clinicalEnabled
      ? systemPromptBase + `\n\nWhen clinical indicators are present, you MAY indicate likely conditions with conservative confidence estimates and explain which values support the indication. Use cautious, non-definitive language and always recommend clinician review.\n\nUser's report context:\n${reportContext || "(no report uploaded yet)"}`
      : systemPromptBase + `\n\nUser's report context:\n${reportContext || "(no report uploaded yet)"}`;

    // Default to a clinically-oriented model; can be overridden via AI_GATEWAY_MODEL or LOVABLE_MODEL env var.
    const MODEL = Deno.env.get("AI_GATEWAY_MODEL") || Deno.env.get("LOVABLE_MODEL") || "openai/gpt-4o-medical";

    const GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://ai.gateway.lovable.dev/v1/chat/completions";

    const isHF = GATEWAY_URL.includes("api-inference.huggingface.co") || Deno.env.get("USE_HF_API") === "true";

    if (isHF) {
      // Hugging Face does not stream in this setup; synthesize a simple assistant reply by asking the model to return a plaintext answer.
      const promptText = `SYSTEM:\n${systemPrompt}\n\nMESSAGES:\n${messages.map(m=>`${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}\n\nRespond with a concise assistant reply only (no extra commentary).`;
      const hfResp = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: promptText, parameters: { max_new_tokens: 256 } }),
      });

      if (!hfResp.ok) {
        const t = await hfResp.text();
        console.error("HF error", hfResp.status, t);
        return new Response(JSON.stringify({ error: "HF gateway error", details: t }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const hfData = await hfResp.json();
      let textOut = '';
      if (Array.isArray(hfData) && hfData[0]?.generated_text) textOut = hfData[0].generated_text;
      else if (hfData.generated_text) textOut = hfData.generated_text;
      else if (typeof hfData === 'string') textOut = hfData;
      else textOut = JSON.stringify(hfData);

      return new Response(JSON.stringify({ reply: textOut }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit reached, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(resp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
