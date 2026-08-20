// =====================================================================================
// approval-selection.html — logic
//
// CATATAN PENTING (baca dulu sebelum pakai):
//
// 1. Field RFQID: primary key RFQTbl DIKONFIRMASI bernama "RFQID" (dari screenshot
//    datasheet RFQTbl). FIELD_MAP.rfq.id di bawah sudah benar, tidak perlu diubah.
//
// 2. Query qrySelectionResultByVendor & qrySelectionSummaryByVendor versi ASLI difilter
//    pakai [Forms]![frmVendorSelection]![RFQID] -- itu cuma bisa nunjukin SATU RFQ yang
//    lagi kebuka di form itu, dan qrySelectionSummaryByVendor versi asli belum ada kolom
//    RFQID di SELECT-nya. Supaya semua RFQ yang "Menunggu Approval" bisa nongol sekaligus
//    di sheet (dan halaman ini bisa filter per RFQ di sisi client), KEDUA QUERY PERLU
//    DIUBAH dulu di Access -- lihat file "Access-Query-Fixes.sql" yang saya kirim
//    bersamaan dengan file ini. Tanpa perubahan itu, sheet cuma akan berisi 1 RFQ setiap
//    kali di-push (ke-overwrite RFQ lain yang masih pending).
//
// 3. "Terms of Payment": DIKONFIRMASI dari skema RFQVendorTermTbl -- gabungan field
//    PaymentTermType & DPPercentage (cth. "Partial" + 20 -> "Partial (DP 20%)"). Sudah
//    ditambahkan ke qrySelectionSummaryByVendor versi REVISED di "Access-Query-Fixes.sql"
//    sebagai kolom TermsOfPayment, dan FIELD_MAP.summary.termsOfPayment di bawah sudah
//    otomatis mengambilnya.
//
// 4. PENTING (v2): qrySelectionResultByVendor & qrySelectionSummaryByVendor versi
//    REVISED v2 sekarang kirim angka uang MENTAH (bukan teks "Rp #,##0" lagi) --
//    sebelumnya teks itu di-auto-parse SALAH sama Google Sheets ("Rp 45,000" jadi
//    "Rp45,00" karena Sheets baca koma sebagai desimal). Semua formatting Rupiah
//    sekarang dilakukan di sini (formatRupiah), bukan di Access lagi.
// =====================================================================================

const FIELD_MAP = {
  rfq: {
    id: "RFQID",       // PK RFQTbl -- SESUAIKAN kalau beda
    status: "Status",
    pendingValue: "Menunggu Approval",
    // Kandidat kolom label buat ditampilkan di dropdown, dicoba urut sampai ketemu yang ada isinya
    // "NoRFQ" dikonfirmasi dari datasheet RFQTbl (cth. "RFQ-202608-0019")
    labelCandidates: ["NoRFQ", "RFQNo", "RFQNumber", "WO_NO", "ProjectID"],
    dateField: "RFQDate", // dikonfirmasi dari datasheet RFQTbl, dipakai buat perjelas label dropdown
  },
  result: {
    // qrySelectionResultByVendor (flat, item-level)
    rfqId: "RFQID",
    vendorId: "VendorID",
    vendorName: "VendorName",
    itemDescription: "ItemDescription",
    totalPrice: "TotalPrice", // angka mentah (BUKAN string lagi, lihat catatan #4 di atas)
    qty: "Qty", // qty yang DITAWARKAN vendor -- bisa lebih kecil dari qty yang diminta di RFQ
  },
  summary: {
    // qrySelectionSummaryByVendor (per-vendor) -- rfqId WAJIB ditambah dulu ke query, lihat catatan #2 di atas
    rfqId: "RFQID",
    vendorId: "VendorID",
    vendorName: "VendorName",
    itemsSubtotal: "ItemsSubtotal",       // pre-formatted "Rp #,##0"
    mobilisasi: "MobilisasiAwarded",      // pre-formatted "Rp #,##0"
    otherService: "OtherServiceAwarded",  // pre-formatted "Rp #,##0"
    ppn: "PPNAwarded",                    // pre-formatted "Rp #,##0"
    termsOfPayment: "TermsOfPayment",     // opsional, lihat catatan #3 di atas
    isOverallWinner: "PemenangKeseluruhan", // "Ya" / "Tidak"
  },
  rfqVendor: {
    // RFQVendorTbl (mentah) -- field-field ini SUDAH PASTI, dari catatan sesi sebelumnya
    rfqId: "RFQID",
    vendorId: "VendorID",
    managementApproval: "ManagementApproval",
  },
};

