
-- Reports table
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  file_name TEXT NOT NULL,
  file_path TEXT,
  raw_text TEXT,
  values JSONB DEFAULT '{}'::jsonb,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read reports" ON public.reports FOR SELECT USING (true);
CREATE POLICY "anyone can insert reports" ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can update reports" ON public.reports FOR UPDATE USING (true);
CREATE POLICY "anyone can delete reports" ON public.reports FOR DELETE USING (true);

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read chat" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "anyone insert chat" ON public.chat_messages FOR INSERT WITH CHECK (true);

-- Storage bucket for lab reports
INSERT INTO storage.buckets (id, name, public) VALUES ('lab-reports', 'lab-reports', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read lab-reports" ON storage.objects FOR SELECT USING (bucket_id = 'lab-reports');
CREATE POLICY "public upload lab-reports" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'lab-reports');
