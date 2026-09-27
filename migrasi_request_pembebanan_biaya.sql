-- ============================================================================
-- FITUR: Pembebanan biaya di Form Permintaan (Project + WO + Jenis Biaya + Fungsi)
-- Tanggal: 2026-09-27
-- ============================================================================
-- Titik krusial laporan biaya ada di sini: tiap request nyimpan SNAPSHOT pembebanannya,
-- biar rekap per project (margin), per fungsi (mis. HSE corporate) & per divisi akurat:
--  - WoID        : id WO Operational (operational.work_orders.id). WO_NO tetap diisi nomornya
--                  seperti sebelumnya (dipakai approval/monitoring/PDF).
--  - CostType    : DIRECT (WO scope client) / INDIRECT (WO-xxx-IND: PMT, site office, mob-demob)
--                  / OVERHEAD (Non-Project WO-9xx-XXX)
--  - CostFunction: fungsi/bidang biaya (daftar = karyawanTbl.Departemen, mis. HSE, QAC). Default
--                  departemen pemohon, boleh diganti; disimpan apa adanya saat request dibuat.
-- Kolom nullable: request lama (sebelum fitur ini) tetap valid tanpa isi.
ALTER TABLE public."request"
  ADD COLUMN IF NOT EXISTS "WoID" uuid,
  ADD COLUMN IF NOT EXISTS "CostType" text,
  ADD COLUMN IF NOT EXISTS "CostFunction" text;
ALTER TABLE public."request" DROP CONSTRAINT IF EXISTS request_costtype_check;
ALTER TABLE public."request" ADD CONSTRAINT request_costtype_check
  CHECK ("CostType" IS NULL OR "CostType" IN ('DIRECT','INDIRECT','OVERHEAD'));
CREATE INDEX IF NOT EXISTS request_woid_idx ON public."request"("WoID");
