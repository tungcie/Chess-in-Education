# Chess in Education — App quản lý học sinh, giáo viên, điểm danh, học phí, tiến độ

> File này là bản thiết kế + quy tắc làm việc. Claude Code tự đọc file này mỗi lần làm việc.
> Dựa trên bản thiết kế của một app đã chạy thật ở một trung tâm cờ vua (1 CLB), **mở rộng cho nhiều đơn vị**
> (trường học / CLB / trung tâm) theo mô hình của dự án Chess in Education do Chess Empire phát triển.
> Chỗ nào chưa chốt được đánh dấu **[CẦN CHỐT]** — Claude phải hỏi trước khi làm phần đó.

---

## 0. Quy tắc làm việc cho Claude (bắt buộc)

- **Thảo luận kế hoạch trước khi làm.** Mỗi việc (giai đoạn mới, sửa lỗi, migration, dọn dữ liệu): trình bày làm gì, bảng / màn
  hình / file nào, ảnh hưởng dữ liệu thật ra sao, hỏi các điểm cần chốt — **chỉ viết code sau khi chủ dự án duyệt**.
- Bản này chưa nói rõ điều gì, hoặc gặp **[CẦN CHỐT]** → **hỏi, không tự đoán**, nhất là quy tắc tính tiền.
- Migration: file `supabase/migrations/<timestamp>_mo_ta.sql` (định dạng của Supabase CLI), **không sửa migration đã chạy**
  (sửa = migration mới). Code mới cần cột mới thì báo chủ dự án chạy migration ngay.
- Có **2 project Supabase**: project thử (chỉ dữ liệu giả) và project thật. Migration chạy ở project thử trước. **Không thử ghi
  tiền trên project thật** (lần đóng tiền không xóa được từ app, xem 8.6).
- Thử trên dữ liệu thật thì dùng dữ liệu tạm tên "QA …", thử xong xóa hết, so số liệu trước / sau.
- Logic tính toán (sinh lịch, đẩy / dồn nội dung, giáo trình, tiến độ, học phí, gói buổi, báo cáo, rating) viết thành **hàm thuần
  có test** (Vitest), để cạnh file dùng nó. Không test logic qua Supabase.
- **Phân quyền có test tự động ở DB** (pgTAP, `supabase/tests/*.sql`, chạy bằng `npm run test:db` — Postgres tạm, không cần Docker —
  hoặc `supabase test db`; CI chạy mỗi lần đẩy code). `00_kiem_tra_chung.sql` tự kiểm mọi bảng / view. Mỗi bảng / view mới phải có
  test "vai trò X của đơn vị A không đọc / ghi được dữ liệu đơn vị B", "giáo viên không ghi được bảng tiền", "view không ghi
  xuyên được". Không có test phân quyền thì giai đoạn chưa xong.
- Quyết định mới chủ dự án chốt → ghi thêm vào mục 15 cuối file.
- Giao tiếp, giao diện, tin nhắn: **tiếng Việt**.

---

## 1. Tổng quan

App web (ưu tiên điện thoại) quản lý **nhiều đơn vị** (trường học, CLB, trung tâm) dưới một hệ thống chung của Chess Empire.
Mỗi đơn vị có dữ liệu riêng, tách hẳn nhau; một giáo viên có thể dạy ở nhiều đơn vị.

| Vai trò | Phạm vi | Làm gì |
|---|---|---|
| **Quản trị hệ thống** (super admin — Chess Empire) | Mọi đơn vị | Tạo / khóa đơn vị, chỉ định quản lý đơn vị, soạn **giáo trình chung**, xem tổng quan toàn hệ thống |
| **Quản lý đơn vị** (org admin) | 1 đơn vị | Toàn quyền trong đơn vị: học sinh, lớp, giáo viên, học phí, tài khoản, tổng quan |
| **Giáo viên** (teacher) | Các lớp **được phân công** | Lịch, điểm danh, nội dung buổi, đánh giá tiến độ, báo cáo; học phí chỉ xem |
| **Học sinh / Phụ huynh** (student / parent) | Học sinh của mình | Xem lớp, lịch, nội dung buổi, điểm danh, tiến độ của mình (phụ huynh: của các con); không sửa gì |

Chức năng: đơn vị · học sinh (+ liên hệ phụ huynh) · lớp học nhóm · lớp học 1-1 · lịch tuần + màn "Hôm nay" · điểm danh + xử lý
vắng · giáo trình (chung + của đơn vị) · **tiến độ học sinh** · báo cáo buổi / tháng (để dán Zalo) · **công giáo viên** · học phí
(theo tháng / gói buổi / nhà trường trả) · theo dõi chess.com / lichess · việc chạy hằng đêm + sao lưu.

**Không làm** (trừ khi chủ dự án yêu cầu): đăng ký công khai (tài khoản do quản lý tạo), thanh toán online, gửi Zalo tự động,
tự viết nhận xét học sinh bằng AI. Tài liệu giảng dạy, video, mini game, đấu luyện (nêu trong README) là **phần khác**, làm sau.

---

## 2. Công nghệ

- **Giao diện:** React 18 + Vite + TypeScript · Tailwind CSS v4 (+ Radix cho hộp thoại, menu) · TanStack Query · React Router 7 ·
  React Hook Form + Zod · Vitest.
- **Dữ liệu:** Supabase (Postgres + Auth + Edge Function), gọi bằng `@supabase/supabase-js`. Không dùng ORM. Kiểu TypeScript sinh
  bằng `supabase gen types typescript` → `src/lib/database.types.ts` (không viết tay).
- **Supabase CLI** quản lý migration (`supabase migration new`, `supabase db push`). Đưa lên Supabase bằng GitHub Actions
  `supabase-deploy.yml` (chạy tay, chọn project thử / thật, có chế độ chạy thử). Cách dự phòng: dán file migration vào SQL Editor
  theo đúng thứ tự. Hướng dẫn cho chủ dự án: `docs/huong-dan-cai-dat.md`.
- **Phân quyền nằm ở DB** (Row Level Security trên mọi bảng); giao diện chỉ ẩn nút. Trình duyệt gọi thẳng DB bằng anon key vẫn
  an toàn.
- **Đưa lên mạng:** Cloudflare Workers static assets (`wrangler.jsonc`, build từ GitHub `main`; dùng thương mại được). Việc hằng
  đêm: GitHub Actions.
- Không thêm thư viện ngoài danh sách này khi chưa hỏi. Đọc Excel: thư viện `xlsx` bản **0.20.x tải từ cdn.sheetjs.com** (bản npm
  0.18.5 có lỗ hổng), chỉ `import()` động khi cần.

Cấu trúc thư mục:
```
src/features/<chức năng>/   *Page.tsx · *Dialog.tsx · *Api.ts (gọi supabase) · use*.ts (React Query) · hàm thuần + *.test.ts
src/components/ui/          nút, ô nhập, hộp thoại, bảng/thẻ, tab, menu "⋯", hộp xác nhận
src/components/layout/      khung trang, menu trái (máy tính), thanh dưới (điện thoại), chọn đơn vị
src/lib/                    supabase client, fetchAll (mục 12), định dạng ngày / tiền, đơn vị đang chọn
supabase/migrations/        *.sql
supabase/tests/             test phân quyền pgTAP
supabase/functions/admin-users/   Edge Function quản lý tài khoản
scripts/                    việc chạy hằng đêm, sao lưu, khôi phục
```

---

## 3. Tên gọi, định dạng

- **Đơn vị** = trường / CLB / trung tâm (bảng `organizations`). Nhãn loại: "Trường học" / "CLB" / "Trung tâm".
- Lớp nhiều em = **"Lớp học nhóm"**; kèm riêng 1 em = **"Lớp học 1-1"**. Nói chung cả hai = "lớp". Nhãn: "Lớp nhóm" / "Lớp 1-1"
  (2 màu khác nhau). Không dùng chữ "khóa học" trên giao diện (trong code có thể đặt bảng `classes` và `courses`).
