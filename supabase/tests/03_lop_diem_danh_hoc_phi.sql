-- Test phân quyền + khóa an toàn: lớp, buổi, điểm danh, gói, đóng tiền.
begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- ---------------------------------------------------------------------------
-- Dữ liệu giả
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin.a@test.vn', '{"full_name":"Quản lý A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'gv.a@test.vn',    '{"full_name":"Giáo viên A"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'gv.a2@test.vn',   '{"full_name":"Giáo viên A2"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hs.a@hs.chessineducation.invalid', '{"full_name":"Học sinh A","username":"hs.a"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'admin.b@test.vn', '{"full_name":"Quản lý B"}');

insert into public.organizations (id, name, slug) values
  ('00000000-0000-0000-0000-00000000000a', 'Đơn vị A', 'don-vi-a'),
  ('00000000-0000-0000-0000-00000000000b', 'Đơn vị B', 'don-vi-b');

insert into public.org_members (org_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'org_admin'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'teacher'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', 'teacher'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'org_admin');

insert into public.students (id, org_id, full_name, created_by) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Em Một', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'Em Hai', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'Em Ba',  '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000000b', 'Em Bê',  '00000000-0000-0000-0000-0000000000b1');

insert into public.account_students (org_id, user_id, student_id, relation) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000001', 'self');

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- ---------------------------------------------------------------------------
-- Quản lý A tạo lớp (lớp L1: GV A phụ trách) và lớp L2 (GV A2 phụ trách)
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$
  select public.create_class(
    '00000000-0000-0000-0000-00000000000a',
    '{"name":"Lớp Cơ bản T3-T5","kind":"group","start_date":"2026-11-03","default_fee":150000}',
    '[{"weekday":1,"start_time":"17:30","duration_minutes":90},{"weekday":3,"start_time":"17:30","duration_minutes":90}]',
    array['00000000-0000-0000-0000-0000000000a2'::uuid],
    '[{"meeting_date":"2026-11-03","start_time":"17:30","duration_minutes":90},
      {"meeting_date":"2026-11-05","start_time":"17:30","duration_minutes":90},
      {"meeting_date":"2026-11-05","start_time":"17:30","duration_minutes":90}]')
$$, 'Quản lý tạo lớp + lịch tuần + giáo viên + buổi bằng 1 RPC');
select is((select count(*)::int from public.class_meetings), 2, 'Buổi trùng (ngày, giờ) bị bỏ qua');
select is((select count(*)::int from public.class_schedule_slots), 2, 'Lưu đủ lịch tuần');

select public.create_class(
  '00000000-0000-0000-0000-00000000000a',
  '{"name":"Kèm riêng Em Ba","kind":"private","start_date":"2026-11-04","default_fee":300000}',
  '[{"weekday":2,"start_time":"19:00","duration_minutes":60}]',
  array['00000000-0000-0000-0000-0000000000a5'::uuid],
  '[{"meeting_date":"2026-11-04","start_time":"19:00","duration_minutes":60}]');

select throws_ok($$
  select public.create_class('00000000-0000-0000-0000-00000000000a', '{"name":"Sai GV","start_date":"2026-11-03"}', '[]',
    array['00000000-0000-0000-0000-0000000000a3'::uuid], '[]')
$$, '23514', null, 'Không phân công tài khoản học sinh làm giáo viên');

-- Thêm học viên: Em Một (theo buổi, giá mặc định), Em Hai (gói)
insert into public.class_members (org_id, class_id, student_id, fee_per_session)
select '00000000-0000-0000-0000-00000000000a', id, '00000000-0000-0000-0000-000000000001', 150000
from public.classes where name = 'Lớp Cơ bản T3-T5';
insert into public.class_members (org_id, class_id, student_id, fee_per_session, billing_mode)
select '00000000-0000-0000-0000-00000000000a', id, '00000000-0000-0000-0000-000000000002', 0, 'package'
from public.classes where name = 'Lớp Cơ bản T3-T5';
select is((select count(*)::int from public.class_members), 2, 'Quản lý thêm được học viên vào lớp');

select throws_ok($$
  insert into public.class_members (org_id, class_id, student_id)
  select '00000000-0000-0000-0000-00000000000a', id, '00000000-0000-0000-0000-00000000000f'
  from public.classes where name = 'Lớp Cơ bản T3-T5'
$$, '23503', null, 'Không thêm học sinh đơn vị B vào lớp đơn vị A (khóa ngoại kép)');

-- Điểm danh buổi 1: Em Một có mặt, Em Hai vắng không phép
insert into public.class_attendance (org_id, class_id, meeting_id, member_id, status, fee, billing)
select m.org_id, m.class_id, m.id, cm.id, 'present', 999, 'package'
from public.class_meetings m join public.class_members cm on cm.class_id = m.class_id
where m.meeting_date = '2026-11-03' and cm.student_id = '00000000-0000-0000-0000-000000000001';
select is((select fee from public.class_attendance a join public.class_members cm on cm.id = a.member_id
           where cm.student_id = '00000000-0000-0000-0000-000000000001'), 150000,
  'Giá buổi do DB chụp từ học viên, không nhận số gửi lên');
select is((select billing from public.class_attendance a join public.class_members cm on cm.id = a.member_id
           where cm.student_id = '00000000-0000-0000-0000-000000000001'), 'per_session',
  'Hình thức thu do DB chụp từ học viên');

insert into public.class_attendance (org_id, class_id, meeting_id, member_id, status)
select m.org_id, m.class_id, m.id, cm.id, 'absent'
from public.class_meetings m join public.class_members cm on cm.class_id = m.class_id
where m.meeting_date = '2026-11-03' and cm.student_id = '00000000-0000-0000-0000-000000000002';
select is((select fee from public.class_attendance a join public.class_members cm on cm.id = a.member_id
           where cm.student_id = '00000000-0000-0000-0000-000000000002'), 0,
  'Học viên đóng gói: buổi không cộng tiền theo buổi (trừ vào gói)');

update public.class_members set fee_per_session = 200000 where student_id = '00000000-0000-0000-0000-000000000001';
update public.class_attendance set status = 'excused'
where member_id = (select id from public.class_members where student_id = '00000000-0000-0000-0000-000000000001');
select is((select fee from public.class_attendance a join public.class_members cm on cm.id = a.member_id
           where cm.student_id = '00000000-0000-0000-0000-000000000001'), 150000,
  'Đổi giá học viên không đổi giá buổi đã chấm');

select throws_ok($$
  update public.class_meetings set status = 'cancelled' where meeting_date = '2026-11-03'
$$, '23514', null, 'Buổi đã điểm danh không báo nghỉ được');
select throws_ok($$
  delete from public.class_meetings where meeting_date = '2026-11-03'
$$, '23503', null, 'Không xóa buổi đã có điểm danh');

-- Gói + đóng tiền
insert into public.tuition_packages (org_id, member_id, sessions, amount, created_by)
select org_id, id, 8, 1000000, '00000000-0000-0000-0000-0000000000a2'
from public.class_members where student_id = '00000000-0000-0000-0000-000000000002';
select is((select created_by from public.tuition_packages), '00000000-0000-0000-0000-0000000000a1'::uuid,
  'Người thêm gói do DB ghi');

insert into public.tuition_payments (org_id, student_id, amount, method, created_by)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', 1000000, 'transfer',
        '00000000-0000-0000-0000-0000000000a2');
