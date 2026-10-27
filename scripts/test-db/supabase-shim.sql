-- Giả lập phần tối thiểu của Supabase để chạy migration + test pgTAP trên Postgres thường
-- (máy không có Docker / Supabase CLI). Không bao giờ chạy file này trên project Supabase thật.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase mặc định cấp mọi quyền cho anon / authenticated trên bảng, view, hàm mới trong public.
-- Giữ y như vậy để test bắt được lỗi "view ghi xuyên" và "quên revoke".
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema extensions;
create extension pgtap with schema extensions;
-- Như Supabase: mọi vai trò dùng được schema extensions (pgTAP chạy cả khi đã "đăng nhập giả")
grant usage on schema extensions to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;
