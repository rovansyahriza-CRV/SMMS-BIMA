-- Fix: list "Approval Vendor" kosong padahal menu Vendor muncul.
-- Dulu RPC cuma nerima tag Author persis "Review Vendor"/"Approval Vendor" (case-sensitive),
-- sementara menu di app.js (applyMenuAccess) nerima inisial RV/AV, RV-xxx/AV-xxx, bentuk panjang,
-- dan ALL/* (super admin). Sekarang aturan DB disamakan dengan menu lewat satu helper.

create or replace function public.vendor_author_can(p_karyawan_id bigint, p_status text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_author text;
  v_pic text;
  v_code text;
  v_long text;
begin
  select upper(coalesce(p."Author", '')), upper(coalesce(p."PIC", ''))
    into v_author, v_pic
  from "paswordTbl" p where p."Id" = p_karyawan_id;

  if v_author is null then
    return false;
  end if;

  -- Super admin (sama dengan isSuperAdmin di app.js)
  if exists (
    select 1 from unnest(string_to_array(v_author || ',' || v_pic, ',')) t
    where trim(t) in ('ALL', '*')
  ) then
    return true;
  end if;

  if p_status = 'Review' then
    v_code := 'RV'; v_long := 'REVIEW VENDOR';
  elsif p_status = 'Approval' then
    v_code := 'AV'; v_long := 'APPROVAL VENDOR';
  else
    return false;
  end if;

  -- Sama dengan matchAuthor: token utuh, "KODE-xxx", atau "KODE xxx"
  return exists (
    select 1
    from unnest(string_to_array(v_author, ',')) raw
    cross join lateral (select trim(raw) as a) x
    cross join lateral unnest(array[v_code, v_long]) k
    where x.a = k or x.a like k || '-%' or x.a like k || ' %'
  );
end;
$function$;

create or replace function public.get_pending_vendor_approvals(p_karyawan_id bigint)
returns table(vendorid bigint, vendorname text, catagory text, contactno text, email text, status text, vendorlistdate timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  select v."VendorID", v."VendorName", v."Catagory", v."ContactNo", v."Email", v."Status", v."VendorListDate"
  from vendor v
  where v."Status" in ('Review', 'Approval')
    and public.vendor_author_can(p_karyawan_id, v."Status");
end;
$function$;

create or replace function public.process_vendor_approval(p_vendor_id bigint, p_karyawan_id bigint, p_decision text, p_reason text default null::text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_current_status text;
begin
  select "Status" into v_current_status from vendor where "VendorID" = p_vendor_id;

  if v_current_status is null then
    raise exception 'Vendor tidak ditemukan.';
  end if;

  if v_current_status not in ('Review', 'Approval') then
    raise exception 'Vendor ini sudah selesai diproses (status: %)', v_current_status;
  end if;

  if not public.vendor_author_can(p_karyawan_id, v_current_status) then
    raise exception 'Anda tidak punya wewenang approval level % untuk Vendor', v_current_status;
  end if;

  if p_decision = 'Reject' then
    update vendor
    set "Status" = 'Rejected', "RejectedBy" = p_karyawan_id::text, "RejectedAt" = now(), "RejectReason" = p_reason
    where "VendorID" = p_vendor_id;

  elsif v_current_status = 'Review' then
    update vendor
    set "Status" = 'Approval', "ReviewedBy" = p_karyawan_id::text, "ReviewedAt" = now()
    where "VendorID" = p_vendor_id;

  elsif v_current_status = 'Approval' then
    update vendor
    set "Status" = 'Approved', "ApprovedBy" = p_karyawan_id::text, "ApprovedAt" = now()
    where "VendorID" = p_vendor_id;
  end if;
end;
$function$;

-- Helper cuma dipanggil dari RPC di atas, jangan diekspos ke client.
revoke all on function public.vendor_author_can(bigint, text) from public, anon, authenticated;

-- Status lama "ACTIVE" disamakan jadi "Approved" supaya ikut muncul di pemilihan vendor RFQ.
update vendor set "Status" = 'Approved' where "Status" = 'ACTIVE';
