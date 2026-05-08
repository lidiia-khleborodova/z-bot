import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildIndex, searchArticles, Article } from './search.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });


const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN!;
const ZENDESK_EMAIL = process.env.ZENDESK_EMAIL!;
const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN!;
const NANO_BANANA_API_KEY = process.env.NANO_BANANA_API_KEY!;

const server = new McpServer({
  name: 'z-emotion',
  version: '1.0.0',
});

// --- Zendesk article fetching ---

function getAuthHeader(): string {
  const credentials = Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_API_TOKEN}`).toString('base64');
  return `Basic ${credentials}`;
}

async function fetchAllArticles(): Promise<Article[]> {
  const articles: Article[] = [];
  let nextPage: string | null = `https://${ZENDESK_SUBDOMAIN}/api/v2/help_center/articles.json?per_page=100`;

  const categoryMap = new Map<number, string>();
  const catRes = await fetch(`https://${ZENDESK_SUBDOMAIN}/api/v2/help_center/categories.json?per_page=100`, {
    headers: { Authorization: getAuthHeader() },
  });
  const catData = await catRes.json() as { categories: { id: number; name: string }[] };
  for (const c of catData.categories) categoryMap.set(c.id, c.name);

  const sectionMap = new Map<number, string>();
  const secRes = await fetch(`https://${ZENDESK_SUBDOMAIN}/api/v2/help_center/sections.json?per_page=100`, {
    headers: { Authorization: getAuthHeader() },
  });
  const secData = await secRes.json() as { sections: { id: number; name: string; category_id: number }[] };
  for (const s of secData.sections) sectionMap.set(s.id, categoryMap.get(s.category_id) ?? 'Unknown');

  while (nextPage) {
    const res = await fetch(nextPage, { headers: { Authorization: getAuthHeader() } });
    const data = await res.json() as { articles: any[]; next_page: string | null };
    for (const a of data.articles) {
      if (a.draft) continue;
      const body = a.body
        .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n').trim();
      articles.push({
        id: a.id,
        title: a.title,
        body,
        url: a.html_url,
        section: sectionMap.get(a.section_id) ?? 'Unknown',
      });
    }
    nextPage = data.next_page;
  }

  return articles;
}

// --- Tool: search_help_articles ---

server.registerTool(
  'search_help_articles',
  {
    description: 'Search Z-Emotion help center articles. Use for any question about z-weave, z-maya, or z-unreal features, installation, settings, or tutorials.',
    inputSchema: {
      query: z.string().describe('Search query in English'),
      top_n: z.number().min(1).max(5).optional().describe('Number of articles to return (default 3)'),
    },
  },
  async ({ query, top_n }) => {
    const articles = await searchArticles(query, top_n ?? 3);
    if (articles.length === 0) {
      return { content: [{ type: 'text', text: 'No articles found.' }] };
    }
    const text = articles
      .map((a) => `Title: ${a.title}\nSection: ${a.section}\nURL: ${a.url}\n\n${a.body}`)
      .join('\n\n---\n\n');
    return { content: [{ type: 'text', text }] };
  }
);

// --- Tool: generate_fashion_image ---

server.registerTool(
  'generate_fashion_image',
  {
    description: 'Generate a fashion image from a text prompt using Nano Banana. Use when the user asks to visualize an outfit, garment, or fashion concept.',
    inputSchema: {
      prompt: z.string().describe('Description of the fashion image to generate'),
    },
  },
  async ({ prompt }) => {
    if (!NANO_BANANA_API_KEY) {
      return { content: [{ type: 'text', text: 'Image generation is not configured.' }] };
    }
    try {
      const res = await fetch('https://api.nanobana.ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${NANO_BANANA_API_KEY}`,
        },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { url?: string };
      if (!data.url) throw new Error('No image URL in response');
      return { content: [{ type: 'text', text: `Generated image: ${data.url}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Image generation failed: ${err}` }] };
    }
  }
);

// --- Tool: search_asset_library (stub) ---

server.registerTool(
  'search_asset_library',
  {
    description: 'Search the Z-Emotion asset library for 3D and 2D pattern files hosted on AWS. (Coming soon)',
    inputSchema: {
      query: z.string().describe('Search query for patterns or assets'),
    },
  },
  async ({ query: _query }) => {
    return { content: [{ type: 'text', text: 'Asset library search is not yet available.' }] };
  }
);

// --- Startup ---

async function main() {
  console.error('Loading Z-Emotion help center articles...');
  const articles = await fetchAllArticles();
  await buildIndex(articles);
  console.error(`Index ready with ${articles.length} articles.`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Z-Emotion MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
