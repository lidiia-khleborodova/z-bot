import OpenAI from 'openai';
let openai = null;
function getClient() {
    if (!openai)
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openai;
}
export async function embed(text) {
    const res = await getClient().embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
    });
    return res.data[0].embedding;
}
export function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
