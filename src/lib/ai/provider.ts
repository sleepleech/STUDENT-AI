/**
 * Universal AI Provider — Auto Fallback Chain
 * 
 * Priority: Gemini → Groq → Cerebras → SambaNova
 * 
 * All providers except Gemini use OpenAI-compatible API format.
 * If one provider hits quota, automatically tries the next one.
 */

// ===== PROVIDER CONFIGS =====
const PROVIDERS = [
  {
    name: "Gemini",
    type: "gemini" as const,
    keysEnv: "GEMINI_API_KEYS",
    model: "gemini-1.5-flash",
  },
  {
    name: "Groq",
    type: "openai_compat" as const,
    keysEnv: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
  },
  {
    name: "Cerebras",
    type: "openai_compat" as const,
    keysEnv: "CEREBRAS_API_KEYS",
    baseUrl: "https://api.cerebras.ai/v1",
    model: "llama-3.3-70b",
  },
  {
    name: "SambaNova",
    type: "openai_compat" as const,
    keysEnv: "SAMBANOVA_API_KEY",
    baseUrl: "https://api.sambanova.ai/v1",
    model: "Meta-Llama-3.3-70B-Instruct",
  },
];

function getKeys(envName: string): string[] {
  const val = process.env[envName] || "";
  return val.split(",").map((k) => k.trim()).filter(Boolean);
}

function isQuotaError(msg: string): boolean {
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("rate_limit") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("overloaded")
  );
}

/**
 * Call OpenAI-compatible API (Groq, Cerebras, SambaNova)
 */
async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false
): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      temperature: 0.3,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Call Gemini API
 */
async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
  jsonMode = false
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  const result = await geminiModel.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
  });

  return result.response.text();
}

/**
 * Main function: Generate text with automatic fallback across all providers
 * 
 * @param prompt        The user prompt to send
 * @param systemPrompt  Optional system prompt (for non-Gemini providers)
 * @param jsonMode      Whether to request JSON output
 */
export async function generateWithFallback(
  prompt: string,
  systemPrompt = "Kamu adalah asisten belajar AI yang membantu siswa belajar efektif.",
  jsonMode = false
): Promise<string> {
  const errors: string[] = [];

  for (const provider of PROVIDERS) {
    const keys = getKeys(provider.keysEnv);
    if (keys.length === 0) continue;

    for (const key of keys) {
      try {
        console.log(`🤖 Trying ${provider.name}...`);

        let result: string;

        if (provider.type === "gemini") {
          result = await callGemini(key, provider.model, prompt, jsonMode);
        } else {
          result = await callOpenAICompat(
            provider.baseUrl!,
            key,
            provider.model,
            systemPrompt,
            prompt,
            jsonMode
          );
        }

        if (result && result.trim().length > 5) {
          console.log(`✅ Success via ${provider.name}`);
          return result;
        }

      } catch (err: any) {
        const msg = err?.message || String(err);
        errors.push(`[${provider.name}] ${msg.slice(0, 100)}`);

        if (isQuotaError(msg.toLowerCase())) {
          console.warn(`⚠️ ${provider.name} quota/rate limit, trying next...`);
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        // Non-quota error: skip this key but continue to next
        console.error(`❌ ${provider.name} error (non-quota): ${msg.slice(0, 100)}`);
        break;
      }
    }
  }

  throw new Error(
    `Semua AI provider gagal atau habis kuota. Detail:\n${errors.join("\n")}`
  );
}

/**
 * Generate JSON specifically — parses and validates the output
 */
export async function generateJSONWithFallback(
  prompt: string,
  systemPrompt?: string
): Promise<any> {
  const raw = await generateWithFallback(prompt, systemPrompt, true);

  // Clean markdown code fences if present
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract first JSON object/array
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);
    throw new Error("AI response is not valid JSON: " + cleaned.slice(0, 200));
  }
}
