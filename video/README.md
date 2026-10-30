# Xưởng video ngắn Chess Empire

Dựng video dọc 9:16 (TikTok / Shorts / Reels) về cờ vua bằng code. Kịch bản là một file JSON.
Bàn cờ luôn đúng luật vì mọi nước đi được `python-chess` kiểm tra.

```
video/
  assets/            logo, ảnh HLV, quân cờ (cburnett), font Be Vietnam Pro
  src/coach.js       nhân vật hoạt hình HLV Tùng (SVG, nhép miệng theo giọng đọc)
  src/mon.js         nhân vật bé Mon (em bé cầm con Xe)
  src/player.html    bố cục + hiệu ứng: vẽ khung hình tại thời điểm t
  tools/build.py     kịch bản → giọng đọc, thế cờ, mốc thời gian, âm thanh
  tools/render.js    timeline → MP4 1080×1920 (Playwright + ffmpeg)
  episodes/<tập>/script.json   kịch bản từng tập
```

## Làm một tập mới

```bash
pip install -r video/requirements.txt          # cần ffmpeg, Node 22 và Playwright
cd video
python tools/build.py episodes/01-khai-cuoc     # tạo build/timeline.json + build/audio.wav
node tools/render.js episodes/01-khai-cuoc --stills 3,10,30   # xem nhanh vài khung hình
node tools/render.js episodes/01-khai-cuoc      # xuất build/video.mp4 (~2,5 phút)
```

## Viết kịch bản (`script.json`)

Thiết lập chung ở đầu file:

| Trường | Ví dụ | Ý nghĩa |
|---|---|---|
| `character` | `coach` / `mon` | Nhân vật dẫn |
| `theme` | `gold` / `magic` | Phong cách: vàng sang trọng hoặc phép thuật (tia sáng, nổ, chớp, rung màn hình) |
| `music` | `calm` / `magic` | Nhạc nền tự tổng hợp |
| `voice`, `rate`, `pitch`, `formant` | `vi-VN-HoaiMyNeural`, `-2%`, `+30Hz`, `1.15` | Giọng đọc; `formant` > 1 làm giọng nghe như trẻ con |
| `endcard` | `{ "name": "Bé Mon", ... }` | Chữ ở màn kết |
| `boardBox` | `{ "x": 130, "y": 470, "size": 820 }` | Vị trí/kích thước bàn cờ (chừa chỗ cho phương trình phía trên) |
| `boardStyle` | `{ "light": "#F6EEDC", "dark": "#D8C7A3" }` | Màu ô sáng/tối |

Mỗi cảnh có thể đặt thế cờ ban đầu bằng `"board": { "fen": "..." }` (hoặc `{ "reset": true }` cho thế khai cuộc).

Mỗi cảnh có `header` (chip + tiêu đề) và danh sách `phrases`. Mỗi câu thoại gồm:

- `text`: chữ hiện trên phụ đề; `say` (tuỳ chọn): cách đọc cho TTS, ví dụ `e4` → `e bốn`.
- `events`: việc xảy ra trong lúc đọc câu đó. `word` là số thứ tự **từ đang đọc** (bắt đầu từ 0)
  để sự kiện khớp đúng lời nói.

| `type` | Tham số | Tác dụng |
|---|---|---|
| `move` | `san` | Đi một nước (ký hiệu SAN: `e4`, `Nf3`, `O-O`, `Qxd8+`) |
| `line` | `san[]`, `step`, `reset` | Tua nhanh cả chuỗi nước |
| `highlight` | `squares[]`, `color` (gold/red/green) | Tô ô |
| `arrow` | `from`, `to`, `color` | Mũi tên |
| `dots` | `from`, `mode` (`attacks`/`moves`) | Chấm các ô quân ở `from` kiểm soát, hoặc chỉ các ô đi được (tự tính) |
| `shield` | `square` | Biểu tượng khiên “an toàn” |
| `sticker` | `text`, `color` | Tem chữ lớn |
| `label` | `text` | Nhãn nhỏ dưới bàn cờ |
| `beam` | `from`, `only[]` (tuỳ chọn) | Tia phép thuật theo đường đi của Xe; tự đánh dấu quân chặn (✗) và quân ăn được |
| `fen` | `fen` | Đổi thế cờ giữa chừng |
| `flash` / `magic` | – | Chớp sáng + rung màn hình / tia lửa quanh tay nhân vật (chỉ `theme: magic`) |
| `countdown` | `n` | Số đếm ngược lớn giữa màn hình |
| `move` + `"boom": true` | | Nổ tung khi ăn quân |
| `heat` | `piece` (R/B/Q), `rings[]`, `stagger` | Bản đồ số ô đi được trên bàn trống, tô màu theo vòng (Hậu = màu Xe phối màu Tượng) |
| `equation` | `a`, `b`, `c` | Phương trình [Xe] a + [Tượng] b = [Hậu] c phía trên bàn cờ |
| `clear` | – | Xoá tô ô / mũi tên / tem trong cảnh |
| `recap`, `endcard` | `index` | Thẻ tóm tắt và màn kết (cảnh `layout: "outro"`) |

## Ghi chú

- Giọng đọc mẫu là `vi-VN-NamMinhNeural` (edge-tts), chỉ dùng để làm thử. Khi đăng chính thức nên dùng
  giọng thật của HLV (thu âm, hoặc nhân bản giọng bằng VieNeu-TTS / ElevenLabs).
- Quân cờ: bộ cburnett (Colin M.L. Burnett, giấy phép GPLv2+/BSD). Font Be Vietnam Pro: SIL OFL (`assets/fonts/OFL.txt`).
- Nhạc nền do script tự tổng hợp, không dính bản quyền.
