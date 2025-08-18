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
];

// Type definition for cache entries
type ModelStatus = {
  lastAvailable: number;
  lastError?: number;
};

// Cache for model availability
const modelStatusCache = new Map<string, ModelStatus>();

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

    const { message, history = [] } = await request.json();

    // Try models in priority order
    for (const modelName of MODEL_PRIORITY_LIST) {
      try {
        // Skip recently failing models
        const cacheEntry = modelStatusCache.get(modelName);
        if (cacheEntry?.lastError && (Date.now() - cacheEntry.lastError < 300000)) {
          continue;
        }

        const model = genAI.getGenerativeModel({ model: modelName });

        // Build conversation history
        const chat = model.startChat({
          history: [
            ...history,
            // You could add system instructions here if needed
          ],
          generationConfig: {
            maxOutputTokens: 2000, // Adjust as needed
            temperature: 0.9, // Adjust for creativity
          },
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        // Update cache on success - ensure both properties are properly set
        modelStatusCache.set(modelName, { 
          lastAvailable: Date.now(),
          lastError: undefined // Clear any previous errors
        });
        
        return NextResponse.json({ 
          text,
          modelUsed: modelName 
        });

      } catch (error) {
        console.warn(`Model ${modelName} failed:`, error);
        const cacheEntry = modelStatusCache.get(modelName) || { lastAvailable: 0 };
        modelStatusCache.set(modelName, { 
          lastAvailable: cacheEntry.lastAvailable, // Preserve existing
          lastError: Date.now() // Set new error time
        });
      }
    }

    throw new Error("All models are currently unavailable");

  } catch (error: unknown) {
    console.error("Chat Error:", error);
    
    // Enhanced error handling
    let errorMessage = "Failed to process request";
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes("quota")) {
        errorMessage = "API quota exceeded. Please try again later.";
        statusCode = 429;
      } else if (error.message.includes("model") || error.message.includes("unavailable")) {
        errorMessage = "Model service unavailable. Please try again.";
        statusCode = 503;
      } else if (error.message.includes("safety")) {
        errorMessage = "Content blocked for safety reasons.";
        statusCode = 400;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        suggestion: "Try again in a few minutes or contact support if the issue persists"
      },
      { status: statusCode }
    );
  }
}