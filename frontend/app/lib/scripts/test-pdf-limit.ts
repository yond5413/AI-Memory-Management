
import { extractKeyPoints } from '../services/llm';
import { delay } from '../utils';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env loader since dotenv is not installed
function loadEnv() {
    try {
        const envFile = path.join(process.cwd(), '.env');
        if (fs.existsSync(envFile)) {
            const content = fs.readFileSync(envFile, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            });
            console.log("Loaded .env file manually");
        } else {
            console.warn(".env file not found");
        }
    } catch (e) {
        console.error("Error loading .env:", e);
    }
}

loadEnv();

const chunks = [
    { topic: "Intro", text: "This is a short introduction text. It is used to test the summarization capability of the LLM. It should be short enough to be processed quickly." },
    { topic: "Body", text: "This is the main body text. It contains more details about the topic. The LLM should summarize this into a concise sentence or two." },
    { topic: "Conclusion", text: "This is the conclusion. It summarizes the main points. The test ensures that we can process multiple chunks without hitting rate limits." }
];

async function run() {
    console.log("Starting PDF Limit Test...");
    for (const [index, chunk] of chunks.entries()) {
        console.log(`Processing chunk ${index + 1}/${chunks.length} (${chunk.topic})...`);
        const start = Date.now();
        try {
            const summary = await extractKeyPoints(chunk.text, chunk.topic);
            console.log(`✓ Summary (${Date.now() - start}ms):`, summary);
        } catch (e) {
            console.error("✗ Error:", e);
        }

        console.log("Waiting 2s...");
        await delay(2000);
    }
    console.log("Done.");
}

run().catch(console.error);
