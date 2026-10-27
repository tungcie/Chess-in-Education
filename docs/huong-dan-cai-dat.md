# Hướng dẫn cài đặt — đăng ký Supabase, GitHub, Cloudflare

Làm theo thứ tự A → E. Lần đầu mất khoảng 30–45 phút. Giao diện các trang web có thể đổi tên nút đôi chút; nếu không thấy đúng
chữ, tìm mục có ý nghĩa tương tự hoặc hỏi Claude.

> **Giữ bí mật:** mật khẩu database, *access token*, *service_role / secret key* **không bao giờ** gửi qua chat hay dán vào code.
> Chúng chỉ nằm trong GitHub → Settings → Environments (phần B). Thứ duy nhất được phép công khai là **Project URL** và
> **anon / publishable key**.

---

## A. Supabase — nơi chứa dữ liệu và tài khoản (miễn phí)

1. Vào <https://supabase.com> → **Start your project** → đăng nhập bằng **GitHub** (dùng luôn tài khoản GitHub đang có).
2. Tạo **Organization**: tên `Chess Empire`, gói **Free**.
3. **New project** — project THỬ:
   - Name: `cie-thu`
   - Database Password: bấm **Generate a password**, rồi **chép lưu vào nơi an toàn** (ghi chú điện thoại có khóa, trình quản lý
     mật khẩu…). Mất mật khẩu này thì phải đặt lại.
   - Region: **Southeast Asia (Singapore)** — gần Việt Nam nhất, app chạy nhanh hơn.
   - Bấm **Create new project**, đợi 1–2 phút.
4. Làm lại bước 3 cho project THẬT: Name `cie-that` (mật khẩu khác, cũng lưu lại).
5. Ở **từng** project:
   - **Authentication → Sign In / Providers**: tắt **Allow new users to sign up** → Save. (Tài khoản chỉ do quản lý / giáo viên
     tạo trong app.)
   - Giữ **Email** provider ở trạng thái bật (đăng nhập bằng mật khẩu cần nó).
6. Ghi lại 3 thông tin của **từng** project:
   - **Project ref**: Project Settings → General → *Project ID* (chuỗi khoảng 20 chữ cái).
   - **Project URL**: `https://<project-ref>.supabase.co` (cũng thấy ở Project Settings → Data API).
   - **Anon / publishable key**: Project Settings → API Keys → *Publishable key* (hoặc tab *Legacy API keys* → `anon public`).
7. Tạo **Access token** (dùng cho GitHub tự đưa code lên Supabase): mở <https://supabase.com/dashboard/account/tokens> →
   **Generate new token**, tên `github-deploy`, thời hạn dài nhất.
   - Có lựa chọn **Classic** → chọn loại đó (không phải chọn quyền).
   - Chỉ có loại giới hạn quyền (scoped) → Projects: chọn `cie-thu` và `cie-that`; Permissions: **Read-write** cho Database, Edge
     Functions, Projects (không chắc thì Read-write tất cả).
   - Bấm Generate → hiện **một dòng chữ dài + nút Copy** (đầu chuỗi có thể là `sbp_…` hoặc khác) → chép ngay, chỉ hiện 1 lần.
   - Deploy báo lỗi 403 / "missing permissions" → token thiếu quyền: xóa, tạo lại với nhiều quyền hơn.

> Gói Free: project **không có ai dùng trong 7 ngày sẽ bị tạm dừng** (dữ liệu vẫn còn, vào trang Supabase bấm *Restore* là chạy
> lại). Project thật có người dùng hằng ngày nên không bị. Sao lưu tự động hằng đêm làm ở giai đoạn 10.

---

## B. GitHub — cất bí mật để tự đưa code lên Supabase

> Cần gộp nhánh code của Claude vào `main` trước (GitHub chỉ hiện nút chạy tay cho workflow đã nằm ở `main`). Anh bảo Claude
> "tạo pull request", rồi bấm **Merge** trên GitHub.

1. Vào repo `Chess-in-Education` trên GitHub → **Settings → Environments → New environment** → tên `supabase-thu` → Configure.
2. Trong môi trường đó, mục **Environment secrets → Add environment secret**, thêm 3 cái (của project THỬ):

   | Name | Value |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | token ở bước A.7 |
   | `SUPABASE_PROJECT_REF` | project ref của `cie-thu` |
   | `SUPABASE_DB_PASSWORD` | mật khẩu database của `cie-thu` |

