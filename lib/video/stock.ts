
import { createClient } from 'pexels';

export async function searchStockVideo(query: string, apiKey: string): Promise<string> {
    if (!apiKey) {
        throw new Error("Missing Pexels API Key");
    }

    const client = createClient(apiKey);
    let videos: any[] = []; // Type 'any' as Pexels types might be loose or require specific import

    try {
        // 1. Primary Search
        const result = await client.videos.search({ query, per_page: 5, orientation: 'portrait' });
        if ('videos' in result) {
            videos = result.videos;
        }
    } catch (e) {
        console.warn(`Pexels search failed for '${query}':`, e);
        // Continue to fallback
    }

    // 2. Fallback Search (if no videos found or error)
    if (videos.length === 0) {
        console.log(`No videos found for '${query}'. Trying fallback.`);
        try {
            const fallbackQuery = "abstract vertical business background";
            const result = await client.videos.search({ query: fallbackQuery, per_page: 5, orientation: 'portrait' });
            if ('videos' in result) {
                videos = result.videos;
            }
        } catch (e) {
            console.error("Pexels fallback failed.", e);
        }
    }

    if (videos.length === 0) {
        throw new Error("Failed to find any stock footage, even fallback.");
    }

    // 3. Selection Logic
    // We want a video that is at least 5 seconds long (to loop reasonably) but not huge.
    // Pick a random one from the top 5 to vary content if query is same.
    const randomVideo = videos[Math.floor(Math.random() * videos.length)];

    // Get the best video file (HD)
    const videoFile = randomVideo.video_files.find((f: any) => f.quality === 'hd' && f.width >= 1280)
        || randomVideo.video_files[0];

    return videoFile.link;
}
