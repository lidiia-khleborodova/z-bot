import { embed, cosineSimilarity } from './embeddings.js';

export interface Article {
  id: number;
  title: string;
  body: string;
  url: string;
  section: string;
}

interface EmbeddedArticle {
  article: Article;
  embedding: number[];
}

let embeddedArticles: EmbeddedArticle[] = [];

export async function buildIndex(articles: Article[]): Promise<void> {
  embeddedArticles = await Promise.all(
    articles.map(async (article) => ({
      article,
      embedding: await embed(`${article.title}\n\n${article.body}`),
    }))
  );
}

export async function searchArticles(query: string, topN = 3): Promise<Article[]> {
  if (embeddedArticles.length === 0) return [];
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