3. Tạo thêm môi trường `supabase-that` với 3 secret của project THẬT, và tick **Required reviewers** → chọn chính anh (để mỗi lần
   đưa lên project thật phải bấm duyệt).
4. Chạy: tab **Actions → Supabase — deploy → Run workflow** → `target: thu`, giữ tick **dry_run** → Run. Xem kết quả: thấy danh
   sách migration sẽ chạy là đúng. Chạy lại lần nữa **bỏ tick dry_run** để tạo bảng thật + đưa Edge Function `admin-users` lên.
5. Khi project thử chạy ổn mới làm lại bước 4 với `target: that`.

**Cách thay thế (không dùng GitHub Actions):** mở từng file trong `supabase/migrations/` theo thứ tự tên, chép toàn bộ nội dung vào
Supabase → **SQL Editor → New query → Run**. Edge Function thì vẫn nên đưa lên bằng GitHub Actions.

---

## C. Tạo tài khoản quản trị đầu tiên

Làm ở project THỬ trước, sau đó ở project THẬT.

1. Supabase → **Authentication → Users → Add user → Create new user**: email + mật khẩu của anh, tick **Auto Confirm User**.
2. **SQL Editor → New query**: dán nội dung file `supabase/setup/khoi_tao.sql`, sửa dòng `v_email` thành email vừa tạo (có thể sửa
   tên đơn vị) → **Run**. Thấy dòng "Xong: …" là được.

---

## D. Cloudflare Workers — đưa trang web lên mạng (miễn phí, dùng thương mại được)

Cloudflare giờ tạo dự án mới dạng **Workers** (không phải Pages). Repo đã có sẵn file `wrangler.jsonc` để Workers chạy app.

1. Đăng ký ở <https://dash.cloudflare.com/sign-up> (email + mật khẩu, xác nhận email).
2. **Workers & Pages → Create → Import a repository** (Connect to Git) → cho phép Cloudflare đọc GitHub → chọn repo
   `Chess-in-Education`.
3. Cấu hình:
   - Project name: `chess-in-education` (phải **trùng** dòng `"name"` trong `wrangler.jsonc`; đặt tên khác thì sửa file đó cho khớp)
   - Production branch: `main`
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy` (thường điền sẵn)
4. **Biến lúc build** — Worker → **Settings → Build → Variables and secrets** (KHÔNG phải mục *Variables and Secrets* của runtime;
   app đọc biến lúc build):
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon / publishable key
   - `NODE_VERSION` = `22`

   Giai đoạn dùng thử: điền thông tin project **thử** (`cie-thu`). Khi dùng thật thì đổi sang project **thật** rồi build lại.
5. **Deployments → Retry / Redeploy** (hoặc đẩy code mới lên `main`). Xong sẽ có địa chỉ dạng
   `https://chess-in-education.<tên-tài-khoản>.workers.dev` (sau này gắn tên miền riêng được).
6. Supabase (project đang dùng) → **Authentication → URL Configuration → Site URL** = địa chỉ web vừa có.

---

## E. Gửi cho Claude

Chỉ cần gửi: **địa chỉ web** (bước D.5) và báo "đã chạy xong deploy + khoi_tao". Không gửi mật khẩu / token / secret key.

### Thử giai đoạn 1 (trên project thử)

1. Đăng nhập bằng email quản trị → thấy đủ menu (Tổng quan, Hôm nay, …, Tài khoản, Đơn vị).
2. **Tài khoản → Tạo tài khoản** → vai trò Giáo viên, đăng nhập bằng email → bấm Sao chép thông tin.
3. Đăng xuất, đăng nhập bằng giáo viên → menu chỉ còn Hôm nay, Lịch tuần, Lớp học, Học viên, Học phí, Tài khoản.
4. Giáo viên **tạo tài khoản học sinh bằng tên đăng nhập** (không email) → đăng xuất → đăng nhập bằng tên đăng nhập đó → chỉ thấy
   Hôm nay, Lịch tuần, Lớp học, Tiến độ.
5. Đăng nhập lại quản lý → khóa tài khoản học sinh → học sinh đăng nhập sẽ thấy "Tài khoản chưa được cấp quyền". Mở khóa lại.
6. **Đơn vị** → sửa địa chỉ, số điện thoại → Lưu.
7. Thử trên điện thoại: thanh menu nằm dưới đáy; Safari / Chrome → *Thêm vào màn hình chính* → mở như ứng dụng.
