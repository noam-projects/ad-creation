import OpenAI from 'openai';

// Initialize with environment variable
// Note: Client should only be initialized on server side

export interface AdSegment {
    text: string;
    visualKeywords: string;
    estimatedDuration: number;
}

export interface AdContent {
    theme: string;
    segments: AdSegment[];
}

export async function generateAdContent(masterPrompt: string, dateContext: string, apiKey: string): Promise<AdContent> {
    if (!apiKey) throw new Error("Missing OpenAI API Key");

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are a creative director for high-performing video ads.
    Your goal is to generate a short, engaging video ad with EXACTLY 3 SEGMENTS.
    
    The ad is for a specific date: ${dateContext}.
    
    Output structured JSON:
    {
        "theme": "Brief theme description",
        "segments": [
            {
                "text": "The Hook. Must be a powerful, attention-grabbing opening. (15-20 words)",
                "visualKeywords": "Search terms for stock video",
                "estimatedDuration": 8
            },
            {
                "text": "The core message. Detailed and persuasive. (15-25 words)",
                "visualKeywords": "Search terms for stock video",
                "estimatedDuration": 10
            },
            {
                "text": "Call to action or final thought. Strong and clear. (10-15 words)",
                "visualKeywords": "Search terms for stock video",
                "estimatedDuration": 7
            }
        ]
    }
    
    Guidelines:
    - STRICTLY 3 SEGMENTS.
    - SEGMENT 1 MUST BE A HOOK: Focus on a problem, a surprising fact, or a bold promise.
    - NO DATES: DO NOT include the date or any date references (like "Today is...") in the text of any segment.
    - VISUAL RULE: Broad, professional concepts.
    - COMPLIANCE: No graphs, charts, or trading screens.
    - TONALITY: calm, unhurried, and authoritative.
    - LENGTH: Allow for natural, flowing sentences. Not too short, but not rambling.
    `;

    const completion = await openai.chat.completions.create({
        model: "gpt-5.2", // User requested specifically
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Master Prompt: ${masterPrompt}` }
        ],
        response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("Failed to generate content from OpenAI");

    return JSON.parse(content) as AdContent;
}
