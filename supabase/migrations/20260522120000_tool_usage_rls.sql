-- RLS for tool_usage (wellness tool "used" markers)

ALTER TABLE public.tool_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tool_usage_select_own" ON public.tool_usage;
DROP POLICY IF EXISTS "tool_usage_insert_own" ON public.tool_usage;

CREATE POLICY "tool_usage_select_own"
  ON public.tool_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "tool_usage_insert_own"
  ON public.tool_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tool_usage_delete_own" ON public.tool_usage;

CREATE POLICY "tool_usage_delete_own"
  ON public.tool_usage
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
