# Xưởng video ngắn Chess Empire

Dựng video dọc 9:16 (TikTok / Shorts / Reels) về cờ vua bằng code. Kịch bản là một file JSON.
Bàn cờ luôn đúng luật vì mọi nước đi được `python-chess` kiểm tra.

```
video/
  assets/            logo, ảnh HLV, quân cờ (cburnett), font Be Vietnam Pro
  src/coach.js       nhân vật hoạt hình HLV Tùng (SVG, nhép miệng theo giọng đọc)
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
| `dots` | `from` | Chấm các ô mà quân ở `from` kiểm soát (tự tính) |
| `shield` | `square` | Biểu tượng khiên “an toàn” |
| `sticker` | `text`, `color` | Tem chữ lớn |
| `label` | `text` | Nhãn nhỏ dưới bàn cờ |
| `clear` | – | Xoá tô ô / mũi tên / tem trong cảnh |
| `recap`, `endcard` | `index` | Thẻ tóm tắt và màn kết (cảnh `layout: "outro"`) |

## Ghi chú

- Giọng đọc mẫu là `vi-VN-NamMinhNeural` (edge-tts), chỉ dùng để làm thử. Khi đăng chính thức nên dùng
  giọng thật của HLV (thu âm, hoặc nhân bản giọng bằng VieNeu-TTS / ElevenLabs).
- Quân cờ: bộ cburnett (Colin M.L. Burnett, giấy phép GPLv2+/BSD). Font Be Vietnam Pro: SIL OFL (`assets/fonts/OFL.txt`).
- Nhạc nền do script tự tổng hợp, không dính bản quyền.
