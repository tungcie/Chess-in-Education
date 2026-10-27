# Chess-in-Education
Trang web quản lý dữ liệu của dự án Chess in Education tại Việt Nam do Chess Empire phát triển, trang web cung cấp cho các trường học, có thể phân bổ xuống giáo viên và quản lý học sinh như những user được thêm vào dưới sự cho phép của từng trường. Có sẵn tài liệu giảng dạy, video bài giảng, mini games, đấu luyện, phân tích và vẫn đang phát triển

## App quản lý học sinh, giáo viên, điểm danh, học phí, tiến độ

- Bản thiết kế, quy tắc và thứ tự các giai đoạn: [`CLAUDE.md`](CLAUDE.md)
- Đăng ký Supabase / GitHub / Cloudflare và đưa app lên mạng: [`docs/huong-dan-cai-dat.md`](docs/huong-dan-cai-dat.md)

Công nghệ: React + Vite + TypeScript, Tailwind CSS, Supabase (Postgres + Auth + Edge Function), Cloudflare Workers.

### Lệnh cho người phát triển

```bash
npm install
cp .env.example .env.local   # điền URL + anon key của project Supabase THỬ
npm run dev                  # chạy trên máy
npm run lint && npm run typecheck && npm test && npm run build
npm run test:db              # migration + test phân quyền pgTAP trên Postgres tạm (cần Postgres 15+, pgTAP)
```
