// ==== Supabase client (dibuat di config.js sebagai supabaseClient) ====

// ==== state ====
let rowIdCounter = 0;
const resourceCache = {}; // cache in-memory per group, dipakai semua baris

const els = {
  projectId: document.getElementById("projectId"),
  woNo: document.getElementById("woNo"),
  purpose: document.getElementById("purpose"),
  expectedDate: document.getElementById("expectedDate"),
  itemRowsBody: document.getElementById("itemRowsBody"),
  btnAddItem: document.getElementById("btnAddItem"),
  form: document.getElementById("requestForm"),
  submitBtn: document.getElementById("submitBtn"),
  formMsg: document.getElementById("formMsg"),
  requestByLabel: document.getElementById("requestByLabel"),
};

// ==== auth guard ====
const currentSession = requireAuth("Request");

// Kode "GROUP-ID" buat identifikasi item di report PDF (sama persis pola yang dipakai di
// end-user-receiving.html / monitoring.html).
function groupPrefix(group) {
  if (!group) return 'ITEM';
  const known = {
    consumables: 'CONS', consumable: 'CONS',
    material: 'MAT', materials: 'MAT',
    tools: 'TOOL', tool: 'TOOL',
    heavyequipment: 'HE',
    serviceorder: 'SO'
  };
  const key = String(group).toLowerCase().replace(/\s+/g, '');
  if (known[key]) return known[key];
  const letters = String(group).replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
  return letters || 'ITEM';
}
function itemCode(m) {
  return m.ItemID != null ? `${groupPrefix(m.ItemGroup)}-${m.ItemID}` : null;
}

function getCurrentUser() {
  return {
    id: currentSession ? currentSession.id : "",
    name: currentSession ? currentSession.nama : "—",
    qrCodeId: currentSession ? currentSession.qrCodeId : "",
  };
}

// ==== Project ID otomatis dari PIC (pola "Request <projectId>", cth "Request 101") ====
// - 1 project cocok  -> field dikunci (readonly), gak perlu diketik manual lagi
// - >1 project cocok -> jadi dropdown pilihan, gak bisa ketik bebas
// - gak ada tag project-scoped sama sekali (cuma tag polos "Request", biasa dipakai HO)
//   -> tetap free text seperti sebelumnya, gak dibatasi
function setupProjectIdField() {
  const wrap = document.getElementById("projectIdWrap");
  const pic = currentSession ? currentSession.pic : "";
  const allowed = getAuthorizedProjects(pic, "Request");

  if (Array.isArray(allowed) && allowed.length === 1) {
    wrap.innerHTML = `<input type="text" id="projectId" value="${allowed[0]}" readonly>`;
  } else if (Array.isArray(allowed) && allowed.length > 1) {
    const options = allowed.map((p) => `<option value="${p}">${p}</option>`).join("");
    wrap.innerHTML = `<select id="projectId" required>${options}</select>`;
  }
  // else: null (akses semua project) atau [] -> biarkan input free-text bawaan HTML, gak diubah

  els.projectId = document.getElementById("projectId");
}

// ==== load resources (cache di memori + sessionStorage, dipakai lintas baris) ====
async function loadResourceItems(group) {
  if (resourceCache[group]) return resourceCache[group];

  const cacheKey = `resources_${group}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    resourceCache[group] = parsed;
    return parsed;
  }

  const res = await fetch(`${RESOURCES_URL}?sheet=${encodeURIComponent(group)}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);

  sessionStorage.setItem(cacheKey, JSON.stringify(data));
  resourceCache[group] = data;
  return data;
}

