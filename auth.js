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

// ==== Fetch data karyawan + password (dengan cache session, sekali per sesi browser) ====
async function fetchKaryawanSheet(sheet) {
  const cacheKey = `karyawan_${sheet}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  const res = await fetch(`${KARYAWAN_URL}?sheet=${encodeURIComponent(sheet)}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);

  sessionStorage.setItem(cacheKey, JSON.stringify(data));
  return data;
}

// ==== Login: cocokkan Id + Password ke PasswordTbl, ambil nama dari KaryawanTbl ====
async function login(id, password) {
  const [passwords, karyawan] = await Promise.all([
    fetchKaryawanSheet("PasswordTbl"),
    fetchKaryawanSheet("KaryawanTbl"),
  ]);

  const pw = passwords.find((p) => String(p.Id) === String(id));
  if (!pw) throw new Error("User tidak ditemukan.");
  if (pw.IsActive !== true && pw.IsActive !== "TRUE") throw new Error("Akun tidak aktif.");
  if (String(pw.PasswordHas) !== String(password)) throw new Error("Password salah.");

  const karyawanRow = karyawan.find((k) => String(k.Id) === String(id));

  const session = {
    id: pw.Id,
    nama: karyawanRow ? karyawanRow.NamaPersonnel : `User #${pw.Id}`,
    author: pw.Author || "",
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
    const [passwords, karyawan] = await Promise.all([
      fetchKaryawanSheet("PasswordTbl"),
      fetchKaryawanSheet("KaryawanTbl"),
    ]);
    const pw = passwords.find((p) => String(p.Id) === String(bypassId));
    if (!pw) return false;
    const karyawanRow = karyawan.find((k) => String(k.Id) === String(bypassId));
    setSession({
      id: pw.Id,
      nama: karyawanRow ? karyawanRow.NamaPersonnel : `User #${pw.Id}`,
      author: pw.Author || "",
    });
    return true;
  } catch (e) {
    console.warn("Bypass gagal:", e.message);
    return false;
  }
}

// ==== Guard: panggil di halaman form (request/received/distribusi) ====
function requireAuth(menuName) {
  const session = getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  const required = MENU_AUTH[menuName];
  if (required && !isAuthorized(session.author, required)) {
    alert("Anda tidak punya akses ke menu ini.");
    window.location.href = "index.html";
    return null;
  }
  return session;
}

function logout() {
  clearSession();
  // hapus cache karyawan supaya data fresh pas login lagi
  sessionStorage.removeItem("karyawan_PasswordTbl");
  sessionStorage.removeItem("karyawan_KaryawanTbl");
  window.location.href = "index.html";
}
