-- 1. Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Backfill existing registered users into the profiles table FIRST
INSERT INTO public.profiles (id, full_name, email)
SELECT u.id, COALESCE(u.raw_user_meta_data ->> 'full_name', ''), COALESCE(u.email, '')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 3. Set user_id to NULL for any reports belonging to deleted/non-existent users (prevents FK violation)
UPDATE public.reports 
SET user_id = NULL 
WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- 4. Now add the foreign key relation safely
ALTER TABLE public.reports 
  ADD CONSTRAINT fk_reports_user_id 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
  ON DELETE SET NULL;

-- 5. Create the auto-profile trigger function for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- 6. Set up the trigger to run automatically on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Add public read select and delete bypass policies for the admin dashboard
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin can view all profiles" ON public.profiles;
CREATE POLICY "admin can view all profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin can delete all profiles" ON public.profiles;
CREATE POLICY "admin can delete all profiles" ON public.profiles FOR DELETE USING (true);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin can view all reports" ON public.reports;
CREATE POLICY "admin can view all reports" ON public.reports FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin can delete all reports" ON public.reports;
CREATE POLICY "admin can delete all reports" ON public.reports FOR DELETE USING (true);
