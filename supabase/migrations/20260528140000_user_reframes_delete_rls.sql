-- Allow users to delete their own reframes (not starter rows with user_id IS NULL)

DROP POLICY IF EXISTS "user_reframes_delete_own" ON public.user_reframes;

CREATE POLICY "user_reframes_delete_own"
  ON public.user_reframes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
