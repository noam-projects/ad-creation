
// Native Fetch Implementation (No SDK Dependency)
const BASE_URL = "https://api.elevenlabs.io/v1";

export async function generateVoiceover(text: string, apiKey: string) {
    if (!apiKey) throw new Error("Missing ElevenLabs API Key");

    // 1. Fetch Voices
    let voiceId = "21m00Tcm4TlvDq8ikWAM"; // Default (Rachel)
    console.log("Fetching voices from ElevenLabs API...");

    try {
        const voicesRes = await fetch(`${BASE_URL}/voices`, {
            headers: { "xi-api-key": apiKey }
        });

        if (voicesRes.ok) {
            const data = await voicesRes.json();
            if (data.voices && Array.isArray(data.voices)) {
                // 1. Try User's Request: Jonathan (Partial match is safer)
                const preferred = data.voices.find((v: any) => v.name?.toLowerCase().includes("jonathan"));
                // 2. Fallback: Adam
                const secondary = data.voices.find((v: any) => v.name?.toLowerCase().includes("adam"));

                if (preferred) {
                    voiceId = preferred.voice_id;
                    console.log(`✅ Using Preferred Voice: ${preferred.name} (${voiceId})`);
                } else if (secondary) {
                    voiceId = secondary.voice_id;
                    console.log(`⚠️ 'Jonathan Livingstone' not found. Falling back to: ${secondary.name}`);
                } else {
                    voiceId = data.voices[0].voice_id;
                    console.log(`⚠️ No preferred voices found. Using fallback: ${data.voices[0].name}`);
                }
            }
        }
    } catch (e) {
        console.warn("Failed to fetch voices, using default ID:", e);
    }

    // 2. Generate Audio
    console.log(`Generating audio with voice ID: ${voiceId}`);

    const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
        },
        body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
                stability: 0.85, // Very high stability for calm, consistent delivery
                similarity_boost: 0.65, // Slightly lower to allow natural pacing
                style: 0.0, // Neutral style
                use_speaker_boost: true // Enhance voice clarity
            },
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs API Error (${response.status}): ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
