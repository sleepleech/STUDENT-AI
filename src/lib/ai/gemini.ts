import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';

if (!apiKey && typeof window === 'undefined') {
  console.warn("GEMINI_API_KEY is not defined. Ensure it is set in your .env.local file.");
}

// Access your API key as an environment variable
export const genAI = new GoogleGenerativeAI(apiKey);

// The Core AI model (Google Gemini 1.5 Flash)
export const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// The Embedding model for RAG contextual search
export const geminiEmbeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
