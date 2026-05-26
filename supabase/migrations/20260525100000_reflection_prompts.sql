-- reflection_prompts: powers mood-filtered daily reflection prompts
create table if not exists public.reflection_prompts (
  id integer primary key generated always as identity,
  prompt_text text not null,
  mood_tags text[] not null default '{}'
);

alter table public.reflection_prompts enable row level security;

create policy "reflection_prompts are publicly readable"
  on public.reflection_prompts
  for select
  using (true);

-- optional FK from journal entries back to the prompt that inspired the reflection
alter table public.journal_entries
  add column if not exists prompt_id integer references public.reflection_prompts(id) on delete set null;

-- seed: mood_tags use the app's MoodId values
-- (happy | calm | hopeful | overwhelmed | exhausted | angry | scared | sad | disconnected | numb)
insert into public.reflection_prompts (prompt_text, mood_tags) values
  ('What is one thing you did today that took courage?',                         array['overwhelmed','scared','exhausted']),
  ('When did you last feel truly at ease? What created that feeling?',           array['anxious','disconnected','sad']),
  ('What does connection look like for you right now?',                          array['lonely','disconnected','sad','numb']),
  ('Name one small thing that brought a moment of relief today.',                array['overwhelmed','exhausted','stressed']),
  ('What would you tell a close friend who was feeling the way you feel today?', array['sad','scared','overwhelmed','anxious']),
  ('What is something you are carrying that you did not choose?',                array['overwhelmed','exhausted','sad']),
  ('What made you smile or feel lighter in the past 24 hours?',                 array['happy','calm','hopeful']),
  ('How has your body been asking you to slow down lately?',                     array['exhausted','overwhelmed','numb']),
  ('What is one thing you are proud of this week, no matter how small?',         array['happy','hopeful','calm']),
  ('Who in your life makes you feel safe? What do they do that helps?',          array['scared','disconnected','sad','numb']),
  ('What does a moment of rest look like for you right now?',                    array['exhausted','overwhelmed']),
  ('What is something you wish others understood about how you are feeling?',    array['disconnected','angry','sad','lonely']),
  ('What small joy can you create today, even if everything feels heavy?',       array['sad','disconnected','exhausted','numb']),
  ('What boundary did you uphold this week, or wish you had?',                  array['overwhelmed','angry']),
  ('What does hope feel like in your body today?',                               array['hopeful','happy','calm']),
  ('When did you last feel seen or understood? What made that possible?',        array['disconnected','sad','lonely']),
  ('What would make tomorrow feel a little lighter?',                            array['overwhelmed','exhausted','sad']),
  ('What feeling have you been avoiding? Can you sit with it for a moment?',     array['numb','disconnected','scared']),
  ('What are you learning about yourself in this season of life?',               array['calm','hopeful','happy']),
  ('What does self-compassion look like for you today?',                         array['overwhelmed','sad','exhausted','scared']);
