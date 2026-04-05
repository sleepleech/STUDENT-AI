/**
 * Universal AI Provider — Hyper-Reliable Edition (v3)
 * 
 * Priority: Gemini → Groq → Cerebras → SambaNova
 * Features: Key Shuffling + Model Fallback (70B -> 8B) + Detection 404/429.
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
  {
    name: "Gemini",
    type: "gemini" as const,
    keysEnv: "GEMINI_API_KEYS",
    mainModel: "gemini-1.5-flash",
    fallbackModel: "gemini-1.5-flash-latest",
  },
  {
    name: "Groq",
    type: "openai_compat" as const,
    keysEnv: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    mainModel: "llama-3.3-70b-versatile",
    fallbackModel: "llama-3.1-8b-instant",
  },
  {
    name: "Cerebras",
    type: "openai_compat" as const,
    keysEnv: "CEREBRAS_API_KEYS",
    baseUrl: "https://api.cerebras.ai/v1",
    mainModel: "llama-3.3-70b",
    fallbackModel: "llama-3.1-8b",
  },
  {
    name: "SambaNova",
    type: "openai_compat" as const,
    keysEnv: "SAMBANOVA_API_KEY",
    baseUrl: "https://api.sambanova.ai/v1",
    mainModel: "Llama-3.3-70B-Instruct",
    fallbackModel: "Llama-3.2-1B-Instruct", // Ultra lightweight fallback
  },
];

function getKeys(envName: string): string[] {
  const val = process.env[envName] || "";
  return val.split(",").map((k) => k.trim()).filter(Boolean);
}

function isLimitError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("limit") ||
    lower.includes("reached") ||
    lower.includes("resource_exhausted") ||
    lower.includes("too many requests") ||
    lower.includes("overloaded")
  );
}

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
    temperature: 0.2,
    max_tokens: 4000,
  };

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
    throw new Error(`[${providerName} API] ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
  jsonMode = false
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  // Ensure model name has 'models/' prefix for SDK reliably
  const modelId = model.includes("/") ? model : `models/${model}`;
  const geminiModel = genAI.getGenerativeModel({ model: modelId });

  const result = await geminiModel.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
  });

  return result.response.text();
}

/**
 * Main function: Generate text with dual-model fallback per provider
 */
export async function generateWithFallback(
  prompt: string,
  systemPrompt = "Kamu adalah asisten belajar AI yang membantu siswa belajar efektif.",
  jsonMode = false
): Promise<string> {
  const allErrors: string[] = [];

  for (const provider of PROVIDERS) {
    const rawKeys = getKeys(provider.keysEnv);
    if (rawKeys.length === 0) continue;

    const keys = shuffleArray(rawKeys);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        
        // Model rotation: Try MainModel first, then FallbackModel if needed
        const modelList = [provider.mainModel, provider.fallbackModel];
        
        for (const targetModel of modelList) {
          try {
            console.log(`🤖 [${provider.name}] Trying Model: ${targetModel} (Key #${i+1})...`);

            let result: string;
            if (provider.type === "gemini") {
              result = await callGemini(key, targetModel, prompt, jsonMode);
            } else {
              result = await callOpenAICompat(
                provider.name,
                provider.baseUrl!,
                key,
                targetModel,
                systemPrompt,
                prompt,
                jsonMode
              );
            }

            if (result && result.trim().length > 5) {
              return result;
            }
          } catch (err: any) {
            const rawMsg = err?.message || String(err);
            console.warn(`⚠️ [${provider.name}] Failed with model ${targetModel}: ${rawMsg.slice(0, 100)}`);
            
            allErrors.push(`[${provider.name}/${targetModel}] ${rawMsg.slice(0, 80)}`);
            
            // If it's a 404 on Gemini or a 400 on SambaNova, try the next model on the same key!
            if (rawMsg.includes("404") || rawMsg.includes("400")) {
                continue; // try fallbackModel with the same key
            }

            // If it's a limit error, try next MODEL or next KEY
            if (isLimitError(rawMsg)) {
                continue; 
            }
            
            // For other critical errors, break this key but move to next key/model
            break; 
          }
        }
    }
  }

  throw new Error(
    `Semua AI provider gagal. Silakan periksa Vercel Logs untuk detail API. Terakhir: ${allErrors.pop()}`
  );
}

export async function generateJSONWithFallback(prompt: string, systemPrompt?: string): Promise<any> {
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