select is((select created_by from public.tuition_payments), '00000000-0000-0000-0000-0000000000a1'::uuid,
  'Người thu do DB ghi = người đăng nhập, không nhận giá trị gửi lên');
select throws_ok($$
  insert into public.tuition_payments (org_id, student_id, amount) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', -50000)
$$, '23514', null, 'Điều chỉnh âm không ghi lý do bị chặn');
select lives_ok($$
  insert into public.tuition_payments (org_id, student_id, amount, note) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', -50000, 'Ghi nhầm số')
$$, 'Điều chỉnh âm có lý do thì được');
select throws_ok($$
  update public.tuition_payments set amount = 1 where student_id = '00000000-0000-0000-0000-000000000002'
$$, '42501', null, 'Không sửa được lần đóng tiền');
select throws_ok($$
  delete from public.tuition_payments where student_id = '00000000-0000-0000-0000-000000000002'
$$, '42501', null, 'Không xóa được lần đóng tiền');
select throws_ok($$
  delete from public.students where id = '00000000-0000-0000-0000-000000000002'
$$, '23503', null, 'Không xóa được học viên đã có điểm danh / đóng tiền');
select ok((select count(*) from public.audit_log where table_name = 'tuition_payments') = 2, 'Nhật ký ghi lại các lần đóng tiền');
select ok((select count(*) from public.audit_log where table_name = 'class_attendance' and action = 'update') = 1,
  'Nhật ký ghi lại lần sửa điểm danh');

-- ---------------------------------------------------------------------------
-- Giáo viên A (phụ trách L1, không phụ trách lớp kèm riêng)
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select results_eq('select name from public.classes'::text, $$values ('Lớp Cơ bản T3-T5')$$::text,
  'Giáo viên chỉ thấy lớp mình được phân công');
