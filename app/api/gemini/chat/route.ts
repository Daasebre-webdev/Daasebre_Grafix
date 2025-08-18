import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialize with environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Rate limiting configuration
const REQUEST_DELAY = 1000; // 1 second between requests
let lastRequestTime = 0;

// Model fallback configuration
const MODEL_PRIORITY_LIST = [
  "gemini-1.5-flash", // Fastest
  "gemini-1.5-pro",   // More capable
  "gemini-pro"        // Basic
] as const;

type ModelName = typeof MODEL_PRIORITY_LIST[number];

// Type definition for cache entries
type ModelStatus = {
  lastAvailable: number;
  lastError?: number;
};

// Cache for model availability
const modelStatusCache = new Map<ModelName, ModelStatus>();

// Type definitions for request and response
type ChatHistoryItem = {
  role: "user" | "model";
  parts: { text: string }[];
};

type ChatRequest = {
  message: string;
  history?: ChatHistoryItem[];
};

type ChatResponse = {
  text: string;
  modelUsed: ModelName;
};

type ErrorResponse = {
  error: string;
  suggestion?: string;
};

type GeminiAPIError = Error & {
  response?: {
    status?: number;
    data?: {
      error?: string;
    };
  };
};

type ErrorType = 
  | 'QUOTA_EXCEEDED'
  | 'MODEL_UNAVAILABLE'
  | 'SAFETY_BLOCKED'
  | 'GENERIC_ERROR';

type ErrorHandler = {
  type: ErrorType;
  test: (error: GeminiAPIError) => boolean;
  message: string;
  status: number;
};

const errorHandlers: ErrorHandler[] = [
  {
    type: 'QUOTA_EXCEEDED',
    test: (error) => error.message.includes("quota"),
    message: "API quota exceeded. Please try again later.",
    status: 429
  },
  {
    type: 'MODEL_UNAVAILABLE',
    test: (error) => 
      error.message.includes("model") || 
      error.message.includes("unavailable"),
    message: "Model service unavailable. Please try again.",
    status: 503
  },
  {
    type: 'SAFETY_BLOCKED',
    test: (error) => error.message.includes("safety"),
    message: "Content blocked for safety reasons.",
    status: 400
  },
  {
    type: 'GENERIC_ERROR',
    test: () => true,
    message: "Failed to process request",
    status: 500
  }
];

export async function POST(request: Request) {
  try {
    // Implement rate limiting
    const now = Date.now();
    const timeSinceLast = now - lastRequestTime;
    
    if (timeSinceLast < REQUEST_DELAY) {
      await new Promise(resolve => 
        setTimeout(resolve, REQUEST_DELAY - timeSinceLast)
      );
    }
    lastRequestTime = Date.now();

    const { message, history = [] } = await request.json() as ChatRequest;

    // Try models in priority order
    for (const modelName of MODEL_PRIORITY_LIST) {
      try {
        // Skip recently failing models
        const cacheEntry = modelStatusCache.get(modelName);
        if (cacheEntry?.lastError && (Date.now() - cacheEntry.lastError < 300000)) {
          continue;
        }

        const model = genAI.getGenerativeModel({ model: modelName });

        // Convert history to the correct format
        const formattedHistory = history.map(({ role, parts }) => ({
          role,
          parts
        }));

        // Build conversation history
        const chat = model.startChat({
          history: formattedHistory,
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.9,
          },
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        // Update cache on success
        modelStatusCache.set(modelName, { 
          lastAvailable: Date.now(),
          lastError: undefined
        });
        
        return NextResponse.json({ 
          text,
          modelUsed: modelName 
        } satisfies ChatResponse);

      } catch (error: unknown) {
        console.warn(`Model ${modelName} failed:`, error);
        const cacheEntry = modelStatusCache.get(modelName) || { lastAvailable: 0 };
        modelStatusCache.set(modelName, { 
          lastAvailable: cacheEntry.lastAvailable,
          lastError: Date.now()
        });
      }
    }

    throw new Error("All models are currently unavailable");

  } catch (error: unknown) {
    console.error("Chat Error:", error);
    
    const defaultHandler = errorHandlers.find(h => h.type === 'GENERIC_ERROR')!;
    const handler = error instanceof Error 
      ? errorHandlers.find(h => h.test(error as GeminiAPIError)) ?? defaultHandler
      : defaultHandler;

    return NextResponse.json(
      { 
        error: handler.message,
        suggestion: "Try again in a few minutes or contact support if the issue persists"
      } satisfies ErrorResponse,
      { status: handler.status }
    );
  }
}