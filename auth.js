// ==== Session helpers ====
const SESSION_KEY = "smms_session";

function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setSession(data) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// Author di PasswordTbl bisa berisi lebih dari satu role dipisah koma, cth "Request, Receive".
// Sekarang juga menerima bentuk project-scoped "Request 101" (persis pola "Pengirim/Penerima
// barang <kode>" di halaman scan wajah) -- dianggap tetap punya akses ke menu "Request", cuma
// dibatasi ke project tertentu (lihat getAuthorizedProjects).
function isAuthorized(authorField, required) {
  if (!authorField) return false;
  const requiredLower = required.toLowerCase();
  const scopedRe = new RegExp(`^${requiredLower}\\s+\\d+$`, "i");
  return String(authorField)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .some((tag) => tag === requiredLower || scopedRe.test(tag));
}

// Ambil daftar Project ID yang di-scope ke user ini untuk menu tertentu, dari pola
// "<menuName> <projectId>" di kolom Author (cth "Request 101, Request 102").
// - null   = user punya tag polos "<menuName>" tanpa angka -> gak dibatasi, akses semua project
// - [...]  = user cuma punya tag project-scoped -> dibatasi ke project-project itu saja
// - []     = gak ada tag yang cocok sama sekali (harusnya sudah keblok di requireAuth duluan)
function getAuthorizedProjects(authorField, menuName) {
  if (!authorField) return [];
  const menuLower = menuName.toLowerCase();
  const scopedRe = new RegExp(`^${menuLower}\\s+(\\d+)$`, "i");
  const tags = String(authorField).split(",").map((s) => s.trim());

  let hasUnscoped = false;
  const projects = [];
  tags.forEach((tag) => {
    const m = tag.match(scopedRe);
    if (m) projects.push(Number(m[1]));
    else if (tag.toLowerCase() === menuLower) hasUnscoped = true;
  });

  if (hasUnscoped) return null;
  return projects;
}

// ==== Fetch data karyawan + password langsung dari Supabase (paswordTbl / karyawanTbl) ====
async function fetchPasswordRow(id) {
  const { data, error } = await supabaseClient
    .from("paswordTbl")
    .select("*")
    .eq("Id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function fetchKaryawanRow(id) {
  const { data, error } = await supabaseClient
    .from("karyawanTbl")
    .select("*")
    .eq("Id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function fetchAllKaryawan() {
  const { data, error } = await supabaseClient.from("karyawanTbl").select("*");
  if (error) throw new Error(error.message);
  return data || [];
}

// Nama kolom "nama" di karyawanTbl belum dikonfirmasi persis casing-nya -- coba beberapa
// kemungkinan umum dulu sebelum jatuh ke fallback "User #id", biar gak putus kalau ternyata
// beda dari dugaan.
function karyawanName(row, id) {
  if (!row) return `User #${id}`;
  return row.NamaPersonnel || row.Nama || row.NamaKaryawan || row.Name || row.nama || `User #${id}`;
}

// ==== Login: cocokkan Id + Password ke paswordTbl, ambil nama dari karyawanTbl ====
async function login(id, password) {
  const pw = await fetchPasswordRow(id);
  if (!pw) throw new Error("User tidak ditemukan.");
  if (pw.IsActive !== true) throw new Error("Akun tidak aktif.");
  if (String(pw.PasswordHas) !== String(password)) throw new Error("Password salah.");

  const karyawanRow = await fetchKaryawanRow(id);

  const session = {
    id: pw.Id,
    nama: karyawanName(karyawanRow, pw.Id),
    author: pw.Author || "",
    pic: pw.pic || pw.PIC || "",
    qrCodeId: karyawanRow ? (karyawanRow.QrCodeId || karyawanRow.QrCodeID || "") : "",
    kualifikasi: karyawanRow ? (karyawanRow.Kualifikasi || "") : "",
  };

  setSession(session);
  return session;
}

async function bypassAuthFromBadge() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('fromBadge') !== '1') return false;
  const bypassId = params.get('id');
  if (!bypassId) return false;

  try {
    const pw = await fetchPasswordRow(bypassId);
    if (!pw) return false;
    const karyawanRow = await fetchKaryawanRow(bypassId);
    setSession({
      id: pw.Id,
      nama: karyawanName(karyawanRow, pw.Id),
      author: pw.Author || "",
      pic: pw.pic || pw.PIC || "",
      qrCodeId: karyawanRow ? (karyawanRow.QrCodeId || karyawanRow.QrCodeID || "") : "",
      kualifikasi: karyawanRow ? (karyawanRow.Kualifikasi || "") : "",
    });
    return true;
  } catch (e) {
    console.warn("Bypass gagal:", e.message);
    return false;
  }
}

// ==== Guard: panggil di halaman form (request/received/distribusi/approval) ====
// Approval divalidasi dari kolom Author (wewenang approval), menu lain dari kolom pic
// (operator yang berwenang) -- lihat MENU_FIELD di config.js.
function requireAuth(menuName) {
  const session = getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  const required = MENU_AUTH[menuName];
  const fieldName = (typeof MENU_FIELD !== "undefined" && MENU_FIELD[menuName]) || "author";
  const fieldValue = fieldName === "pic" ? session.pic : session.author;
  if (required && !isAuthorized(fieldValue, required)) {
    alert("Anda tidak punya akses ke menu ini.");
    window.location.href = "index.html";
    return null;
  }
  return session;
}

function logout() {
  clearSession();
  window.location.href = "index.html";
}
