-- KHỞI TẠO LẦN ĐẦU — chạy 1 lần trong Supabase → SQL Editor, SAU KHI đã chạy migration.
-- Trước đó: tạo tài khoản của anh ở Authentication → Users → Add user (email + mật khẩu, tick "Auto Confirm User").
-- Sửa 3 dòng v_... bên dưới rồi bấm Run. Chạy lại nhiều lần cũng không sao.
-- File này không phải migration và không chứa email thật trong kho code.
do $$
declare
  v_email    text := 'email-cua-anh@gmail.com';     -- email tài khoản quản trị vừa tạo
  v_org_name text := 'Chess in Education Vietnam';  -- tên đơn vị
  v_org_slug text := 'cie-vietnam';                 -- mã đơn vị: chữ thường không dấu, số, gạch nối
  v_user uuid;
  v_org  uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'Chưa có tài khoản %: tạo ở Authentication → Users trước', v_email;
  end if;

  insert into public.profiles (id, email) values (v_user, lower(v_email)) on conflict (id) do nothing;
  update public.profiles
     set is_super_admin = true,
         full_name = coalesce(nullif(full_name, ''), 'Quản trị')
   where id = v_user;

  insert into public.organizations (name, slug)
  values (v_org_name, v_org_slug)
  on conflict (slug) do update set name = excluded.name
  returning id into v_org;

  insert into public.org_members (org_id, user_id, role)
  values (v_org, v_user, 'org_admin')
  on conflict (org_id, user_id) do update set role = 'org_admin', status = 'active';

  raise notice 'Xong: % là quản trị hệ thống và quản lý đơn vị "%"', v_email, v_org_name;
end $$;
