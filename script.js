// ==== state ====
let currentItems = [];

const els = {
  itemGroup: document.getElementById("itemGroup"),
  itemSearch: document.getElementById("itemSearch"),
  itemSelectedIndex: document.getElementById("itemSelectedIndex"),
  itemResults: document.getElementById("itemResults"),
  itemCode: document.getElementById("itemCode"),
  unit: document.getElementById("unit"),
  qty: document.getElementById("qty"),
  durationRow: document.getElementById("durationRow"),
  duration: document.getElementById("duration"),
  durUnit: document.getElementById("durUnit"),
  projectId: document.getElementById("projectId"),
  woNo: document.getElementById("woNo"),
  purpose: document.getElementById("purpose"),
  refNo: document.getElementById("refNo"),
  expectedDate: document.getElementById("expectedDate"),
  form: document.getElementById("requestForm"),
  submitBtn: document.getElementById("submitBtn"),
  formMsg: document.getElementById("formMsg"),
  requestByLabel: document.getElementById("requestByLabel"),
};

// ==== auth guard ====
const currentSession = requireAuth("Request");

function getCurrentUser() {
  return { id: currentSession ? currentSession.id : "", name: currentSession ? currentSession.nama : "—" };
}

// ==== load resources (dengan cache session) ====
async function loadResourceItems(group) {
  const cacheKey = `resources_${group}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  const res = await fetch(`${RESOURCES_URL}?sheet=${encodeURIComponent(group)}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);

  sessionStorage.setItem(cacheKey, JSON.stringify(data));
  return data;
}

els.itemGroup.addEventListener("change", async () => {
  const group = els.itemGroup.value;
  resetItemFields();

  els.itemSearch.disabled = true;
  els.itemSearch.value = "";
  els.itemSearch.placeholder = "Memuat item...";
  els.itemResults.hidden = true;

  els.durationRow.hidden = !RENTAL_GROUPS.includes(group);

  try {
    currentItems = await loadResourceItems(group);
    els.itemSearch.placeholder = `Ketik untuk cari (${currentItems.length} item)`;
    els.itemSearch.disabled = false;
  } catch (err) {
    els.itemSearch.placeholder = "Gagal memuat item";
    showMsg("Gagal memuat daftar item: " + err.message, "error");
  }
});

els.itemSearch.addEventListener("input", () => {
  els.itemSelectedIndex.value = "";
  resetItemFields();
  renderItemResults(els.itemSearch.value.trim().toLowerCase());
});

els.itemSearch.addEventListener("focus", () => {
  if (els.itemSearch.value.trim() !== "") {
    renderItemResults(els.itemSearch.value.trim().toLowerCase());
  }
});

document.addEventListener("click", (e) => {
  if (!els.itemResults.contains(e.target) && e.target !== els.itemSearch) {
    els.itemResults.hidden = true;
  }
});

function renderItemResults(query) {
  const filtered = query
    ? currentItems.filter((item) => {
        const haystack = `${item.Group || ""} ${item.Specification} ${item.Size || ""} ${item.Item_Code || ""}`.toLowerCase();
        return haystack.includes(query);
      })
    : currentItems;

  els.itemResults.innerHTML = "";

  if (filtered.length === 0) {
    els.itemResults.innerHTML = `<div class="combobox-empty">Item tidak ditemukan</div>`;
    els.itemResults.hidden = false;
    return;
  }

  filtered.slice(0, 50).forEach((item) => {
    const realIndex = currentItems.indexOf(item);
    const row = document.createElement("div");
    row.className = "combobox-item";
    row.innerHTML = `${item.Specification} <span class="code">${item.Group ? "· " + item.Group : ""}${item.Size ? " · " + item.Size : ""}${item.Item_Code ? " · " + item.Item_Code : ""}</span>`;
    row.addEventListener("click", () => selectItem(realIndex));
    els.itemResults.appendChild(row);
  });

  els.itemResults.hidden = false;
}

function selectItem(index) {
  const item = currentItems[index];
  if (!item) return;
  els.itemSelectedIndex.value = index;
  els.itemSearch.value = `${item.Group ? item.Group + " — " : ""}${item.Specification}${item.Size ? " (" + item.Size + ")" : ""}`;
  els.itemCode.value = item.Item_Code || item.ID || "";
  els.unit.value = item.Unit || "";
  els.itemResults.hidden = true;
}

