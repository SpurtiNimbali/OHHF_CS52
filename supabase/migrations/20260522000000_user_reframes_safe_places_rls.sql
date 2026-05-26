-- RLS for user_reframes and safe_places
-- Starter reframes use user_id IS NULL (readable by all authenticated users).

ALTER TABLE public.user_reframes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safe_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_reframes_select" ON public.user_reframes;
DROP POLICY IF EXISTS "user_reframes_insert_own" ON public.user_reframes;

CREATE POLICY "user_reframes_select"
  ON public.user_reframes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "user_reframes_insert_own"
  ON public.user_reframes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "safe_places_select_own" ON public.safe_places;
DROP POLICY IF EXISTS "safe_places_insert_own" ON public.safe_places;
DROP POLICY IF EXISTS "safe_places_update_own" ON public.safe_places;
DROP POLICY IF EXISTS "safe_places_delete_own" ON public.safe_places;

CREATE POLICY "safe_places_select_own"
  ON public.safe_places
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "safe_places_insert_own"
  ON public.safe_places
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "safe_places_update_own"
  ON public.safe_places
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "safe_places_delete_own"
  ON public.safe_places
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS safe_places_user_id_unique ON public.safe_places (user_id);

-- Seed 6 starter reframe cards (global, user_id NULL)
INSERT INTO public.user_reframes (user_id, thought, reframe, timestamp)
SELECT NULL, v.thought, v.reframe, NOW()
FROM (
  VALUES
    ('I have to handle everything', 'I can take one next step'),
    ('I can''t fall apart', 'I can feel this and keep going'),
    ('I''m failing', 'This is hard, and I''m trying'),
    ('I should be stronger', 'strength includes asking for help'),
    ('I''m so behind', 'I am doing what I can'),
    ('I can''t do this', 'I have done hard things today')
) AS v(thought, reframe)
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_reframes WHERE user_id IS NULL LIMIT 1
);
