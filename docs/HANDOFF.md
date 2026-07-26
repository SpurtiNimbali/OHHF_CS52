# Cardea

## Project Handoff & Transition Document

**Prepared for:** Ollie Hinkle Heart Foundation (OHHF)  
**Prepared by:** Stanford CS for Social Good team — Spurti, Edwin, Priyanka, Amrita, Cara  
**Date:** 07/26/2026  
**Product name in code / UI:** Cardea (caregiver-facing brand); project repo: `OHHF_CS52`

---

### Purpose of This Document

This document accompanies the handoff of **Ollie's Companion / Cardea** from our team to the Ollie Hinkle Heart Foundation. It consolidates everything OHHF needs to review the work independently, access deliverables and accounts, understand the current state of the build, and continue development into the next phase.

---

### Project Overview

Ollie's Companion (product UI name: **Cardea**) is a web support app for caregivers of heart families. It offers a warm, trauma-informed companion chatbot grounded in curated CHD resources, alongside mood check-ins, mental-health wellness tools, and OHHF resource hubs (glossary, support orgs, care-team visit questions) so families feel less alone through their journey.

**Who it serves**

- **Primary users:** Parents and caregivers of children with congenital / acquired heart conditions (CHD heart families).
- **Core value:** Emotional support in hard moments; practical resource access; preparation for care-team visits; gentle wellness coping tools — not a replacement for clinical care.

**Key features built**


| Feature                            | Scope & guardrails                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Companion chatbot**              | Conversational support via RAG over a curated corpus (AHA, Mended Hearts, CHF, etc.). Intent classification routes emotional vs informational asks. **Crisis keyword detection** short-circuits to safety messaging + resources; the bot is **not** a therapist or crisis hotline. Deep-links into wellness tools and resource pages when relevant. |
| **Mental-health / wellness tools** | Guided breathing, 5-4-3-2-1 grounding, physical regulation, Name It to Tame It, micro-journal, reframes, Safe Place visualization, Today's Nudge, crisis-reset panel. Mood-aware suggestions on home + wellness.                                                                                                                                    |
| **Mood check-in**                  | Daily mood selection that personalizes home cards, chat prefill, and recommended tools; can persist to Supabase.                                                                                                                                                                                                                                    |
| **OHHF Resources hub**             | Find Support (orgs/programs), Medical Glossary (plain-language terms), Questions for Your Care Team (intake → personalized suggestions + standard library).                                                                                                                                                                                         |
| **Auth & onboarding**              | Sign-up / sign-in with security questions (Supabase + edge function); welcome / onboarding flow.                                                                                                                                                                                                                                                    |


---

### Access & Deliverables

Please confirm access on your end; if any link does not open, flag it at the meeting and we'll re-share.


