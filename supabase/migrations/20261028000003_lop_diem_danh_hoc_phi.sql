-- Lớp học + buổi học + điểm danh + học phí (bản gọn — CLAUDE.md mục 15, 27/10/2026).
-- Số buổi không lưu DB (app đánh số theo ngày, giờ). Giá 1 buổi nhập tay theo từng em.
-- Tiền: lần đóng không sửa / xóa được; mọi thay đổi điểm danh, gói, đóng tiền, giá ghi vào audit_log.

-- ---------------------------------------------------------------------------
-- Bảng
-- ---------------------------------------------------------------------------

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  kind text not null default 'group' check (kind in ('group', 'private')),
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  location text,
  default_fee integer not null default 0 check (default_fee >= 0),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_org_id_id_key unique (org_id, id)
);
create index classes_org_id_idx on public.classes (org_id);

create table public.class_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  class_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  mode text not null default 'offline' check (mode in ('offline', 'online')),
  created_at timestamptz not null default now(),
  constraint class_schedule_slots_class_fkey foreign key (org_id, class_id)
    references public.classes (org_id, id) on delete cascade
);
create index class_schedule_slots_class_id_idx on public.class_schedule_slots (class_id);

create table public.class_teachers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  class_id uuid not null,
  teacher_id uuid not null,
  is_main boolean not null default true,
  created_at timestamptz not null default now(),
  constraint class_teachers_class_teacher_key unique (class_id, teacher_id),
  constraint class_teachers_class_fkey foreign key (org_id, class_id)
    references public.classes (org_id, id) on delete cascade,
  -- giáo viên phải là thành viên đơn vị (gỡ khỏi đơn vị → tự gỡ khỏi lớp)
  constraint class_teachers_member_fkey foreign key (org_id, teacher_id)
    references public.org_members (org_id, user_id) on delete cascade
);
create index class_teachers_teacher_id_idx on public.class_teachers (teacher_id);

create table public.class_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  class_id uuid not null,
  student_id uuid not null,
  status text not null default 'active' check (status in ('active', 'removed')),
  fee_per_session integer not null default 0 check (fee_per_session >= 0),
  billing_mode text not null default 'per_session' check (billing_mode in ('per_session', 'package')),
  joined_on date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  left_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_members_class_student_key unique (class_id, student_id),
  constraint class_members_org_id_id_key unique (org_id, id),
  constraint class_members_class_fkey foreign key (org_id, class_id)
    references public.classes (org_id, id) on delete cascade,
  constraint class_members_student_fkey foreign key (org_id, student_id)
    references public.students (org_id, id) on delete cascade
);
create index class_members_student_id_idx on public.class_members (student_id);

create table public.class_meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  class_id uuid not null,
  meeting_date date not null,
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  mode text not null default 'offline' check (mode in ('offline', 'online')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  taught_by uuid references public.profiles (id) on delete set null,
  content text,
  homework text,
  -- buổi app tự thêm để giữ đủ buổi phía trước (bỏ "Đã dạy" nhầm thì xóa được nếu chưa ai sửa)
  auto_added boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_meetings_org_id_id_key unique (org_id, id),
  constraint class_meetings_class_slot_key unique (class_id, meeting_date, start_time),
  constraint class_meetings_class_fkey foreign key (org_id, class_id)
    references public.classes (org_id, id) on delete cascade
);
create index class_meetings_date_idx on public.class_meetings (org_id, meeting_date);

create table public.class_attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  class_id uuid not null,
  meeting_id uuid not null,
  member_id uuid not null,
  status text not null check (status in ('present', 'excused', 'absent')),
  note text,
  -- chụp lại lúc chấm (trigger điền, không nhận từ app): đổi giá sau này không đổi tiền buổi cũ
  fee integer not null default 0 check (fee >= 0),
  billing text not null default 'per_session' check (billing in ('per_session', 'package')),
  marked_by uuid references public.profiles (id) on delete set null,
  marked_at timestamptz not null default now(),
  constraint class_attendance_meeting_member_key unique (meeting_id, member_id),
  -- RESTRICT: không xóa buổi / thành viên đã có điểm danh (mất dữ liệu tính tiền)
  constraint class_attendance_meeting_fkey foreign key (org_id, meeting_id)
    references public.class_meetings (org_id, id) on delete restrict,
  constraint class_attendance_member_fkey foreign key (org_id, member_id)
    references public.class_members (org_id, id) on delete restrict
);
create index class_attendance_class_id_idx on public.class_attendance (class_id);
create index class_attendance_member_id_idx on public.class_attendance (member_id);