// ==== template 1 baris item ====
function buildItemRowHTML() {
  return `
    <div class="item-row">
      <div class="item-row-head">
        <span class="item-row-title">Item</span>
        <button type="button" class="btn-remove-row" aria-label="Hapus item ini" title="Hapus item ini">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Kelompok item</label>
          <select class="row-group">
            <option value="" disabled selected>Pilih kelompok</option>
            <option value="Material">Material</option>
            <option value="Consumables">Consumables</option>
            <option value="Tools">Tools</option>
            <option value="HeavyEquipment">Heavy equipment</option>
            <option value="ServiceOrder">Service</option>
          </select>
        </div>
        <div class="field">
          <label>Item</label>
          <div class="combobox">
            <input type="text" class="row-search" placeholder="Pilih kelompok dulu" disabled autocomplete="off">
            <input type="hidden" class="row-selected-index" value="">
            <div class="combobox-list row-results" hidden></div>
          </div>
        </div>
      </div>

      <div class="field-row three">
        <div class="field">
          <label>Item code</label>
          <input type="text" class="row-code" readonly placeholder="—">
        </div>
        <div class="field">
          <label>Satuan</label>
          <input type="text" class="row-unit" readonly placeholder="—">
        </div>
        <div class="field">
          <label>Jumlah</label>
          <input type="number" class="row-qty" min="1" step="1" placeholder="0">
        </div>
      </div>

      <div class="field-row two row-duration-row" hidden>
        <div class="field">
          <label>Durasi sewa</label>
          <input type="number" class="row-duration" min="1" step="1" placeholder="0">
        </div>
        <div class="field">
          <label>Satuan durasi</label>
          <select class="row-durunit">
            <option value="Hari">Hari</option>
            <option value="Minggu">Minggu</option>
            <option value="Bulan">Bulan</option>
          </select>
        </div>
      </div>
    </div>`;
}

function resetRowItemFields(rowEl) {
  rowEl.querySelector(".row-code").value = "";
  rowEl.querySelector(".row-unit").value = "";
}

function wireItemRow(rowEl) {
  rowEl._items = [];

  const groupEl = rowEl.querySelector(".row-group");
  const searchEl = rowEl.querySelector(".row-search");
  const selIndexEl = rowEl.querySelector(".row-selected-index");
  const resultsEl = rowEl.querySelector(".row-results");
  const durationRowEl = rowEl.querySelector(".row-duration-row");

  groupEl.addEventListener("change", async () => {
    const group = groupEl.value;
    selIndexEl.value = "";
    resetRowItemFields(rowEl);
    searchEl.value = "";
    searchEl.disabled = true;
    searchEl.placeholder = "Memuat item...";
    resultsEl.hidden = true;
    durationRowEl.hidden = !RENTAL_GROUPS.includes(group);

    try {
      rowEl._items = await loadResourceItems(group);
      searchEl.placeholder = `Ketik untuk cari (${rowEl._items.length} item)`;
      searchEl.disabled = false;
    } catch (err) {
      searchEl.placeholder = "Gagal memuat item";
      showMsg("Gagal memuat daftar item: " + err.message, "error");
    }
  });

  searchEl.addEventListener("input", () => {
    selIndexEl.value = "";
    resetRowItemFields(rowEl);
    renderRowResults(rowEl, searchEl.value.trim().toLowerCase());
  });

  searchEl.addEventListener("focus", () => {
    if (searchEl.value.trim() !== "") {
      renderRowResults(rowEl, searchEl.value.trim().toLowerCase());
    }
  });

  rowEl.querySelector(".btn-remove-row").addEventListener("click", () => removeRequestRow(rowEl));
}

function renderRowResults(rowEl, query) {
  const items = rowEl._items || [];
  const resultsEl = rowEl.querySelector(".row-results");

  const filtered = query
    ? items.filter((item) => {
        const haystack = `${item.Group || ""} ${item.Specification} ${item.Size || ""} ${item.Item_Code || ""}`.toLowerCase();
        return haystack.includes(query);
      })
    : items;

  resultsEl.innerHTML = "";

  if (filtered.length === 0) {
    resultsEl.innerHTML = `<div class="combobox-empty">Item tidak ditemukan</div>`;
    resultsEl.hidden = false;
    return;
  }

  filtered.slice(0, 50).forEach((item) => {
    const realIndex = items.indexOf(item);
    const row = document.createElement("div");
    row.className = "combobox-item";
    row.innerHTML = `${item.Specification} <span class="code">${item.Group ? "· " + item.Group : ""}${item.Size ? " · " + item.Size : ""}${item.Item_Code ? " · " + item.Item_Code : ""}</span>`;
    row.addEventListener("click", () => selectRowItem(rowEl, realIndex));
    resultsEl.appendChild(row);
  });

  resultsEl.hidden = false;
}

function selectRowItem(rowEl, index) {
  const items = rowEl._items || [];
  const item = items[index];
  if (!item) return;
  rowEl.querySelector(".row-selected-index").value = index;
  rowEl.querySelector(".row-search").value = `${item.Group ? item.Group + " — " : ""}${item.Specification}${item.Size ? " (" + item.Size + ")" : ""}`;
  rowEl.querySelector(".row-code").value = item.Item_Code || "";
  rowEl.querySelector(".row-unit").value = item.Unit || "";
  rowEl.querySelector(".row-results").hidden = true;
}

