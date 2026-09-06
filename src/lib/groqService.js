/**
 * Groq AI integration for streaming medical assistant chat
 * Uses active models: qwen/qwen3.6-27b, openai/gpt-oss-20b, groq/compound-mini
 * Grounds responses in extracted lab metrics
 */

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
];

/**
 * Clean model response by removing internal thinking blocks, <think> tags, and reasoning headers
 */
export function cleanModelResponse(text = "") {
  if (!text) return "";
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  cleaned = cleaned.replace(/^Here's a thinking process:[\s\S]*?\n\n/i, "");
  cleaned = cleaned.replace(/^Analyze User Input:[\s\S]*?\n\n/i, "");
  cleaned = cleaned.replace(/^Formulate Response:[\s\S]*?\n\n/i, "");
  cleaned = cleaned.replace(/^Constraint check:[\s\S]*?\n\n/i, "");
  return cleaned.trim();
}

/**
 * Validate whether a query belongs to the medical, health, or clinical domain
 */
export function isMedicalQuery(message = "") {
  if (!message || typeof message !== "string") return false;
  const q = message.toLowerCase().trim();

  // General non-medical keywords (programming, games, trivia, finance, history, entertainment)
  const nonMedicalKeywords = [
    "python", "javascript", "react", "html", "css", "java", "c++", "code", "coding", "programming", "script",
    "world cup", "football", "cricket", "nba", "movie", "song", "cinema", "actor", "actress",
    "stock market", "crypto", "bitcoin", "investing", "capital of", "who is the president", "history of"
  ];

  return !nonMedicalKeywords.some((keyword) => q.includes(keyword));
}

function buildSystemPrompt(metricsContext, reportSummary, ragPromptText = "") {
  const metrics = Object.entries(metricsContext || {})
    .filter(([, v]) => v?.value != null)
    .map(([key, v]) => `- ${key.toUpperCase()}: ${v.value} ${v.unit || ""} (Rule Engine Status: ${v.status || "normal"})`)
    .join("\n");

  return `[SYSTEM INSTRUCTIONS & SAFETY RULES]
You are a helpful, empathetic, and direct AI Health Assistant. Your task is to directly answer the CURRENT USER QUESTION in simple, patient-friendly terms.

STRICT MEDICAL DOMAIN SCOPING RULE:
You are an AI assistant specialized EXCLUSIVELY in the medical, healthcare, clinical, pharmaceutical, wellness, and laboratory fields.
If the user asks a question that is NOT related to medicine, health, lab tests, medical conditions, anatomy, biology, nutrition, or patient care (e.g. coding, programming, general trivia, history, entertainment, finance), you MUST politely refuse by stating:
"I am an AI Health Assistant specialized exclusively in medical, health, and laboratory topics. Please ask me a question related to your health, lab reports, medications, or medical conditions."

CRITICAL INSTRUCTIONS:
1. **NEVER EXPOSE THINKING TRACES:** Do NOT output internal reasoning, <think> tags, "Analyze User Input:", or "Constraint check:".
2. **PRIORITIZE THE CURRENT USER QUESTION:** Answer the CURRENT USER QUESTION directly. Do not answer an earlier question unless the current user explicitly refers to it.
3. **AMBIGUOUS PREMISE CORRECTION:** If the user asks an incorrect assumption (e.g. "why HbA1c is low?" when HbA1c = 7.1% HIGH, or "why glucose is less?" when Glucose = 141 mg/dL HIGH), politely correct the misunderstanding FIRST (e.g. "Your report actually classifies HbA1c as HIGH at 7.1%, rather than low."), then explain why it is high.
4. **DETERMINISTIC NUMERICAL AUTHORITY:** The rule engine classifications (LOW, HIGH, NORMAL) and values (e.g., 141 mg/dL) are immutable facts. Never recalculate or alter numerical values.
5. **EVIDENCE SUFFICIENCY:** Rely on retrieved medical guidelines. If specific evidence for a biomarker is limited, state so clearly instead of substituting unrelated guidelines.
6. **STRUCTURED PATIENT-FRIENDLY RESPONSE:**
   - 📌 **Direct Answer:** 1-2 sentence direct response.
   - 💡 **What This Means:** Clear, easy-to-understand bullet points.
   - 🩺 **Questions for Your Doctor:** 2 specific questions for their clinician.
7. **SAFETY DISCLAIMER:** End with *"Disclaimer: This is for educational reference only. Please consult your physician for clinical diagnosis."*

[PATIENT & REPORT CONTEXT]
ACTIVE REPORT SUMMARY:
${reportSummary || "No active report summary"}

[DETERMINISTIC LAB CLASSIFICATIONS]
${metrics || "No active report metrics"}

${ragPromptText ? ragPromptText : ""}`;
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
      const formattedHistory = messages.map((m, idx) => {
        const isCurrent = idx === messages.length - 1;
        if (isCurrent && m.role === "user") {
          return {
            role: "user",
            content: `[CURRENT USER QUESTION - TOP PRIORITY ANSWER THIS QUESTION]:\n"${m.content}"`,
          };
        }
        return { role: m.role, content: m.content };
      });

      const requestBody = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...formattedHistory,
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
        return cleanModelResponse(fullResponse);
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

export function validateMessage(message) {
  const dangerous = [
    "ignore system prompt",
    "forget your instructions",
    "system prompt",
    "override rules",
    "break character",
  ];
  const lower = (message || "").toLowerCase();
  const isDangerous = dangerous.some((d) => lower.includes(d));
  if (isDangerous) {
    return { ok: false, reason: "Message contains unsafe text patterns." };
  }
  return { ok: true };
}
