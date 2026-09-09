-- =====================================================================================
-- MIGRASI RPC SUPPORT END-USER RECEIVING (SMMS-BIMA)
-- =====================================================================================

-- 1. FUNCTION RPC: GENERATE NO TRANSAKSI EUR
DROP FUNCTION IF EXISTS generate_no_transaksi_eur();
CREATE OR REPLACE FUNCTION generate_no_transaksi_eur()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_date_str TEXT := TO_CHAR(NOW() AT TIME ZONE 'Asia/Makassar', 'YYYYMMDD');
    v_rand TEXT := LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
BEGIN
    RETURN 'BIMA/EUR/' || v_date_str || '-' || v_rand;
END;
$$;


-- 2. FUNCTION RPC: GET AUTHOR BY KARYAWAN ID
DROP FUNCTION IF EXISTS get_author_by_karyawan_id(BIGINT);
CREATE OR REPLACE FUNCTION get_author_by_karyawan_id(p_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_author TEXT;
BEGIN
    SELECT "Author" INTO v_author
    FROM "karyawanTbl"
    WHERE "Id" = p_id
    LIMIT 1;

    RETURN COALESCE(v_author, '');
END;
$$;


-- 3. FUNCTION RPC: GET KARYAWAN BY QRCODE
DROP FUNCTION IF EXISTS get_karyawan_by_qrcode(TEXT);
CREATE OR REPLACE FUNCTION get_karyawan_by_qrcode(p_qrcode TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_kar RECORD;
BEGIN
    SELECT "Id" AS id, "NamaPersonnel" AS nama, "Kualifikasi" AS kualifikasi, "Author" AS author
    INTO v_kar
    FROM "karyawanTbl"
    WHERE UPPER(TRIM("QrCodeId")) = UPPER(TRIM(p_qrcode))
    LIMIT 1;

    IF v_kar.id IS NULL THEN
        RETURN '[]'::JSONB;
    END IF;

    RETURN jsonb_build_array(jsonb_build_object(
        'id', v_kar.id,
        'nama', v_kar.nama,
        'kualifikasi', v_kar.kualifikasi,
        'author', v_kar.author
    ));
END;
$$;