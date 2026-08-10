# SMMS-BIMA — Material Request

Frontend Request untuk Smart Material Management System (SMMS), site BIMA.

## Alur

1. User pilih kelompok item (Material / Consumables / Tools / Heavy Equipment)
2. Dropdown item diisi dari Sheet **Resources** (read-only, di-push dari Access HO)
3. User isi jumlah, keperluan, tanggal dibutuhkan, dll
4. Submit -> data masuk ke Sheet **Transaksi** (tab `Request`)
5. Access di HO melakukan **pull** dari Sheet Transaksi untuk diproses lebih lanjut (RFQ -> Vendor Selection -> Purchase/Service Order)

## File

- `index.html` — form Request
- `style.css` — styling
- `config.js` — URL Apps Script (Resources & Transaksi)
- `script.js` — logic fetch item + submit request

## Setup

1. Deploy 2 Apps Script (`Code_Resources.gs` di Sheet Resources, `Code_Transaksi.gs` di Sheet Transaksi) sebagai Web App
2. Isi URL hasil deploy ke `config.js`
3. Aktifkan GitHub Pages di repo ini (Settings > Pages > Deploy from branch `main`)

## TODO

- Integrasi `getCurrentUser()` di `script.js` dengan Smart Gate (saat ini masih dummy)
- Field `Status` masih hardcode `"Pending"` saat submit
- Geolocation check sebelum submit (rencana, belum diimplementasi)
