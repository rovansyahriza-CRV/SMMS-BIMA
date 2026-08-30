// URL Web App Apps Script — SMMS-BIMA
// (RESOURCES_URL masih dipakai untuk katalog item per kelompok. KARYAWAN_URL sudah TIDAK
//  dipakai lagi untuk login -- login sekarang langsung ke Supabase (paswordTbl/karyawanTbl),
//  disisakan di sini cuma buat jaga-jaga kalau ada halaman lama yang masih refer ke sini.)
const RESOURCES_URL = "https://script.google.com/macros/s/AKfycbzHvD3cz2Ur3WGkf_b-yIC6qNRajqZC9mx5ZmcQzr1-28vx_7EJO12Paez5VZFQt3IO/exec";
const TRANSAKSI_URL = "https://script.google.com/macros/s/AKfycbziA0AWUvyt8f6VGyy4mWM_nsv7RP2xjfrK4vVzPR3_65Qdiu8_NPn8KZyYuPQ6USRW/exec";
const KARYAWAN_URL = "https://script.google.com/macros/s/AKfycbxDIDJ5COlR2GOCcmJdN0_j303qxCpk_mKUFzzOytgzmgPsV244_vWgS-XUaYxmSJ_CTg/exec";

// Supabase — dipakai untuk login (paswordTbl/karyawanTbl) dan request.html untuk
// menyimpan Material Request langsung ke tabel "request", supaya muncul di Create RFQ /
// approval flow desktop app. Halaman yang load config.js dan butuh login/Supabase WAJIB
// juga load <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// SEBELUM config.js.
const SUPABASE_URL = "https://nhmpwjriextmbotmvvbu.supabase.co";
const SUPABASE_KEY = "sb_publishable_XNqLw7iz873TtrLn9ag8dQ_AkL2rImz";
const supabaseClient = (typeof supabase !== "undefined")
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// Drive File Bridge — dipakai buat simpan foto (delivery-to-site/end-user-receiving) &
// PDF report ke Google Drive 100GB, lewat Apps Script (lihat drive-bridge-appsscript.gs).
// ISI DUA VALUE INI setelah kamu deploy Apps Script-nya:
// - DRIVE_BRIDGE_URL  = URL Web App hasil deploy (https://script.google.com/macros/s/.../exec)
// - DRIVE_BRIDGE_TOKEN = string yang sama persis dengan Script Property "UPLOAD_TOKEN"
const DRIVE_BRIDGE_URL = "https://script.google.com/macros/s/AKfycbwfq5bqNWx0fO9LuEyQasUzkLP91gA8G-rqRKpPOIJ9r7WNN0G_klH8jXxXhY96ArlC/exec";
const DRIVE_BRIDGE_TOKEN = "bima-2026-x8f2k9";

// Grup yang butuh input durasi sewa (bukan konsumsi habis pakai)
const RENTAL_GROUPS = ["Tools", "HeavyEquipment"];

// Nama menu -> Author/PIC yang wajib dimiliki user, dicek dari paswordTbl (comma-separated)
const MENU_AUTH = {
  Request: "Request",
  Received: "Receive",
  Distribusi: "Distribusi",
  Approval: "Approval",
};

// Menu mana divalidasi dari kolom apa di paswordTbl:
// - Approval tetap dari "Author" (wewenang approval)
// - Request/Received/Distribusi dari "pic" (operator yang berwenang), biar konsisten
//   sama sistem desktop app
const MENU_FIELD = {
  Request: "pic",
  Received: "pic",
  Distribusi: "pic",
  Approval: "author",
};
