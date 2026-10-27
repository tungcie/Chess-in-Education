-- Giai đoạn 1 — Nền: đơn vị, hồ sơ tài khoản, vai trò trong đơn vị, hàm phân quyền, RLS.
-- Ghi tài khoản (tạo / khóa / xóa / đổi vai trò) chỉ đi qua Edge Function admin-users (service_role),
-- nên org_members không có policy INSERT / UPDATE / DELETE cho người dùng app.

-- ---------------------------------------------------------------------------
-- Tiện ích chung
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bảng
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null default 'center' check (kind in ('school', 'club', 'center')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  address text,
  phone text,
  logo_url text,
  tuition_due_day smallint not null default 10 check (tuition_due_day between 1 and 28),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  -- null với tài khoản tạo bằng tên đăng nhập (email nội bộ không hiển thị)
  email text,
  username text unique check (username ~ '^[a-z0-9._]{3,32}$'),
  phone text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('org_admin', 'teacher', 'student', 'parent')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_members_org_user_key unique (org_id, user_id),
  constraint org_members_org_id_id_key unique (org_id, id)
);

create index org_members_user_id_idx on public.org_members (user_id);
create index org_members_created_by_idx on public.org_members (created_by);

create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger org_members_set_updated_at before update on public.org_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Hàm phân quyền (security definer: đọc bảng mà không bị RLS của chính bảng đó chặn / gọi vòng)
-- ---------------------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_super_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Vai trò của người đang đăng nhập trong đơn vị (null nếu không thuộc, bị khóa, hoặc đơn vị tạm khóa).
create or replace function public.org_role(p_org_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.org_members m
  join public.organizations o on o.id = m.org_id
  where m.org_id = p_org_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.status = 'active';
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or coalesce(public.org_role(p_org_id) = 'org_admin', false);
$$;

create or replace function public.is_org_staff(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin()
    or coalesce(public.org_role(p_org_id) in ('org_admin', 'teacher'), false);
$$;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or public.org_role(p_org_id) is not null;
$$;

-- Người đang đăng nhập có được thấy dòng thành viên này không.
-- Quản lý: mọi thành viên đơn vị. Giáo viên: quản lý + giáo viên + học sinh / phụ huynh mình tạo
-- (giai đoạn 2 mở thêm: học sinh các lớp mình dạy). Ai cũng thấy dòng của chính mình.
create or replace function public.can_view_member(
  p_org_id uuid,
  p_user_id uuid,
  p_role text,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = auth.uid()
    or public.is_org_admin(p_org_id)
    or (
      public.org_role(p_org_id) = 'teacher'
      and (p_role in ('org_admin', 'teacher') or p_created_by = auth.uid())
    );
$$;

create or replace function public.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1
      from public.org_members m
      where m.user_id = p_profile_id
        and public.can_view_member(m.org_id, m.user_id, m.role, m.created_by)
    );
$$;

revoke execute on function
  public.is_super_admin(),
  public.org_role(uuid),
  public.is_org_admin(uuid),
  public.is_org_staff(uuid),
  public.is_org_member(uuid),
  public.can_view_member(uuid, uuid, text, uuid),
  public.can_view_profile(uuid)
from public, anon;

grant execute on function
  public.is_super_admin(),
  public.org_role(uuid),
  public.is_org_admin(uuid),
  public.is_org_staff(uuid),
  public.is_org_member(uuid),
  public.can_view_member(uuid, uuid, text, uuid),
  public.can_view_profile(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger bảo vệ cột (chỉ áp với người dùng app: có auth.uid())
-- ---------------------------------------------------------------------------

create or replace function public.organizations_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    if new.slug is distinct from old.slug
       or new.status is distinct from old.status
       or new.kind is distinct from old.kind then
      raise exception 'Chỉ quản trị hệ thống được đổi mã, loại hoặc trạng thái đơn vị'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger organizations_guard before update on public.organizations
  for each row execute function public.organizations_guard();

create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    if new.is_super_admin is distinct from old.is_super_admin
       or new.email is distinct from old.email
       or new.username is distinct from old.username then
      raise exception 'Không được tự đổi email, tên đăng nhập hoặc quyền quản trị'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------------------------------------------------------------------------
-- Tự tạo profiles khi có user mới trong auth.users
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, username)
  values (
    new.id,
    case when new.email like '%@hs.chessineducation.invalid' then null else new.email end,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'username', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tài khoản tạo trước migration này (vd tài khoản quản trị đầu tiên)
insert into public.profiles (id, email, full_name, username)
select
  u.id,
  case when u.email like '%@hs.chessineducation.invalid' then null else u.email end,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  nullif(u.raw_user_meta_data ->> 'username', '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.org_members enable row level security;

-- organizations
create policy organizations_select on public.organizations
  for select to authenticated
  using ((select public.is_org_member(id)));

create policy organizations_insert on public.organizations
  for insert to authenticated
  with check ((select public.is_super_admin()));

create policy organizations_update on public.organizations
  for update to authenticated
  using ((select public.is_org_admin(id)))
  with check ((select public.is_org_admin(id)));

create policy organizations_delete on public.organizations
  for delete to authenticated
  using ((select public.is_super_admin()));

-- profiles: tạo / xóa chỉ qua trigger auth.users và Edge Function
create policy profiles_select on public.profiles
  for select to authenticated
  using ((select public.can_view_profile(id)));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_super_admin()))
  with check (id = (select auth.uid()) or (select public.is_super_admin()));

-- org_members: chỉ đọc từ app
create policy org_members_select on public.org_members
  for select to authenticated
  using ((select public.can_view_member(org_id, user_id, role, created_by)));

-- ---------------------------------------------------------------------------
-- Quyền bảng (RLS vẫn chặn từng dòng). anon không đọc / ghi gì.
-- ---------------------------------------------------------------------------

revoke all on public.organizations, public.profiles, public.org_members from anon, public;
grant select, insert, update, delete on public.organizations to authenticated;
grant select, update on public.profiles to authenticated;
revoke insert, delete, truncate, references, trigger on public.profiles from authenticated;
grant select on public.org_members to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.org_members from authenticated;