function resetItemFields() {
  els.itemCode.value = "";
  els.unit.value = "";
}

// ==== SUBMIT FORM KE GITHUB REST API ====
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMsg("", "");

  const item = currentItems[els.itemSelectedIndex.value];
  if (!item) {
    showMsg("Pilih item dari daftar pencarian terlebih dahulu.", "error");
    return;
  }

  const user = getCurrentUser();
  const requestId = `REQ-${Date.now()}`;

  // Objek data request yang akan disimpan
  const payload = {
    id: requestId,
    dateRequest: new Date().toISOString().split("T")[0],
    projectId: els.projectId.value,
    woNo: els.woNo.value,
    itemId: item.ID || "",
    itemDescription: item.Specification || "",
    qty: Number(els.qty.value) || 0,
    unit: els.unit.value,
    duration: els.duration.value || "",
    durUnit: els.durationRow.hidden ? "" : els.durUnit.value,
    categoryId: item.CATAGORY_ID || "",
    itemCode: els.itemCode.value,
    itemGroup: els.itemGroup.value,
    purpose: els.purpose.value,
    refNo: els.refNo.value || "-",
    expectedDate: els.expectedDate.value,
    status: "Pending HO",
    requestBy: user.name,
    requestById: user.id,
    timestamp: new Date().toISOString()
  };

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Mengirim ke GitHub...";

  try {
    // Panggil fungsi simpan ke GitHub API
    await saveRequestToGithub(payload);

    showMsg(`Permintaan berhasil dikirim ke GitHub (ID #${requestId}).`, "success");
    els.form.reset();
    els.itemSearch.value = "";
    els.itemSearch.placeholder = "Pilih kelompok dulu";
    els.itemSearch.disabled = true;
    els.itemSelectedIndex.value = "";
    els.durationRow.hidden = true;
    resetItemFields();
  } catch (err) {
    showMsg("Gagal mengirim ke GitHub: " + err.message, "error");
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "Kirim permintaan";
  }
});

// ==== FUNGSI SIMPAN UNTUK GITHUB REST API ====
async function saveRequestToGithub(newRequestObj) {
  if (typeof GH_CONFIG === "undefined" || !GH_CONFIG.TOKEN) {
    throw new Error("Konfigurasi GH_CONFIG di config.js belum diatur dengan benar.");
  }

  const url = `https://api.github.com/repos/${GH_CONFIG.OWNER}/${GH_CONFIG.REPO}/contents/${GH_CONFIG.FILE_PATH}`;
  const headers = {
    "Authorization": `Bearer ${GH_CONFIG.TOKEN}`,
    "Content-Type": "application/json",
    "Accept": "application/vnd.github.v3+json"
  };

  let sha = "";
  let existingData = [];

  // 1. Baca data JSON yang ada di GitHub Repo
  const getRes = await fetch(url, { headers, cache: "no-store" });
  
  if (getRes.status === 200) {
    const fileInfo = await getRes.json();
    sha = fileInfo.sha;
    // Decode base64 UTF-8 aman
    const jsonString = decodeURIComponent(escape(atob(fileInfo.content.replace(/\n/g, ""))));
    existingData = JSON.parse(jsonString);
  } else if (getRes.status !== 404) {
    const errJson = await getRes.json();
    throw new Error(errJson.message || `Gagal membaca file GitHub (${getRes.status})`);
  }

  // 2. Tambahkan data request baru ke array
  existingData.push(newRequestObj);

  // 3. Encode data baru ke Base64 (UTF-8 safe)
  const updatedJsonStr = JSON.stringify(existingData, null, 2);
  const base64Content = btoa(unescape(encodeURIComponent(updatedJsonStr)));

  // 4. Update file JSON di GitHub via PUT
  const putRes = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `Feat: Material request ${newRequestObj.id} dikirim oleh ${newRequestObj.requestBy}`,
      content: base64Content,
      sha: sha || undefined
    })
  });

  if (!putRes.ok) {
    const errData = await putRes.json();
    throw new Error(errData.message || "Gagal memperbarui file di GitHub.");
  }
}

function showMsg(text, type) {
  els.formMsg.textContent = text;
  els.formMsg.className = "form-msg" + (type ? " " + type : "");
}

// ==== init ====
(function init() {
  const user = getCurrentUser();
  if (els.requestByLabel) {
    els.requestByLabel.textContent = user.name;
  }
})();
