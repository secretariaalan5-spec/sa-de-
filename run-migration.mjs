import https from 'https';

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cHF6YnN3dGRmYXRkcnRxaHJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM3NjAyOCwiZXhwIjoyMDg1OTUyMDI4fQ.P38UZCfSG2mOwyqzN-4pze8hK2Sc3p7DxJEgiPqZ7lE';
const PROJECT_URL = 'qxpqzbswtdfatdrtqhrw.supabase.co';

const SQL = `
CREATE TABLE IF NOT EXISTS public.portal_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'emult' CHECK (access_level IN ('emult', 'nurse', 'tech')),
  label        TEXT NOT NULL DEFAULT '',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  uses_count   INTEGER NOT NULL DEFAULT 0,
  max_uses     INTEGER,
  expires_at   TIMESTAMP WITH TIME ZONE,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (admin_id, code)
);
CREATE INDEX IF NOT EXISTS idx_portal_invites_admin_id ON public.portal_invites(admin_id);
CREATE INDEX IF NOT EXISTS idx_portal_invites_code ON public.portal_invites(code);
CREATE INDEX IF NOT EXISTS idx_portal_invites_active ON public.portal_invites(is_active, admin_id);
ALTER TABLE public.portal_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read active invites" ON public.portal_invites;
CREATE POLICY "Public can read active invites" ON public.portal_invites FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Admins can insert own invites" ON public.portal_invites;
CREATE POLICY "Admins can insert own invites" ON public.portal_invites FOR INSERT WITH CHECK (auth.uid() = admin_id);
DROP POLICY IF EXISTS "Admins can update own invites" ON public.portal_invites;
CREATE POLICY "Admins can update own invites" ON public.portal_invites FOR UPDATE USING (auth.uid() = admin_id);
DROP POLICY IF EXISTS "Admins can delete own invites" ON public.portal_invites;
CREATE POLICY "Admins can delete own invites" ON public.portal_invites FOR DELETE USING (auth.uid() = admin_id);
`;

function request(hostname, path, method, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
            },
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function run() {
    console.log('Executando migration portal_invites...');

    // Supabase Management API - execute SQL
    const result = await request(
        'api.supabase.com',
        `/v1/projects/qxpqzbswtdfatdrtqhrw/database/query`,
        'POST',
        { query: SQL }
    );

    console.log('Status:', result.status);
    console.log('Response:', result.body);
}

run().catch(err => {
    console.error('Erro:', err.message);
    process.exit(1);
});