create table public.tuition_packages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  member_id uuid not null,
  sessions integer not null check (sessions > 0),
  amount integer not null check (amount >= 0),
  purchased_on date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tuition_packages_member_fkey foreign key (org_id, member_id)
    references public.class_members (org_id, id) on delete restrict
);
create index tuition_packages_member_id_idx on public.tuition_packages (member_id);

create table public.tuition_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  student_id uuid not null,
  -- âm = điều chỉnh khi ghi nhầm (bắt buộc ghi chú)
  amount integer not null check (amount <> 0),
  paid_on date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  method text not null default 'cash' check (method in ('cash', 'transfer', 'other')),
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tuition_payments_student_fkey foreign key (org_id, student_id)
    references public.students (org_id, id) on delete restrict
);
create index tuition_payments_student_id_idx on public.tuition_payments (student_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  table_name text not null,
  row_id uuid,
  action text not null,
  old jsonb,
  new jsonb,
  actor_id uuid,
  at timestamptz not null default now()
);
create index audit_log_org_at_idx on public.audit_log (org_id, at desc);

create trigger classes_set_updated_at before update on public.classes
  for each row execute function public.set_updated_at();
create trigger class_members_set_updated_at before update on public.class_members
  for each row execute function public.set_updated_at();
create trigger class_meetings_set_updated_at before update on public.class_meetings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Hàm phân quyền
-- ---------------------------------------------------------------------------

create or replace function public.is_class_teacher(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_teachers t
    join public.classes c on c.id = t.class_id
    where t.class_id = p_class_id
      and t.teacher_id = auth.uid()
      and public.org_role(c.org_id) in ('teacher', 'org_admin')
  );
$$;

-- Sửa trong lớp (điểm danh, buổi, thêm học viên): quản lý đơn vị hoặc giáo viên được phân công.
create or replace function public.can_edit_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.classes c where c.id = p_class_id and public.is_org_admin(c.org_id))
    or public.is_class_teacher(p_class_id);
$$;

-- Xem lớp: người sửa được + học sinh / phụ huynh có em đang học lớp đó.
create or replace function public.can_view_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_edit_class(p_class_id)
    or exists (
      select 1 from public.class_members m
      where m.class_id = p_class_id and m.status = 'active'
        and m.student_id in (select public.my_student_ids())
    );
$$;

-- Mở rộng: giáo viên xem được học viên các lớp mình dạy.
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
        or exists (
          select 1 from public.class_members m
          where m.student_id = s.id and public.is_class_teacher(m.class_id)
        )
      )
  );
$$;

revoke execute on function
  public.is_class_teacher(uuid), public.can_edit_class(uuid), public.can_view_class(uuid)
from public, anon;
grant execute on function
  public.is_class_teacher(uuid), public.can_edit_class(uuid), public.can_view_class(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger bảo vệ dữ liệu
-- ---------------------------------------------------------------------------

-- Giáo viên phụ trách phải là giáo viên / quản lý của đơn vị (không gán học sinh làm giáo viên).
create or replace function public.class_teachers_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.org_members m
    where m.org_id = new.org_id and m.user_id = new.teacher_id and m.role in ('teacher', 'org_admin')
  ) then
    raise exception 'Người được phân công phải là giáo viên hoặc quản lý của đơn vị' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger class_teachers_check before insert or update on public.class_teachers
  for each row execute function public.class_teachers_check();