// tutup daftar hasil pencarian kalau klik di luar combobox baris manapun
document.addEventListener("click", (e) => {
  document.querySelectorAll(".item-row").forEach((rowEl) => {
    const combo = rowEl.querySelector(".combobox");
    if (combo && !combo.contains(e.target)) {
      rowEl.querySelector(".row-results").hidden = true;
    }
  });
});

// ==== tambah / hapus baris ====
function addRequestRow() {
  rowIdCounter += 1;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildItemRowHTML();
  const rowEl = wrapper.firstElementChild;
  rowEl.dataset.rowId = rowIdCounter;
  els.itemRowsBody.appendChild(rowEl);
  wireItemRow(rowEl);
  renumberRows();
}

function removeRequestRow(rowEl) {
  const rows = els.itemRowsBody.querySelectorAll(".item-row");

  if (rows.length <= 1) {
    // minimal 1 baris harus tetap ada — kosongkan isinya saja
    rowEl.querySelector(".row-group").value = "";
    const searchEl = rowEl.querySelector(".row-search");
    searchEl.value = "";
    searchEl.disabled = true;
    searchEl.placeholder = "Pilih kelompok dulu";
    rowEl.querySelector(".row-selected-index").value = "";
    resetRowItemFields(rowEl);
    rowEl.querySelector(".row-qty").value = "";
    rowEl.querySelector(".row-duration-row").hidden = true;
    rowEl.querySelector(".row-duration").value = "";
    rowEl._items = [];
    return;
  }

  rowEl.remove();
  renumberRows();
}

function renumberRows() {
  const rows = els.itemRowsBody.querySelectorAll(".item-row");
  rows.forEach((rowEl, idx) => {
    rowEl.querySelector(".item-row-title").textContent = `Item #${idx + 1}`;
  });
}

els.btnAddItem.addEventListener("click", addRequestRow);

// ==== SUBMIT FORM (batch, bisa banyak item sekaligus) ke Supabase ====
// Mekanisme ini disamakan dengan Create Request di desktop app:
// 1. Generate No. Referensi otomatis lewat RPC generate_refno()
// 2. Insert 1 baris ke tabel "request_approval" (RefNo, ProjectID, CurrentLevel: 'Review')
// 3. Insert semua item ke tabel "request" (satu baris per item, Status: 'Menunggu Review')
// Data umum (Project ID/WO/Purpose/Tanggal) sama untuk semua item dalam 1 pengiriman.
els.form.addEventListener("submit", handleBatchSubmitRequest);

