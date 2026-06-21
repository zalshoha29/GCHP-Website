/* =========================================
   GCHP Portal — Supabase Client (shared)
   Loaded on every portal page after the
   @supabase/supabase-js CDN script.
   ========================================= */

// These two values are public-safe (the anon key is protected by RLS).
// Replace the placeholders with your project values, OR inject them at
// deploy time. Do NOT put the service_role key here under any circumstances.
const SUPABASE_URL = 'https://ydocmylanhcjgzgfakds.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkb2NteWxhbmhjamd6Z2Zha2RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTIzOTMsImV4cCI6MjA5MjEyODM5M30.FzGB-ROxWPjwz81MbgGlswkK7j3O1zaugjF1bds5Iuc';

if (SUPABASE_URL.startsWith('<<') || SUPABASE_ANON_KEY.startsWith('<<')) {
  console.error(
    'GCHP Portal: Supabase credentials not set. ' +
    'Edit portal/supabase-client.js and replace the placeholder values.'
  );
}

// window.supabase is provided by the CDN UMD build.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- Shared helpers ---------- */

// Returns the current session's user, or null.
async function getCurrentUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user || null;
}

// Returns the current user's profile row (incl. role), or null.
async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) {
    console.error('Failed to load profile:', error.message);
    return null;
  }
  return data;
}

// Returns the single active cycle, or null.
async function getActiveCycle() {
  const { data, error } = await sb
    .from('cycles')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();
  if (error) {
    console.error('Failed to load active cycle:', error.message);
    return null;
  }
  return data;
}

// Count of unread messages for the current user.
async function getUnreadCount(userId) {
  const { count } = await sb
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);
  return count || 0;
}

// Open a stored file via a short-lived signed URL (1 hour).
async function openStoredFile(filePath, bucket = 'submissions') {
  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUrl(filePath, 3600);
  if (error) {
    alert('Could not open file: ' + error.message);
    return;
  }
  window.open(data.signedUrl, '_blank');
}

// Sign out and return to login.
async function signOut() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

// Small helper: escape user text before inserting into innerHTML.
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