-- Giá / hình thức thu chỉ quản lý đặt. Giáo viên thêm em → giá mặc định của lớp, thu theo buổi.
create or replace function public.class_members_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_org_admin(new.org_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    select c.default_fee into new.fee_per_session from public.classes c where c.id = new.class_id;
    new.billing_mode := 'per_session';
  elsif new.fee_per_session is distinct from old.fee_per_session or new.billing_mode is distinct from old.billing_mode then
    raise exception 'Chỉ quản lý được đổi giá / hình thức thu học phí' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger class_members_guard before insert or update on public.class_members
  for each row execute function public.class_members_guard();

-- Buổi đã có điểm danh không báo nghỉ được (bỏ điểm danh trước).
create or replace function public.class_meetings_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled'
     and exists (select 1 from public.class_attendance a where a.meeting_id = new.id) then
    raise exception 'Buổi đã điểm danh — bỏ điểm danh trước khi báo nghỉ' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger class_meetings_guard before update on public.class_meetings
  for each row execute function public.class_meetings_guard();

-- Điểm danh: buổi + học viên phải cùng lớp; chụp giá / hình thức thu từ học viên; ghi người chấm.
create or replace function public.class_attendance_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meeting record;
  v_member record;
begin
  select class_id, status into v_meeting from public.class_meetings where id = new.meeting_id;
  select class_id, fee_per_session, billing_mode into v_member from public.class_members where id = new.member_id;
  if v_meeting.class_id is distinct from new.class_id or v_member.class_id is distinct from new.class_id then
    raise exception 'Buổi học và học viên không cùng lớp' using errcode = '23514';
  end if;
  if v_meeting.status = 'cancelled' then
    raise exception 'Buổi đã nghỉ — không điểm danh được' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.billing := v_member.billing_mode;
    new.fee := case when v_member.billing_mode = 'per_session' then v_member.fee_per_session else 0 end;
  else
    -- giữ giá đã chụp; không cho đổi sang buổi / học viên khác
    new.billing := old.billing;
    new.fee := old.fee;
    new.meeting_id := old.meeting_id;
    new.member_id := old.member_id;
    new.class_id := old.class_id;
  end if;
  new.marked_by := coalesce(auth.uid(), new.marked_by);
  new.marked_at := now();
  return new;
end;
$$;
create trigger class_attendance_prepare before insert or update on public.class_attendance
  for each row execute function public.class_attendance_prepare();

-- Đóng tiền: người ghi = người đăng nhập; điều chỉnh âm phải có ghi chú; không sửa / xóa.
create or replace function public.tuition_payments_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    if new.amount < 0 and coalesce(btrim(new.note), '') = '' then
      raise exception 'Khoản điều chỉnh (số âm) phải ghi lý do' using errcode = '23514';
    end if;
    return new;
  end if;
  if auth.uid() is not null then
    raise exception 'Không sửa / xóa lần đóng tiền — ghi khoản điều chỉnh nếu nhầm' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger tuition_payments_guard before insert or update or delete on public.tuition_payments
  for each row execute function public.tuition_payments_guard();

create or replace function public.tuition_packages_prepare()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger tuition_packages_prepare before insert on public.tuition_packages
  for each row execute function public.tuition_packages_prepare();

-- Nhật ký thay đổi (CLAUDE.md 4.3)
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (org_id, table_name, row_id, action, old, new, actor_id)
  values (
    coalesce(new.org_id, old.org_id),
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    auth.uid()
  );
  return null;
end;
$$;
revoke execute on function public.audit_row() from public, anon, authenticated;

create trigger class_attendance_audit after insert or update or delete on public.class_attendance
  for each row execute function public.audit_row();
create trigger tuition_payments_audit after insert or update or delete on public.tuition_payments
  for each row execute function public.audit_row();
create trigger tuition_packages_audit after insert or update or delete on public.tuition_packages
  for each row execute function public.audit_row();
create trigger class_members_audit after insert or update or delete on public.class_members
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- RPC: tạo lớp + lịch tuần + giáo viên + các buổi đầu trong 1 giao dịch
-- ---------------------------------------------------------------------------

create or replace function public.create_class(
  p_org_id uuid,
  p_class jsonb,
  p_slots jsonb,
  p_teacher_ids uuid[],
  p_meetings jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Chỉ quản lý được tạo lớp' using errcode = '42501';
  end if;

  insert into public.classes (org_id, name, kind, start_date, location, default_fee, notes, created_by)
  values (
    p_org_id,
    btrim(p_class ->> 'name'),
    coalesce(p_class ->> 'kind', 'group'),
    (p_class ->> 'start_date')::date,
    nullif(btrim(p_class ->> 'location'), ''),
    coalesce((p_class ->> 'default_fee')::integer, 0),
    nullif(btrim(p_class ->> 'notes'), ''),
    auth.uid()
  )
  returning id into v_id;

  insert into public.class_schedule_slots (org_id, class_id, weekday, start_time, duration_minutes, mode)
  select p_org_id, v_id, (s ->> 'weekday')::smallint, (s ->> 'start_time')::time,
         (s ->> 'duration_minutes')::integer, coalesce(s ->> 'mode', 'offline')
  from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb)) s;

  insert into public.class_teachers (org_id, class_id, teacher_id)
  select p_org_id, v_id, t from unnest(coalesce(p_teacher_ids, '{}')) t;

  insert into public.class_meetings (org_id, class_id, meeting_date, start_time, duration_minutes, mode)
  select p_org_id, v_id, (m ->> 'meeting_date')::date, (m ->> 'start_time')::time,
         (m ->> 'duration_minutes')::integer, coalesce(m ->> 'mode', 'offline')
  from jsonb_array_elements(coalesce(p_meetings, '[]'::jsonb)) m
  on conflict (class_id, meeting_date, start_time) do nothing;

  return v_id;
