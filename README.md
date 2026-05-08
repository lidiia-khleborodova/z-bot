# Z-Emotion Help Center Agent

A conversational support chatbot for Z-Emotion products (z-weave, z-maya, z-unreal). Uses Claude with an agentic tool loop to search help center articles, find sewing patterns, retrieve release notes, and search the web.

## Architecture

- **Express** server streams responses to the browser
- **Claude** (claude-sonnet-4-6) decides which tools to call based on the question
- **OpenAI** text-embedding-3-small for semantic article and pattern search
- **Zendesk** Help Center API as the article source (refreshed every 6 hours)
- **Conversation history** — last 2 exchanges kept per browser session (cleared on refresh)

### Tools available to Claude

| Tool | Description |
|------|-------------|
| `search_articles` | Semantic search over Zendesk help center articles |
| `get_latest_version` | Returns latest release notes for z-weave, z-maya, or z-unreal |
| `search_patterns` | Searches the sewing pattern asset library (CSV) |
| `web_search` | Searches z-emotion.com when articles don't answer the question |
| `web_fetch` | Fetches a specific URL provided by the user |

## Setup

**1. Install dependencies**
```bash
npm install
```

**2. Create `.env`**
```
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
ZENDESK_SUBDOMAIN=help.z-emotion.com
ZENDESK_EMAIL=your-email@z-emotion.com
ZENDESK_API_TOKEN=your_zendesk_api_token
PORT=3000
```

**3. Add the pattern CSV**

Place the pattern CSV file at:
```
data/zls links sample.csv
```

Expected columns: `Name`, `Link`, `Gender`, `Type`

**4. Start the server**
```bash
npm run dev
```

On first start it fetches all published Zendesk articles and builds embeddings (~30 seconds).

## API

### `POST /chat`

Ask a question. Response streams as plain text chunks.

**Request**
```json
{ "question": "how do I install z-weave on Windows?", "sessionId": "optional-session-id" }
```

**Response headers**
```
X-Session-Id: <uuid>
```

Pass the returned `sessionId` in subsequent requests to maintain conversation history.

**Example**
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"find me a women's jacket pattern\"}"
```

### `GET /health`

Returns server status and number of loaded articles.

```json
{ "status": "ok", "articles": 326 }
```
