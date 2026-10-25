# Kênh video AI ngắn – Chess in Education

Tài liệu nghiên cứu công cụ (GitHub) và quy trình đề xuất để sản xuất video ngắn
(TikTok / YouTube Shorts / Reels) về cờ vua với các nhân vật của dự án.

> Cập nhật: 10/2026. Số sao GitHub thay đổi nhanh, nên coi đây là ảnh chụp tại thời điểm viết.
> Trước khi dùng thương mại, **luôn đọc file LICENSE** của từng repo (xem cột "Giấy phép").

---

## 1. Kết luận nhanh

Video cờ vua có một lợi thế lớn: **bàn cờ và nước đi là dữ liệu chính xác** (FEN/PGN).
Không nên bắt AI tạo video "vẽ" bàn cờ, vì mô hình text-to-video gần như luôn vẽ sai
quân, sai ô, sai nước đi, và khán giả cờ sẽ bắt lỗi ngay.

Cách hiệu quả nhất là **kết hợp hai lớp**:

| Lớp | Làm bằng gì | Vai trò |
|---|---|---|
| **Bàn cờ + chữ + hiệu ứng** | Code (Remotion hoặc HyperFrames) do Claude viết, dữ liệu lấy từ PGN/FEN qua `python-chess` | Luôn đúng luật cờ, đồng bộ thương hiệu, render hàng loạt |
| **Nhân vật + cảnh "bắt mắt"** | Ảnh/video AI (Midjourney, Flux, Kling, Veo, Sora, Seedance…) với ảnh tham chiếu cố định của nhân vật | Mở đầu (hook) 1–3 giây, phản ứng cảm xúc, kể chuyện |
| **Giọng đọc tiếng Việt** | VieNeu-TTS (miễn phí, clone giọng) hoặc ElevenLabs | Lồng tiếng, đồng bộ phụ đề theo từ |

Claude (Claude Code) đóng vai **đạo diễn + biên tập**: viết kịch bản, lập storyboard,
viết code dựng hình, ghép các clip AI, sinh phụ đề và xuất file 9:16.

---

## 2. Công cụ tìm được trên GitHub

### 2.1. Skill / agent cho Claude Code làm video (quan trọng nhất)

