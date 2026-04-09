-- Add is_short_notice column to track exception requests properly
ALTER TABLE "public"."leave_requests" 
ADD COLUMN IF NOT EXISTS "is_short_notice" boolean DEFAULT false;
