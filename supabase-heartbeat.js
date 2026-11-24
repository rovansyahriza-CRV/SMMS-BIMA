// Heartbeat Supabase: 1 query ringan (maks. sekali per 12 jam per browser) supaya project
// tetap punya aktivitas dan tidak di-pause karena idle. Gagal = diabaikan, tidak mengganggu alur halaman.
// Butuh client Supabase (supabaseClient) sebagai argumen.
const HEARTBEAT_KEY = 'smmsSupabaseHeartbeat';
const HEARTBEAT_INTERVAL_MS = 12 * 60 * 60 * 1000;

async function supabaseHeartbeat(client) {
  try {
    const last = Number(localStorage.getItem(HEARTBEAT_KEY)) || 0;
    if (Date.now() - last < HEARTBEAT_INTERVAL_MS) return;
    localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
    await client.from('rfq').select('RFQID').limit(1);
  } catch (e) { /* abaikan */ }
}
