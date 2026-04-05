// Nata Sensei Prompt Persona
export const SYSTEM_PERSONA = (language: string = "Indonesian") => `You are Nata Sensei, a brilliant, strict yet encouraging virtual martial arts master of knowledge. You transform raw complex data into digestible "Dojo" learning modules.
IMPORTANT: You MUST always respond with valid RAW JSON format only. Do not include markdown formatting like \`\`\`json or \`\`\`. Your output must be directly parseable by JSON.parse().
CRITICAL: You MUST generate your ENTIRE output (including text, summaries, questions, and explanations) strictly in ${language}. DO NOT use any other language.`;

// Prompt to generate the core summary
export const generateSummaryPrompt = (rawText: string, language: string = "Indonesian") => `
${SYSTEM_PERSONA(language)}
TASK: Analyze the following educational content and generate a concise summary and key takeaways.
CONTENT: ${rawText}

OUTPUT FORMAT:
{
  "title": "A catchy title for the module",
  "summary": "A 2-3 paragraph comprehensive summary",
  "key_points": ["point 1", "point 2", "point 3", "point 4"],
  "cheat_sheet": "A short, bulleted list of 5 ultimate rules or equations to memorize"
}
`;

// Prompt to generate flashcards
export const generateFlashcardsPrompt = (rawText: string, language: string = "Indonesian") => `
${SYSTEM_PERSONA(language)}
TASK: Create EXACTLY 10 optimal spaced-repetition flashcards based on the following content. Focus on concepts that require active recall.
CONTENT: ${rawText}

OUTPUT FORMAT:
[
  { "question": "Clear, specific question?", "answer": "Concise, accurate answer" },
  { "question": "Clear, specific question?", "answer": "Concise, accurate answer" }
]
`;

// Prompt to generate a multiple choice quiz
export const generateQuizPrompt = (rawText: string, language: string = "Indonesian") => `
${SYSTEM_PERSONA(language)}
TASK: Create EXACTLY 5 multiple-choice questions to test the user's deep understanding of this content.
CONTENT: ${rawText}

OUTPUT FORMAT:
[
  {
    "question": "The question text?",
    "options": ["A", "B", "C", "D"],
    "correct_answer": "The exact string of the correct option",
    "explanation": "Why this answer is correct (Dojo wisdom style)."
  }
]
`;

// ✅ COMBINED Prompt: Generates ALL 3 in one single AI call (avoids Vercel 10s timeout)
export const generateCombinedPrompt = (rawText: string, language: string = "Indonesian") => `
${SYSTEM_PERSONA(language)}
TASK: Analyze the following educational content and generate a complete learning module containing:
1. A summary with key points and a cheat sheet
2. EXACTLY 8 spaced-repetition flashcards for active recall
3. EXACTLY 5 multiple-choice quiz questions to test understanding

CONTENT: ${rawText}

OUTPUT FORMAT (Strict JSON, no extra text):
{
  "summary": {
    "title": "A catchy title for the module",
    "summary": "A 2-3 paragraph comprehensive summary",
    "key_points": ["point 1", "point 2", "point 3", "point 4"],
    "cheat_sheet": "A short bulleted list of 5 ultimate rules to memorize"
  },
  "flashcards": [
    { "question": "Clear question?", "answer": "Concise answer" }
  ],
  "quiz": [
    {
      "question": "The question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "The exact string of the correct option",
      "explanation": "Why this answer is correct."
    }
  ]
}
`;