const els = {
  rfqSelect: document.getElementById("rfqSelect"),
  loadingNote: document.getElementById("loadingNote"),
  emptyState: document.getElementById("emptyState"),
  crosstabWrap: document.getElementById("crosstabWrap"),
  crosstabTable: document.getElementById("crosstabTable"),
  approverLabel: document.getElementById("approverLabel"),
};

const session = requireAuth("Approval");

let allRfq = [];
let allResult = [];
let allSummary = [];
let allRfqVendor = [];

function parseRupiah(str) {
  if (str === undefined || str === null || str === "") return 0;
  const digits = String(str).replace(/[^0-9-]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}
function formatRupiah(num) {
  return "Rp " + Math.round(num).toLocaleString("id-ID");
}

async function fetchSheet(url, sheetName) {
  const cacheBust = ""; // tidak dicache di sessionStorage -- data approval harus selalu fresh
  const res = await fetch(`${url}?sheet=${encodeURIComponent(sheetName)}`);
  const json = await res.json();
  if (json && json.error) throw new Error(json.error);
  // doGet mengembalikan array langsung (bukan {success,data}), tapi jaga-jaga kalau berubah format
  return Array.isArray(json) ? json : (json.data || []);
}

function rfqLabel(row) {
  const f = FIELD_MAP.rfq;
  let base = `RFQ #${row[f.id]}`;
  for (const cand of f.labelCandidates) {
    if (row[cand] !== undefined && row[cand] !== "") {
      base = String(row[cand]);
      break;
    }
  }
  if (f.dateField && row[f.dateField]) {
    base += ` — ${row[f.dateField]}`;
  }
  return base;
}

async function init() {
  els.approverLabel.textContent = session.nama;
  els.loadingNote.hidden = false;
  try {
    allRfq = await fetchSheet(TRANSAKSI_URL, "RFQTbl");
  } catch (err) {
    els.loadingNote.textContent = "Gagal memuat daftar RFQ: " + err.message;
    return;
  }

  const f = FIELD_MAP.rfq;
  const pending = allRfq.filter((r) => String(r[f.status]).trim() === f.pendingValue);

  els.loadingNote.hidden = true;

  if (pending.length === 0) {
    els.rfqSelect.innerHTML = `<option value="">(kosong)</option>`;
    els.emptyState.hidden = false;
    return;
  }

  els.rfqSelect.innerHTML = `<option value="" disabled selected>Pilih RFQ...</option>` +
    pending.map((r) => `<option value="${r[f.id]}">${rfqLabel(r)}</option>`).join("");
  els.rfqSelect.disabled = false;

  els.rfqSelect.addEventListener("change", () => loadRfqDetail(els.rfqSelect.value));
}

async function loadRfqDetail(rfqId) {
  if (!rfqId) return;
  els.crosstabWrap.hidden = true;
  els.emptyState.hidden = true;
  els.loadingNote.hidden = false;
  els.loadingNote.textContent = "Memuat ringkasan vendor...";

  try {
    const [resultRaw, summaryRaw, rfqVendorRaw] = await Promise.all([
      fetchSheet(TRANSAKSI_URL, "qrySelectionResultByVendor"),
      fetchSheet(TRANSAKSI_URL, "qrySelectionSummaryByVendor"),
      fetchSheet(TRANSAKSI_URL, "RFQVendorTbl"),
    ]);
    allResult = resultRaw;
    allSummary = summaryRaw;
    allRfqVendor = rfqVendorRaw;
  } catch (err) {
    els.loadingNote.textContent = "Gagal memuat data vendor: " + err.message;
    return;
  }

  els.loadingNote.hidden = true;
  renderCrosstab(rfqId);
}

function renderCrosstab(rfqId) {
  const rf = FIELD_MAP.result;
  const sf = FIELD_MAP.summary;
  const rvf = FIELD_MAP.rfqVendor;

  const resultRows = allResult.filter((r) => String(r[rf.rfqId]) === String(rfqId));
  const summaryRows = allSummary.filter((r) => String(r[sf.rfqId]) === String(rfqId));

  if (summaryRows.length === 0) {
    els.crosstabWrap.hidden = true;
    els.emptyState.textContent = "Belum ada data ringkasan vendor untuk RFQ ini di Sheet. Pastikan qrySelectionSummaryByVendor sudah di-push (lihat catatan di approvalSelection.js).";
    els.emptyState.hidden = false;
    return;
  }
  els.emptyState.hidden = true;

  // Daftar vendor (kolom), urutkan pemenang keseluruhan duluan lalu nama
  const vendors = summaryRows
    .map((s) => ({
      vendorId: s[sf.vendorId],
      vendorName: s[sf.vendorName],
      itemsSubtotal: parseRupiah(s[sf.itemsSubtotal]),
      mobilisasi: parseRupiah(s[sf.mobilisasi]),
      otherService: parseRupiah(s[sf.otherService]),
      ppn: parseRupiah(s[sf.ppn]),
      termsOfPayment: s[sf.termsOfPayment] || "",
      isOverallWinner: String(s[sf.isOverallWinner]).trim().toLowerCase() === "ya",
    }))
    .sort((a, b) => (b.isOverallWinner - a.isOverallWinner) || a.vendorName.localeCompare(b.vendorName));

  // Baris item, urut sesuai kemunculan pertama di data
  const itemLabels = [];
  resultRows.forEach((r) => {
    const label = r[rf.itemDescription];
    if (label && !itemLabels.includes(label)) itemLabels.push(label);
  });

  const hasTerms = vendors.some((v) => v.termsOfPayment);

  let html = "<thead>";
  html += `<tr class="action-row"><th class="row-label-head"></th>${vendors.map((v) => `<th><div class="vendor-actions" id="actions-${cssSafe(v.vendorId)}"></div></th>`).join("")}</tr>`;
  html += `<tr class="vendor-head"><th class="row-label-head">Nama Vendor</th>${vendors.map((v) => `<th>${v.vendorName}${v.isOverallWinner ? " ★" : ""}</th>`).join("")}</tr>`;
  html += "</thead><tbody>";

  itemLabels.forEach((label) => {
    html += `<tr><td class="row-label">${label}</td>`;
    vendors.forEach((v) => {
      const match = resultRows.find((r) => String(r[rf.vendorId]) === String(v.vendorId) && r[rf.itemDescription] === label);
      if (match) {
        const qtyNote = (match[rf.qty] !== undefined && match[rf.qty] !== "")
          ? `<br><span style="font-weight:400;color:var(--ink-soft);font-size:11.5px;">Qty ${match[rf.qty]}</span>`
          : "";
        html += `<td class="cell-value">${formatRupiah(parseRupiah(match[rf.totalPrice]))}${qtyNote}</td>`;
      } else {
        html += `<td class="cell-value">${formatRupiah(0)}</td>`;
      }
    });
    html += "</tr>";
  });

  html += `<tr><td class="row-label">Mobilisasi</td>${vendors.map((v) => `<td class="cell-value">${formatRupiah(v.mobilisasi)}</td>`).join("")}</tr>`;
  html += `<tr><td class="row-label">Other Service</td>${vendors.map((v) => `<td class="cell-value">${formatRupiah(v.otherService)}</td>`).join("")}</tr>`;
  if (hasTerms) {
    html += `<tr><td class="row-label">Terms of Payment</td>${vendors.map((v) => `<td class="cell-value">${v.termsOfPayment || "-"}</td>`).join("")}</tr>`;
  }
  html += `<tr><td class="row-label">PPN</td>${vendors.map((v) => `<td class="cell-value">${formatRupiah(v.ppn)}</td>`).join("")}</tr>`;

  html += `<tr class="total-row"><td class="row-label">TOTAL</td>${vendors.map((v) => {
    const total = v.itemsSubtotal + v.mobilisasi + v.otherService + v.ppn;
    return `<td class="cell-value">${formatRupiah(total)}</td>`;
  }).join("")}</tr>`;

  html += "</tbody>";
  els.crosstabTable.innerHTML = html;
  els.crosstabWrap.hidden = false;

  // Render tombol/status per vendor setelah tabel ke-mount
  vendors.forEach((v) => renderVendorActions(rfqId, v));
}

function cssSafe(val) {
  return String(val).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function renderVendorActions(rfqId, vendor) {
  const rvf = FIELD_MAP.rfqVendor;
  const container = document.getElementById(`actions-${cssSafe(vendor.vendorId)}`);
  if (!container) return;

  const existing = allRfqVendor.find(
    (r) => String(r[rvf.rfqId]) === String(rfqId) && String(r[rvf.vendorId]) === String(vendor.vendorId)
  );
  const currentStatus = existing ? String(existing[rvf.managementApproval] || "Pending").trim() : "Pending";

  paintVendorActions(container, currentStatus, () => submitApproval(rfqId, vendor, "Approved", container), () => submitApproval(rfqId, vendor, "Rejected", container));
}

function paintVendorActions(container, status, onApprove, onReject) {
  if (status === "Approved" || status === "Rejected") {
    const cls = status === "Approved" ? "status-approved" : "status-rejected";
    const label = status === "Approved" ? "Approved" : "Rejected";
    container.innerHTML = `<span class="status-pill ${cls}">${label}</span>`;
    return;
  }
  container.innerHTML = `<button class="btn-approve">Confirm</button><button class="btn-reject">Cancel</button>`;
  container.querySelector(".btn-approve").addEventListener("click", onApprove);
  container.querySelector(".btn-reject").addEventListener("click", onReject);
}

async function submitApproval(rfqId, vendor, decision, container) {
  const rvf = FIELD_MAP.rfqVendor;
  container.innerHTML = `<span class="status-pill status-pending">Mengirim...</span>`;

  const nowIso = new Date().toISOString();
  const payload = {
    action: "UPDATE_ROW",
    sheetName: "RFQVendorTbl",
    match: {
      [rvf.rfqId]: rfqId,
      [rvf.vendorId]: vendor.vendorId,
    },
    updates: {
      ManagementApproval: decision,
      ManagementApprovalDate: nowIso,
      ManagementApprovalBy: session.nama, // field ini nyimpen NAMA approver, sesuai catatan sesi lalu
    },
  };

  try {
    const res = await fetch(TRANSAKSI_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || "Gagal menyimpan.");

    // Update cache lokal supaya kalau RFQ yang sama dibuka lagi tanpa reload, statusnya konsisten
    const idx = allRfqVendor.findIndex(
      (r) => String(r[rvf.rfqId]) === String(rfqId) && String(r[rvf.vendorId]) === String(vendor.vendorId)
    );
    if (idx !== -1) allRfqVendor[idx][rvf.managementApproval] = decision;

    paintVendorActions(container, decision, null, null);
  } catch (err) {
    container.innerHTML = `<span class="status-pill status-rejected">Gagal: ${err.message}</span>`;
  }
}

init();
