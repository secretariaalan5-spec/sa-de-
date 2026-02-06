-- Create table for published portal data
CREATE TABLE public.portal_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  emult_data JSONB NOT NULL DEFAULT '{}',
  service_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portal_schedules ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anonymous) to read published schedules
CREATE POLICY "Anyone can view published schedules"
ON public.portal_schedules
FOR SELECT
USING (true);

-- Only authenticated users can insert/update
CREATE POLICY "Authenticated users can publish schedules"
ON public.portal_schedules
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedules"
ON public.portal_schedules
FOR UPDATE
TO authenticated
USING (true);

-- Create index for faster queries
CREATE INDEX idx_portal_schedules_published_at ON public.portal_schedules(published_at DESC);