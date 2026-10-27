-- Giai đoạn 2 — Học viên: hồ sơ học sinh, liên hệ phụ huynh, gắn tài khoản đăng nhập với hồ sơ.
-- Bảng students chỉ quản lý đơn vị đọc / ghi trực tiếp; giáo viên / học sinh đọc qua view (CLAUDE.md 4.3).
-- Giáo viên tạo hồ sơ qua RPC create_student (tự ghi created_by = người gọi).

-- ---------------------------------------------------------------------------
-- Bảng
-- ---------------------------------------------------------------------------

create table public.students (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) > 0),
  birth_date date,
  gender text check (gender in ('male', 'female')),
  address text,
  school_class text,
  phone text,
  email text,
  level text,
  level_source text not null default 'manual'
    check (level_source in ('manual', 'rapid', 'blitz', 'bullet', 'daily', 'tactics')),
  start_date date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  status text not null default 'active' check (status in ('active', 'paused', 'inactive')),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_org_id_id_key unique (org_id, id)
);

create index students_org_id_idx on public.students (org_id);
create index students_created_by_idx on public.students (created_by);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  student_id uuid not null,
  full_name text not null check (length(btrim(full_name)) > 0),
  relation text,
  phone text,
  zalo_name text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardians_student_fkey foreign key (org_id, student_id)
    references public.students (org_id, id) on delete cascade
);

create index guardians_student_id_idx on public.guardians (student_id);

create table public.account_students (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null,
  relation text not null default 'self' check (relation in ('self', 'parent')),
  created_at timestamptz not null default now(),
  constraint account_students_user_student_key unique (user_id, student_id),
  constraint account_students_student_fkey foreign key (org_id, student_id)
    references public.students (org_id, id) on delete cascade
);

create index account_students_student_id_idx on public.account_students (student_id);

create trigger students_set_updated_at before update on public.students
  for each row execute function public.set_updated_at();
create trigger guardians_set_updated_at before update on public.guardians
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Hàm phân quyền
-- ---------------------------------------------------------------------------

-- Học sinh mà tài khoản đang đăng nhập đại diện (chính em / các con).
create or replace function public.my_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.student_id
  from public.account_students a
  join public.org_members m on m.org_id = a.org_id and m.user_id = a.user_id
  join public.organizations o on o.id = a.org_id
  where a.user_id = auth.uid() and m.status = 'active' and o.status = 'active';
$$;

-- Ai được xem hồ sơ 1 học sinh: quản lý đơn vị; giáo viên với em mình tạo (giai đoạn 4 thêm: em trong lớp mình dạy);
-- học sinh / phụ huynh với em mình đại diện.
create or replace function public.can_view_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and (
        public.is_org_admin(s.org_id)
        or (public.org_role(s.org_id) = 'teacher' and s.created_by = auth.uid())
        or s.id in (select public.my_student_ids())
      )
  );
$$;

