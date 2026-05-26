-- Allow multiple safe places per user (switch between them in the UI)
DROP INDEX IF EXISTS public.safe_places_user_id_unique;
