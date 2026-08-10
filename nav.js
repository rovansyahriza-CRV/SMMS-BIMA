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

  nav.menuRequest.hidden = !hasRequest;
  nav.menuReceived.hidden = !hasReceived;
  nav.menuDistribusi.hidden = !hasDistribusi;

  nav.noAccessMsg.hidden = hasRequest || hasReceived || hasDistribusi;
}

function showLogin() {
  nav.loginSection.hidden = false;
  nav.menuSection.hidden = true;
  nav.logoutBtn.hidden = true;
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
  }
})();
