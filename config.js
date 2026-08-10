// URL Web App Apps Script — SMMS-BIMA
const RESOURCES_URL = "https://script.google.com/macros/s/AKfycbzHvD3cz2Ur3WGkf_b-yIC6qNRajqZC9mx5ZmcQzr1-28vx_7EJO12Paez5VZFQt3IO/exec";
const TRANSAKSI_URL = "https://script.google.com/macros/s/AKfycbziA0AWUvyt8f6VGyy4mWM_nsv7RP2xjfrK4vVzPR3_65Qdiu8_NPn8KZyYuPQ6USRW/exec";
const KARYAWAN_URL = "https://script.google.com/macros/s/AKfycbxDIDJ5COlR2GOCcmJdN0_j303qxCpk_mKUFzzOytgzmgPsV244_vWgS-XUaYxmSJ_CTg/exec";

// Grup yang butuh input durasi sewa (bukan konsumsi habis pakai)
const RENTAL_GROUPS = ["Tools", "HeavyEquipment"];

// Nama menu -> Author yang wajib dimiliki user (dicek dari PasswordTbl.Author, comma-separated)
const MENU_AUTH = {
  Request: "Request",
  Received: "Receive",
  Distribusi: "Distribusi",
};
