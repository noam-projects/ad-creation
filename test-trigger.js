const fetch = require('node-fetch'); // NOTE: In Node 18+ fetch is native, but just in case
// Or we just use native fetch if running on Node 18+
// Usage: node test-trigger.js [topic] [project]

async function testTrigger() {
    const topic = process.argv[2] || "Lazy Investing Guide";
    const project = process.argv[3] || "investing";

    console.log(`🚀 Testing Ad Engine locally...`);
    console.log(`Topic: ${topic}`);
    console.log(`Project: ${project}`);
    console.log(`Target: http://localhost:3000/api/generate`);
    console.log('-------------------------------------------');

    try {
        const response = await fetch('http://localhost:3000/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, project })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ SUCCESS!');
            console.log('Response Payload:');
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log('❌ ERROR:', response.status);
            console.log(data);
        }

    } catch (error) {
        console.error('❌ Network Error. Is the server running?');
        console.error('Run "npm run dev" in another terminal first.');
        console.error(error.message);
    }
}

testTrigger();
