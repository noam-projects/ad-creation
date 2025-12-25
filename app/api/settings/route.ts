import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
    try {
        // Simple health check
        let dbConnected = true;
        try {
            await db.$queryRaw`SELECT 1`;
        } catch (e) {
            console.error("DB Health Check Failed:", e);
            dbConnected = false;
        }

        const settings = await db.settings.findFirst();

        return NextResponse.json({
            hasOpenAI: !!settings?.openaiKey,
            hasElevenLabs: !!settings?.elevenLabsKey,
            hasGemini: !!settings?.geminiKey,
            hasPexels: !!settings?.pexelsKey,
            useGpu: settings?.useGpu || false,
            dbConnected
        });
    } catch (error) {
        console.error("Settings Fetch Error:", error);
        return NextResponse.json({
            hasOpenAI: false,
            hasElevenLabs: false,
            hasGemini: false,
            hasPexels: false,
            useGpu: false,
            dbConnected: false
        });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Upsert settings (update if exists, create if not)
        const existing = await db.settings.findFirst();

        if (existing) {
            await db.settings.update({
                where: { id: existing.id },
                data: {
                    openaiKey: body.OPENAI_API_KEY || existing.openaiKey,
                    elevenLabsKey: body.ELEVENLABS_API_KEY || existing.elevenLabsKey,
                    // Replicate removed
                    geminiKey: body.GEMINI_API_KEY || existing.geminiKey,
                    pexelsKey: body.PEXELS_API_KEY || existing.pexelsKey,
                    useGpu: body.USE_GPU ?? existing.useGpu,
                    isConfigured: true
                }
            });
        } else {
            await db.settings.create({
                data: {
                    openaiKey: body.OPENAI_API_KEY,
                    elevenLabsKey: body.ELEVENLABS_API_KEY,
                    // Replicate removed
                    geminiKey: body.GEMINI_API_KEY,
                    pexelsKey: body.PEXELS_API_KEY,
                    useGpu: body.USE_GPU || false,
                    isConfigured: true
                }
            });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