async function handleBatchSubmitRequest(e) {
  e.preventDefault();
  showMsg("", "");

  const projectIdNum = Number(els.projectId.value);
  if (!els.projectId.value || Number.isNaN(projectIdNum)) {
    showMsg("Project ID harus berupa angka.", "error");
    return;
  }
  if (!els.woNo.value.trim()) {
    showMsg("Nomor WO wajib diisi.", "error");
    return;
  }
  if (!els.purpose.value.trim()) {
    showMsg("Keperluan wajib diisi.", "error");
    return;
  }
  if (!els.expectedDate.value) {
    showMsg("Tanggal dibutuhkan wajib diisi.", "error");
    return;
  }

  const rowEls = Array.from(els.itemRowsBody.querySelectorAll(".item-row"));
  if (rowEls.length === 0) {
    showMsg("Tambahkan minimal 1 item barang.", "error");
    return;
  }

  const itemsData = [];
  for (let i = 0; i < rowEls.length; i++) {
    const rowEl = rowEls[i];
    const items = rowEl._items || [];
    const selIndex = rowEl.querySelector(".row-selected-index").value;
    const item = items[selIndex];
    const qty = Number(rowEl.querySelector(".row-qty").value);
    const group = rowEl.querySelector(".row-group").value;

    if (!group) {
      showMsg(`Item #${i + 1}: pilih kelompok item terlebih dahulu.`, "error");
      return;
    }
    if (!item) {
      showMsg(`Item #${i + 1}: pilih item dari daftar pencarian terlebih dahulu.`, "error");
      return;
    }
    if (!qty || qty <= 0) {
      showMsg(`Item #${i + 1}: jumlah harus diisi dan lebih dari 0.`, "error");
      return;
    }

    const isRental = RENTAL_GROUPS.includes(group);
    itemsData.push({
      ItemID: item.ID ? Number(item.ID) : null,
      ItemDescription: item.Specification || "",
      QTY: qty,
      UNIT: rowEl.querySelector(".row-unit").value,
      Duration: isRental ? (Number(rowEl.querySelector(".row-duration").value) || null) : null,
      DurUnit: isRental ? rowEl.querySelector(".row-durunit").value : null,
      CATAGORY_ID: item.CATAGORY_ID ? Number(item.CATAGORY_ID) : null,
      Item_Code: rowEl.querySelector(".row-code").value ? Number(rowEl.querySelector(".row-code").value) : null,
      ItemGroup: group,
    });
  }

  const user = getCurrentUser();
  const today = new Date().toISOString().split("T")[0];
  const headerData = {
    projectId: projectIdNum,
    woNo: els.woNo.value,
    purpose: els.purpose.value,
    expectedDate: els.expectedDate.value,
  };

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Mengirim semua item...";

  try {
    const { data: generatedRefNo, error: refError } = await supabaseClient.rpc("generate_refno");
    if (refError) throw refError;

    const { error: approvalError } = await supabaseClient.from("request_approval").insert({
      RefNo: generatedRefNo,
      ProjectID: headerData.projectId,
      CurrentLevel: "Review",
    });
    if (approvalError) throw approvalError;

    const payloadToInsert = itemsData.map((it) => ({
      DATE_REQUEST: today,
      PROJECTID: headerData.projectId,
      WO_NO: headerData.woNo,
      ItemID: it.ItemID,
      ItemDescription: it.ItemDescription,
      QTY: it.QTY,
      UNIT: it.UNIT,
      Duration: it.Duration,
      DurUnit: it.DurUnit,
      CATAGORY_ID: it.CATAGORY_ID,
      Item_Code: it.Item_Code,
      ItemGroup: it.ItemGroup,
      Purpose: headerData.purpose,
      RefNo: generatedRefNo,
      ExpectedDate: headerData.expectedDate,
      Status: "Menunggu Review",
      RequestBy: user.name,
    }));

    const { error } = await supabaseClient.from("request").insert(payloadToInsert);
    if (error) throw error;

    showMsg(`Berhasil! ${payloadToInsert.length} item terkirim dengan No. Referensi ${generatedRefNo}.`, "success");

    // Generate & upload report PDF -- dibungkus try/catch sendiri: kalau ini gagal, request-nya
    // TETAP TERKIRIM (udah di-insert di atas), cuma reportnya aja yang gak kebuat. Ini versi
    // "bukti pengajuan" -- begitu di-approve di alur approval, reportnya BELUM otomatis
    // diperbarui (approval terjadi di desktop app, di luar jangkauan halaman ini).
    try {
      els.submitBtn.textContent = "Membuat report PDF...";
      const pdfDoc = await generateRequestReportPdf({
        refNo: generatedRefNo,
        woNo: headerData.woNo,
        projectId: headerData.projectId,
        tanggalRequest: new Date(today).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
        diajukanOleh: user.name,
        diajukanOlehSub: "",
        diajukanOlehQr: `QrCodeID=${user.qrCodeId}|NoTransaksi=${generatedRefNo}`,
        status: "Menunggu Review",
        keperluan: headerData.purpose,
        items: itemsData.map((it) => ({ kode: itemCode(it) || (it.ItemGroup || ""), desk: it.ItemDescription, qty: it.QTY, unit: it.UNIT })),
        approvalHistory: [{ tanggal: new Date().toLocaleString("id-ID"), oleh: user.name, keterangan: "Request diajukan" }],
        disetujuiOleh: null,
      });
      const pdfBlob = reportPdfToBlob(pdfDoc);
      const uploadedPdf = await uploadReportPdfToDrive(pdfBlob, `REQ_${generatedRefNo.replace(/\//g, "-")}.pdf`);
      await supabaseClient.from("request").update({ ReportURL: uploadedPdf.directUrl, ReportFileID: uploadedPdf.fileId }).eq("RefNo", generatedRefNo);
      showMsg(`Berhasil! ${payloadToInsert.length} item terkirim dengan No. Referensi ${generatedRefNo}. Report PDF juga sudah dibuat.`, "success");
    } catch (reportErr) {
      console.warn("Gagal membuat/upload report PDF:", reportErr);
    }

    els.form.reset();
    els.itemRowsBody.innerHTML = "";
    rowIdCounter = 0;
    addRequestRow();
  } catch (err) {
    showMsg("Gagal mengirim permintaan: " + err.message, "error");
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "Kirim Semua Item Request";
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
  setupProjectIdField();
  addRequestRow();
})();