- Trạng thái buổi: **Chưa dạy** / **Đã dạy** / **Đã nghỉ**. Điểm danh: **Có mặt** / **Vắng** / chưa điểm danh.
- Thứ trong tuần lưu số **0 = Thứ 2 … 6 = Chủ nhật**; tuần bắt đầu Thứ 2. Ngày hiển thị `dd/mm/yyyy`, lưu `yyyy-mm-dd`.
  Mọi mốc "hôm nay / tháng này" tính theo **giờ Việt Nam (UTC+7)** — dùng 1 hàm `todayVN()` chung, không gọi `new Date()` rải rác.
- Tiền: số nguyên VNĐ, hiển thị `250.000 ₫` (khoảng trắng không ngắt trước ₫).

---

## 4. Phân quyền

### 4.1 Tài khoản và đơn vị
- `profiles` (id = `auth.users.id`, `full_name`, `email`, `phone`, `is_super_admin bool`). Vai trò **theo từng đơn vị** nằm ở
  `org_members` (`org_id`, `user_id`, `role` org_admin | teacher | student | parent, `status` active | disabled). Unique
  `(org_id, user_id)`.
- `account_students` (`user_id`, `student_id`, `relation` self | parent): tài khoản học sinh → chính em đó; tài khoản phụ huynh →
  **một hoặc nhiều con**. Unique `(user_id, student_id)`.
- Đăng nhập mà không có `org_members` nào đang hoạt động (và không phải super admin) → màn "Tài khoản chưa được cấp quyền".
- **Đơn vị đang chọn:** hiện tại app chạy **1 đơn vị** (mục 15): không có ô chọn đơn vị, đơn vị đang dùng = đơn vị đang hoạt
  động duy nhất của người dùng (super admin: đơn vị đầu tiên). DB vẫn có `org_id` ở mọi bảng để sau này mở nhiều đơn vị mà không
  phải đổi dữ liệu. Khi mở nhiều đơn vị: thêm ô chọn đơn vị, lưu ở URL (`/o/:orgSlug/...`); **Hôm nay** và **Lịch tuần** của giáo
  viên gộp mọi đơn vị.
- **Tắt tự đăng ký** trong Supabase Auth. Tạo / đặt lại mật khẩu / khóa / xóa tài khoản qua Edge Function `admin-users` (service_role
  ở máy chủ). Hàm kiểm người gọi: super admin tạo được quản lý đơn vị; quản lý đơn vị chỉ tạo giáo viên / học sinh / phụ huynh **trong
  đơn vị mình**; **giáo viên tạo được tài khoản học sinh** (và đặt lại mật khẩu cho tài khoản học sinh mình tạo); không ai tự đổi
  vai trò hay tự xóa chính mình; không ai ngoài super admin cấp `is_super_admin`. Quy tắc ai được làm gì viết thành hàm thuần ở
  `supabase/functions/_shared/accountRules.ts`, có test, giao diện và Edge Function dùng chung.
- **Học sinh không cần email** → tài khoản tạo bằng **tên đăng nhập** (chữ thường không dấu, số, dấu chấm / gạch dưới; duy nhất toàn
  hệ thống): Edge Function tạo user với email nội bộ `<tên>@hs.chessineducation.invalid` (đã xác nhận sẵn, không bao giờ gửi thư), màn
  đăng nhập chấp nhận "email hoặc tên đăng nhập". Có email thật thì dùng email.
- Đổi mật khẩu: xác minh mật khẩu cũ bằng đăng nhập lại trước khi đổi.
- **Đăng xuất và đổi đơn vị phải xóa hết cache dữ liệu** (TanStack Query `clear()`), không thì người sau / đơn vị sau thấy dữ liệu
  cũ. Mọi query key bắt đầu bằng `orgId`.
- Mỗi user mới trong `auth.users` tự có dòng `profiles` (trigger). Super admin đầu tiên + đơn vị đầu tiên: tạo user trong Supabase
  Auth, rồi chạy `supabase/setup/khoi_tao.sql` (điền email + tên đơn vị) trong SQL Editor — file này không phải migration, không
  chứa email thật.

### 4.2 Giáo viên — được và không được
- Chỉ thấy lớp nhóm / lớp 1-1 **được phân công** (`class_teachers`, `course_teachers`; quản lý phân công ở trang lớp).
- Trong lớp của mình: thêm / cho rời học viên, tạo học viên mới, sửa lịch (cả lớp và từng em), thêm buổi, áp / đổi / sắp xếp giáo
  trình, điểm danh, nhận xét, đánh giá tiến độ, đánh dấu Đã dạy, báo nghỉ, báo cáo.
- Tạo tài khoản học sinh (cho em chưa có email), đặt lại mật khẩu cho tài khoản học sinh mình tạo.
- Menu Học viên: chỉ học viên lớp mình + em mình tạo; hồ sơ **chỉ xem, không có học phí, không có số điện thoại phụ huynh**
  **[CẦN CHỐT: giáo viên có cần thấy SĐT phụ huynh không?]**.
- Học phí: **chỉ xem** học phí theo tháng các lớp mình (8.8). Không thấy giá gói, không đóng tiền, không thiết lập giá.
- Không: tạo lớp, sửa tên / trạng thái / ngày bắt đầu / trình độ lớp, sửa / xóa hồ sơ học viên, liên kết chess.com, sửa buổi đã
  dạy, xóa điểm danh đã chấm. Giáo viên đọc giáo trình nhưng không sửa.

### 4.3 Cách làm ở DB
- **Mọi bảng nghiệp vụ có `org_id not null`.** Bảng con tham chiếu bảng cha bằng **khóa ngoại kép** `(org_id, x_id) references
  cha(org_id, id)` (bảng cha có `unique (org_id, id)`) → DB tự đảm bảo không gắn học sinh đơn vị A vào lớp đơn vị B.
- Hàm trợ giúp `security definer`, `stable`, `set search_path = ''`: `is_super_admin()`, `org_role(org_id)`, `is_org_admin(org_id)`
  (gồm super admin), `is_org_staff(org_id)`, `my_student_ids()`, `can_view_class(id)` / `can_edit_class(id)`, `can_view_course(id)`
  / `can_edit_course(id)`, `can_view_student(id)`. Trong policy viết `(select is_org_admin(org_id))` để Postgres không gọi lại mỗi
  dòng.
- Mỗi bảng: `enable row level security` + policy **tách riêng** SELECT / INSERT / UPDATE / DELETE. UPDATE có cả `using` và `with
  check` (chặn đổi `org_id` sang đơn vị khác).
- Giáo viên được UPDATE lớp nhưng **trigger chặn đổi các cột chỉ quản lý được đổi** (tên, trạng thái, trình độ…).
- **Bảng `students` chỉ quản lý đơn vị đọc / ghi trực tiếp.** Giáo viên / học sinh đọc qua view: `student_names` (id, tên),
  `student_profiles` (hồ sơ không có tiền), `student_directory` (danh sách để chọn). Giáo viên chọn thời lượng buổi qua view chỉ có
  số phút (không có giá). View tự lọc bằng các hàm trợ giúp.
- **View phải chỉ đọc.** View chạy bằng quyền chủ sở hữu (bỏ qua RLS bảng gốc), và Supabase mặc định cấp mọi quyền cho anon /
  authenticated — view 1 bảng **ghi xuyên được xuống bảng gốc**. Tạo view nào thì trong cùng migration:
  `revoke insert, update, delete, truncate, references, trigger on <view> from public, anon, authenticated;`
  `revoke select on <view> from public, anon; grant select on <view> to authenticated;`
  Kèm test pgTAP: UPDATE / DELETE vào view phải bị từ chối (42501).
- Ghi nhiều bước liền nhau → **1 hàm Postgres (RPC) `security invoker`** chạy trong 1 giao dịch; lệnh bị RLS lọc còn 0 dòng thì
  `raise exception` (đừng để lỗi âm thầm). Chỉ dùng `security definer` khi phải sửa dòng ngoài quyền người gọi, và kiểm quyền ngay
  đầu hàm.
