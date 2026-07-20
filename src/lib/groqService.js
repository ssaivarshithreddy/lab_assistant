/**
 * Groq AI integration for streaming medical assistant chat
 * Uses llama-3.3-70b-versatile model
 * Grounds responses in extracted lab metrics
 */

/**
 * Build a system prompt that grounds the AI in medical facts and extracted metrics
 */
function buildSystemPrompt(metricsContext, reportSummary) {
  const metrics = Object.entries(metricsContext || {})
    .filter(([, v]) => v?.value != null)
    .map(([key, v]) => `- ${key}: ${v.value} ${v.unit || ""} (${v.status || "unknown"})`)
    .join("\n");

  return `You are a knowledgeable medical assistant helping patients understand their lab reports. 

CRITICAL RULES:
1. Always ground your responses in the extracted lab metrics provided below
2. NEVER hallucinate medical facts or values not in the report
3. Clearly distinguish between: what the report shows, standard reference ranges, and general educational information
4. Always include: "This is not medical advice. Please consult with your healthcare provider for clinical decisions."
5. Use simple, patient-friendly language
6. Highlight abnormal values and what they might indicate (generally)
7. Flag critical values (very high/low) as potentially requiring urgent attention
8. Never diagnose conditions - only explain what values mean generally
9. Suggest follow-up discussions with their doctor

EXTRACTED LAB METRICS FROM REPORT:
${metrics || "No metrics extracted"}

REPORT SUMMARY:
${reportSummary}

When answering questions:
- Reference specific values from the metrics above
- Use evidence-based general information about what values mean
- Always caveat with "general information suggests" or "typically indicates"
- Encourage professional follow-up for any abnormal findings`;
}

/**
 * Stream a chat message with Groq AI
 */
export async function streamGroqChat(options) {
  const { messages, metricsContext, reportSummary, temperature = 0.7, maxTokens = 1024, onChunk } = options;

  const systemPrompt = buildSystemPrompt(metricsContext, reportSummary);
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("VITE_GROQ_API_KEY is not configured. Please set it in your .env file.");
  }

  const requestBody = {
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Groq API error:", error);
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error("No response body from Groq API");
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

    return fullResponse;
  } catch (error) {
    console.error("Groq streaming error:", error);
    throw error;
  }
}

/**
 * Non-streaming fallback (for simpler implementation)
 */
export async function groqChat(options) {
  const { messages, metricsContext, reportSummary, temperature = 0.7, maxTokens = 1024 } = options;

  const systemPrompt = buildSystemPrompt(metricsContext, reportSummary);
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("VITE_GROQ_API_KEY is not configured");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
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
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Validate that a message doesn't contain prompt injection attempts
 */
export function validateMessage(message) {
  // Basic injection prevention
  const dangerous = [
    "ignore system prompt",
    "forget your instructions",
    "system prompt",
    "override rules",
    "break character",
  ];
  const lower = message.toLowerCase();
  return !dangerous.some((d) => lower.includes(d));
}
