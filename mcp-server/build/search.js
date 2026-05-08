import { embed, cosineSimilarity } from './embeddings.js';
let embeddedArticles = [];
export async function buildIndex(articles) {
    embeddedArticles = await Promise.all(articles.map(async (article) => ({
        article,
        embedding: await embed(`${article.title}\n\n${article.body}`),
    })));
}
export async function searchArticles(query, topN = 3) {
    if (embeddedArticles.length === 0)
        return [];
    const queryEmbedding = await embed(query);
    return embeddedArticles
        .map(({ article, embedding }) => ({
        article,
        score: cosineSimilarity(queryEmbedding, embedding),
    }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .map((s) => s.article);
}
