alter table saved_questions
  add column if not exists source text check (source in ('generated', 'custom', 'preset'));
