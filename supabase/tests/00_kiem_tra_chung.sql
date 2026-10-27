-- Kiểm tra chung cho MỌI bảng / view trong schema public (tự áp cho bảng mới thêm ở giai đoạn sau):
--  1. Bảng nào cũng bật RLS.
--  2. View không cho ghi (view chạy bằng quyền chủ sở hữu → ghi xuyên xuống bảng gốc, bỏ qua RLS).
--  3. anon không có quyền gì trên bảng / view.
--  4. Hàm security definer luôn đặt search_path.
begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is(
  array(
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
    order by 1
  ),
  array[]::text[],
  'Mọi bảng trong public đã bật RLS'
);

select is(
  array(
    select distinct c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated')) r(role_name)
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p(priv)
    where n.nspname = 'public' and c.relkind in ('v', 'm')
      and has_table_privilege(r.role_name, c.oid, p.priv)
    order by 1
  ),
  array[]::text[],
  'Không view nào cho anon / authenticated ghi (phải revoke trong cùng migration tạo view)'
);

select is(
  array(
    select distinct c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
      and has_table_privilege('anon', c.oid, p.priv)
    order by 1
  ),
  array[]::text[],
  'anon không có quyền trên bảng / view nào'
);

select is(
  array(
    select p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')
    order by 1
  ),
  array[]::text[],
  'Hàm security definer nào cũng đặt search_path'
);

select * from finish();
rollback;
