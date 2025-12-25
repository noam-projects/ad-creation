import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { startOfMonth, endOfMonth, addDays, format, startOfDay } from 'date-fns';
import { db } from '@/lib/db';

// Import AI services
import { generateAdContent, AdSegment } from '@/lib/ai/openai';
import { auditScript } from '@/lib/ai/gemini';
import { generateVoiceover } from '@/lib/ai/elevenlabs';
import { searchStockVideo } from '@/lib/video/stock';
import { composeSegment, concatSegments } from '@/lib/video/composer';

const MAX_RETRIES = 3;

interface ApiKeys {
    openai: string;
    gemini?: string;
    elevenlabs: string;
    pexels?: string;
    useGpu: boolean;
}

async function processSegment(
    segment: AdSegment,
    index: number,
    tempDir: string,
    keys: ApiKeys,
    log: (msg: string) => void
): Promise<string> {
    const segPrefix = `seg_${index}`;

    // 1. Audit Script (Gemini)
    // Non-blocking safety check. If it fails, we use original.
    let finalScript = segment.text;
    try {
        if (keys.gemini) {
            log(`Auditing segment ${index} with Gemini...`);
            const audit = await auditScript(segment.text, keys.gemini);
            if (audit.wasModified) {
                log(`Safety Audit: Segment ${index} rewritten.`);
                finalScript = audit.safeScript;
            }
        }
    } catch (e) {
        log(`⚠️ Safety audit failed, using original text.`);
    }

    // 2. Generate Audio (ElevenLabs)
    log(`Generating Audio for Segment ${index} (Text: "${finalScript.slice(0, 20)}...")...`);
    const audioBuffer = await generateVoiceover(finalScript, keys.elevenlabs);
    const audioPath = path.join(tempDir, `${segPrefix}_audio.mp3`);
    await fs.writeFile(audioPath, audioBuffer);
    log(`Audio generated for Segment ${index}`);

    // 3. Search Stock Video (Pexels)
    const searchQuery = segment.visualKeywords || "abstract bright business background";
    log(`Searching Pexels for: "${searchQuery}"`);
    const videoUrl = await searchStockVideo(searchQuery, keys.pexels || "");

    log(`Downloading video for Segment ${index}...`);
    let videoBuffer: Buffer;
    try {
        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) throw new Error(`Fetch failed: ${videoRes.statusText}`);
        videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    } catch (e) {
        log(`❌ Video download failed for Segment ${index}`);
        throw e;
    }

    const videoPath = path.join(tempDir, `${segPrefix}_video.mp4`);
    await fs.writeFile(videoPath, videoBuffer);

    // 4. Compose Segment 
    log(`Composing Segment ${index} (Looping video to audio + Captions)...`);
    const segmentVideoPath = path.join(tempDir, `${segPrefix}_final.mp4`);
    await composeSegment(videoPath, audioPath, segmentVideoPath, keys.useGpu, finalScript);
    log(`Segment ${index} composed successfully.`);

    // Cleanup raw assets
    await fs.unlink(audioPath).catch(() => { });
    await fs.unlink(videoPath).catch(() => { });

    return segmentVideoPath;
}

