/**
 * Apps Script - Sheet Karyawan (deployment TERPISAH, khusus SMMS-BIMA login)
 * PENTING: jangan dicampur dengan Code.gs yang sudah dipakai Fusion4.
 * Buat Script project baru (Extensions > Apps Script, atau tambah file .gs baru
 * lalu deploy sebagai Web App terpisah / "New deployment").
 *
 * Deploy sebagai Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Endpoint (GET):
 *   {URL}?sheet=PasswordTbl
 *   {URL}?sheet=KaryawanTbl
 *
 * Hanya expose kolom yang perlu untuk login (tidak expose NoKTP, dsb dari KaryawanTbl
 * ke publik lewat endpoint terpisah jika perlu — lihat catatan di sheetToJsonSafe).
 */

function doGet(e) {
  var sheetName = e.parameter.sheet;
  if (!sheetName) return jsonResponse({ error: "Parameter 'sheet' wajib diisi" });

  var allowed = ["PasswordTbl", "KaryawanTbl"];
  if (allowed.indexOf(sheetName) === -1) {
    return jsonResponse({ error: "Sheet tidak diizinkan diakses lewat endpoint ini" });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return jsonResponse({ error: "Sheet '" + sheetName + "' tidak ditemukan" });

  var data = sheetName === "KaryawanTbl" ? sheetToJsonSafe(sheet) : sheetToJson(sheet);
  return jsonResponse(data);
}

// Untuk KaryawanTbl, buang kolom sensitif (NoKTP, TanggalKTPTerbit) dari response publik
function sheetToJsonSafe(sheet) {
  var HIDE_COLUMNS = ["NoKTP", "TanggalKTPTerbit"];
  var rows = sheetToJson(sheet);
  return rows.map(function (row) {
    HIDE_COLUMNS.forEach(function (col) { delete row[col]; });
    return row;
  });
}

function sheetToJson(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = values.slice(1);
  return rows
    .filter(function (row) { return row.join("") !== ""; })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (header, i) {
        var val = row[i];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        obj[header] = val;
      });
      return obj;
    });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