- **Nhật ký thay đổi** (`audit_log`: `org_id`, `table_name`, `row_id`, `action`, `old jsonb`, `new jsonb`, `actor_id`, `at`): trigger
  ghi cho các bảng tiền và điểm danh. Chỉ thêm, không sửa / xóa; chỉ quản lý đơn vị đọc. Giúp trả lời "ai sửa Có mặt → Vắng?".

---

## 5. Dữ liệu

Mọi bảng có `id uuid`, `org_id`, `created_at`, phần lớn có `updated_at` (trigger tự cập nhật). Bảng gắn với học viên có khóa ngoại
tới `students` (xóa theo nếu phụ thuộc vòng đời). Không nhét cột tùy tiện vào bảng lớn — chức năng mới thì tạo bảng mới.

**Đơn vị, tài khoản** — `organizations`: `name`, `slug` (dùng trên URL), `kind` (school | club | center), `status` (active |
suspended), `address`, `logo_url`, `tuition_due_day` (mặc định hạn đóng), `notes`. Cùng `profiles`, `org_members`,
`account_students` (mục 4.1).

**Học viên**
- `students`: `full_name`, `birth_year`, `school_class` (lớp ở trường, vd "3A" — hữu ích cho đơn vị là trường học), `phone`,
  `email`, `level` (trình độ ghi tay), `level_source` (manual | rapid | blitz | bullet | daily | tactics), `start_date`, `status`
  (active Đang học | paused Tạm nghỉ | inactive Đã nghỉ), `notes`, `created_by`. Unique `(org_id, id)`.
- `guardians` (liên hệ phụ huynh, không bắt buộc có tài khoản): `student_id`, `full_name`, `relation`, `phone`, `zalo_name`,
  `is_primary`. Dùng để soạn tin nhắc học phí / báo cáo.

**Giáo trình**
- `curriculum_templates`: `org_id` **null = giáo trình chung của Chess Empire** (mọi đơn vị đọc, chỉ super admin sửa), có giá trị =
  giáo trình riêng của đơn vị. `name`, `description`, `level` (Sơ cấp, Trung cấp…), `created_by`.
- `curriculum_items`: `template_id`, `position`, `title` (nội dung buổi), `objectives` (mục tiêu / kỹ năng của bài, không bắt buộc).

**Lớp 1-1**
- `courses`: `student_id`, `template_id` (null được), `name`, `start_date`, `status` (active | paused | completed | cancelled),
  `notes`, `created_by`.
- `course_schedule_slots`: `course_id`, `weekday`, `start_time`, `duration_minutes`, `mode` (online | offline) — lịch tuần.
- `course_sessions`: `course_id`, `student_id`, `session_number`, `session_date`, `start_time`, `duration_minutes`, `mode`, `status`
  (scheduled | completed | cancelled), `taught_by` (giáo viên dạy thật), `planned_title` (nội dung **dự kiến**), `content_summary` /
  `homework` / `progress_notes` (nội dung **đã dạy thật**), `cancel_undo jsonb`. Unique `(course_id, session_number)`.
- `course_teachers`: `course_id`, `teacher_id`.

**Lớp nhóm**
- `classes`: `name`, `template_id`, `start_date`, `status` (active | completed | cancelled), `level` (quyết định học phí — 8.2),
  `kind` (group lớp thường | school lớp nhà trường trả theo sĩ số), `student_count` (chỉ `school`), `rating_format` / `rating_min` /
  `rating_max`, `location` (phòng / địa điểm), `notes`, `created_by`.
- `class_schedule_slots`: như lịch tuần lớp 1-1.
- `class_teachers`: `class_id`, `teacher_id`, `is_main` (giáo viên chính / trợ giảng).
- `class_members`: `class_id`, `student_id`, `status` (active | removed | paused — rời lớp chỉ đổi trạng thái), `joined_at_session_number`,
  `weekdays int[]` (null = học mọi ngày của lớp), `day_minutes jsonb` (`{"5": 45}` = Thứ 7 học 45 phút).
- `class_meetings` (buổi **chung cả lớp**): `class_id`, `session_number`, `meeting_date`, `start_time`, `duration_minutes`, `mode`,
  `status`, `taught_by` (giáo viên dạy thật — mặc định giáo viên chính, đổi khi dạy thay), `planned_title`, `content_summary`,
  `homework`, `cancel_undo jsonb`. Unique `(class_id, session_number)`.
- `class_attendance` (từng em × từng buổi): `meeting_id`, `member_id`, `status` (scheduled | present | absent), `absence_remedy`
  (makeup | carry_forward | homework), `makeup_meeting_id`, `makeup_completed`, `carried_to_meeting_id`, `homework_note`,
  `start_time` / `duration_minutes` (riêng của em ở buổi này, null = theo lịch), `teacher_note` (nhận xét ngắn của giáo viên về em ở
  buổi này). Unique `(meeting_id, member_id)`.
- `class_races`: `class_id`, `name`, `format`, `start_date`, `end_date` (9.4).

**Tiến độ** (mục 7.4)
- `skills`: `org_id` null = bộ kỹ năng chung Chess Empire; `code`, `name`, `group` (Chiến thuật, Tàn cuộc, Khai cuộc…), `position`.
- `student_assessments`: `student_id`, `skill_id`, `assessed_on`, `score` (1 Chưa đạt | 2 Đạt | 3 Tốt), `note`, `assessed_by`. Giữ
  lịch sử (không ghi đè) để xem tiến bộ theo thời gian.

**Học phí** (chỉ quản lý đơn vị — mục 8)
- `tuition_rates`: `level`, `duration_minutes`, `fee`. Khóa chính `(org_id, level, duration_minutes)`.
- `tuition_plans`: `student_id`, `class_id` / `course_id` (đúng 1 cột có giá trị), `mode` (monthly | package), `fee_per_session`,
  `day_fees jsonb`, `duration_fees jsonb` (lớp 1-1: `{"60": 350000, "90": 500000}`), `package_sessions`, `package_amount`,
  `remind_before_sessions`, `due_day`, `start_month`. Unique `(student_id, class_id)` và `(student_id, course_id)`.
- `tuition_charges`: `student_id` (null = khoản của lớp nhà trường trả), `kind` (monthly | package | other), `plan_id`, `class_id`,
  `course_id`, `period_month` (ngày 01 của tháng học), `title`, `amount`, `due_date`, `note`, `sessions_count` + `start_date` +
  `start_fixed` (gói buổi). Unique **đầy đủ** `(plan_id, period_month)`; unique có điều kiện `(class_id, period_month) where
  student_id is null`.
- `tuition_payments`: `charge_id`, `amount`, `paid_at`, `method` (cash | transfer), `note`, `created_by` (trigger tự điền).
- `school_tuition_plans`: `class_id` (khóa chính), `fee_mode` (per_student | per_session), `fee`, `due_day`.

**chess.com / lichess**
- `chess_accounts`: `student_id`, `platform` (chesscom | lichess), `username`. Unique `(student_id, platform)`.
- `chess_rating_snapshots`: `chess_account_id`, `snapshot_date`, `rapid_rating`, `blitz_rating`, `bullet_rating`, `daily_rating`,
  `tactics_rating`, `fetched_at`. Unique `(chess_account_id, snapshot_date)` — 1 dòng / ngày, không xóa.
- `chess_games`: `chess_account_id`, `platform_game_id` (unique), `played_at`, `time_class`, `result` (win | loss | draw),
  `result_detail`, `opponent_username`, `rating_after`, `url`. Chỉ giữ 30 ngày gần nhất.

Các trạng thái, tiền đã đóng, số buổi đã dùng của gói, tiến độ giáo trình, công giáo viên… **tính trong app, không lưu DB** (tránh
lệch số).

---

## 6. Lịch và buổi học (dùng chung lớp nhóm + lớp 1-1)

### 6.1 Sinh buổi
- Lớp có **lịch tuần** (nhiều dòng: thứ, giờ, thời lượng, online / offline). Tạo lớp → sinh sẵn **16 buổi** từ ngày bắt đầu theo
  lịch tuần (xem trước bằng chính hàm sinh lịch trước khi lưu). Không có ô "tổng số buổi"; giao diện ghi "Đã dạy N buổi".
