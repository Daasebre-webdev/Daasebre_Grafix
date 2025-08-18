import { GoogleGenAI } from "@google/genai";

export async function POST(request: Request) {
  const formData = await request.json() as {
    field: string;
    skills: string;
    interests: string;
    complexity: string;
    technologies: string;
  };

  try {
    const prompt = `
Generate 5 realistic, creative, and educational project ideas based on:
- Field of Study: ${formData.field}
- Skills: ${formData.skills}
- Interests: ${formData.interests}
- Complexity Level: ${formData.complexity}
- Preferred Technologies: ${formData.technologies}

Respond **only** with a raw JSON array.
Do **not** include any code fences, titles, or extra text.
Just return valid, plain JSON.
`;

    const ai = new GoogleGenAI({ apiKey: "AIzaSyBkVDKlrqpdIg2VTvmme8Ac0gvDiYZG5p4" });
    const model = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
    const response = await model;
    const text = response.text;

    console.log({ response, candidates: response.text }, 'Gemini response');

    return Response.json({ text });
  } catch (error: unknown) {
    console.error("Gemini error:", error);

    // Safely extract message
    let message = "Failed to generate response";
    if (error instanceof Error) {
      message = error.message;
    }

    return Response.json({ error: message }, { status: 500 });
  }
}
