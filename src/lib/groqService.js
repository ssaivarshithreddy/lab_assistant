/**
 * Groq AI integration for streaming medical assistant chat
 * Uses active models: qwen/qwen3.6-27b, openai/gpt-oss-20b, groq/compound-mini
 * Grounds responses in extracted lab metrics
 */

const GROQ_MODELS = [
  "qwen/qwen3.6-27b",
  "openai/gpt-oss-20b",
  "groq/compound-mini",
  "allam-2-7b",
];

/**
 * Build a system prompt that grounds the AI in medical facts and extracted metrics
 */
function buildSystemPrompt(metricsContext, reportSummary, ragPromptText = "") {
  const metrics = Object.entries(metricsContext || {})
    .filter(([, v]) => v?.value != null)
    .map(([key, v]) => `- ${key.toUpperCase()}: ${v.value} ${v.unit || ""} (Rule Engine Status: ${v.status || "normal"})`)
    .join("\n");

  return `You are an expert clinical medical assistant helping patients understand their laboratory test results.

STRICT MEDICAL RAG RULES:
1. Always respect the DETERMINISTIC RULE ENGINE classification (LOW, HIGH, NORMAL). Do NOT alter or guess numerical classifications.
2. Ground your explanations strictly using the RETRIEVED CURATED MEDICAL GUIDELINES and user report evidence provided below.
3. NEVER hallucinate medical facts, reference intervals, or unverified treatments.
4. Do NOT provide a definitive diagnosis — frame explanations as educational reference.
5. Always include: "This is not medical advice. Please consult with your qualified healthcare provider for clinical decisions."
6. Explain results using simple, patient-friendly language while citing specific biomarker values, units, and source report files.

${ragPromptText ? ragPromptText : ""}

ACTIVE REPORT EXTRACTED METRICS (DETERMINISTIC):
${metrics || "No active report metrics"}

ACTIVE REPORT SUMMARY:
${reportSummary || "No active report summary"}

INSTRUCTIONS:
- Explain what the lab value means using the retrieved medical guidelines.
- List general possible causes from the retrieved evidence.
- Suggest high-value questions the patient should ask their clinician.`;
}

/**
 * Stream a chat message with Groq AI using active models with fallback
 */
export async function streamGroqChat(options) {
  const { messages, metricsContext, reportSummary, ragPromptText, temperature = 0.7, maxTokens = 1024, onChunk } = options;

  const systemPrompt = buildSystemPrompt(metricsContext, reportSummary, ragPromptText);
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("VITE_GROQ_API_KEY is not configured. Please set it in your .env file.");
  }

  let lastError = null;

  for (const model of GROQ_MODELS) {
    try {
      const requestBody = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature,
        max_tokens: maxTokens,
        stream: true,
      };

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Groq API model ${model} failed (${response.status}):`, errorText);
        lastError = new Error(`Groq API error (${model}): ${response.status} - ${errorText}`);
        continue;
      }

      if (!response.body) {
        continue;
      }

      let fullResponse = "";
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content || "";
            if (content) {
              fullResponse += content;
              onChunk?.(content);
            }
          } catch (e) {
            // Parse error on SSE line, continue
          }
        }
      }

      if (fullResponse) {
        return fullResponse;
      }
    } catch (err) {
      console.warn(`Groq streaming model ${model} exception:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error("All Groq AI models failed");
}

/**
 * Non-streaming fallback
 */
export async function groqChat(options) {
  const { messages, metricsContext, reportSummary, temperature = 0.7, maxTokens = 1024 } = options;

  const systemPrompt = buildSystemPrompt(metricsContext, reportSummary);
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("VITE_GROQ_API_KEY is not configured");
  }

  let lastError = null;

  for (const model of GROQ_MODELS) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(`Groq API error (${model}): ${response.status} - ${errorText}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      if (content) return content;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("All Groq AI models failed");
}

/**
 * Validate that a message doesn't contain prompt injection attempts
 */
export function validateMessage(message) {
  const dangerous = [
    "ignore system prompt",
    "forget your instructions",
    "system prompt",
    "override rules",
    "break character",
  ];
  const lower = (message || "").toLowerCase();
  return !dangerous.some((d) => lower.includes(d));
}
