import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';

let genAiInstance: GoogleGenAI | null = null;

export function getGeminiApiKey(): string | null {
  const candidate =
    (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim()) ||
    (env.GOOGLE_API_KEY && env.GOOGLE_API_KEY.trim()) ||
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) ||
    (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim()) ||
    null;

  if (!candidate || candidate === 'your_gemini_api_key_here' || candidate.length === 0) {
    return null;
  }
  return candidate;
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }
  if (!genAiInstance) {
    genAiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return genAiInstance;
}