revoke execute on function public.my_student_ids(), public.can_view_student(uuid) from public, anon;
grant execute on function public.my_student_ids(), public.can_view_student(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: tạo hồ sơ (quản lý + giáo viên), kèm 1 phụ huynh chính nếu có
-- ---------------------------------------------------------------------------

create or replace function public.create_student(
  p_org_id uuid,
  p_student jsonb,
  p_guardian jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_org_staff(p_org_id) then
    raise exception 'Bạn không có quyền tạo hồ sơ học viên trong đơn vị này' using errcode = '42501';
  end if;

  insert into public.students (
    org_id, full_name, birth_date, gender, address, school_class, phone, email, level, start_date, notes, created_by
  ) values (
    p_org_id,
    btrim(p_student ->> 'full_name'),
    nullif(p_student ->> 'birth_date', '')::date,
    nullif(p_student ->> 'gender', ''),
    nullif(btrim(p_student ->> 'address'), ''),
    nullif(btrim(p_student ->> 'school_class'), ''),
    nullif(btrim(p_student ->> 'phone'), ''),
    nullif(btrim(lower(p_student ->> 'email')), ''),
    nullif(btrim(p_student ->> 'level'), ''),
    coalesce(nullif(p_student ->> 'start_date', '')::date, (now() at time zone 'Asia/Ho_Chi_Minh')::date),
    nullif(btrim(p_student ->> 'notes'), ''),
    auth.uid()
  )
  returning id into v_id;

  if p_guardian is not null and nullif(btrim(p_guardian ->> 'full_name'), '') is not null then
    insert into public.guardians (org_id, student_id, full_name, relation, phone, zalo_name, is_primary)
    values (
      p_org_id,
      v_id,
      btrim(p_guardian ->> 'full_name'),
      nullif(btrim(p_guardian ->> 'relation'), ''),
      nullif(btrim(p_guardian ->> 'phone'), ''),
      nullif(btrim(p_guardian ->> 'zalo_name'), ''),
      true
    );
  end if;

  return v_id;
end;
$$;

revoke execute on function public.create_student(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.create_student(uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.account_students enable row level security;

-- students: chỉ quản lý đơn vị (giáo viên / học sinh đọc qua view student_profiles)
create policy students_select on public.students
  for select to authenticated using ((select public.is_org_admin(org_id)));
create policy students_insert on public.students
  for insert to authenticated with check ((select public.is_org_admin(org_id)));
create policy students_update on public.students
  for update to authenticated
  using ((select public.is_org_admin(org_id)))
  with check ((select public.is_org_admin(org_id)));
create policy students_delete on public.students
  for delete to authenticated using ((select public.is_org_admin(org_id)));

-- guardians: ai xem được hồ sơ em thì xem được phụ huynh (giáo viên được thấy SĐT — mục 15); chỉ quản lý sửa
create policy guardians_select on public.guardians
  for select to authenticated using ((select public.can_view_student(student_id)));
create policy guardians_insert on public.guardians
  for insert to authenticated with check ((select public.is_org_admin(org_id)));
create policy guardians_update on public.guardians
  for update to authenticated
  using ((select public.is_org_admin(org_id)))
  with check ((select public.is_org_admin(org_id)));
create policy guardians_delete on public.guardians
  for delete to authenticated using ((select public.is_org_admin(org_id)));

-- account_students: người xem được hồ sơ em thì thấy em đã có tài khoản chưa; chỉ quản lý gắn / gỡ
-- (giáo viên gắn khi tạo tài khoản — đi qua Edge Function)
create policy account_students_select on public.account_students
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.can_view_student(student_id)));
create policy account_students_insert on public.account_students
  for insert to authenticated
  with check (
    (select public.is_org_admin(org_id))
    and exists (
      select 1 from public.org_members m
      where m.org_id = account_students.org_id
        and m.user_id = account_students.user_id
        and m.role in ('student', 'parent')
    )
  );
create policy account_students_delete on public.account_students
  for delete to authenticated using ((select public.is_org_admin(org_id)));

revoke all on public.students, public.guardians, public.account_students from anon, public;
grant select, insert, update, delete on public.students, public.guardians to authenticated;
grant select, insert, delete on public.account_students to authenticated;
revoke update, truncate, references, trigger on public.account_students from authenticated;

-- ---------------------------------------------------------------------------
-- View đọc cho mọi vai trò (tự lọc bằng can_view_student) — CHỈ ĐỌC
-- ---------------------------------------------------------------------------

create view public.student_names as
  select s.id, s.org_id, s.full_name
  from public.students s
  where public.can_view_student(s.id);

create view public.student_profiles as
  select
    s.id, s.org_id, s.full_name, s.birth_date, s.gender, s.address, s.school_class, s.phone, s.email,
    s.level, s.level_source, s.start_date, s.status, s.notes, s.created_by, s.created_at, s.updated_at
  from public.students s
  where public.can_view_student(s.id);

revoke insert, update, delete, truncate, references, trigger on public.student_names, public.student_profiles
  from public, anon, authenticated;
revoke select on public.student_names, public.student_profiles from public, anon;
grant select on public.student_names, public.student_profiles to authenticated;
