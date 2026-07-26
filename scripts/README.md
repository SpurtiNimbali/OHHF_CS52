# Scripts

| Folder / file | Purpose |
|---------------|---------|
| `rag/` | Build `data/knowledge/index.json` (`npm run rag:build`) |
| `scrape_jina_corpus/` | Active web/PDF scrape → cleaned chunk JSON |
| `glossary_terms_pipeline/` | Extract / canonicalize glossary → upload to Supabase |
| `care_team_questions_pipeline/` | Care-team question corpus → Supabase |
| `supabase_data_scripts/` | Export pipelines + `legacy_pipeline/` OHHF scrape/upload |
| `chat-once.ts` | CLI RAG smoke test (`npm run chat:ask`) |
| `test-*.ts` | Crisis / coping / tool-link smoke tests |
| `apply-mood-journal-rls.ts` | One-off RLS helper |

Day-to-day app work rarely needs these except `rag:build` after corpus changes.