end;
$$;
revoke execute on function public.create_class(uuid, jsonb, jsonb, uuid[], jsonb) from public, anon;
grant execute on function public.create_class(uuid, jsonb, jsonb, uuid[], jsonb) to authenticated;

-- Đổi lịch tuần: xóa dòng cũ + thêm dòng mới trong 1 giao dịch (không đụng buổi đã có).
create or replace function public.set_class_slots(p_class_id uuid, p_slots jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.classes where id = p_class_id;
  if v_org is null or not public.is_org_admin(v_org) then
    raise exception 'Chỉ quản lý được đổi lịch tuần' using errcode = '42501';
  end if;
  delete from public.class_schedule_slots where class_id = p_class_id;
  insert into public.class_schedule_slots (org_id, class_id, weekday, start_time, duration_minutes, mode)
  select v_org, p_class_id, (s ->> 'weekday')::smallint, (s ->> 'start_time')::time,
         (s ->> 'duration_minutes')::integer, coalesce(s ->> 'mode', 'offline')
  from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb)) s;
end;
$$;
revoke execute on function public.set_class_slots(uuid, jsonb) from public, anon;
grant execute on function public.set_class_slots(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.classes enable row level security;
alter table public.class_schedule_slots enable row level security;
alter table public.class_teachers enable row level security;
alter table public.class_members enable row level security;
alter table public.class_meetings enable row level security;
alter table public.class_attendance enable row level security;
alter table public.tuition_packages enable row level security;
alter table public.tuition_payments enable row level security;
alter table public.audit_log enable row level security;

-- classes: xem theo can_view_class; chỉ quản lý tạo / sửa / xóa
-- (is_org_admin theo org_id trước: insert … returning của chính quản lý phải thấy dòng vừa thêm)
create policy classes_select on public.classes for select to authenticated
  using ((select public.is_org_admin(org_id)) or (select public.can_view_class(id)));
create policy classes_insert on public.classes for insert to authenticated
  with check ((select public.is_org_admin(org_id)));
create policy classes_update on public.classes for update to authenticated
  using ((select public.is_org_admin(org_id))) with check ((select public.is_org_admin(org_id)));
create policy classes_delete on public.classes for delete to authenticated
  using ((select public.is_org_admin(org_id)));

-- lịch tuần, giáo viên phụ trách: ai xem lớp thì xem; chỉ quản lý sửa
create policy class_schedule_slots_select on public.class_schedule_slots for select to authenticated
  using ((select public.can_view_class(class_id)));
create policy class_schedule_slots_insert on public.class_schedule_slots for insert to authenticated
  with check ((select public.is_org_admin(org_id)));
create policy class_schedule_slots_update on public.class_schedule_slots for update to authenticated
  using ((select public.is_org_admin(org_id))) with check ((select public.is_org_admin(org_id)));
create policy class_schedule_slots_delete on public.class_schedule_slots for delete to authenticated
  using ((select public.is_org_admin(org_id)));

create policy class_teachers_select on public.class_teachers for select to authenticated
  using ((select public.can_view_class(class_id)));
create policy class_teachers_insert on public.class_teachers for insert to authenticated
  with check ((select public.is_org_admin(org_id)));
create policy class_teachers_delete on public.class_teachers for delete to authenticated
  using ((select public.is_org_admin(org_id)));

-- học viên trong lớp: người sửa lớp thấy cả lớp; học sinh / phụ huynh chỉ thấy dòng của em mình (không lộ giá của em khác)
create policy class_members_select on public.class_members for select to authenticated
  using ((select public.can_edit_class(class_id)) or student_id in (select public.my_student_ids()));
create policy class_members_insert on public.class_members for insert to authenticated
  with check ((select public.can_edit_class(class_id)));
create policy class_members_update on public.class_members for update to authenticated
  using ((select public.can_edit_class(class_id))) with check ((select public.can_edit_class(class_id)));
create policy class_members_delete on public.class_members for delete to authenticated
  using ((select public.is_org_admin(org_id)));

-- buổi học: ai xem lớp thì xem; người sửa lớp thêm / sửa; chỉ xóa buổi chưa dạy (điểm danh chặn bằng FK RESTRICT)
create policy class_meetings_select on public.class_meetings for select to authenticated
  using ((select public.can_view_class(class_id)));
create policy class_meetings_insert on public.class_meetings for insert to authenticated
  with check ((select public.can_edit_class(class_id)));
create policy class_meetings_update on public.class_meetings for update to authenticated
  using ((select public.can_edit_class(class_id))) with check ((select public.can_edit_class(class_id)));
create policy class_meetings_delete on public.class_meetings for delete to authenticated
  using ((select public.can_edit_class(class_id)) and status = 'scheduled');

-- điểm danh: người sửa lớp chấm / bỏ chấm; học sinh / phụ huynh xem điểm danh của em mình
create policy class_attendance_select on public.class_attendance for select to authenticated
  using (
    (select public.can_edit_class(class_id))
    or member_id in (select m.id from public.class_members m where m.student_id in (select public.my_student_ids()))
  );
create policy class_attendance_insert on public.class_attendance for insert to authenticated
  with check ((select public.can_edit_class(class_id)));
create policy class_attendance_update on public.class_attendance for update to authenticated
  using ((select public.can_edit_class(class_id))) with check ((select public.can_edit_class(class_id)));
create policy class_attendance_delete on public.class_attendance for delete to authenticated
  using ((select public.can_edit_class(class_id)));

-- gói buổi: quản lý thêm; giáo viên lớp đó xem (để biết em còn mấy buổi)
create policy tuition_packages_select on public.tuition_packages for select to authenticated
  using (
    (select public.is_org_admin(org_id))
    or exists (select 1 from public.class_members m where m.id = member_id and public.is_class_teacher(m.class_id))
  );
create policy tuition_packages_insert on public.tuition_packages for insert to authenticated
  with check ((select public.is_org_admin(org_id)));

-- đóng tiền: chỉ quản lý xem / ghi; không có policy sửa / xóa
create policy tuition_payments_select on public.tuition_payments for select to authenticated
  using ((select public.is_org_admin(org_id)));
create policy tuition_payments_insert on public.tuition_payments for insert to authenticated
  with check ((select public.is_org_admin(org_id)));

create policy audit_log_select on public.audit_log for select to authenticated
  using ((select public.is_org_admin(org_id)));

-- ---------------------------------------------------------------------------
-- Quyền bảng
-- ---------------------------------------------------------------------------

revoke all on
  public.classes, public.class_schedule_slots, public.class_teachers, public.class_members,
  public.class_meetings, public.class_attendance, public.tuition_packages, public.tuition_payments,
  public.audit_log
from anon, public;

grant select, insert, update, delete on
  public.classes, public.class_schedule_slots, public.class_members, public.class_meetings, public.class_attendance
to authenticated;
grant select, insert, delete on public.class_teachers to authenticated;
revoke update on public.class_teachers from authenticated;
grant select, insert on public.tuition_packages, public.tuition_payments to authenticated;
revoke update, delete, truncate, references, trigger on public.tuition_packages, public.tuition_payments from authenticated;
grant select on public.audit_log to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.audit_log from authenticated;