- **Ngày nghỉ chung** (`holidays`: `org_id`, `date_from`, `date_to`, `name` — Tết, nghỉ hè, lịch thi của trường): hàm sinh lịch bỏ
  qua các ngày này. Thêm kỳ nghỉ mới → xem trước rồi dời các buổi chưa dạy rơi vào kỳ nghỉ (như "Sửa lịch học"). **[CẦN CHỐT]**
- **Luôn giữ 16 buổi chưa dạy phía trước:** mở trang lớp (người sửa được, lớp đang học, có lịch tuần) hoặc sau khi bấm "Đã dạy" mà
  thiếu → thêm buổi cuối theo lịch tuần; nội dung = bài giáo trình tiếp theo (7.3). Việc hằng đêm chạy lại đúng quy tắc này.
- **Số buổi luôn theo thứ tự ngày:** đổi ngày / giờ bất kỳ buổi nào → trigger đánh số lại theo (ngày, giờ), giữ nguyên tập số buổi.
  **Nội dung đi theo buổi.** Unique số buổi nên đánh số lại phải dời qua số tạm (vd +100000) rồi mới gán số thật.

### 6.2 Thao tác trên buổi
- **Đã dạy:** đánh dấu xong buổi (ghi `taught_by`). Bấm nhầm thì đổi lại "Chưa dạy" được (nếu app đã tự thêm 1 buổi cuối lúc bấm Đã
  dạy mà buổi đó chưa ai sửa thì xóa luôn).
- **Sửa buổi:** ngày giờ, thời lượng, hình thức, trạng thái, giáo viên dạy, nội dung dự kiến, nội dung đã dạy, bài tập về nhà (1-1
  thêm ghi chú tiến độ).
- **+ Thêm buổi học** (học bù / ngoài lịch): chèn đúng thứ tự ngày, các buổi sau tự đánh số lại. Ngày đã qua (lớp 1-1) → thêm luôn là
  Đã dạy. Lớp nhóm: chọn em học buổi này; "Học bù cho buổi nghỉ X" → chọn sẵn các em của buổi đó, giữ thời lượng (giá buổi bù = giá
  buổi nghỉ).
- **Nghỉ một buổi:** trạng thái → Đã nghỉ; nội dung buổi nghỉ chuyển đi, cho chọn:
  - *Đẩy:* nội dung xuống buổi chưa dạy kế tiếp, nội dung buổi đó xuống buổi sau nữa… gặp buổi trống thì dừng; dư thì thêm buổi cuối
    theo lịch tuần.
  - *Dồn:* ghép nội dung vào đầu buổi chưa dạy kế tiếp (mỗi bài 1 dòng), số buổi giữ nguyên.
  Buổi nghỉ **không tính học phí**. Lớp nhóm không cho báo nghỉ buổi đã điểm danh (bỏ điểm danh trước); em đã xếp học bù vào buổi đó
  → quay về danh sách "Cần xếp lịch học bù". Lúc báo nghỉ lưu cách hoàn tác vào `cancel_undo` (nội dung gốc, các buổi bị dời, buổi đã
  thêm) — làm luôn từ đầu để "Bỏ nghỉ" trả lại được nội dung.
- **Bỏ nghỉ:** đổi "Đã nghỉ" về Chưa dạy / Đã dạy; trả nội dung theo `cancel_undo`, chỉ trả các buổi **vẫn chưa dạy và chưa bị sửa**.
- **Sửa lịch học** (lịch tuần mới): xếp lại ngày giờ **mọi buổi chưa dạy** từ "Áp dụng từ ngày" (mặc định = buổi chưa dạy đầu tiên;
  ngày đã có buổi đã dạy / đã nghỉ thì bỏ qua); buổi đã dạy / nghỉ giữ nguyên; giữ số buổi + nội dung. Xem trước, ghi bằng 1 RPC.
- Sửa nội dung một buổi mà nội dung cũ bị thay → hỏi: đẩy nội dung cũ xuống / ghép vào buổi kế / lưu không chuyển. Thêm vào buổi này
  một bài đang nằm ở buổi phía sau → bỏ dòng trùng phía sau, buổi trống thì dồn các buổi sau lên, buổi cuối nhận bài giáo trình tiếp
  theo. Luôn xem trước, chỉ đụng buổi chưa dạy.
- Mọi thao tác đẩy / dồn / sửa lịch: **hàm thuần nhận danh sách buổi, trả danh sách thay đổi** (`{id, from, to}`), giao diện hiện
  bảng "Trước → Sau" từ chính kết quả đó, RPC ghi đúng danh sách đó. Một hàm, ba chỗ dùng — không viết quy tắc hai lần.

### 6.3 Lớp nhóm
- **Thêm em giữa chừng:** bắt đầu từ buổi chưa dạy gần nhất (theo trạng thái, không theo ngày); chỉ tạo điểm danh từ buổi đó.
- **Lịch riêng từng em:** em có thể chỉ học một số ngày của lớp (`weekdays`) và thời lượng riêng từng ngày (`day_minutes`). **Điểm danh
  là nguồn sự thật:** chỉ tạo dòng điểm danh cho buổi rơi vào ngày em học. Đổi lịch riêng → đồng bộ chỉ các buổi chưa dạy từ ngày áp
  dụng: bỏ dòng chưa chấm của ngày em không học, thêm dòng cho ngày em học; dòng đã chấm giữ nguyên.
- **Điểm danh:** Có mặt / Vắng (+ nhận xét ngắn tùy chọn). Vắng → chọn cách xử lý:
  - *Nhắc ôn ở buổi sau* (`carry_forward`): ghi vào buổi kế tiếp em có mặt.
  - *Học bù* (`makeup`): chọn 1 buổi có sẵn của **bất kỳ lớp nào cùng đơn vị**; để trống → hiện ở khối "Cần xếp lịch học bù".
  - *Bài tập về nhà* (`homework`): link / ghi chú.
- **Điểm danh nhanh** (trang riêng, dùng trên điện thoại): mỗi em 2 nút lớn ✓ / ✕, **lưu ngay mỗi lần bấm** (cập nhật lạc quan, lỗi thì
  trả lại + báo), bấm lại nút đang chọn = bỏ điểm danh; "Tất cả có mặt" chỉ áp cho các em **đang hiện và chưa điểm danh**; nút "Đã dạy"
  dính dưới đáy. Mất mạng giữa chừng → giữ hàng đợi các lần bấm, có mạng lại thì gửi, hiện "Chưa lưu N".
- Chỉ quản lý xóa được dòng điểm danh đã chấm; giáo viên chỉ xóa dòng chưa chấm, chưa xử lý vắng.
- **Lớp nhà trường trả theo sĩ số** (`kind = school`): lớp dạy ở trường mà trường không gửi danh sách, chỉ có số học sinh. Trang lớp chỉ
  có Buổi học · Học phí · Thông tin; điểm danh nhanh chỉ có nút "Đã dạy". Đổi lớp thường → loại này phải cho các em rời lớp trước.

### 6.4 Màn hình
- **Lịch tuần** (mọi vai trò): gộp buổi lớp nhóm + 1-1 trong tuần, hàng theo giờ, RLS tự lọc theo quyền. Quản lý có lọc "Của tôi /
  Tất cả / theo giáo viên".
- **Hôm nay** (trang mở đầu trên điện thoại): dải 7 ngày có chấm màu, danh sách buổi ngày chọn. Trạng thái theo giờ: Đang học (từ 15
  phút trước giờ học tới hết giờ), Sắp tới, Đã dạy, Nghỉ, "Chưa bấm Đã dạy" (đã qua giờ). Buổi lớp nhóm đang học / quên bấm có nút
  Điểm danh. Quản lý thấy dòng "N em quá hạn học phí".
- **Trang lớp** chia tab (lưu ở `?tab=`): lớp nhóm = Buổi học · Học viên · Tiến độ · Thi đua · Thông tin; lớp 1-1 = Buổi học · Tiến độ ·
  Học phí (quản lý) · Thông tin. Đầu tab Buổi học: ô tiến độ tháng này (đã dạy x / y buổi, không tính buổi nghỉ; lớp nhóm thêm chuyên
  cần % và số em chờ học bù). Bảng "Các buổi học": buổi các tháng trước gom thành 1 dòng mỗi tháng, bấm để mở.
