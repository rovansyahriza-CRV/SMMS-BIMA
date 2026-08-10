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

// ==== Smart Gate integration placeholder ====
// TODO: ganti dengan pemanggilan API Smart Gate yang sesungguhnya
function getCurrentUser() {
  return { id: "dummy_user", name: "Dummy User" };
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

// ==== submit ====
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMsg("", "");

  const item = currentItems[els.itemSelectedIndex.value];
  if (!item) {
    showMsg("Pilih item dari daftar pencarian terlebih dahulu.", "error");
    return;
  }

  const user = getCurrentUser();
  const payload = {
    target: "Request",
    data: {
      DATE_REQUEST: new Date().toISOString().split("T")[0],
      PROJECTID: els.projectId.value,
      WO_NO: els.woNo.value,
      ItemID: item.ID,
      ItemDescription: item.Specification,
      QTY: els.qty.value,
      UNIT: els.unit.value,
      DURATION: els.duration.value || "",
      DurUnit: els.durationRow.hidden ? "" : els.durUnit.value,
      CATAGORY_ID: item.CATAGORY_ID || "",
      Item_Code: els.itemCode.value,
      ItemGroup: els.itemGroup.value,
      Purpose: els.purpose.value,
      RefNo: els.refNo.value,
      ExpectedDate: els.expectedDate.value,
      Status: "Pending",
      RequestBy: user.id,
    },
  };

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Mengirim...";

  try {
    const res = await fetch(TRANSAKSI_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    if (result.success) {
      showMsg(`Permintaan berhasil dikirim (ID #${result.id}).`, "success");
      els.form.reset();
      els.itemSearch.value = "";
      els.itemSearch.placeholder = "Pilih kelompok dulu";
      els.itemSearch.disabled = true;
      els.itemSelectedIndex.value = "";
      els.durationRow.hidden = true;
      resetItemFields();
    } else {
      showMsg("Gagal mengirim: " + (result.error || "tidak diketahui"), "error");
    }
  } catch (err) {
    showMsg("Gagal mengirim: " + err.message, "error");
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "Kirim permintaan";
  }
});

function showMsg(text, type) {
  els.formMsg.textContent = text;
  els.formMsg.className = "form-msg" + (type ? " " + type : "");
}

// ==== init ====
(function init() {
  const user = getCurrentUser();
  els.requestByLabel.textContent = user.name;
})();
