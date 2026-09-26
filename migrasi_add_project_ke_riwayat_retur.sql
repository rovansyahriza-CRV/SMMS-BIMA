-- =====================================================================================
-- FITUR: Label "Project asal" (procurement) di tiap baris Riwayat Retur
-- Tanggal: 2026-09-26
-- =====================================================================================
-- Konteks: "Project" di Laporan Stok/filter monitoring.html = PROJECTID procurement dari
-- table request (siapa yang beli/order barangnya). "Project (Operational)" di form Serah
-- Terima/Kembalikan Barang (end-user-receiving.html) = operational.projects lewat
-- contracts -> work_orders (WO mana yang lagi jalan di lapangan) -- DUA REGISTRY BEDA yang
-- kebetulan sama-sama pakai angka kecil (14, 15, dst).
--
-- Karena barang bisa dibeli atas nama 1 project procurement tapi dipakai/dikembalikan
-- lewat WO operational project LAIN, op_list_material_returns() ditambah join sampai ke
-- request.PROJECTID + RefNo, biar di Riwayat Retur keliatan jelas stok itu balik ke
-- project procurement yang mana -- tanpa perlu bikin sistem transfer/pinjam antar-project
-- yang terpisah. Biaya aktual tetap ngikut yang ter-handover; retur cuma ngoreksi balik ke
-- ledger procurement asalnya.
-- =====================================================================================

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
    LEFT JOIN operational."work_orders" wo ON wo."id" = eur."woID"
    WHERE p_wo_id IS NULL OR eur."woID" = p_wo_id
  ) x;
$function$;
