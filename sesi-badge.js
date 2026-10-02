// ============ SESI BADGE untuk halaman lapangan (delivery-to-site, end-user-receiving) ============
// Simpan/terima/serah/retur barang dicek server (RPC S5) pakai token sesi Badge (hasil badge_login).
// - Dibuka dari Digital Badge (tab yang sama, ?fromBadge=1): token sudah ada di sessionStorage
//   (origin sama dengan Fusion4), langsung dipakai.
// - Dibuka langsung (HP bersama di site): setelah scan wajah/QR, petugas diminta PIN Badge.
//   Token cuma disimpan di memori halaman dan di-logout saat halaman ditutup / ganti petugas.
// Butuh global supabaseClient.

const SESI_BADGE_KEY = 'fusion4BadgeToken';
const SESI_DARI_BADGE = new URLSearchParams(location.search).get('fromBadge') === '1';
let sesiBadgeMemori = null;

function sesiBadgeToken() {
  if (sesiBadgeMemori) return sesiBadgeMemori;
  try { return sessionStorage.getItem(SESI_BADGE_KEY) || ''; } catch (e) { return ''; }
}

function sesiBadgeDeviceId() {
  try {
    let id = localStorage.getItem('fusion4BadgeDevice');
    if (!id) {
      id = 'BD-' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
      localStorage.setItem('fusion4BadgeDevice', id);
    }
    return id;
  } catch (e) { return 'BD-tanpa-storage'; }
}

function sesiBadgeLogoutMemori() {
  if (!sesiBadgeMemori) return;
  const tok = sesiBadgeMemori;
  sesiBadgeMemori = null;
  supabaseClient.rpc('badge_logout', { p_token: tok }).then(() => {}, () => {});
}
window.addEventListener('pagehide', sesiBadgeLogoutMemori);

const samaQr = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();

// Pastikan ada sesi Badge milik petugas yang barusan terverifikasi (qrCodeId).
// Resolve true kalau sesi sah, false kalau petugas membatalkan.
async function pastikanSesiBadge(qrCodeId, nama) {
  const token = sesiBadgeToken();
  if (token) {
    try {
      const { data } = await supabaseClient.rpc('badge_sesi_info', { p_token: token });
      if (data && data.status === 'OK' && samaQr(data.qrCodeId, qrCodeId)) return true;
    } catch (e) { /* lanjut minta PIN */ }
  }
  sesiBadgeLogoutMemori(); // sesi petugas sebelumnya (HP bersama) tidak dipakai lagi
  return mintaPinBadgeLapangan(qrCodeId, nama);
}

function mintaPinBadgeLapangan(qrCodeId, nama) {
  return new Promise((resolve) => {
    let card = document.getElementById('sesiBadgeCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'sesiBadgeCard';
      card.className = 'card';
      card.innerHTML =
        '<p class="card-label">🔐 PIN Digital Badge</p>' +
        '<p id="sesiBadgeInfo" style="margin:0 0 12px; font-size:14px; line-height:1.5;"></p>' +
        '<input type="password" id="sesiBadgePin" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="6 digit PIN Badge" ' +
        'style="width:100%; box-sizing:border-box; font-size:18px; letter-spacing:4px; text-align:center; padding:11px 12px; border-radius:12px; border:1.5px solid var(--border); background:var(--surface-2);">' +
        '<p id="sesiBadgeError" style="display:none; margin:8px 0 0; font-size:13px; color:var(--danger);"></p>' +
        '<button type="button" id="sesiBadgeOk" class="btn-block btn-primary">Lanjut</button>' +
        '<button type="button" id="sesiBadgeBatal" class="btn-block btn-secondary">Batal</button>';
      const anchor = document.getElementById('matchInfo');
      anchor.parentNode.insertBefore(card, anchor.nextSibling);
    }
    const input = document.getElementById('sesiBadgePin');
    const err = document.getElementById('sesiBadgeError');
    const btnOk = document.getElementById('sesiBadgeOk');
    document.getElementById('sesiBadgeInfo').innerText =
      'Masukkan PIN Badge ' + (nama || 'Anda') + ' untuk melanjutkan. Data pengiriman/penerimaan dicatat atas nama pemilik PIN.';
    input.value = '';
    err.style.display = 'none';
    card.style.display = 'block';
    input.focus();

    const tampilError = (t) => { err.innerText = t; err.style.display = 'block'; };
    const selesai = (hasil) => {
      card.style.display = 'none';
      btnOk.onclick = null;
      document.getElementById('sesiBadgeBatal').onclick = null;
      resolve(hasil);
    };
    document.getElementById('sesiBadgeBatal').onclick = () => selesai(false);
    btnOk.onclick = async () => {
      const pin = input.value.trim();
      if (!/^\d{6}$/.test(pin)) { tampilError('PIN harus 6 digit angka.'); return; }
      btnOk.disabled = true;
      try {
        const { data, error } = await supabaseClient.rpc('badge_login', { p_pin: pin, p_device: sesiBadgeDeviceId() });
        if (error) throw new Error(error.message);
        if (!data || data.status !== 'OK') {
          tampilError(((data && data.message) || 'PIN tidak ditemukan.') + (data && data.sisa != null ? ' Sisa percobaan: ' + data.sisa + '.' : ''));
          return;
        }
        if (!samaQr(data.qrCodeId, qrCodeId)) {
          supabaseClient.rpc('badge_logout', { p_token: data.token }).then(() => {}, () => {});
          tampilError('PIN ini milik ' + (data.nama || 'karyawan lain') + ', bukan ' + (nama || 'petugas yang terverifikasi') + '.');
          return;
        }
        if (SESI_DARI_BADGE) {
          try { sessionStorage.setItem(SESI_BADGE_KEY, data.token); } catch (e) { sesiBadgeMemori = data.token; }
        } else {
          sesiBadgeMemori = data.token;
        }
        selesai(true);
      } catch (e) {
        tampilError('Gagal cek PIN: ' + e.message);
      } finally {
        btnOk.disabled = false;
      }
    };
  });
}

// Dibuka dari Badge -> tombol kembali ke Badge (tab yang sama, sesi tetap).
document.addEventListener('DOMContentLoaded', () => {
  if (!SESI_DARI_BADGE) return;
  const brand = document.querySelector('.brand-row');
  if (!brand) return;
  const a = document.createElement('a');
  a.href = '/Fusion4/digital-badge.html';
  a.textContent = '← Kembali ke Badge';
  a.style.cssText = 'display:inline-block; margin-bottom:10px; font-size:13px; font-weight:700; color:var(--steel); text-decoration:none;';
  brand.parentNode.insertBefore(a, brand);
});

// Hasil RPC S5: lempar error yang jelas kalau gagal.
function cekHasilS5(data, error) {
  if (error) throw new Error(error.message);
  if (!data || data.status !== 'OK') {
    if (data && data.status === 'SESSION_EXPIRED') throw new Error('Sesi Badge habis. Ulangi dari scan wajah lalu masukkan PIN Badge.');
    throw new Error((data && data.message) || 'Gagal menyimpan.');
  }
  return data;
}
