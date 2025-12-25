import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * === FFmpeg & FFprobe Setup ===
 * Ensures paths are correctly resolved on Windows.
 */
if (ffmpegPath) {
    let resolvedPath = ffmpegPath;
    if (!existsSync(resolvedPath)) {
        const fallback = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
        if (existsSync(fallback)) resolvedPath = fallback;
    }
    ffmpeg.setFfmpegPath(resolvedPath);
}

if (ffprobePath && ffprobePath.path) {
    let resolvedPath = ffprobePath.path;
    if (!existsSync(resolvedPath)) {
        const fallback = path.join(process.cwd(), 'node_modules', 'ffprobe-static', 'bin', 'win32', 'x64', 'ffprobe.exe');
        if (existsSync(fallback)) resolvedPath = fallback;
    }
    ffmpeg.setFfprobePath(resolvedPath);
}

/**
 * Helper to get exact audio duration.
 */
async function getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            const duration = metadata.format.duration;
            if (typeof duration !== 'number' || isNaN(duration) || duration <= 0) {
                return reject(new Error("Invalid audio duration"));
            }
            resolve(duration);
        });
    });
}

/**
 * === COMPOSE SINGLE SEGMENT ===
 * 
 * Objectives:
 * 1. UNHURRIED: Adds 1.0s silence at the end of audio.
 * 2. VERTICAL: 1080x1920 (no cropping issues, scale-to-fit/increase).
 * 3. SYNCED: Loops video to match (audio + 1s padding).
 * 4. STYLED: Premium white captions with black outline.
 */
export async function composeSegment(
    videoPath: string,
    audioPath: string,
    outputPath: string,
    useGpu: boolean = false,
    text?: string
): Promise<void> {
    console.log(`\n🎬 Composing: ${path.basename(outputPath)}`);

    const audioDuration = await getAudioDuration(audioPath);
    const startDelay = 0.2; // 200ms
    const endPadding = 0.8; // 800ms
    const finalDuration = audioDuration + startDelay + endPadding;

    console.log(`🎵 Audio: ${audioDuration.toFixed(2)}s | Padding: 1.00s | Total: ${finalDuration.toFixed(2)}s`);

    return new Promise((resolve, reject) => {
        const command = ffmpeg();

        // Input 1: Video (looped infinitely)
        command.input(videoPath).inputOptions(['-stream_loop', '-1']);

        // Input 2: Audio
        command.input(audioPath);

        // Create a complex filter for both video scaling and audio padding
        // [0:v] is video, [1:a] is audio
        // we add 0.1s silence at start and 0.6s at end for natural breathing room
        const complexFilter = [
            `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[v]`,
            `[1:a]asetpts=PTS-STARTPTS,adelay=${(startDelay * 1000).toFixed(0)}|${(startDelay * 1000).toFixed(0)},apad=whole_dur=${finalDuration.toFixed(2)}[a]`
        ];

        if (text) {
            const cleanText = text
                .replace(/['"''""]/g, '')
                .replace(/[^a-zA-Z0-9\s.,!?'-]/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            const wrapText = (str: string, limit: number): string => {
                const words = str.split(' ');
                const lines: string[] = [];
                let currentLine = '';
                for (const word of words) {
                    const testLine = currentLine ? `${currentLine} ${word}` : word;
                    if (testLine.length > limit && currentLine) {
                        lines.push(currentLine);
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                }
                if (currentLine) lines.push(currentLine);
                return lines.join('\n'); // Real newline
            };

            const wrapped = wrapText(cleanText, 25);

            // Simple escaping for drawtext - we pass real newlines and hope FFmpeg handles them
            const escapedText = wrapped
                .replace(/\\/g, '\\\\')
                .replace(/:/g, '\\:')
                .replace(/'/g, "'\\\\\\''");

            const fontPath = 'C\\:/Windows/Fonts/arialbd.ttf'.replace(/[:\\]/g, '\\$&');

            complexFilter[0] = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS,` +
                `drawtext=fontfile='${fontPath}':text='${escapedText}':fontcolor=white:fontsize=72:` +
                `x=(w-text_w)/2:y=h-text_h-250:borderw=8:bordercolor=black[v]`;
        }

        command
            .complexFilter(complexFilter)
            .map('[v]')
            .map('[a]')
            .outputOptions([
                '-t', String(finalDuration),
                '-shortest',
                '-r', '30',
                '-c:v', useGpu ? 'h264_amf' : 'libx264',
                '-preset', 'fast',
                '-crf', '18',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-ar', '44100',
                '-ac', '2',
                '-pix_fmt', 'yuv420p',
                '-y'
            ])
            .on('start', () => console.log(`⚙️  Encoding...`))
            .on('error', (err) => {
                console.error(`❌ FFmpeg Error: ${err.message}`);
                reject(err);
            })
            .on('end', () => {
                console.log(`✅ Segment complete: ${finalDuration.toFixed(2)}s`);
                resolve();
            })
            .save(outputPath);
    });
}

/**
 * === CONCATENATE SEGMENTS ===
 * Merges the 3 chunks into a single .mp4 file.
 */
export async function concatSegments(
    segmentPaths: string[],
    outputPath: string
): Promise<void> {
    console.log(`\n🔗 Merging ${segmentPaths.length} segments...`);

    const listContent = segmentPaths
        .map(p => `file '${p.replace(/\\/g, '/')}'`)
        .join('\n');

    const listPath = outputPath.replace('.mp4', '_concat.txt');
    await fs.writeFile(listPath, listContent);

    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(listPath)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            .outputOptions(['-c', 'copy', '-y'])
            .on('error', async (err) => {
                await fs.unlink(listPath).catch(() => { });
                console.error(`❌ Concat Error: ${err.message}`);
                reject(err);
            })
            .on('end', async () => {
                await fs.unlink(listPath).catch(() => { });
                console.log(`🚀 Final Ad Created: ${path.basename(outputPath)}`);
                resolve();
            })
            .save(outputPath);
    });
}
