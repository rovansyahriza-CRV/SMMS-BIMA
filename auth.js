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

// Author di PasswordTbl bisa berisi lebih dari satu role dipisah koma, cth "Request, Receive"
function isAuthorized(authorField, required) {
  if (!authorField) return false;
  return String(authorField)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(required.toLowerCase());
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
