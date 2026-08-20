const nav = {
  loginSection: document.getElementById("loginSection"),
  menuSection: document.getElementById("menuSection"),
  loginForm: document.getElementById("loginForm"),
  loginId: document.getElementById("loginId"),
  loginPin: document.getElementById("loginPin"),
  loginMsg: document.getElementById("loginMsg"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  userName: document.getElementById("userName"),
  menuRequest: document.getElementById("menuRequest"),
  menuReceived: document.getElementById("menuReceived"),
  menuDistribusi: document.getElementById("menuDistribusi"),
  menuApproval: document.getElementById("menuApproval"),
  noAccessMsg: document.getElementById("noAccessMsg"),
};
function showMenu(session) {
  nav.loginSection.hidden = true;
  nav.menuSection.hidden = false;
  nav.logoutBtn.hidden = false;
  nav.userName.textContent = session.nama;
  const hasRequest = isAuthorized(session.author, MENU_AUTH.Request);
  const hasReceived = isAuthorized(session.author, MENU_AUTH.Received);
  const hasDistribusi = isAuthorized(session.author, MENU_AUTH.Distribusi);
  const hasApproval = MENU_AUTH.Approval ? isAuthorized(session.author, MENU_AUTH.Approval) : false;
  nav.menuRequest.hidden = !hasRequest;
  nav.menuReceived.hidden = !hasReceived;
  nav.menuDistribusi.hidden = !hasDistribusi;
  if (nav.menuApproval) nav.menuApproval.hidden = !hasApproval;
  nav.noAccessMsg.hidden = hasRequest || hasReceived || hasDistribusi || hasApproval;
}
function showLogin() {
  nav.loginSection.hidden = false;
  nav.menuSection.hidden = true;
  nav.logoutBtn.hidden = true;
}
async function populateUserDropdown() {
  try {
    const karyawan = await fetchKaryawanSheet("KaryawanTbl");
    nav.loginId.innerHTML = `<option value="" disabled selected>Pilih nama</option>`;
    karyawan.forEach((k) => {
      const opt = document.createElement("option");
      opt.value = k.Id;
      opt.textContent = k.NamaPersonnel;
      nav.loginId.appendChild(opt);
    });
    nav.loginId.disabled = false;
  } catch (err) {
    nav.loginId.innerHTML = `<option value="" disabled selected>Gagal memuat daftar user</option>`;
    nav.loginMsg.textContent = "Gagal memuat daftar user: " + err.message;
    nav.loginMsg.className = "form-msg error";
  }
}
nav.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  nav.loginMsg.textContent = "";
  nav.loginMsg.className = "form-msg";
  nav.loginBtn.disabled = true;
  nav.loginBtn.textContent = "Memeriksa...";
  try {
    const session = await login(nav.loginId.value.trim(), nav.loginPin.value.trim());
    showMenu(session);
    nav.loginForm.reset();
  } catch (err) {
    nav.loginMsg.textContent = err.message;
    nav.loginMsg.className = "form-msg error";
  } finally {
    nav.loginBtn.disabled = false;
    nav.loginBtn.textContent = "Masuk";
  }
});
nav.logoutBtn.addEventListener("click", () => {
  logout();
  showLogin();
});
// ==== init ====
(function init() {
  const session = getSession();
  if (session) {
    showMenu(session);
  } else {
    showLogin();
    populateUserDropdown();
  }
})();