| Repo | Sao | Giấy phép | Dùng để làm gì | Đánh giá cho dự án |
|---|---|---|---|---|
| [remotion-dev/skills](https://github.com/remotion-dev/skills) | ~5.7k | xem repo | Skill **chính chủ** của Remotion: tạo composition, animation, phụ đề, render | ⭐ Nền tảng nên cài đầu tiên. Lưu ý: Remotion yêu cầu **giấy phép công ty** nếu tổ chức >3 người — Chess Empire cần kiểm tra |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | ~72k | Apache-2.0 | Viết HTML/CSS → render MP4, có plugin Claude Code | ⭐ Phương án thay Remotion **miễn phí thương mại**. Dễ nhúng bàn cờ HTML (chessground) |
| [calesthio/OpenMontage](https://github.com/calesthio/OpenMontage) | ~72k | AGPL-3.0 | "Studio" agent đầy đủ: 12 pipeline, nghiên cứu → kịch bản → tạo tài sản AI → dựng → xuất | Mạnh cho thử nghiệm, nhưng lớn và phức tạp. AGPL: dùng nội bộ được, nếu sửa và cung cấp như dịch vụ thì phải mở mã |
| [Vincentwei1021/video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) | ~13k | Apache-2.0 | 152 "công thức cảnh quay" (shot recipe) + template Remotion | Tốt để học cách làm chuyển động điện ảnh, hook đẹp |
| [Vincentwei1021/video-talkcraft](https://github.com/Vincentwei1021/video-talkcraft) | ~1.8k | xem repo | Video giải thích có lồng tiếng, đồng bộ theo từ, "chống kiểu slideshow" | ⭐ Rất hợp với video **giải thích thế cờ / bài học** |
| [Vincentwei1021/anything2explainer](https://github.com/Vincentwei1021/anything2explainer) | ~2.7k | **PolyForm Noncommercial** | Chủ đề → video giải thích có TTS + phụ đề | Phương pháp hay, nhưng **không dùng thương mại được** → chỉ tham khảo |
| [nateherkai/herk-edit-kit](https://github.com/nateherkai/herk-edit-kit) | ~2.2k | xem repo | 15 skill dựng Shorts/Reels: cắt theo transcript, kể chuyện, 406 thẻ motion graphics | Hợp nếu có quay người thật (thầy/cô, học sinh) rồi để Claude dựng |
| [howseen-ai/claude-motion-design](https://github.com/howseen-ai/claude-motion-design) | ~0.7k | xem repo | Motion design bằng HTML + Playwright + ffmpeg | Nhẹ, không cần Remotion |
| [zhuyansen/awesome-claude-video-skills](https://github.com/zhuyansen/awesome-claude-video-skills) | ~0.9k | — | Danh sách 180 repo skill video, **có chấm điểm an toàn** | Dùng để tra cứu thêm |

### 2.2. Pipeline tự động video ngắn (topic → video)

| Repo | Sao | Giấy phép | Ghi chú |
|---|---|---|---|
| [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | ~135k | xem repo | Một lệnh: chủ đề → kịch bản → stock footage → TTS → phụ đề. Nhanh nhưng kiểu "faceless" chung chung, dùng video stock → **không hợp** nội dung cờ chính xác |
| [gyoridavid/short-video-maker](https://github.com/gyoridavid/short-video-maker) | ~1.4k | MIT | MCP server + REST API dựng Shorts bằng Remotion → Claude gọi trực tiếp được |
| [Cuongyd196/auto-video-gen](https://github.com/Cuongyd196/auto-video-gen) | ~0.2k | MIT | Dự án Việt: URL → video 9:16, **TTS tiếng Việt** + motion graphic. Tham khảo tốt cách xử lý tiếng Việt |
| [ChrisChen667788/wind-comic](https://github.com/ChrisChen667788/wind-comic) | ~0.7k | MIT | Multi-agent: 1 câu → kịch bản → storyboard → **video nhân vật nhất quán** (MJ, Veo, Kling, Minimax…) |
| [xuanyustudio/LocalMiniDrama](https://github.com/xuanyustudio/LocalMiniDrama) | ~2.2k | xem repo | Làm "phim ngắn/truyện tranh động" AI chạy local: truyện → storyboard → video |

### 2.3. Công cụ cờ vua

| Repo | Dùng để làm gì |
|---|---|
| [niklasf/python-chess](https://github.com/niklasf/python-chess) | Đọc PGN/FEN, kiểm tra nước đi hợp lệ, gọi Stockfish. **Nguồn sự thật** cho mọi bàn cờ trong video |
| [lichess-org/chessground](https://github.com/lichess-org/chessground) | Bàn cờ HTML của Lichess, có mũi tên/ô tô màu → nhúng vào HyperFrames/Remotion |
| [wdjoyner/chess-animator](https://github.com/wdjoyner/chess-animator) | PGN → video Manim có thanh đánh giá Stockfish, danh sách nước, bình luận |
| [swoyer2/manim_chess](https://github.com/swoyer2/manim_chess) | Thư viện Manim vẽ bàn cờ, thanh đánh giá (phong cách 3Blue1Brown) |

### 2.4. Giọng đọc tiếng Việt

| Repo | Ghi chú |
|---|---|
| [pnnbao97/VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) | Apache-2.0, ~2.9k sao, clone giọng tức thì, chạy được trên CPU, 48kHz → ⭐ có thể tạo **giọng riêng cho từng nhân vật** |
| [nguyenthienhy/F5-TTS-Vietnamese](https://github.com/nguyenthienhy/F5-TTS-Vietnamese) | F5-TTS fine-tune tiếng Việt |
| [zeroweight-ai/ZeroTTS](https://github.com/zeroweight-ai/ZeroTTS) | Nhẹ, zero-shot, real-time trên CPU |

### 2.5. Đăng bài tự động

| Repo | Ghi chú |
|---|---|
| [dreammis/social-auto-upload](https://github.com/dreammis/social-auto-upload) | ~15.8k sao, tự upload lên TikTok, YouTube (và Douyin, Bilibili…). Dùng tự động hóa trình duyệt → có rủi ro bị nền tảng hạn chế; nên dùng **YouTube Data API chính thức** khi có thể |

---

## 3. Quy trình đề xuất

### Giai đoạn 0 – Chuẩn bị "bộ nhận diện nhân vật" (làm 1 lần)

1. Với mỗi nhân vật: 1 **ảnh tham chiếu chuẩn** (mặt trước, nền trơn) + 4–6 ảnh biểu cảm
   (vui, ngạc nhiên, suy nghĩ, ăn mừng, buồn).
2. Viết **"character sheet"** dạng văn bản: tên, tính cách, màu sắc chủ đạo, câu cửa miệng,
   mô tả ngoại hình cố định (dùng y nguyên trong mọi prompt).
3. Chọn giọng cho từng nhân vật (clone bằng VieNeu-TTS từ 10–20 giây giọng mẫu, **có sự đồng ý** của người cho giọng).
4. Bộ thương hiệu: logo, font, bảng màu, khung bàn cờ, nhạc hiệu 2 giây.

→ Lưu tất cả vào `docs/ai-video/brand/` để Claude dùng lại mọi lần.

### Giai đoạn 1 – Các định dạng nội dung nên thử (mỗi video 30–60 giây)

| Định dạng | Mô tả | Mức tự động hóa |
|---|---|---|
| **"Câu đố 15 giây"** | Hook: nhân vật hỏi "Trắng đi và chiếu hết sau 2 nước?" → bàn cờ → đếm ngược → lời giải có mũi tên | Rất cao: chỉ cần FEN + lời giải. Có thể ra hàng ngày |
| **"Bẫy khai cuộc"** | Nhân vật bị lừa / lừa đối thủ, bàn cờ chạy nước đi, phản ứng cảm xúc | Cao |
| **"Cờ vua dạy gì cho con?"** | Kể chuyện ngắn: tình huống đời thường ↔ bài học tư duy (đúng tinh thần "Học Cách Nghĩ") | Trung bình: cần cảnh AI nhân vật |
| **"Ván cờ huyền thoại trong 60 giây"** | Tóm tắt ván cờ nổi tiếng với thanh đánh giá Stockfish | Cao (PGN có sẵn) |
| **Hậu trường lớp học** | Clip thật ở trường + Claude dựng phụ đề/hiệu ứng (herk-edit-kit) | Trung bình, cần xin phép phụ huynh/nhà trường |

### Giai đoạn 2 – Dây chuyền sản xuất một video

```
Ý tưởng/FEN/PGN ─► [Claude] kịch bản + storyboard (JSON)
                    │
                    ├─► python-chess: kiểm tra mọi nước đi hợp lệ, xuất danh sách khung bàn cờ
                    ├─► TTS (VieNeu-TTS / ElevenLabs): giọng đọc + mốc thời gian theo từ
                    ├─► Công cụ ảnh/video AI: 1–3 clip nhân vật (hook, phản ứng)
                    │
                    ▼
            [Claude + Remotion/HyperFrames] dựng 1080×1920:
            bàn cờ động + clip nhân vật + phụ đề lớn + nhạc + logo
                    │
                    ▼
            Người duyệt (bắt buộc) ─► đăng TikTok / Shorts / Reels
```

Nguyên tắc:
- **Storyboard là JSON** (cảnh, thời lượng, FEN, nước đi, lời thoại, nhân vật, biểu cảm) →
  cùng một storyboard xuất được nhiều phiên bản (tiếng Việt/tiếng Anh, 9:16/16:9).
- **Không để AI video vẽ bàn cờ.** Bàn cờ luôn render bằng code từ FEN.
- **3 giây đầu quyết định**: luôn mở bằng câu hỏi/tình huống + nhân vật, không mở bằng logo.
- **Phụ đề to, nằm giữa-trên**, tránh vùng nút của TikTok (khoảng 20% dưới và mép phải).
- **Luôn có người duyệt** trước khi đăng (đúng luật cờ, đúng thông điệp giáo dục, không lỗi chính tả).

### Giai đoạn 3 – Đo lường và lặp lại

Mỗi 2 tuần xem: tỉ lệ xem hết, lượt xem lại, lượt lưu/chia sẻ, bình luận.
Định dạng nào thắng → làm thành **template** để Claude sản xuất hàng loạt.

---

## 4. Lưu ý quan trọng

- **Trẻ em trong video**: kênh hướng tới học sinh → tuân thủ chính sách nội dung trẻ em của
  YouTube (đánh dấu "Made for Kids" nếu phù hợp) và TikTok; xin phép bằng văn bản nếu xuất hiện học sinh thật.
- **Gắn nhãn nội dung AI**: YouTube và TikTok yêu cầu khai báo nội dung tạo bằng AI có tính chân thực.
- **Giấy phép**: Remotion (công ty >3 người cần giấy phép), anything2explainer (cấm thương mại),
  OpenMontage (AGPL). HyperFrames và VieNeu-TTS là Apache-2.0 – an toàn nhất cho thương mại.
- **Bảo mật**: chỉ cài skill từ nguồn uy tín; đọc qua mã trước khi chạy (danh sách
  awesome-claude-video-skills có chấm điểm an toàn). Không đưa API key vào repo.
- **Upload tự động** qua tự động hóa trình duyệt có thể vi phạm điều khoản nền tảng → ưu tiên API chính thức hoặc đăng tay.

---

## 5. Bước tiếp theo đề xuất

1. Chọn công cụ dựng: **HyperFrames** (miễn phí thương mại) hoặc **Remotion** (nếu mua giấy phép).
2. Gửi cho Claude: ảnh nhân vật + character sheet + logo/màu.
3. Claude dựng **template "Câu đố 15 giây"** đầu tiên trong repo: nhập FEN + lời giải → ra MP4 9:16.
4. Làm 5–10 video thử, đăng thử 2 tuần, đo lường, rồi mở rộng sang các định dạng khác.
