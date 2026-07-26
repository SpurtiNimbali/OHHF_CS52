# Cardea (OHHF_CS52)

Caregiver companion for congenital heart disease (CHD) families — mood check-ins, trauma-informed chat with RAG, wellness tools, and OHHF resources (glossary, support orgs, care-team questions).

**Stack:** Vite + React + TypeScript · Express API · Supabase · OpenAI (RAG chat) · Anthropic (care-team question generation)

---

## Quick start

```bash
npm install
cp .env.example .env   # or use env.local — see Env below
```

Fill in at least:

| Variable | Needed for |
|----------|------------|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Auth, glossary, support, saved data |
| `SUPABASE_SECRET_KEY` | Server-side mood/journal/tool saves |
| `OPENAI_API_KEY` | Chat RAG + embeddings |
| `ANTHROPIC_API_KEY` | Personalized care-team question generation |

```bash
npm run rag:build   # once (or after corpus changes) → data/knowledge/index.json
npm run dev:all     # API :3001 + Vite :5173
```

Open **http://localhost:5173/**

---

## App map (user-facing)

| Route | Feature |
|-------|---------|
| `/auth`, `/sign-in`, `/sign-up`, `/onboarding` | Auth + onboarding |
| `/home` | Mood check-in + personalized cards |
| `/chat` | Cardea companion (RAG + crisis-aware) |
| `/wellness` | Coping tools (`?tool=breathing`, `safe-place`, …) |
| `/resources` | Hub for support / glossary / care-team questions |
| `/resources?view=care-team` | Questions for your care team |
| `/resources?view=care-team-standard` | Standard question library |
| `/resources?view=support` | Find support |
| `/resources?view=glossary` | Medical glossary |

---

## Repository map

```
Active product
  src/                 React UI (screens, components, mood, home, lib)
  server/              Express API — chat, mood, journal, care-team, wellness data
  supabase/            Migrations + edge functions (security-question sign-in)
  data/                emotionMap.json; knowledge/index.json (gitignored, from rag:build)
  index.html           Vite entry → src/App.tsx

Content & pipelines
  corpus_cleaned_chunks/                 RAG chunk inputs (keep)
  scripts/rag/                           Build embeddings index
  scripts/scrape_jina_corpus/            Active scrape → cleaned chunks
  scripts/glossary_terms_pipeline/       Glossary extract → Supabase
  scripts/care_team_questions_pipeline/  Care-team corpus → Supabase
  scripts/supabase_data_scripts/         Data export / OHHF scrape-upload helpers

Docs
  docs/HANDOFF.md      Full OHHF handoff narrative
  docs/retrieval.md    RAG index + chat setup (detail)
```

---

## npm scripts

| Script | What it does |
|--------|----------------|
| `npm run dev:all` | Frontend + API together |
| `npm run dev` | Vite only (`:5173`, proxies `/api` → `:3001`) |
| `npm run server:dev` | Express API only |
| `npm run rag:build` | Embed corpus → `data/knowledge/index.json` |
| `npm run chat:ask` | CLI smoke test for RAG chat |
| `npm run test:crisis` | Crisis keyword tests |
| `npm run build` | Production frontend build |

---

## Env

Load order (later wins): `.env` → `.env.local` → `env.local`

See `.env.example`. Secrets are gitignored (`*.local`, `.env*`).

After changing env, restart `dev:all`.

---

## Handoff notes

1. **RAG chat** needs `npm run rag:build` on each machine; `data/knowledge/` is not in git. Details: [docs/retrieval.md](docs/retrieval.md).
2. **Supabase migrations** live in `supabase/migrations/` — apply with your usual Supabase workflow before relying on mood/journal/reframes/safe-place tables.
3. **Care-team generation** uses Anthropic; **companion chat** uses OpenAI (or OpenRouter if configured in `server/lib/llmClient.ts`).
4. Prefer `src/screens/` for UI (canonical resources / chat / wellness surfaces).

**Full handoff narrative (for OHHF / Beth):** [docs/HANDOFF.md](docs/HANDOFF.md)

---

## Team / product context

Built for OHHF (Ollie Hinkle Heart Foundation) with Stanford CS for Social Good (CS 51/52). Cardea is the caregiver-facing product name in the UI; the foundation may refer to the product as **Ollie's Companion**.
