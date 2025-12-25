import { GoogleGenerativeAI } from "@google/generative-ai";

export async function auditScript(script: string, apiKey: string): Promise<{ safeScript: string, wasModified: boolean }> {
    if (!apiKey) {
        // Fallback: If no key, assume unsafe or just return original with warning? 
        // Better to return original to avoid blocking, but log warning.
        console.warn("Missing Gemini Key, skipping safety audit.");
        return { safeScript: script, wasModified: false };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are a strict Legal Compliance and Brand Safety Officer.
    Review the following ad script segment.
    
    Rules:
    1. If the script is safe (no hate speech, violence, misleading claims, NSFW), return it EXACTLY as is.
    2. If it is unsafe or questionable, REWRITE it to be safe while keeping the original meaning and energy.
    3. Return strictly JSON.

    Input Script: "${script}"

    Output JSON:
    {
        "safeScript": "The sanitized text (or original if safe)",
        "wasModified": boolean
    }`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr) as { safeScript: string, wasModified: boolean };
    } catch (error) {
        console.error("Gemini Audit Error:", error);
        // Fallback on error: Return original to prevent crashing
        return { safeScript: script, wasModified: false };
    }
}
