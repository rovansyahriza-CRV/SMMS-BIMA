-- =====================================================================================
-- FITUR: RPC buat Riwayat Retur di monitoring.html (tab baru "🔄 Riwayat Retur")
-- Tanggal: 2026-09-26
-- =====================================================================================
-- materialReturn cuma nyimpen ConfirmationID + QtyReturned mentah -- gak ada nama item,
-- No. WO, atau nama storeman langsung di tabelnya. RPC ini rakit semuanya lewat chain
-- materialReturn -> endUserReceiving -> siteReceiving -> delivery -> purchaseOrderDetail
-- (buat ItemDescription/Unit/DestinationSite) + karyawanTbl (nama storeman) + work_orders
-- di schema operational (No. WO / judul WO).
--
-- p_wo_id opsional: NULL = semua riwayat retur, atau isi UUID WO tertentu buat filter.
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
    'unit', x."Unit",
    'qtyReturned', x."QtyReturned",
    'returnedByName', x.returned_by_name,
    'returnDate', x."ReturnDate",
    'notes', x."Notes",
    'photoUrl', x."PhotoURL",
    'woNumber', x.wo_number,
    'woTitle', x.wo_title,
    'destinationSite', x."DestinationSite"
  ) ORDER BY x."ReturnDate" DESC), '[]')
  FROM (
    SELECT mr."ReturnID", mr."QtyReturned", mr."ReturnDate", mr."Notes", mr."PhotoURL",
      pod."ItemDescription", pod."Unit", dl."DestinationSite",
      kb."NamaPersonnel" AS returned_by_name,
      wo."number" AS wo_number, wo."title" AS wo_title
    FROM public."materialReturn" mr
    JOIN public."endUserReceiving" eur ON eur."ConfirmationID" = mr."ConfirmationID"
    JOIN public."siteReceiving" sr ON sr."ReceivingID" = eur."ReceivingID"
    JOIN public."delivery" dl ON dl."DeliveryID" = sr."DeliveryID"
    JOIN public."purchaseOrderDetail" pod ON pod."PODetailID" = dl."PODetailID"
    LEFT JOIN public."karyawanTbl" kb ON kb."Id" = mr."ReturnedBy"
    LEFT JOIN operational."work_orders" wo ON wo."id" = eur."woID"
    WHERE p_wo_id IS NULL OR eur."woID" = p_wo_id
  ) x;
$function$;
