# Retrieval README

How to build the knowledge index, run retrieval against it, and use RAG chat locally.

## Prerequisites

- **Node.js** (project uses `npm` + `tsx`)
- **OpenAI API key** set as `OPENAI_API_KEY` (used for embeddings)
- **Anthropic API key** set as `ANTHROPIC_API_KEY` (used for chat)

## One-time setup

1. Install dependencies from the repo root (`OHHF_CS52/`):

   ```bash
   npm install
   ```

2. Copy env template and set your key:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set at least `OPENAI_API_KEY` + `ANTHROPIC_API_KEY`. Optional overrides:

   - `OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-small`)
   - `CLAUDE_MODEL` (default `claude-sonnet-4-6`)
   - `CLAUDE_FOLLOWUP_MODEL` (default `CLAUDE_MODEL`)

   Values in `.env.local` override `.env` if you use that file.

## Build the retrieval index (embeddings)

Chunk JSON is read from **both** of these directories (every `*.json` file in each):

- `corpus_cleaned_chunks/`
- `scripts/scrape_jina_corpus/corpus_cleaned_chunks/`

Run:

```bash
npm run rag:build
```

This calls `scripts/rag/build-knowledge-index.ts`, normalizes/dedupes chunks, requests embeddings from OpenAI, and writes:

- `data/knowledge/index.json`

That path is **gitignored**; each developer (and CI, if you add it) must run `rag:build` after pulling new corpus JSON.

Re-run **`rag:build`** whenever chunk files change so retrieval stays aligned with the corpus.

## Run the app with RAG chat

The Vite dev server proxies `/api` to the Express API.

**Terminal 1 — API (default port 3001):**

```bash
npm run server:dev
```

**Terminal 2 — frontend:**

```bash
npm run dev
```

Open the URL Vite prints (e.g. `http://localhost:5173`), use the Chat screen, and questions hit `POST /api/chat`, which loads `data/knowledge/index.json` and retrieves top chunks before answering.

## Smoke test from the terminal

After `rag:build`:

```bash
npm run chat:ask
```

Optional: pass a question as arguments (see `scripts/chat-once.ts`).

## Troubleshooting

| Issue | What to do |
|--------|------------|
| `Set OPENAI_API_KEY in the environment` | Ensure `.env` (or `.env.local`) contains a non-empty `OPENAI_API_KEY` (needed for embeddings + retrieval). |
| `Set ANTHROPIC_API_KEY in the environment` | Ensure `.env` (or `.env.local`) contains a non-empty `ANTHROPIC_API_KEY` (needed for chat). |
| `Knowledge index unavailable` / chat errors about index | Run `npm run rag:build` from repo root. |
| `[rag:build] skip missing directory: ...` | That corpus folder is absent on disk; add it or ignore if you only use the other tree. |
| Chat UI works but no API | Start `npm run server:dev` so something listens on port **3001** (or set `PORT` to match your proxy). |

## Related files

- Index builder: `scripts/rag/build-knowledge-index.ts`
- Load index: `server/lib/knowledge/loadIndex.ts`
- Retrieval + chat: `server/lib/chatRag.ts`
- Env reference: `.env.example`