async function generateDayAd(
    projectPath: string,
    masterPrompt: string,
    date: Date,
    isTest: boolean,
    keys: ApiKeys,
    log: (msg: string) => void
) {
    const year = format(date, 'yyyy');
    const month = format(date, 'MM');
    const day = format(date, 'dd');

    const targetDir = path.join(projectPath, year, month);
    await fs.mkdir(targetDir, { recursive: true });

    const fileName = isTest ? `test_ad_${day}.mp4` : `${day}.mp4`;
    const finalFilePath = path.join(targetDir, fileName);

    // Duplicate Check
    if (!isTest) {
        try {
            await fs.access(finalFilePath);
            return { status: 'skipped', message: `Skipped day ${day} already exists` };
        } catch { }
    }

    const dateStr = format(date, 'MMMM do, yyyy');
    const tempDir = path.join(targetDir, `temp_${day}_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    log(`Starting generation for date: ${dateStr}`);

    try {
        // 1. Generate Story Segments (OpenAI)
        log("Generating story segments with OpenAI...");

        let attempt = 0;
        let content;
        while (attempt < MAX_RETRIES) {
            try {
                log(`[Attempt ${attempt + 1}/${MAX_RETRIES}] Sending master prompt to OpenAI...`);
                content = await generateAdContent(masterPrompt, dateStr, keys.openai);
                log("OpenAI generation successful.");
                break;
            } catch (e: any) {
                log(`⚠️ OpenAI Attempt ${attempt + 1} failed: ${e.message}`);
                attempt++;
                if (attempt >= MAX_RETRIES) throw e;
                await new Promise(r => setTimeout(r, 1000)); // Backoff
            }
        }

        if (!content) throw new Error("Failed to generate content.");

        // 2. Process Segments in Parallel (or Sequence? Sequence is safer for rate limits)
        const segmentPaths: string[] = [];
        for (let i = 0; i < content.segments.length; i++) {
            const segPath = await processSegment(content.segments[i], i, tempDir, keys, log);
            segmentPaths.push(segPath);
        }

        // 3. Concatenate Segments
        await concatSegments(segmentPaths, finalFilePath);

        // 4. Cleanup Temp Dir
        for (const p of segmentPaths) {
            await fs.unlink(p).catch(() => { });
        }
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });

        return { status: 'success', file: fileName };

    } catch (e: any) {
        // cleanup on error
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
        throw e;
    }
}

// ----------------------------------------------------------------------
// Streaming Implementation
// ----------------------------------------------------------------------

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { projectId, year, month, isTest } = body;

        // 1. Fetch Settings
        const settings = await db.settings.findFirst();
        if (!settings?.openaiKey || !settings?.elevenLabsKey || !settings?.pexelsKey) {
            return NextResponse.json({ error: 'Missing API Keys (OpenAI, ElevenLabs, or Pexels).' }, { status: 400 });
        }

        const keys: ApiKeys = {
            openai: settings.openaiKey,
            gemini: settings.geminiKey || undefined,
            elevenlabs: settings.elevenLabsKey,
            pexels: settings.pexelsKey,
            useGpu: settings.useGpu
        };

        // 2. Fetch Project
        const project = await db.project.findUnique({ where: { id: projectId } });
        if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

        const projectPath = path.join(process.cwd(), 'ads', project.name);

        // Date Logic
        const today = startOfDay(new Date());
        const selectedDate = new Date(year, month - 1);
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);

        let startDate = monthStart;
        if (!isTest && monthStart.getMonth() === today.getMonth() && monthStart.getFullYear() === today.getFullYear()) {
            startDate = addDays(today, 1);
        }

        // Create Stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                // Helper to push updates
                const send = (data: any) => {
                    controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
                };

                const log = (msg: string) => {
                    send({ type: 'log', message: msg, timestamp: new Date().toLocaleTimeString() });
                };

                try {
                    if (isTest) {
                        const testDate = (today >= monthStart && today <= monthEnd) ? today : monthStart;
                        try {
                            const res = await generateDayAd(projectPath, project.masterPrompt, testDate, true, keys, log);
                            send({ type: 'result', date: format(testDate, 'yyyy-MM-dd'), status: res.status, file: res.file, error: res.message });
                        } catch (e: any) {
                            send({ type: 'result', date: format(testDate, 'yyyy-MM-dd'), status: 'error', error: e.message });
                        }
                    } else {
                        let current = startDate;
                        while (current <= monthEnd) {
                            try {
                                const res = await generateDayAd(projectPath, project.masterPrompt, current, false, keys, log);
                                send({
                                    type: 'result',
                                    date: format(current, 'yyyy-MM-dd'),
                                    status: res.status,
                                    file: res?.file,
                                    error: res?.message
                                });
                            } catch (e: any) {
                                send({ type: 'result', date: format(current, 'yyyy-MM-dd'), status: 'error', error: e.message });
                            }
                            current = addDays(current, 1);
                        }
                    }
                    send({ type: 'done' });
                    controller.close();
                } catch (error: any) {
                    send({ type: 'error', message: error.message });
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: { 'Content-Type': 'application/json' } // Technically NDJSON or text/event-stream could optionally be used
        });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
