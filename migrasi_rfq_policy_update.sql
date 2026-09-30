-- Tabel rfq pakai RLS tapi cuma punya policy SELECT, jadi semua update dari aplikasi
-- (ReportURL, SelectionReportURL, Status) gagal diam-diam (0 baris, tanpa error).
-- Sudah di-apply ke Supabase 2026-09-30.
create policy "App can update rfq" on public.rfq
  for update to anon, authenticated
  using (true) with check (true);