- **Tổng quan** (quản lý, trang mở đầu trên máy tính): số học viên đang học, số buổi tuần này / tháng này, gói buổi sắp hết, học viên
  lâu chưa học (> 14 ngày), học viên vắng ≥ 3 buổi liên tiếp, buổi học 14 ngày tới. Super admin: bảng các đơn vị (số lớp, học viên,
  buổi tháng này).

---

## 7. Giáo trình và tiến độ

### 7.1 Soạn
- Giáo trình = tên + cấp độ + danh sách buổi (Buổi | Nội dung | Mục tiêu). Sắp xếp theo tên kiểu số tự nhiên ("Sơ cấp 2" trước "Sơ
  cấp 10"). Cấp độ để trống = suy từ tên bỏ mã cuối ("Sơ cấp 1A" → "Sơ cấp").
- **Giáo trình chung** (Chess Empire soạn) và **giáo trình của đơn vị**; đơn vị có nút "Sao chép thành giáo trình riêng" để chỉnh.
- **Tải file Excel / CSV:** mỗi sheet = 1 giáo trình; tự tìm cột "Buổi" + "Nội dung" (+ "Mục tiêu" nếu có; không có thì lấy cột 1, 2);
  ô Buổi trống → nối vào buổi phía trên.
- Lưu danh sách buổi bằng 1 RPC (xóa + thêm trong 1 giao dịch — lỗi không mất bài).
- Đổi chữ một bài → hỏi có cập nhật các buổi **chưa dạy** đang dùng chữ cũ không; buổi đã dạy giữ chữ cũ.
- Xóa giáo trình: lớp đang gắn mất liên kết, nội dung buổi đã xếp giữ nguyên; hỏi xác nhận kèm danh sách lớp đang gắn.

### 7.2 Áp vào lớp
- Chọn giáo trình + "bắt đầu từ bài" (gợi ý = sau bài lớn nhất lớp đã dạy). Chỉ đổi **buổi chưa dạy**, lần lượt nhận bài; hết giáo
  trình thì nối sang giáo trình **cùng cấp độ** xếp sau theo tên; hết cấp độ thì để trống. Không thêm buổi.
- Tùy chọn "Giữ nguyên buổi ghi tay" (mặc định bật): buổi chỉ có dòng gõ tay không nhận bài.
- Xem trước "Nội dung hiện tại → Sau khi áp"; cảnh báo buổi đã qua mà chưa bấm "Đã dạy".
- Bảng "Sắp xếp giáo trình": ma trận bài × buổi chưa dạy để kéo bài qua lại (quản lý sửa được cả buổi đã dạy).

### 7.3 Quy tắc nội dung
- **Mỗi bài là 1 dòng** trong nội dung buổi; so khớp **theo dòng**, không bao giờ so chuỗi con ("Ôn tập" ≠ "Ôn tập khai cuộc"). Dòng gõ
  tay giữ ở cuối.
- **Bài tiếp theo** cho buổi tự thêm: mốc = bài của **buổi muộn nhất có bài giáo trình**; lấy các bài sau mốc chưa nằm ở buổi nào
  (không lấy "bài xa nhất" — lớp có thể dạy trước bài 4–7 mà vẫn phải xếp bài 1–3).

### 7.4 Tiến độ học sinh
- **Tiến độ theo giáo trình (tự tính, không lưu):** bài em **đã học** = các dòng nội dung của buổi em Có mặt (lớp nhóm) / buổi Đã dạy
  (lớp 1-1), cộng buổi học bù đã hoàn thành. So với giáo trình lớp đang dùng → "Đã học 12 / 20 bài · Sơ cấp 1", thanh tiến độ, danh
  sách **bài bị lỡ** (vắng mà chưa bù / chưa nhận bài tập). Hàm thuần dùng chung cho hồ sơ em, tab Tiến độ của lớp, báo cáo tháng.
- **Đánh giá kỹ năng (giáo viên chấm):** tab Tiến độ của lớp = bảng em × kỹ năng, mỗi ô chấm 1–3 + ghi chú; lưu thành dòng mới mỗi lần
  chấm. Hồ sơ em có biểu đồ đơn giản kỹ năng theo thời gian. Nhận xét luôn do giáo viên viết.
- Tab Tiến độ của lớp còn có: chuyên cần từng em (% có mặt), số bài bị lỡ, rating hiện tại (nếu liên kết).

---

## 8. Học phí (chỉ quản lý đơn vị)

> **[CẦN CHỐT — cả mục này]** Đây là cách tính của CLB gốc, giữ làm mặc định. Trước giai đoạn Học phí, chủ dự án chốt: có gói buổi
> không, vắng có tính tiền không, hạn đóng ngày mấy, giá lớp nhóm theo gì, trường hợp nhà trường trả cả lớp tính ra sao, phụ huynh có
> được xem học phí của con không. Mỗi đơn vị có thể có bảng giá riêng.

### 8.1 Thiết lập
- Mỗi (em × lớp nhóm) hoặc (em × lớp 1-1) có **tối đa 1 thiết lập**, 2 hình thức:
  - **Theo tháng:** học xong mới thu. Tiền tháng = cộng giá các buổi **em đã học thật** trong tháng.
  - **Theo gói:** đóng trước N buổi. Lưu thiết lập lần đầu → tạo luôn khoản gói đầu; gói sau = nút **Gia hạn**.
- **Buổi đã học thật:** lớp nhóm = buổi điểm danh **Có mặt** (vắng không tính, buổi lớp nghỉ không tính); lớp 1-1 = buổi **Đã dạy**.
  Muốn thu đúng thì phải điểm danh / bấm Đã dạy đủ.
- Đổi hình thức **áp dụng từ tháng sau / gói sau:** tháng → gói: gói đầu tính từ ngày 01 tháng sau; gói → tháng: thu tháng từ tháng
  sau buổi cuối của gói. Đổi giá theo tháng áp cho tháng này + các tháng chưa đóng; theo gói áp từ gói gia hạn sau.
- Thêm em vào lớp / tạo lớp 1-1 xong → hỏi thiết lập học phí luôn. Lớp nhóm có nút "Thiết lập học phí cho cả lớp (N em chưa có)" —
  chỉ tạo cho em chưa có.
- "Ngừng thu": xóa thiết lập, tùy chọn xóa luôn khoản chưa đóng; khoản đã đóng giữ lại.

### 8.2 Giá 1 buổi
- **Lớp nhóm = theo trình độ lớp + thời gian học:** bảng "Học phí nhóm" (`tuition_rates`) của đơn vị: Trình độ × Thời gian học (phút)
  → Học phí 1 buổi. **Không nhập giá tay từng em.** Thời gian 1 buổi của em, theo thứ tự ưu tiên: thời lượng riêng ở buổi đó → thời
  lượng riêng ngày đó của em → thời lượng buổi lớp → lịch tuần. Thời gian em học chỉ chọn trong các mức có trong bảng của trình độ lớp.
  Đổi bảng giá / trình độ lớp → giá gói gia hạn sau theo giá mới, gói đã tạo giữ tiền.
- **Lớp 1-1 = theo thời gian học:** mỗi thiết lập có danh sách giá theo phút; mọi thời lượng trong lịch tuần phải có giá; thời lượng
  không có giá → lấy giá cao nhất. Thời lượng buổi 1-1 chỉ chọn trong danh sách này.
- Tiền 1 gói = cộng giá N buổi tiếp theo theo lịch của em.
- **Tên khoản** ghi cách tính: "8 buổi × 250.000 ₫" · "4 buổi T7 × 125.000 ₫ + 4 buổi CN × 250.000 ₫" · "2 buổi 60 phút × 350.000 ₫ +
  1 buổi 90 phút × 500.000 ₫".

### 8.3 Khoản tháng tự sinh
- Hàm đồng bộ (gọi khi mở các trang học phí, sau mọi thao tác đổi giá / lịch / điểm danh, và mỗi đêm). Quyết định bằng **hàm thuần**
  (vào: thiết lập, buổi đã học, khoản hiện có; ra: danh sách thêm / sửa / xóa):
  - tháng có buổi đã học mà chưa có khoản → thêm;
  - khoản **chưa đóng đồng nào, hoặc của tháng này** → cập nhật tiền + tên (không đè hạn đóng đã dời ở 8.5);
  - khoản chưa đóng mà tháng đó hết buổi đã học → xóa;
  - khoản tháng trước đã đóng tiền → giữ nguyên;
  - em đã rời lớp / lớp 1-1 đã hủy → không đụng khoản nào.
- Chạy lại bao nhiêu lần cũng ra cùng kết quả. Upsert theo unique `(plan_id, period_month)` — **unique đầy đủ, không có WHERE**.
- Bắt đầu thu từ tháng có buổi đã học đầu tiên. **Hạn = ngày `due_day` của tháng sau** (học tháng 09 → hạn 10/10).
- Lớp nhà trường trả theo sĩ số: mỗi tháng 1 khoản cho cả lớp = số buổi **Đã dạy** × (giá 1 học sinh × số học sinh, hoặc 1 giá cả nhóm
  / buổi).

### 8.4 Gói buổi
- **Số buổi đã dùng không lưu DB** — tính mỗi lần xem: xếp các buổi em đã học theo thời gian, mỗi buổi trừ vào gói đóng sớm nhất còn
  buổi (cùng lớp). Gói sau chỉ bắt đầu trừ khi gói trước hết.
- **Buổi 1 của gói:** mặc định tính từ **ngày đóng tiền** (lần đóng đầu đặt `start_date` = ngày đóng; chưa đóng thì tạm tính từ hôm
  nay). Hoặc quản lý chọn ngày ("Tính buổi từ ngày") → `start_fixed = true`. Có "Sửa ngày đóng" cho gói đã đóng.
- Em học sau khi gói cũ hết mà trước ngày tính của gói mới = **buổi học nợ**: không tự tính vào gói mới, chỉ báo, kèm nút "Tính cả các
  buổi này".
- Nhắc khi còn ≤ `remind_before_sessions` buổi: dự báo hết gói vào buổi nào, nút "Nhắc" (tin nháp) và "Gia hạn gói".

### 8.5 Đóng tiền
- Hộp Đóng tiền: số tiền, ngày, tiền mặt / chuyển khoản, ghi chú. Đóng gộp nhiều khoản → chia vào **khoản cũ trước**, mỗi khoản tối đa
  phần còn nợ, ghi nhiều dòng trong 1 RPC.
- **"Đóng chung tháng sau"** (ô tick ở mỗi tháng còn nợ): không gộp tiền, chỉ **dời hạn** sang tháng sau nữa + ghi chú; bỏ tick là
  hủy. Nhận ra khoản đã dời bằng cách so hạn với tháng học.
- Khoản bị giảm tiền sau khi đã đóng (vd sửa Có mặt → Vắng) → nhãn **"Đóng dư X ₫"**.
- Trạng thái (Đã đóng đủ / Còn nợ / Quá hạn / Chưa tới hạn), đã đóng, còn lại: tính trong app.
- Tin nhắc có sẵn **nội dung chuyển khoản** gợi ý (vd `HP T09 NGUYEN VAN A`) và (nếu đơn vị cấu hình tài khoản) mã VietQR dạng ảnh
  tĩnh để phụ huynh quét. **[CẦN CHỐT]**

### 8.6 Khóa an toàn tiền ở DB (bắt buộc, làm ngay từ đầu)
- `tuition_payments.created_by` do trigger điền = người ghi, không nhận giá trị gửi lên.
- Trigger khi thêm lần đóng: **khóa dòng khoản** (`select … for update`) rồi chặn nếu tổng đã đóng vượt số tiền khoản (2 người cùng ghi
  → người sau bị từ chối, báo số còn nợ).
- Chặn xóa lần đóng, chặn sửa số tiền / khoản / người thu; chặn xóa khoản đã có tiền → **không xóa được học viên đã đóng tiền** (gợi ý
  chuyển "Đã nghỉ"). Ghi nhầm thì thêm **lần đóng âm có ghi chú "Điều chỉnh"** do quản lý đơn vị ghi (vẫn lưu nhật ký), không xóa.
  **[CẦN CHỐT]**
- Các trigger chỉ áp khi có `auth.uid()` (người dùng app).
- Bảng khoản trên app **chỉ để xem**: chỉ có Đóng tiền, Nhắc, Lịch sử (ghi "thu bởi …"). Không có sửa / xóa khoản.

### 8.7 Trang Học phí
- Thẻ tổng: **Học phí đến hạn** (hạn trong tháng này hoặc trước), **Tổng học phí tháng này** (buổi đã học tháng này), Đã thu tháng
  này, Số khoản quá hạn. Khối nhắc gói sắp hết, khối "Chưa có học phí" (em đang học mà chưa thiết lập).
- 4 tab: **Còn nợ** (mỗi em từng tháng / gói chưa đóng, tick đóng chung, đóng gộp) · **Quá hạn** · **Đã đóng đủ** · **Tất cả**.
- Thiết lập: bảng học phí nhóm (Trình độ · Thời gian · Giá · Các lớp đang dùng), bảng giá lớp 1-1.
- Trang học phí của 1 em: các thẻ thiết lập từng lớp (sửa tại chỗ), bảng khoản, lớp em không còn học (để còn ngừng thu).
- Xuất Excel danh sách khoản theo tháng (cho kế toán).
- Tin nhắc học phí gửi phụ huynh: bản nháp sửa được rồi bấm Sao chép.

### 8.8 Học phí — giáo viên xem
- Chỉ xem học phí theo tháng các lớp mình: mỗi em số buổi × giá, học phí, Đã đóng / Còn nợ / Quá hạn / Chưa tới hạn; em đóng gói chỉ ghi
  "Đóng theo gói". RLS: giáo viên SELECT được khoản `monthly` + lần đóng của khoản đó thuộc lớp mình.

---

## 9. Theo dõi chess.com / lichess

### 9.1 Liên kết
- Mỗi em tối đa 1 tài khoản mỗi nền tảng (chỉ quản lý liên kết). Kiểm tra username có thật: chess.com `GET
  https://api.chess.com/pub/player/{username}`; lichess `GET https://lichess.org/api/user/{username}` (cả hai công khai, có CORS).
- Trình độ học viên có thể lấy theo rating 1 thể loại (`level_source`).
- Code gọi API tách theo nền tảng (`chesscomApi.ts`, `lichessApi.ts`) trả về cùng một kiểu dữ liệu; phần còn lại không biết nền tảng.

### 9.2 Đồng bộ
- chess.com: `…/{username}/stats` → snapshot hôm nay (upsert theo ngày); `…/{username}/games/{YYYY}/{MM}` → ván 30 ngày gần nhất, xóa
  ván cũ hơn. lichess: `/api/user/{username}` (rating) và `/api/games/user/{username}?since=…` (NDJSON).
- Mở trang học viên: chỉ tự đồng bộ khi lần gần nhất cũ hơn **6 giờ**; có nút "Đồng bộ ngay". Nhiều em: **lần lượt từng em**, nghỉ ~1,5
  giây giữa các em. 1 em lỗi không dừng các em khác.
- Việc hằng đêm gửi User-Agent có thông tin liên hệ.
- Lấy rating mới nhất của nhiều tài khoản: 1 RPC trả dòng mới nhất mỗi tài khoản.

### 9.3 Chênh lệch rating trong khoảng ngày (thứ tự ưu tiên)
1. Có snapshot đầu + cuối khoảng → trừ nhau (Tactics **chỉ** tính được cách này).
2. Thiếu snapshot → đọc archive ván các tháng của khoảng (tối đa ~14 tháng), lấy rating ván cuối trước khoảng và ván cuối trong khoảng;
   số ván thắng / thua / hòa cũng lấy từ đây.
3. Trong lúc (2) đang tải → tạm suy từ `rating_after` của các ván đã lưu.
- Khoảng ngày mặc định bám ngày snapshot mới nhất trong DB, không theo đồng hồ máy.

### 9.4 Thi đua trong lớp
- Tab Thi đua (lớp nhóm): bảng xếp hạng tăng rating theo thể loại + khoảng ngày; em chưa liên kết vẫn hiện "—". Dùng **cùng hàm tính**
  với trang học viên.
- **Cuộc đua** (`class_races`): tên, thể loại, ngày bắt đầu / kết thúc cố định; nhãn Sắp diễn ra / Đang diễn ra / Đã kết thúc.
- Gợi ý xếp lớp: lớp có khoảng rating → hộp thêm học viên xếp em "Hợp lớp" lên trước.

---

## 10. Học viên, báo cáo, giáo viên, tài khoản

- **Danh sách học viên:** tìm theo tên / trình độ / lớp ở trường, lọc trạng thái; mỗi em: trình độ / rating, lớp đang học, số buổi đã
  học, buổi gần nhất / sắp tới. Nhập hàng loạt từ Excel (tên, năm sinh, lớp ở trường, SĐT phụ huynh) — có xem trước, báo dòng trùng tên.
- **Hồ sơ:** thông tin, phụ huynh, lớp đang học, **tiến độ** (7.4), chess.com, học phí (quản lý), **Lịch sử đã học** theo tháng (ngày,
  lớp, thời lượng, nội dung bài, nhận xét), tháng này mở sẵn.
- **Tạm nghỉ / Học lại** (quản lý): tạm nghỉ từ ngày X → em tạm rời các lớp nhóm (nhớ lớp, bỏ điểm danh chưa chấm từ ngày đó), lớp 1-1
  → tạm dừng. Học lại từ ngày Y → vào lại đúng các lớp cũ (giữ lịch riêng), lớp 1-1 xếp lại buổi chưa dạy từ ngày Y (có xem trước).
- **Xóa học viên:** hộp xác nhận liệt kê những gì mất theo; em đã đóng tiền thì không cho xóa.
- **Báo cáo buổi** (để dán Zalo, nút Sao chép): tin chung cả lớp (tên lớp, buổi, ngày, nội dung, bài tập) — **không nêu tên em vắng**;
  tin riêng từng em vắng kèm hướng xử lý. Ký tên giáo viên.
- **Báo cáo tháng:** 1 lớp / 1 lớp 1-1 / mọi lớp của 1 em: số buổi, chuyên cần, nội dung đã học, tiến độ giáo trình, đánh giá kỹ năng,
  nhận xét giáo viên. Có bản in / lưu PDF (CSS in, không thêm thư viện). Không tự viết nhận xét.
- **Giáo viên** (quản lý): danh sách giáo viên của đơn vị, lớp phụ trách, **công tháng**: số buổi đã dạy và tổng phút theo
  `taught_by` (tách lớp nhóm / 1-1 / online / offline), xuất Excel. Giáo viên xem được công của chính mình (tổng hợp mọi đơn vị).
- **Tài khoản** (quản lý đơn vị): danh sách, tạo (email hoặc tên đăng nhập, mật khẩu, vai trò, tên; học sinh / phụ huynh thì chọn học
  viên), đặt lại mật khẩu, khóa, xóa. **Đơn vị** (super admin): tạo / sửa / tạm khóa đơn vị, chỉ định quản lý.

---

## 11. Giao diện

- **Ưu tiên điện thoại.** Dưới `lg`: header = logo + tên trang + nút tài khoản; **thanh điều hướng dưới đáy**: Hôm nay · Lịch · Lớp học
  · Học viên · Học phí (giáo viên: Hôm nay · Lịch · Lớp học · Học viên; học sinh / phụ huynh: Hôm nay · Lịch · Tiến độ). Mục còn lại vào
  menu tài khoản. Chừa đáy trang cho thanh dưới (kể cả `safe-area-inset-bottom`). Đăng nhập trên điện thoại vào thẳng "Hôm nay".
- **Máy tính:** menu trái (mở rộng / thu gọn thành cột icon, nhớ lựa chọn), ô chọn đơn vị ở đầu, mục theo quyền: Tổng quan · Hôm nay ·
  Lịch tuần · Học viên · Lớp học (Lớp nhóm / Lớp 1-1) · Giáo trình · Học phí · Giáo viên · Tài khoản; super admin thêm Đơn vị; khối
  "Gần đây" (4 trang vừa mở).
- **Bảng → thẻ trên điện thoại:** dưới `md` mỗi dòng thành 1 thẻ, ô có nhãn nhỏ, nút xuống hàng riêng. Không bắt vuốt ngang mới thấy nút.
- Thao tác ít dùng / nguy hiểm gom vào menu "⋯"; xác nhận bằng hộp thoại riêng (không dùng `window.confirm`).
- Màu khai báo 1 chỗ (`@theme` của Tailwind trong `src/index.css`). Màu theo logo Chess in Education Vietnam: **xanh navy `#0F2749`**
  (chữ, nút chính, menu) + **vàng `#E9BD36`** (điểm nhấn, mục đang chọn), nền sáng trắng / xám rất nhạt. Logo ở `public/brand/`:
  Chess in Education Vietnam (chính, ở header + màn đăng nhập) và Chess Empire ("phát triển bởi", màn đăng nhập + chân menu —
  hiện ghi chữ, **chờ file logo Chess Empire**).
- Trạng thái trống, đang tải, lỗi: mọi trang đều có (khung xám khi tải, câu hướng dẫn khi trống, nút "Thử lại" khi lỗi).
- `manifest.webmanifest` + icon 192/512 + apple-touch-icon → "Thêm vào màn hình chính" mở như ứng dụng.

---

## 12. Bẫy kỹ thuật (tránh ngay từ đầu)

- **Supabase trả tối đa 1.000 dòng mỗi lần và cắt im lặng.** Đọc bảng lớn dần (điểm danh, buổi, thành viên, học viên, khoản / lần đóng,
  đánh giá, snapshot, ván cờ, bài giáo trình) phải qua hàm `fetchAll` đọc từng trang `.range()` tới hết, luôn `order` theo cột duy nhất.
  Danh sách id dài dùng `.in()` theo từng lô ~150 id. Có 1 test quét code báo lỗi nếu truy vấn các bảng này thiếu `.range(` /
  `.single()` / `.maybeSingle()` / `.limit(` / `fetchAll(`.
- **Bảng có ≥ 2 khóa ngoại trỏ cùng 1 bảng** (vd `class_attendance` → `class_meetings` qua `meeting_id`, `makeup_meeting_id`,
  `carried_to_meeting_id`): embed PostgREST phải ghi rõ tên constraint (`class_meetings!class_attendance_meeting_id_fkey(...)`), không thì
  lỗi PGRST201.
- **View bỏ qua RLS và ghi xuyên được** — xem 4.3.
- **Quên `org_id`:** mọi lệnh thêm dòng phải gửi `org_id`; policy INSERT kiểm `with check (is_org_staff(org_id))`. Test pgTAP chéo đơn vị
  cho mọi bảng.
- Không embed `students(full_name)` trong code dùng chung mọi vai trò: RLS trả null nên tên thành trống mà không báo lỗi. Lấy tên qua view
  `student_names`.
- Lần dựng đầu, vai trò người dùng chưa tải xong → đừng chốt giá trị mặc định theo vai trò trong `useState(...)`; dùng `null` rồi
  `lựaChọn ?? mặcĐịnhTheoVaiTrò`.
- react-hook-form bỏ giá trị ô `disabled` khi submit → muốn khóa lựa chọn thì giới hạn option.
- Upsert PostgREST vẫn kiểm NOT NULL với cột không gửi → gửi kèm cột bắt buộc.
- Ghi bảng buổi học từ form: chỉ gửi đúng các cột thật (trường phụ trong state → lỗi "cột lạ").
- Ngày giờ: cột `date` / `time` không múi giờ; so sánh "đã qua giờ chưa" bằng giờ VN, không bằng giờ máy người dùng.
- Cloudflare trước chess.com chặn trình duyệt không giao diện (lỗi CORS giả) → thử tự động bằng trình duyệt có giao diện.
- File văn bản dùng LF (`.gitattributes`: `* text=auto eol=lf`).
- Không bao giờ đưa `service_role` key vào biến `VITE_*` (lộ ra trình duyệt).

---

## 13. Thứ tự làm

Mỗi giai đoạn: Claude trình kế hoạch → chủ dự án duyệt → làm → thử trên project thử → chủ dự án dùng thử → sang giai đoạn sau.
Thứ tự đã đổi so với bản gốc: **lớp nhóm + điểm danh lên trước** (đơn vị chủ yếu là trường học), lớp 1-1 làm sau vì dùng lại máy
sinh lịch đã có.

| # | Giai đoạn | Xong khi |
|---|---|---|
| 1 | **Nền:** dự án Vite, Supabase CLI + 2 project, đăng nhập (email / tên đăng nhập), `organizations` + `profiles` + `org_members` + hàm phân quyền, khung giao diện (menu trái, thanh dưới), Edge Function + trang Tài khoản + trang Đơn vị (thông tin đơn vị), CI (lint + test + build + test DB) | Quản lý tạo được giáo viên / học sinh, giáo viên tạo được học sinh; mỗi vai trò thấy đúng menu; test pgTAP: người đơn vị A không thấy gì của đơn vị B |
| 2 | **Học viên:** danh sách, thêm / sửa / trạng thái, phụ huynh, nhập Excel, hồ sơ, view cho giáo viên, `account_students` (gắn tài khoản học sinh với hồ sơ) | Giáo viên không đọc / ghi thẳng được bảng `students` (test pgTAP + thử bằng request) |
| 3 | **Lớp nhóm — lịch và buổi:** lịch tuần → 16 buổi, ngày nghỉ chung, Đã dạy, sửa / thêm buổi, nghỉ (đẩy / dồn + bỏ nghỉ), phân công giáo viên, `taught_by`; Lịch tuần + Hôm nay | Đánh dấu Đã dạy luôn còn 16 buổi phía trước; số buổi đúng thứ tự ngày; test hàm thuần đẩy / dồn đủ trường hợp |
| 4 | **Lớp nhóm — học viên và điểm danh:** thành viên, điểm danh + nhận xét + xử lý vắng, học bù, điểm danh nhanh (chịu được mất mạng) | Thêm em giữa chừng chỉ có điểm danh từ buổi chưa dạy gần nhất; điểm danh nhanh dùng tốt trên điện thoại |
| 5 | **Giáo trình + tiến độ:** giáo trình chung / đơn vị, soạn, tải Excel, áp vào lớp, bài tiếp theo, sắp xếp; tiến độ theo giáo trình, đánh giá kỹ năng | Áp giáo trình chỉ đổi buổi chưa dạy; hồ sơ em hiện đúng "đã học x / y bài" và bài bị lỡ |
| 6 | **Học phí** (sau khi chốt mục 8): bảng giá, thiết lập, khoản tháng tự sinh, gói buổi, đóng tiền, khóa an toàn tiền, nhật ký, trang Học phí, giáo viên xem | Test hàm thuần đủ trường hợp; đóng tiền vượt / xóa lần đóng trên project thử bị DB chặn |
| 7 | **Báo cáo:** buổi / tháng (+ bản in), tin nhắc học phí, công giáo viên | Tin chung không có tên em vắng; công giáo viên khớp số buổi Đã dạy |
| 8 | **Lớp 1-1:** dùng lại máy sinh lịch, học phí theo thời lượng | Như lớp nhóm: luôn 16 buổi phía trước, đúng thứ tự ngày |
| 9 | **chess.com / lichess:** liên kết, đồng bộ, chênh lệch rating, thi đua, cuộc đua | Số chênh lệch khớp số nền tảng hiển thị |
| 10 | **Hằng đêm + sao lưu** (mục 14) | Chạy thử "chỉ ghi nhật ký" không ghi gì; tệp sao lưu khôi phục được vào project thử |
| 11 | **Nâng cao** (khi cần): lịch riêng từng em, sửa lịch học cả lớp, lớp nhà trường trả theo sĩ số, tạm nghỉ / học lại, gợi ý xếp lớp, tài khoản phụ huynh, VietQR | — |

---

## 14. Vận hành

- **Dựng project Supabase mới:** tạo project → tắt "Allow new users to sign up" → tạo tài khoản super admin đầu tiên → `supabase link` +
  `supabase db push` (hoặc dán lần lượt các migration) → deploy Edge Function `admin-users`. Quyền bảng (`grant select, insert, update,
  delete … to authenticated`) nằm sẵn trong migration; RLS vẫn chặn từng dòng.
- **Đưa lên mạng:** biến môi trường `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key công khai được). Mọi đường dẫn trả
  `index.html` (Cloudflare Workers: `wrangler.jsonc` → `assets.not_found_handling = "single-page-application"`; **không** dùng
  `public/_redirects` — Workers coi `/* /index.html 200` là vòng lặp và hủy deploy). Supabase → Authentication → URL Configuration:
  Site URL = địa chỉ web.
- **Việc hằng đêm** (GitHub Actions, 01:00 giờ VN = cron `0 18 * * *` UTC, có nút chạy tay + ô "Chỉ chạy thử"): 1. đồng bộ khoản học
  phí tháng; 2. giữ 16 buổi chưa dạy cho mọi lớp đang học; 3. đồng bộ chess.com / lichess mọi tài khoản (lần lượt). Chạy cho **từng đơn
  vị**, đơn vị này lỗi không dừng đơn vị khác. Script **dùng chung hàm thuần với app**. Đăng nhập bằng 1 tài khoản super admin riêng tên
  "Máy chạy định kỳ" — **không dùng service_role**, để RLS và khóa an toàn tiền vẫn áp. Chế độ chạy thử: mọi lệnh ghi chỉ in ra nhật
  ký. Nhật ký chỉ ghi số lượng, **không ghi tên học sinh**. Thông tin đăng nhập để ở GitHub Secrets.
- **Sao lưu** (cùng lịch): đọc hết các bảng → JSON → gzip → mã hóa AES-256-GCM (khóa sinh từ mật khẩu sao lưu ≥ 12 ký tự) → lưu làm
  artifact của lần chạy 30 ngày. Script khôi phục: `--verify` (giải mã + đếm dòng) và khôi phục vào project đích (dùng service_role của
  project đích lúc chạy). Thêm bảng mới thì thêm vào danh sách sao lưu, đúng thứ tự khôi phục (bảng cha trước). Có test so danh sách
  sao lưu với danh sách bảng trong migration để không quên bảng.
- CI: mỗi lần đẩy code chạy lint + typecheck + test + build.

---

## 15. Quyết định đã chốt (Claude ghi thêm khi chủ dự án chốt)

- Tên dự án: **Chess in Education Vietnam** — phát triển bởi **Chess Empire**. Màu theo logo Chess in Education (navy + vàng), giao
  diện sáng sủa (mục 11). (27/10/2026)
- Mô hình: **trước mắt 1 đơn vị** (giao diện không có chọn đơn vị); **lâu dài là nền tảng bán cho nhiều trường** (kèm giáo trình,
  video, bài tập, bài kiểm tra) → DB làm nhiều đơn vị ngay từ đầu (mục 4). (27/10/2026)
- Học sinh **không cần email**, đăng nhập bằng tên đăng nhập; **giáo viên được tạo tài khoản học sinh**. (27/10/2026)
- Giáo viên có thấy SĐT phụ huynh: …
- Trình độ lớp nhóm và bảng giá: …
- Hạn đóng học phí: ngày … tháng sau
- Có dùng gói buổi: có / không
- Vắng có tính tiền: …
- Trường trả tiền cả lớp (theo sĩ số) hay phụ huynh trả từng em: …
- Ngày nghỉ chung (Tết, hè, lịch thi): …
- Sửa lần đóng ghi nhầm: lần đóng âm "Điều chỉnh" / sửa trong SQL Editor: …
- …
