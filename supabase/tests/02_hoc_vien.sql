-- Test phân quyền giai đoạn 2: hồ sơ học viên, phụ huynh, gắn tài khoản.
begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- ---------------------------------------------------------------------------
-- Dữ liệu giả
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin.a@test.vn', '{"full_name":"Quản lý A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'gv.a@test.vn',    '{"full_name":"Giáo viên A"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'gv.a2@test.vn',   '{"full_name":"Giáo viên A2"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hs.a@hs.chessineducation.invalid', '{"full_name":"Học sinh A","username":"hs.a"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'ph.a@test.vn',    '{"full_name":"Phụ huynh A"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'admin.b@test.vn', '{"full_name":"Quản lý B"}');

insert into public.organizations (id, name, slug) values
  ('00000000-0000-0000-0000-00000000000a', 'Đơn vị A', 'don-vi-a'),
  ('00000000-0000-0000-0000-00000000000b', 'Đơn vị B', 'don-vi-b');

insert into public.org_members (org_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'org_admin'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'teacher'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', 'teacher'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a6', 'parent'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'org_admin');

-- 3 em ở A (s1 do GV A tạo, s2 do quản lý tạo, s3 do GV A2 tạo), 1 em ở B
insert into public.students (id, org_id, full_name, created_by) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Em Một',  '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'Em Hai',  '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'Em Ba',   '00000000-0000-0000-0000-0000000000a5'),
  ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000000b', 'Em Bê',   '00000000-0000-0000-0000-0000000000b1');

insert into public.guardians (org_id, student_id, full_name, phone, is_primary) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 'Mẹ Em Một', '0901', true),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', 'Bố Em Hai', '0902', true),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000f', 'Mẹ Em Bê',  '0909', true);

-- Tài khoản học sinh A = Em Hai; phụ huynh A = phụ huynh của Em Một và Em Ba
insert into public.account_students (org_id, user_id, student_id, relation) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000002', 'self'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000001', 'parent'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000003', 'parent');

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
-- Khóa ngoại kép: không gắn phụ huynh / tài khoản đơn vị A với học sinh đơn vị B
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.guardians (org_id, student_id, full_name) values
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000f', 'Lẫn đơn vị')$$,
  '23503', null, 'Không gắn phụ huynh đơn vị A vào học sinh đơn vị B');

-- ---------------------------------------------------------------------------
-- Quản lý A
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.students), 3, 'Quản lý A thấy 3 học viên đơn vị A (bảng gốc)');
select is((select count(*)::int from public.student_profiles), 3, 'Quản lý A thấy 3 hồ sơ qua view');
select is((select count(*)::int from public.guardians), 2, 'Quản lý A thấy phụ huynh đơn vị A, không thấy đơn vị B');
update public.students set status = 'paused' where id = '00000000-0000-0000-0000-000000000003';
select is((select status from public.student_profiles where id = '00000000-0000-0000-0000-000000000003'), 'paused',
  'Quản lý sửa được trạng thái học viên');
update public.students set full_name = 'Hack' where id = '00000000-0000-0000-0000-00000000000f';
select lives_ok(
  $$select public.create_student('00000000-0000-0000-0000-00000000000a', '{"full_name":"Em Bốn"}', '{"full_name":"Bà Em Bốn","phone":"0904"}')$$,
  'Quản lý tạo hồ sơ qua RPC kèm phụ huynh');
select is((select count(*)::int from public.guardians g join public.students s on s.id = g.student_id where s.full_name = 'Em Bốn'), 1,
  'RPC tạo luôn phụ huynh chính');
select throws_ok(
  $$select public.create_student('00000000-0000-0000-0000-00000000000b', '{"full_name":"Lấn sân"}')$$,
  '42501', null, 'Quản lý A không tạo hồ sơ ở đơn vị B');
select throws_ok(
  $$insert into public.account_students (org_id, user_id, student_id) values
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'Không gắn tài khoản giáo viên làm tài khoản học sinh');

-- ---------------------------------------------------------------------------
-- Giáo viên A
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.students), 0, 'Giáo viên không đọc thẳng được bảng students');
select results_eq('select full_name from public.student_profiles order by full_name'::text,
  $$values ('Em Một')$$::text, 'Giáo viên chỉ thấy hồ sơ em mình tạo (qua view)');
select results_eq('select phone from public.guardians'::text, $$values ('0901')$$::text,
  'Giáo viên thấy SĐT phụ huynh của em mình xem được');
select throws_ok(
  $$insert into public.students (org_id, full_name) values ('00000000-0000-0000-0000-00000000000a', 'Thẳng bảng')$$,
  '42501', null, 'Giáo viên không ghi thẳng vào bảng students');
select throws_ok(
  $$update public.student_profiles set full_name = 'Qua view' where id = '00000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'View student_profiles không ghi xuyên được');
select throws_ok(
  $$delete from public.student_names where id = '00000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'View student_names không xóa xuyên được');
select throws_ok(
  $$insert into public.guardians (org_id, student_id, full_name) values
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 'GV thêm')$$,
  '42501', null, 'Giáo viên không sửa phụ huynh');
select lives_ok(
  $$select public.create_student('00000000-0000-0000-0000-00000000000a', '{"full_name":"Em GV tạo"}')$$,
  'Giáo viên tạo được hồ sơ học viên qua RPC');
select results_eq('select count(*)::int from public.student_profiles where full_name = $q$Em GV tạo$q$'::text,
  $$values (1)$$::text, 'Em giáo viên vừa tạo hiện ngay trong danh sách của giáo viên đó');

-- ---------------------------------------------------------------------------
-- Học sinh, phụ huynh
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select results_eq('select full_name from public.student_profiles'::text, $$values ('Em Hai')$$::text,
  'Học sinh chỉ thấy hồ sơ của chính mình');
select is((select count(*)::int from public.students), 0, 'Học sinh không đọc thẳng được bảng students');
select throws_ok(
  $$select public.create_student('00000000-0000-0000-0000-00000000000a', '{"full_name":"HS tạo"}')$$,
  '42501', null, 'Học sinh không tạo được hồ sơ');

select pg_temp.login('00000000-0000-0000-0000-0000000000a6');
select results_eq('select full_name from public.student_profiles order by full_name'::text,
  $$values ('Em Ba'), ('Em Một')$$::text, 'Phụ huynh thấy hồ sơ các con');

-- ---------------------------------------------------------------------------
-- Quản lý B, anon
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select results_eq('select full_name from public.student_profiles'::text, $$values ('Em Bê')$$::text,
  'Quản lý B chỉ thấy học viên đơn vị B');

select pg_temp.logout();
select is((select full_name from public.students where id = '00000000-0000-0000-0000-00000000000f'), 'Em Bê',
  'Quản lý A sửa học viên đơn vị B không có tác dụng');
select is((select created_by from public.students where full_name = 'Em GV tạo'), '00000000-0000-0000-0000-0000000000a2'::uuid,
  'RPC ghi created_by = người gọi');

set local role anon;
select throws_ok('select * from public.student_profiles', '42501', null, 'anon không đọc được view hồ sơ');
reset role;

select * from finish();
rollback;
