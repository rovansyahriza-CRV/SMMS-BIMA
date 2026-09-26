-- =====================================================================================
-- FITUR: Validasi scan wajah/QR Petugas Gudang di alur Kembalikan Barang
-- Tanggal: 2026-09-26
-- =====================================================================================
-- Sebelumnya alur "Kembalikan Barang ke Gudang" cuma 1 pihak yang divalidasi scan
-- wajah/QR (storeman yang login di awal, tersimpan sebagai ReturnedBy). Beda sama alur
-- "Serah Terima Barang" yang 2 pihak (storeman + end user penerima).
--
-- Sekarang ditambah scan kedua: Petugas Gudang yang nerima balik barangnya di gudang --
-- storeman jadi "penyerah", Petugas Gudang jadi "penerima". Identitasnya divalidasi
-- lewat scan wajah/QR yang sama persis mekanismenya kayak scan penerima di Serah Terima
-- (finalizeVerification() di end-user-receiving.html, scanPurpose = "gudang").
--
-- 1. Kolom baru materialReturn.ReceivedBy -- FK ke karyawanTbl.Id, nyimpen siapa Petugas
--    Gudang yang nerima balik barangnya (terpisah dari ReturnedBy = storeman).
-- 2. op_list_material_returns() ditambah join kedua ke karyawanTbl (alias kg) buat
--    ambil nama Petugas Gudang, dipakai di tab "Riwayat Retur" (monitoring.html).
-- =====================================================================================

ALTER TABLE public."materialReturn" ADD COLUMN IF NOT EXISTS "ReceivedBy" bigint;

CREATE OR REPLACE FUNCTION public.op_list_material_returns(p_wo_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'returnId', x."ReturnID",
    'itemDescription', x."ItemDescription",
    'itemGroup', x."ItemGroup",
    'unit', x."Unit",
    'qtyReturned', x."QtyReturned",
    'returnedByName', x.returned_by_name,
    'receivedByName', x.received_by_name,
    'returnDate', x."ReturnDate",
    'notes', x."Notes",
    'photoUrl', x."PhotoURL",
    'woNumber', x.wo_number,
    'woTitle', x.wo_title,
    'destinationSite', x."DestinationSite",
    'projectId', x."PROJECTID",
    'refNo', x."RefNo"
  ) ORDER BY x."ReturnDate" DESC), '[]')
  FROM (
    SELECT mr."ReturnID", mr."QtyReturned", mr."ReturnDate", mr."Notes", mr."PhotoURL",
      pod."ItemDescription", pod."ItemGroup", pod."Unit", dl."DestinationSite",
      kb."NamaPersonnel" AS returned_by_name,
      kg."NamaPersonnel" AS received_by_name,
      wo."number" AS wo_number, wo."title" AS wo_title,
      req."PROJECTID", req."RefNo"
    FROM public."materialReturn" mr
    JOIN public."endUserReceiving" eur ON eur."ConfirmationID" = mr."ConfirmationID"
    JOIN public."siteReceiving" sr ON sr."ReceivingID" = eur."ReceivingID"
    JOIN public."delivery" dl ON dl."DeliveryID" = sr."DeliveryID"
    JOIN public."purchaseOrderDetail" pod ON pod."PODetailID" = dl."PODetailID"
    JOIN public."rfqDetail" rd ON rd."RFQDetailID" = pod."RFQDetailID"
    JOIN public."request" req ON req."ID" = rd."RequestID"
    LEFT JOIN public."karyawanTbl" kb ON kb."Id" = mr."ReturnedBy"
    LEFT JOIN public."karyawanTbl" kg ON kg."Id" = mr."ReceivedBy"
    LEFT JOIN operational."work_orders" wo ON wo."id" = eur."woID"
    WHERE p_wo_id IS NULL OR eur."woID" = p_wo_id
  ) x;
$function$;
