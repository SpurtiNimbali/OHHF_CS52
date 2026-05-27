-- Tags + reflection prompt link for micro-journal entries
alter table public.journal_entries
  add column if not exists prompt_id integer references public.reflection_prompts(id) on delete set null;

alter table public.journal_entries
  add column if not exists tags text[] not null default '{}';