select is((select count(*)::int from public.student_profiles), 2, 'Giáo viên thấy hồ sơ học viên trong lớp mình dạy');
select throws_ok($$
  select public.create_class('00000000-0000-0000-0000-00000000000a', '{"name":"GV tạo","start_date":"2026-11-03"}', '[]', '{}', '[]')
$$, '42501', null, 'Giáo viên không tạo được lớp');
select throws_ok($$
  update public.class_members set fee_per_session = 1 where student_id = '00000000-0000-0000-0000-000000000001'
$$, '42501', null, 'Giáo viên không sửa được giá học viên');
select lives_ok($$
  insert into public.class_members (org_id, class_id, student_id, fee_per_session)
  select '00000000-0000-0000-0000-00000000000a', id, '00000000-0000-0000-0000-000000000003', 1
  from public.classes where name = 'Lớp Cơ bản T3-T5'
$$, 'Giáo viên thêm được học viên vào lớp mình');
select is((select fee_per_session from public.class_members where student_id = '00000000-0000-0000-0000-000000000003'
           and class_id = (select id from public.classes where name = 'Lớp Cơ bản T3-T5')), 150000,
  'Giáo viên thêm em → giá lấy mặc định của lớp, không theo số gửi lên');
select lives_ok($$
  insert into public.class_attendance (org_id, class_id, meeting_id, member_id, status)
  select m.org_id, m.class_id, m.id, cm.id, 'present'
  from public.class_meetings m join public.class_members cm on cm.class_id = m.class_id
  where m.meeting_date = '2026-11-05' and cm.student_id = '00000000-0000-0000-0000-000000000001'
$$, 'Giáo viên điểm danh lớp mình');
update public.class_meetings set status = 'completed', taught_by = '00000000-0000-0000-0000-0000000000a2'
where meeting_date = '2026-11-05';
select is((select status from public.class_meetings where meeting_date = '2026-11-05'), 'completed', 'Giáo viên bấm Đã dạy');
select is((select count(*)::int from public.tuition_payments), 0, 'Giáo viên không xem được đóng tiền');
select throws_ok($$
  insert into public.tuition_payments (org_id, student_id, amount) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 100000)
$$, '42501', null, 'Giáo viên không ghi được đóng tiền');
select throws_ok($$
  insert into public.tuition_packages (org_id, member_id, sessions, amount)
  select org_id, id, 4, 1 from public.class_members where student_id = '00000000-0000-0000-0000-000000000001'
$$, '42501', null, 'Giáo viên không thêm được gói');
select is((select count(*)::int from public.audit_log), 0, 'Giáo viên không đọc nhật ký');

-- Giáo viên A2 không đụng được lớp L1 (lấy sẵn id buổi + học viên L1 bằng quyền postgres)
select pg_temp.logout();
select set_config('test.l1_class', m.class_id::text, true), set_config('test.l1_meeting', m.id::text, true),
       set_config('test.l1_member', cm.id::text, true)
from public.class_meetings m join public.class_members cm on cm.class_id = m.class_id
where m.meeting_date = '2026-11-03' and cm.student_id = '00000000-0000-0000-0000-000000000003';
select pg_temp.login('00000000-0000-0000-0000-0000000000a5');
select results_eq('select name from public.classes'::text, $$values ('Kèm riêng Em Ba')$$::text,
  'Giáo viên A2 chỉ thấy lớp kèm riêng của mình');
select throws_ok($$
  insert into public.class_attendance (org_id, class_id, meeting_id, member_id, status) values (
    '00000000-0000-0000-0000-00000000000a', current_setting('test.l1_class')::uuid,
    current_setting('test.l1_meeting')::uuid, current_setting('test.l1_member')::uuid, 'present')
$$, '42501', null, 'Giáo viên không điểm danh lớp không được phân công');

-- ---------------------------------------------------------------------------
-- Học sinh, quản lý B
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select results_eq('select name from public.classes'::text, $$values ('Lớp Cơ bản T3-T5')$$::text,
  'Học sinh thấy lớp mình đang học');
select is((select count(*)::int from public.class_members), 1, 'Học sinh chỉ thấy dòng của mình (không thấy giá của bạn)');
select is((select count(*)::int from public.class_attendance), 2, 'Học sinh thấy điểm danh của mình');
select is_empty($$
  update public.class_attendance set status = 'present' returning 1
$$, 'Học sinh không sửa được điểm danh (0 dòng bị đổi)');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.classes) + (select count(*)::int from public.class_meetings)
          + (select count(*)::int from public.tuition_payments), 0, 'Quản lý B không thấy gì của đơn vị A');

select pg_temp.logout();
select * from finish();
rollback;
