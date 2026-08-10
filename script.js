// ==== state ====
let currentItems = [];

const els = {
  itemGroup: document.getElementById("itemGroup"),
  itemSelect: document.getElementById("itemSelect"),
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

  els.itemSelect.disabled = true;
  els.itemSelect.innerHTML = `<option value="" disabled selected>Memuat...</option>`;

  els.durationRow.hidden = !RENTAL_GROUPS.includes(group);

  try {
    currentItems = await loadResourceItems(group);
    els.itemSelect.innerHTML = `<option value="" disabled selected>Pilih item</option>`;
    currentItems.forEach((item, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${item.Group} — ${item.Specification} (${item.Size || "-"})`;
      els.itemSelect.appendChild(opt);
    });
    els.itemSelect.disabled = false;
  } catch (err) {
    els.itemSelect.innerHTML = `<option value="" disabled selected>Gagal memuat item</option>`;
    showMsg("Gagal memuat daftar item: " + err.message, "error");
  }
});

els.itemSelect.addEventListener("change", () => {
  const item = currentItems[els.itemSelect.value];
  if (!item) return;
  els.itemCode.value = item.Item_Code || item.ID || "";
  els.unit.value = item.Unit || "";
});

function resetItemFields() {
  els.itemCode.value = "";
  els.unit.value = "";
}

// ==== submit ====
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMsg("", "");

  const item = currentItems[els.itemSelect.value];
  if (!item) {
    showMsg("Pilih item terlebih dahulu.", "error");
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
      els.itemSelect.innerHTML = `<option value="" disabled selected>Pilih kelompok dulu</option>`;
      els.itemSelect.disabled = true;
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
