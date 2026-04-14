/**
 * Universal AI Provider — v5 (Multi-Provider with DeepSeek + OpenRouter)
 * 
 * Provider Priority:
 * 1. DeepSeek (via DeepSeek API) — Fast, cheap, great for Indonesian
 * 2. OpenRouter (DeepSeek R1 / Claude / Llama) — Reliable fallback  
 * 3. Gemini 1.5 Flash — Multimodal, comprehensive
 * 4. Groq — Ultra-fast inference
 * 5. Cerebras — Fast fallback
 * 6. SambaNova — Last resort
 */

function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

const PROVIDERS = [
  // ===== DEEPSEEK (Direct API) =====
  {
    name: "DeepSeek",
    type: "openai_compat" as const,
    keysEnv: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com/v1",
    mainModel: "deepseek-chat",
    fallbackModel: "deepseek-chat",
  },
  // ===== OPENROUTER (Multi-model gateway: DeepSeek, Claude, Llama) =====
  {
    name: "OpenRouter-DeepSeek",
    type: "openai_compat" as const,
    keysEnv: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    mainModel: "deepseek/deepseek-chat-v3-0324:free",
    fallbackModel: "deepseek/deepseek-r1:free",
    extraHeaders: {
      "HTTP-Referer": "https://student-ai-beta.vercel.app",
      "X-Title": "Nata Sensei",
    },
  },
  // ===== GEMINI =====
  {
    name: "Gemini",
    type: "gemini" as const,
    keysEnv: "GEMINI_API_KEYS",
    mainModel: "gemini-2.0-flash",
    fallbackModel: "gemini-1.5-flash",
  },
  // ===== GROQ =====
  {
    name: "Groq",
    type: "openai_compat" as const,
    keysEnv: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    mainModel: "llama-3.3-70b-versatile",
    fallbackModel: "llama-3.1-8b-instant",
  },
  // ===== CEREBRAS =====
  {
    name: "Cerebras",
    type: "openai_compat" as const,
    keysEnv: "CEREBRAS_API_KEYS",
    baseUrl: "https://api.cerebras.ai/v1",
    mainModel: "llama-3.3-70b",
    fallbackModel: "llama-3.1-8b",
  },
  // ===== SAMBANOVA =====
  {
    name: "SambaNova",
    type: "openai_compat" as const,
    keysEnv: "SAMBANOVA_API_KEY",
    baseUrl: "https://api.sambanova.ai/v1",
    mainModel: "Llama-3.3-70B-Instruct",
    fallbackModel: "Llama-3.1-8B-Instruct",
  },
];

type ProviderConfig = typeof PROVIDERS[number];

function getKeys(envName: string): string[] {
  const val = process.env[envName] || "";
  return val.split(",").map((k) => k.trim()).filter(Boolean);
}

function isLimitOrModelError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("reached") ||
    lower.includes("resource_exhausted") ||
    lower.includes("model_not_found") ||
    lower.includes("404")
  );
}

async function callOpenAICompat(
  provider: ProviderConfig & { type: "openai_compat" },
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
    temperature: 0.2,
    max_tokens: 4096,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const extraHeaders = (provider as any).extraHeaders || {};

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[${provider.name} ${response.status}] ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  });

  const result = await geminiModel.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    ...(jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
  });

  return result.response.text();
}

/**
 * Main export: Try all providers in priority order with key rotation and model fallback.
 * Will NOT fail silently — throws a descriptive error if ALL providers fail.
 */
export async function generateWithFallback(
  prompt: string,
  systemPrompt = "Kamu adalah asisten belajar AI yang membantu siswa belajar efektif.",
  jsonMode = false
): Promise<string> {
  const allErrors: string[] = [];

  for (const provider of PROVIDERS) {
    const rawKeys = getKeys(provider.keysEnv);
    if (rawKeys.length === 0) {
      console.log(`⏭️ [${provider.name}] Skipped — no key configured.`);
      continue;
    }

    const keys = shuffleArray(rawKeys);
    const models = [provider.mainModel, provider.fallbackModel].filter(Boolean);

    for (const key of keys) {
      for (const model of models) {
        try {
          console.log(`🤖 [${provider.name}] Model: ${model} Key: ...${key.slice(-6)}`);

          let result: string;
          if (provider.type === "gemini") {
            result = await callGemini(key, model, systemPrompt, prompt, jsonMode);
          } else {
            result = await callOpenAICompat(
              provider as any,
              key,
              model,
              systemPrompt,
              prompt,
              jsonMode
            );
          }

          if (result && result.trim().length > 5) {
            console.log(`✅ [${provider.name}/${model}] Success!`);
            return result;
          }

          console.warn(`⚠️ [${provider.name}/${model}] Empty response.`);
        } catch (err: any) {
          const msg = err?.message || String(err);
          console.warn(`⚠️ [${provider.name}/${model}] ${msg.slice(0, 120)}`);
          allErrors.push(`[${provider.name}/${model}] ${msg.slice(0, 100)}`);

          if (isLimitOrModelError(msg)) {
            continue; // Try next model/key
          }
          break; // Non-rate-limit error: skip remaining models for this key
        }
      }
    }
  }

  const lastError = allErrors[allErrors.length - 1] || "Semua provider tidak tersedia.";
  throw new Error(`Semua AI provider gagal. Error terakhir: ${lastError}`);
}

// ====== JSON Helpers ======

function extractJSON(str: string): string | null {
  const firstBrace = str.indexOf('{');
  const firstBracket = str.indexOf('[');

  let start = -1;
  let endChar = '';

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    endChar = '}';
  } else if (firstBracket !== -1) {
    start = firstBracket;
    endChar = ']';
  }

  if (start === -1) return null;

  const end = str.lastIndexOf(endChar);
  if (end === -1 || end < start) return null;

  return str.slice(start, end + 1);
}

export async function generateJSONWithFallback(prompt: string, systemPrompt?: string): Promise<any> {
  const raw = await generateWithFallback(prompt, systemPrompt, true);

  // Strip markdown code fences
  const cleaned = raw.replace(/```json\s*|\s*```/gi, "").trim();

  try {
    let parsed = JSON.parse(cleaned);

    // Unwrap { "data": [...] } → [...]
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      if (keys.length === 1 && Array.isArray(parsed[keys[0]])) {
        return parsed[keys[0]];
      }
    }

    return parsed;
  } catch {
    // Last resort: extract raw JSON substring
    const extracted = extractJSON(cleaned);
    if (extracted) {
      try {
        let parsedExtracted = JSON.parse(extracted);
        if (parsedExtracted && typeof parsedExtracted === 'object' && !Array.isArray(parsedExtracted)) {
          const keys = Object.keys(parsedExtracted);
          if (keys.length === 1 && Array.isArray(parsedExtracted[keys[0]])) {
            return parsedExtracted[keys[0]];
          }
        }
        return parsedExtracted;
      } catch (e) {
        console.error("❌ Final JSON extraction failed:", e);
      }
    }

    throw new Error(`AI response is not valid JSON. Content: ${cleaned.substring(0, 150)}...`);
  }
}
