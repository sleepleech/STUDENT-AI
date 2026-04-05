/**
 * Universal AI Provider — Auto Fallback Chain (Hyper-Reliable Edition)
 * 
 * Priority: Random(Gemini) → Random(Groq) → Random(Cerebras) → Random(SambaNova)
 * 
 * Includes key shuffling to distribute load and aggressive error detection.
 */

// Helper to shuffle arrays (Fisher-Yates) for random key selection
function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

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
    model: "Meta-Llama-3.3-70B-Instruct", // Alternative: "Llama-3.3-70B-Instruct"
  },
];

function getKeys(envName: string): string[] {
  const val = process.env[envName] || "";
  return val.split(",").map((k) => k.trim()).filter(Boolean);
}

function isQuotaError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("limit") || // Matches "Rate limit reached"
    lower.includes("reached") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate_limit") ||
    lower.includes("too many requests") ||
    lower.includes("overloaded") ||
    lower.includes("available") // "No models available" etc.
  );
}

/**
 * Call OpenAI-compatible API (Groq, Cerebras, SambaNova)
 */
async function callOpenAICompat(
  providerName: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false
): Promise<string> {
  const body: any = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 8000,
  };

  // Only add response_format if jsonMode is true (prevents 400 on some providers)
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[${providerName}] HTTP ${response.status}: ${errText.slice(0, 300)}`);
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
 */
export async function generateWithFallback(
  prompt: string,
  systemPrompt = "Kamu adalah asisten belajar AI yang membantu siswa belajar efektif.",
  jsonMode = false
): Promise<string> {
  const errors: string[] = [];

  for (const provider of PROVIDERS) {
    const rawKeys = getKeys(provider.keysEnv);
    if (rawKeys.length === 0) continue;

    // SHUFFLE KEYS to distribute load evenly!
    const keys = shuffleArray(rawKeys);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const keyShort = key.slice(0, 6) + "...";

      try {
        console.log(`🤖 Trying ${provider.name} (Key ${i + 1}/${keys.length}: ${keyShort})...`);

        let result: string;

        if (provider.type === "gemini") {
          result = await callGemini(key, provider.model, prompt, jsonMode);
        } else {
          result = await callOpenAICompat(
            provider.name,
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
        errors.push(msg.slice(0, 150));

        if (isQuotaError(msg)) {
          console.warn(`⚠️ ${provider.name} Key #${i + 1} limit, retrying next key...`);
          await new Promise((r) => setTimeout(r, 800)); // wait brief moment
          continue; // tries next KEY of same provider
        }

        // Non-quota error but we still have more keys? Retry anyway just in case it's a transient network issue
        if (i < keys.length - 1) {
           console.warn(`❌ ${provider.name} unexpected error, trying next key...`);
           continue;
        }

        // If last key failed with non-quota error, move to next provider
        console.error(`❌ ${provider.name} totally failed, moving to next provider.`);
        break; 
      }
    }
  }

  throw new Error(
    `Semua AI provider gagal atau habis kuota. Detail:\n${errors.join("\n")}`
  );
}

/**
 * Generate JSON specifically
 */
export async function generateJSONWithFallback(
  prompt: string,
  systemPrompt?: string
): Promise<any> {
  const raw = await generateWithFallback(prompt, systemPrompt, true);
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);
    throw new Error("AI response is not valid JSON.");
  }
}
