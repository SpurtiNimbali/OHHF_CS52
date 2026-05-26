-- nudges table: powers the "Today's Nudge" wellness tool
create table if not exists public.nudges (
  id integer primary key generated always as identity,
  nudge_text text not null
);

alter table public.nudges enable row level security;

-- nudges are not user-specific — allow anonymous reads
create policy "nudges are publicly readable"
  on public.nudges
  for select
  using (true);

-- seed with 20 sample nudges for heart families
insert into public.nudges (nudge_text) values
  ('tell your child one thing you love about them today.'),
  ('sit close. no phone. just two minutes.'),
  ('take 5 minutes with no medical talk.'),
  ('notice one thing that made them smile.'),
  ('laugh about something silly together.'),
  ('you are allowed to enjoy them.'),
  ('share a memory that made you both happy.'),
  ('hold their hand and breathe together.'),
  ('let them choose what you do today, even if it''s small.'),
  ('name one thing you''re proud of them for.'),
  ('make their favorite snack together.'),
  ('watch their favorite show without any distractions.'),
  ('play a silly game, even for five minutes.'),
  ('tell them: you make our family brighter.'),
  ('ask them what made today feel okay.'),
  ('read one chapter of a book together.'),
  ('take a slow walk, no destination needed.'),
  ('let them hear you laugh today.'),
  ('remind yourself: connection is medicine too.'),
  ('send them a drawing or voice note just because.');
