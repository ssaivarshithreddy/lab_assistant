// Analyzes lab report text: extracts values + summary using configured AI gateway
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
Deno.serve(async (req) => {
    if (req.method === "OPTIONS")
        return new Response(null, { headers: corsHeaders });
    try {
        const { rawText, fileName } = await req.json();
        const API_KEY = Deno.env.get("AI_GATEWAY_KEY");
        if (!API_KEY)
            throw new Error("AI_GATEWAY_KEY missing");
        // systemPrompt and userPrompt are defined below (single canonical definitions are used to avoid duplicate declarations)
        const systemPromptBase = `You are a helpful medical lab assistant. Given the raw OCR text of a lab report, extract common blood test values and write a brief, friendly summary in plain language. Do NOT provide definitive diagnoses. Always remind users to consult a doctor. If a value is missing in the text, omit it (do not invent values).`;
        const clinicalEnabled = Deno.env.get("ENABLE_CLINICAL_INDICATIONS") === "true" && Deno.env.get("CLINICIAN_APPROVED") === "true";
        if (Deno.env.get("ENABLE_CLINICAL_INDICATIONS") === "true" && Deno.env.get("CLINICIAN_APPROVED") !== "true") {
            console.warn("ENABLE_CLINICAL_INDICATIONS requested but CLINICIAN_APPROVED not set to 'true'; clinical indications will remain disabled.");
        }
        const systemPrompt = clinicalEnabled
            ? systemPromptBase + `\n\nWhen clinical indicators are present, list possible health conditions with conservative confidence estimates (0-100%) and a one-line rationale linking values to the possible condition. Use non-definitive language and advise clinician confirmation.`
            : systemPromptBase;
        const userPrompt = `File: ${fileName}\n\nRaw report text:\n${rawText || "(no text extracted)"}\n\nExtract values and write a short summary.`;
        const tools = [{
                type: "function",
                function: {
                    name: "report_analysis",
                    description: "Extracted lab values and patient-friendly summary",
                    parameters: {
                        type: "object",
                        properties: {
                            values: {
                                type: "object",
                                properties: {
                                    hemoglobin: { type: "object", properties: { value: { type: "number" }, unit: { type: "string" }, status: { type: "string", enum: ["low", "normal", "high"] } } },
                                    wbc: { type: "object", properties: { value: { type: "number" }, unit: { type: "string" }, status: { type: "string", enum: ["low", "normal", "high"] } } },
                                    rbc: { type: "object", properties: { value: { type: "number" }, unit: { type: "string" }, status: { type: "string", enum: ["low", "normal", "high"] } } },
                                    platelets: { type: "object", properties: { value: { type: "number" }, unit: { type: "string" }, status: { type: "string", enum: ["low", "normal", "high"] } } },
                                },
                            },
                            summary: { type: "string", description: "Friendly 2-4 sentence overall summary in plain English." },
                            risks: { type: "array", items: { type: "string" }, description: "Short list of any risk indicators noticed." },
                            possible_conditions: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string" },
                                        confidence: { type: "number", description: "0-100 confidence estimate" },
                                        rationale: { type: "string", description: "Which values/thresholds triggered this indication" }
                                    },
                                },
                                description: "Optional list of conservative possible conditions with confidence scores and short rationales."
                            },
                        },
                        required: ["values", "summary", "risks"],
                        additionalProperties: false,
                    },
                },
            }];
        // Default to a clinically-oriented model; can be overridden via AI_GATEWAY_MODEL env var.
        const MODEL = Deno.env.get("AI_GATEWAY_MODEL") || "openai/gpt-4o-medical";
        const GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://api.openai.com/v1/chat/completions";
        const isHF = GATEWAY_URL.includes("api-inference.huggingface.co") || Deno.env.get("USE_HF_API") === "true";
        const isClinicalBert = (Deno.env.get("AI_GATEWAY_MODEL") || "").toLowerCase().includes("clinicalbert") || GATEWAY_URL.toLowerCase().includes("clinicalbert") || Deno.env.get("USE_CLINICAL_BERT") === "true";
        if (isHF && isClinicalBert) {
            // ClinicalBERT path: use token-classification output from HF (entities), combine with regex numeric extraction.
            const text = rawText || '';
            const hfResp = await fetch(GATEWAY_URL, {
                method: "POST",
                headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
            });
            if (!hfResp.ok) {
                const t = await hfResp.text();
                console.error("HF clinicalbert error", hfResp.status, t);
                return new Response(JSON.stringify({ error: "HF clinicalbert error", details: t }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            const hfData = await hfResp.json();
            const entities = Array.isArray(hfData) ? hfData : (hfData?.[0] ? hfData[0] : []);
            const findValue = (keys) => {
                const re = new RegExp(`(?:${keys.join("|")})\\s*[:\\-]?\\s*([0-9]+(?:\\.[0-9]+)?)`, "i");
                const m = text.match(re);
                return m ? parseFloat(m[1]) : null;
            };
            const values = {
                hemoglobin: (() => { const v = findValue(['hemoglobin', 'hb']); return v == null ? null : { value: v, unit: 'g/dL', status: (v < 12 ? 'low' : v > 17.5 ? 'high' : 'normal') }; })(),
                wbc: (() => { const v = findValue(['wbc', 'white blood cell', 'white blood cells']); return v == null ? null : { value: v, unit: 'x10^9/L', status: (v < 4 ? 'low' : v > 11 ? 'high' : 'normal') }; })(),
                rbc: (() => { const v = findValue(['rbc', 'red blood cell', 'red blood cells']); return v == null ? null : { value: v, unit: '10^12/L', status: (v < 4 ? 'low' : v > 5.9 ? 'high' : 'normal') }; })(),
                platelets: (() => { const v = findValue(['platelets', 'platelet']); return v == null ? null : { value: v, unit: '10^9/L', status: (v < 150 ? 'low' : v > 450 ? 'high' : 'normal') }; })(),
            };
            const findings = (entities || []).map(e => ({ text: e.word || e.token || e.entity || e.label, label: e.entity_group || e.entity || e.label || null, score: e.score || e.confidence || null }));
            const possible_conditions = [];
            if (values.hemoglobin && values.hemoglobin.status === 'low')
                possible_conditions.push({ name: 'Possible anemia', confidence: 30, rationale: `Low hemoglobin (${values.hemoglobin.value} ${values.hemoglobin.unit}) - requires clinical confirmation` });
            if (values.wbc && values.wbc.status === 'high')
                possible_conditions.push({ name: 'Possible infection/inflammation', confidence: 30, rationale: `Elevated WBC (${values.wbc.value} ${values.wbc.unit}) - requires clinical confirmation` });
            const summaryParts = [];
            Object.entries(values).forEach(([k, v]) => { if (v)
                summaryParts.push(`${k.toUpperCase()}: ${v.value} ${v.unit} (${v.status})`); });
            const summary = summaryParts.length ? `Detected values — ${summaryParts.join('; ')}.` : 'No common lab values detected in the text.';
            const parsed = { values, summary, risks: [], possible_conditions, findings };
            return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (isHF) {
            // Use Hugging Face Inference API: ask model to return JSON matching our schema and parse it.
            const promptText = `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userPrompt}\n\nReturn ONLY a single JSON object with keys: values (object), summary (string), risks (array of strings), possible_conditions (array of {name,confidence,rationale}). Do not add any extra text.`;
            const hfResp = await fetch(GATEWAY_URL, {
                method: "POST",
                headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ inputs: promptText, parameters: { max_new_tokens: 512 } }),
            });
            if (!hfResp.ok) {
                const t = await hfResp.text();
                console.error("HF error", hfResp.status, t);
                return new Response(JSON.stringify({ error: "HF gateway error", details: t }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            const hfData = await hfResp.json();
            let textOut = "";
            if (Array.isArray(hfData) && hfData[0]?.generated_text)
                textOut = hfData[0].generated_text;
            else if (hfData.generated_text)
                textOut = hfData.generated_text;
            else if (typeof hfData === 'string')
                textOut = hfData;
            else
                textOut = JSON.stringify(hfData);
            // Attempt to extract JSON from model output
            const jsonMatch = textOut.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('HF did not return JSON', textOut);
                return new Response(JSON.stringify({ error: 'HF did not return JSON', raw: textOut }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            let parsed = { values: {}, summary: '', risks: [], possible_conditions: [] };
            try {
                parsed = JSON.parse(jsonMatch[0]);
            }
            catch (e) {
                console.error('JSON parse error', e, jsonMatch[0]);
                return new Response(JSON.stringify({ error: 'Failed to parse JSON from HF output', raw: jsonMatch[0] }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const resp = await fetch(GATEWAY_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                tools,
                tool_choice: { type: "function", function: { name: "report_analysis" } },
            }),
        });
        if (!resp.ok) {
            const t = await resp.text();
            console.error("AI error", resp.status, t);
            if (resp.status === 429)
                return new Response(JSON.stringify({ error: "Rate limit reached, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            if (resp.status === 402)
                return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const data = await resp.json();
        const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        const parsed = args ? JSON.parse(args) : { values: {}, summary: "", risks: [] };
        return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
