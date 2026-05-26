update saved_questions
set source = case
  when lower(coalesce(source, '')) = 'generated' then 'generated'
  when lower(coalesce(source, '')) = 'custom' then 'custom'
  when lower(coalesce(source, '')) in ('preset', 'bank', 'corpus') then 'preset'
  when question_id is not null then 'preset'
  when nullif(btrim(coalesce(custom_text, '')), '') is not null then 'custom'
  else 'custom'
end
where source is null
   or btrim(coalesce(source, '')) = ''
   or lower(source) in ('generated', 'custom', 'preset', 'bank', 'corpus');

alter table saved_questions
  drop constraint if exists saved_questions_source_check;

alter table saved_questions
  add constraint saved_questions_source_check
  check (source in ('generated', 'custom', 'preset'));
