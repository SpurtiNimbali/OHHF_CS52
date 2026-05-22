-- RLS for mood_entries and journal_entries (match saved_questions: users own their rows)

ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mood_entries_select_own" ON public.mood_entries;
DROP POLICY IF EXISTS "mood_entries_insert_own" ON public.mood_entries;
DROP POLICY IF EXISTS "mood_entries_update_own" ON public.mood_entries;

CREATE POLICY "mood_entries_select_own"
  ON public.mood_entries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "mood_entries_insert_own"
  ON public.mood_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "mood_entries_update_own"
  ON public.mood_entries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "journal_entries_select_own" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries_insert_own" ON public.journal_entries;

CREATE POLICY "journal_entries_select_own"
  ON public.journal_entries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "journal_entries_insert_own"
  ON public.journal_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
