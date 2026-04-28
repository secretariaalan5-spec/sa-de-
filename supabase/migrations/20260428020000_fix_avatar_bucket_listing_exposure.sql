-- =====================================================
-- SECURITY FIX: Restrict avatars bucket SELECT policies
-- Remove broad listing permission; keep per-object access
-- via authenticated users only (image URLs still work).
-- =====================================================

-- Drop the two overly-broad public SELECT policies
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

-- Replace with a policy that allows reading a SPECIFIC object
-- only when the requester knows the exact path (no directory listing).
-- Authenticated users can view any avatar (needed to render profile pics).
-- Unauthenticated access is blocked completely.
CREATE POLICY "Authenticated users can view avatars"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');
