-- Test phân quyền giai đoạn 1: đơn vị, hồ sơ, thành viên.
-- Chạy: npm run test:db (Postgres tạm) hoặc supabase test db.
begin;
set client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ---------------------------------------------------------------------------
-- Dữ liệu giả: 2 đơn vị A, B
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a0', 'super@test.vn',   '{"full_name":"Quản trị"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'admin.a@test.vn', '{"full_name":"Quản lý A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'gv.a@test.vn',    '{"full_name":"Giáo viên A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hs.a@hs.chessineducation.invalid', '{"full_name":"Học sinh A","username":"hs.a"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hs.a2@hs.chessineducation.invalid', '{"full_name":"Học sinh A2","username":"hs.a2"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'gv.a2@test.vn',   '{"full_name":"Giáo viên A2"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'admin.b@test.vn', '{"full_name":"Quản lý B"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'gv.b@test.vn',    '{"full_name":"Giáo viên B"}');

update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-0000000000a0';

insert into public.organizations (id, name, slug) values
  ('00000000-0000-0000-0000-00000000000a', 'Đơn vị A', 'don-vi-a'),
  ('00000000-0000-0000-0000-00000000000b', 'Đơn vị B', 'don-vi-b');

insert into public.org_members (org_id, user_id, role, created_by) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'org_admin', null),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'teacher',   '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student',   '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student',   '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', 'teacher',   '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'org_admin', null),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b2', 'teacher',   '00000000-0000-0000-0000-0000000000b1');

-- Đăng nhập giả: đặt role + sub của JWT trong giao dịch hiện tại
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
-- Trigger tạo profiles
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.profiles), 8, 'Mỗi user auth có 1 dòng profiles');
select is((select email from public.profiles where id = '00000000-0000-0000-0000-0000000000a3'), null,
  'Email nội bộ của tài khoản tên đăng nhập không lưu vào profiles');
select is((select username from public.profiles where id = '00000000-0000-0000-0000-0000000000a3'), 'hs.a',
  'Tên đăng nhập lấy từ metadata');

-- ---------------------------------------------------------------------------
-- Quản lý đơn vị A
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select results_eq('select slug from public.organizations'::text, $$values ('don-vi-a')$$::text, 'Quản lý A chỉ thấy đơn vị A');
select is((select count(*)::int from public.org_members), 5, 'Quản lý A thấy 5 thành viên đơn vị A');
select is((select count(*)::int from public.org_members where org_id = '00000000-0000-0000-0000-00000000000b'), 0,
  'Quản lý A không thấy thành viên đơn vị B');
select is((select count(*)::int from public.profiles), 5, 'Quản lý A thấy hồ sơ 5 người của đơn vị A');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 0,
  'Quản lý A không thấy hồ sơ quản lý B');

update public.organizations set name = 'Đơn vị A mới' where id = '00000000-0000-0000-0000-00000000000a';
select is((select name from public.organizations where id = '00000000-0000-0000-0000-00000000000a'), 'Đơn vị A mới',
  'Quản lý A sửa được tên đơn vị mình');

select throws_ok(
  $$update public.organizations set status = 'suspended' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'Quản lý A không tự khóa / đổi trạng thái đơn vị');
select throws_ok(
  $$update public.organizations set slug = 'doi-ma' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'Quản lý A không đổi mã đơn vị');

update public.organizations set name = 'Hack' where id = '00000000-0000-0000-0000-00000000000b';
select throws_ok(
  $$insert into public.organizations (name, slug) values ('Mới', 'moi')$$,
  '42501', null, 'Quản lý đơn vị không tạo đơn vị mới');
select throws_ok(
  $$insert into public.org_members (org_id, user_id, role) values
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000b2', 'teacher')$$,
  '42501', null, 'Không thêm thành viên trực tiếp từ app (chỉ qua Edge Function)');
select throws_ok(
  $$update public.org_members set role = 'org_admin' where user_id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501', null, 'Không đổi vai trò trực tiếp từ app');
select throws_ok(
  $$delete from public.profiles where id = '00000000-0000-0000-0000-0000000000a3'$$,
  '42501', null, 'Không xóa hồ sơ trực tiếp từ app');

select pg_temp.logout();
select is((select name from public.organizations where id = '00000000-0000-0000-0000-00000000000b'), 'Đơn vị B',
  'Quản lý A sửa đơn vị B không có tác dụng');

-- ---------------------------------------------------------------------------
-- Giáo viên đơn vị A
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select results_eq(
  'select user_id from public.org_members order by user_id'::text,
  $$values ('00000000-0000-0000-0000-0000000000a1'::uuid), ('00000000-0000-0000-0000-0000000000a2'::uuid),
           ('00000000-0000-0000-0000-0000000000a3'::uuid), ('00000000-0000-0000-0000-0000000000a5'::uuid)$$::text,
  'Giáo viên A thấy quản lý, giáo viên và học sinh mình tạo — không thấy học sinh người khác tạo');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000a4'), 0,
  'Giáo viên A không thấy hồ sơ học sinh người khác tạo');

update public.organizations set name = 'GV sửa' where id = '00000000-0000-0000-0000-00000000000a';
select throws_ok(
  $$update public.profiles set is_super_admin = true where id = '00000000-0000-0000-0000-0000000000a2'$$,
  '42501', null, 'Giáo viên không tự cấp quyền quản trị hệ thống');
update public.profiles set full_name = 'GV A đổi tên' where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set full_name = 'Sửa người khác' where id = '00000000-0000-0000-0000-0000000000a1';

select pg_temp.logout();
select is((select name from public.organizations where id = '00000000-0000-0000-0000-00000000000a'), 'Đơn vị A mới',
  'Giáo viên không sửa được thông tin đơn vị');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'), 'GV A đổi tên',
  'Giáo viên sửa được tên của chính mình');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'Quản lý A',
  'Giáo viên không sửa được hồ sơ người khác');

-- ---------------------------------------------------------------------------
-- Học sinh đơn vị A
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from public.org_members), 1, 'Học sinh chỉ thấy dòng thành viên của mình');
select is((select count(*)::int from public.profiles), 1, 'Học sinh chỉ thấy hồ sơ của mình');
select is((select count(*)::int from public.organizations), 1, 'Học sinh thấy đơn vị của mình');
select throws_ok(
  $$update public.profiles set username = 'doi.ten' where id = '00000000-0000-0000-0000-0000000000a3'$$,
  '42501', null, 'Học sinh không tự đổi tên đăng nhập');

-- ---------------------------------------------------------------------------
-- Quản trị hệ thống, đơn vị tạm khóa, thành viên bị khóa, anon
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a0');
select is((select count(*)::int from public.organizations), 2, 'Quản trị hệ thống thấy mọi đơn vị');
update public.organizations set status = 'suspended' where id = '00000000-0000-0000-0000-00000000000b';

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.organizations), 0, 'Đơn vị tạm khóa: quản lý không còn thấy đơn vị');
select is((select count(*)::int from public.profiles), 1, 'Đơn vị tạm khóa: chỉ còn thấy hồ sơ của mình');

select pg_temp.logout();
update public.org_members set status = 'disabled' where user_id = '00000000-0000-0000-0000-0000000000a5';
select pg_temp.login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from public.organizations), 0, 'Tài khoản bị khóa không thấy đơn vị');

select pg_temp.logout();
set local role anon;
select throws_ok('select * from public.organizations', '42501', null, 'anon không đọc được organizations');
select throws_ok('select * from public.profiles', '42501', null, 'anon không đọc được profiles');
reset role;

select * from finish();
rollback;