| Deliverable             | Link / Access                                                                                                                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Final presentation      | **[TODO — paste Google Slides / PDF link]**                                                                                                                                                                                                                                            |
| Live prototype / app    | **Local / team demo:** run from repo (`npm run dev:all` → [http://localhost:5173](http://localhost:5173)). **Public deploy:** **[TODO — paste Vercel / production URL if any]**                                                                                                        |
| Figma & design files    | **[TODO — paste Figma link; set OHHF to Editor/Owner]**                                                                                                                                                                                                                                |
| Code repository         | [https://github.com/SpurtiNimbali/OHHF_CS52](https://github.com/SpurtiNimbali/OHHF_CS52)                                                                                                                                                                                               |
| Other platforms / tools | **Supabase** project “OHHF Database” (ref `rcytzbgwjbftajtykxxr`) — auth, glossary, support resources, mood/journal/wellness tables. **OpenAI** — embeddings + companion chat. **Anthropic** — care-team question generation. **Optional:** OpenRouter (if configured via LLM client). |


**Note:** Where access requires an invitation (Figma, repo, hosting), add OHHF emails as collaborators so nothing depends on student accounts staying active. Transfer GitHub org ownership / collaborator roles and rotate API keys after handoff.

**In-repo docs to read first**

- Root [README.md](../README.md) — quick start, routes, repo map  
- [docs/retrieval.md](retrieval.md) — RAG index build & chat

---

### Technical Architecture & Stack

**Stack summary**


| Layer                    | Choice                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**             | React 19 + TypeScript + Vite + Tailwind CSS 4 + React Router + Motion                                                                                                                                                                                                                                             |
| **Backend / API**        | Node.js Express (`server/`), default port **3001**; Vite proxies `/api` → API                                                                                                                                                                                                                                     |
| **Database**             | Supabase (Postgres) + RLS on user data (mood, journal, reframes, safe places, tool usage, saved questions)                                                                                                                                                                                                        |
| **Chatbot / LLM**        | **Companion chat:** OpenAI (`gpt-4o-mini` default) + embeddings (`text-embedding-3-small`); prompts & orchestration in `server/lib/chatRag.ts`, `server/prompts/`. **Care-team Q gen:** Anthropic Claude. **Safety:** keyword crisis triage in `src/lib/crisisKeywords.ts` before / alongside generative replies. |
| **Hosting / deployment** | Developed for local + standard Vite/Node deploy. **No production host is assumed in-repo** — confirm current deploy target with the team.                                                                                                                                                                         |
| **Third-party**          | Supabase Auth (+ security-question edge function), OpenAI, Anthropic                                                                                                                                                                                                                                              |


**Repository structure (orientation)**

```
src/          React UI — screens, components, mood, home cards, client libs
server/       Express API — /api/chat, mood, journal, care-team, wellness data
supabase/     SQL migrations + edge functions
scripts/      RAG index builder, corpus scrape/pipelines, smoke tests
data/         emotionMap.json; knowledge/index.json (built locally, gitignored)
corpus_cleaned_chunks/   RAG chunk inputs
docs/         Handoff & retrieval notes
```

- **Change chatbot behavior / prompts:** `server/lib/chatRag.ts`, `server/prompts/`  
- **Change wellness tools / routes:** `src/lib/wellnessToolRegistry.ts`, `src/screens/WellnessTools.tsx`  
- **Change home personalization:** `src/mood/`, `src/home/personalizedHomeCards.ts`  
- **Change resources UI:** `src/screens/ResourcesLanding.tsx`, glossary / support / care-team screens  
- **Env template:** `.env.example` (load order: `.env` → `.env.local` → `env.local`)

Full day-to-day setup: see repo **README.md**.

---

### Credentials & Account Transfer

**Do not paste passwords or API keys into this document.** Track what must move; share secrets via a password manager or encrypted note at/before the meeting.


| Service / Account              | Current owner                   | Transfer action                                                                        |
| ------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------- |
| Design (Figma)                 | **[TODO — current owner]**      | Invite OHHF as Editor/Owner; remove student-only ownership if desired                  |
| Code repo (GitHub `OHHF_CS52`) | Spurti / CS4SG team             | Add OHHF org or maintainers; transfer ownership if OHHF will own the repo long-term    |
| Hosting / deploy               | **[TODO — if any]**             | Transfer project; update DNS / env vars on host                                        |
| LLM / chatbot API (OpenAI)     | Team keys via local env         | Create OHHF-owned OpenAI project; rotate keys; update env                              |
| Care-team gen (Anthropic)      | Team keys via local env         | Same — OHHF-owned key + rotate                                                         |
| Supabase (OHHF Database)       | Team / OHHF project             | Transfer org ownership; rotate `anon` + `service_role` keys; never commit service role |
| Any third-party keys           | Local `env.local` / `.env` only | Inventory + rotate; keep out of git                                                    |


**Required env vars (names only):**  
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (+ optional model overrides). See `.env.example`.

---

### Current State of the Build

**Complete & working (local demo path)**

- Auth landing, sign-in / sign-up, onboarding welcome flow  
- Home with mood check-in and personalized “right for you now” cards  
- Companion chat with RAG retrieval, citations screen, crisis short-circuit, wellness / resource deep-links  
- Wellness tools suite (breathing, grounding, physical regulation, name-it, micro-journal, reframes, safe place, nudges, crisis support panel)  
- Resources hub: Find Support, Medical Glossary, Questions for Care Team (+ standard question library)  
- Supabase-backed persistence for mood / journal / reframes / safe places / tool usage / saved questions (when keys + migrations applied)  
- RAG pipeline: `npm run rag:build` → `data/knowledge/index.json`

**In progress / partially built**

- **Production hosting & CI/CD** — app runs locally via `dev:all`; confirm any live URL and who owns deploy  
- **Server auth route** (`server/routes/auth.ts`) exists but is not mounted in `server/index.ts` — client auth is primarily Supabase direct / edge function  
- **Content pipelines** (`scripts/supabase_data_scripts/`, glossary / care-team pipelines) are for ops, not day-to-day app use  
- **Clinical / content review** of chatbot tone and corpus coverage — engineering complete; ongoing OHHF review recommended

**Designed but not yet built**

- **[TODO — list anything still only in Figma]** (e.g. mobile-native shell, push notifications, caregiver profiles beyond current onboarding, analytics dashboards)  
- Point designers to Figma; do not assume every frame is implemented in `src/screens/`

---

### Known Limitations & Open Items

1. **Not medical advice / not crisis care.** Crisis detection is keyword-based and routes to help messaging; it is not a clinical triage system. Always keep 988 / local emergency guidance visible in crisis UI.
2. **RAG index is not in git.** Each environment must run `npm run rag:build` after pull / corpus changes, or chat will fail with a missing knowledge index.
3. **Secrets live only in local env files.** `env.local` / `.env`* are gitignored — new developers need a secure share of keys.
4. **Rate limits & cost:** OpenAI embeddings + chat and Anthropic generation incur usage costs; monitor quotas after transfer.
5. **HIPAA / privacy:** App stores emotional / journal content in Supabase under user accounts. Treat as sensitive; complete privacy policy, retention, and (if applicable) BAA / compliance review before broad public launch.
6. **Browser-first web app** — not a native iOS/Android binary; mobile is responsive web unless a later phase adds Expo/TestFlight.
7. **Some TypeScript unused-import / polish warnings** may exist in secondary files; core flows were demoed via `dev:all`.
8. **Care-team question quality** depends on corpus upload + Anthropic; empty corpus → weaker or mock fallbacks depending on path.

---

### Recommendations for the Next Phase

1. **Highest-impact product:** Soft launch with a small caregiver cohort + structured feedback on chat tone, crisis moments, and which wellness tools get used.
2. **Technical priority:** Production deploy (host + env), CI, monitoring for API errors/cost; ensure Supabase migrations are applied on the shared project; rotate all keys post-handoff.
3. **Content / clinical review:** Have OHHF clinical or peer-support advisors review companion prompts (`server/prompts/`), crisis copy, and glossary definitions before wide release.
4. **Privacy & trust:** Publish clear “not a doctor / not a crisis line” language; review data retention for journals and mood entries.
5. **What we’d do with more time:** Stronger eval harness for RAG answers, richer citation UX, analytics on tool engagement, accessibility pass (screen readers / contrast), and closing gaps between Figma and production.

---

### Team & Contacts

We're glad to answer follow-up questions after the handoff. Best points of contact:


| Name     | Role                               | Email              |
| -------- | ---------------------------------- | ------------------ |
| Spurti   | Primary engineering contact / repo | **[TODO — email]** |
| Edwin    | Engineering                        | **[TODO — email]** |
| Priyanka | Engineering                        | **[TODO — email]** |
| Amrita   | Engineering                        | **[TODO — email]** |
| Cara     | Engineering                        | **[TODO — email]** |


*(Fill emails before sending to Beth / OHHF.)*

---

### Closing Note

It's been a genuine privilege to help shape Ollie's Companion, and we're excited to see OHHF carry it forward so it can make a real difference for heart families. Thank you for the partnership throughout — we're rooting for the next phase.

**Stanford CS for Social Good · OHHF team** · 07/26/2026

---

### Appendix A — Day-one checklist for the next developer

1. Get GitHub access to `OHHF_CS52` and Supabase project access.
2. Copy `.env.example` → `.env` / `env.local`; receive keys via secure channel.
3. `npm install` → `npm run rag:build` → `npm run dev:all`.
4. Smoke-test: auth → home mood → chat (non-crisis + crisis keyword) → one wellness tool → resources (glossary / support / care-team).
5. Confirm Supabase migrations match `supabase/migrations/`.
6. Skim `README.md` and `docs/retrieval.md`.

### Appendix B — Feature ↔ code map


| Feature             | Primary locations                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Routes              | `src/App.tsx`                                                                                  |
| Chat UI             | `src/screens/ChatScreen.tsx`                                                                   |
| Chat / RAG API      | `server/routes/chat.ts`, `server/lib/chatRag.ts`                                               |
| Crisis keywords     | `src/lib/crisisKeywords.ts`                                                                    |
| Wellness            | `src/screens/WellnessTools.tsx`, `src/lib/wellnessToolRegistry.ts`, `src/components/wellness/` |
| Mood / home         | `src/mood/`, `src/screens/homeScreen.tsx`, `src/home/`                                         |
| Care-team questions | `src/screens/QuestionsForCareTeam.tsx`, `server/routes/careTeamQuestions.ts`                   |
| Glossary / support  | `src/screens/MedicalGlossary.tsx`, `src/screens/FindSupport.tsx`                               |
| RAG build           | `scripts/rag/build-knowledge-index.ts`                                                         |


