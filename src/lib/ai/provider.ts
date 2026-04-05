/**
 * Universal AI Provider — Hyper-Reliable Edition (v4)
 * 
 * Features: Key Shuffling + Model Fallback + Advanced JSON Extraction.
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
    fallbackModel: "Llama-3.1-8B-Instruct", 
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
    lower.includes("resource_exhausted") 
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
            
            if (rawMsg.includes("404") || rawMsg.includes("400") || isLimitError(rawMsg)) {
                continue; 
            }
            break; 
          }
        }
    }
  }

  throw new Error(
    `Semua AI provider gagal. Terakhir: ${allErrors.pop()}`
  );
}

/**
 * Helper to extract the most likely JSON object or array from a string
 */
function extractJSON(str: string) {
    // Look for first { or [
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
    
    let end = str.lastIndexOf(endChar);
    if (end === -1 || end < start) return null;
    
    return str.slice(start, end + 1);
}

/**
 * Generate JSON specifically — with aggressive cleaning and array extraction
 */
export async function generateJSONWithFallback(prompt: string, systemPrompt?: string): Promise<any> {
  const raw = await generateWithFallback(prompt, systemPrompt, true);
  
  // 1. Initial Cleaning (Removal of markdown fences)
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  
  try {
    let parsed = JSON.parse(cleaned);
    
    // 2. Wrap Fix: If we get { "flashcards": [...] } but prompt asked for [ ... ]
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        if (keys.length === 1 && Array.isArray(parsed[keys[0]])) {
            return parsed[keys[0]];
        }
    }
    
    return parsed;
  } catch {
    // 3. Last Resort: Aggressive Extraction via start/end markers
    const extracted = extractJSON(cleaned);
    if (extracted) {
        try {
            let parsedExtracted = JSON.parse(extracted);
            // Re-apply wrap fix for extracted part
            if (parsedExtracted && typeof parsedExtracted === 'object' && !Array.isArray(parsedExtracted)) {
                const keys = Object.keys(parsedExtracted);
                if (keys.length === 1 && Array.isArray(parsedExtracted[keys[0]])) {
                    return parsedExtracted[keys[0]];
                }
            }
            return parsedExtracted;
        } catch (e) {
            console.error("Final JSON Extraction Failed:", e);
        }
    }
    
    throw new Error("AI response is not valid JSON even after extraction.");
  }
}
