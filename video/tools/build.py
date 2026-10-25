"""Dựng dữ liệu cho một tập video từ script.json.

    python tools/build.py episodes/01-khai-cuoc

Các bước:
  1. Đọc từng câu thoại → TTS tiếng Việt (edge-tts) + mốc thời gian từng từ.
  2. Dùng python-chess phát lại mọi nước đi (sai luật là dừng ngay) → danh sách thế cờ.
  3. Gắn sự kiện (nước đi, mũi tên, tô ô, sticker…) vào đúng từ đang được đọc.
  4. Trộn giọng đọc + tiếng đặt quân + nhạc nền → build/audio.wav.
  5. Tính độ mở miệng nhân vật theo âm lượng → build/timeline.json.
"""
import asyncio
import json
import subprocess
import sys
from pathlib import Path

import chess
import edge_tts
import numpy as np

SR = 48000
FPS = 30
TAIL = 1.6          # giây giữ lại sau câu cuối
HOOK_LEAD = 0.25    # khoảng lặng đầu video


def tts(text, voice, rate, out_mp3):
    """Gọi edge-tts, trả về danh sách (thời điểm bắt đầu, từ)."""
    async def run():
        words = []
        comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
        with open(out_mp3, "wb") as f:
            async for ch in comm.stream():
                if ch["type"] == "audio":
                    f.write(ch["data"])
                elif ch["type"] == "WordBoundary":
                    words.append((ch["offset"] / 1e7, ch["text"]))
        return words
    return asyncio.run(run())


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def trim_silence(x, thr=0.01):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x, 0.0
    start = max(0, idx[0] - int(0.02 * SR))
    end = min(len(x), idx[-1] + int(0.05 * SR))
    return x[start:end], start / SR


def click_sound():
    """Tiếng đặt quân gỗ: nhiễu ngắn + cộng hưởng tần số thấp."""
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(n) * np.exp(-t * 90)
    body = np.sin(2 * np.pi * 420 * t) * np.exp(-t * 55) + 0.5 * np.sin(2 * np.pi * 900 * t) * np.exp(-t * 80)
    s = 0.35 * noise + 0.8 * body
    return (s / np.abs(s).max() * 0.35).astype(np.float32)


def music_bed(duration):
    """Nền nhạc nhẹ tự tổng hợp (Am – F – C – G), không vướng bản quyền."""
    n = int(duration * SR)
    t = np.arange(n) / SR
    chords = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [261.63, 329.63, 392.0], [196.0, 246.94, 293.66]]
    bar = 2.4
    out = np.zeros(n, dtype=np.float64)
    for i in range(int(duration / bar) + 1):
        a, b = int(i * bar * SR), min(n, int((i + 1) * bar * SR + 0.6 * SR))
        if a >= n:
            break
        tt = t[a:b] - i * bar
        env = np.minimum(1, tt / 0.5) * np.exp(-tt * 0.7)
        for f in chords[i % 4]:
            out[a:b] += env * (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt))
        # nhịp pluck nhẹ
        for k in range(4):
            pa = a + int(k * bar / 4 * SR)
            if pa >= n:
                break
            pl = np.arange(min(int(0.4 * SR), n - pa)) / SR
            f = chords[i % 4][k % 3] * 2
            out[pa:pa + len(pl)] += 0.5 * np.sin(2 * np.pi * f * pl) * np.exp(-pl * 9)
    out /= np.abs(out).max() + 1e-9
    fade = np.minimum(1, np.minimum(t / 1.0, (duration - t) / 1.5))
    return (out * fade * 0.055).astype(np.float32)


def board_map(board):
    return {chess.square_name(sq): p.symbol() for sq, p in board.piece_map().items()}


def main(ep_dir):
    ep = Path(ep_dir)
    script = json.loads((ep / "script.json").read_text())
    build = ep / "build"
    (build / "tts").mkdir(parents=True, exist_ok=True)

    voice, rate, gap = script["voice"], script.get("rate", "+0%"), script.get("gap", 0.2)
    board = chess.Board()
    positions = [board_map(board)]      # positions[k] = thế cờ sau k sự kiện cờ
    board_events = []                   # {t, dur, kind, from/to..., pos}
    overlays = []                       # sự kiện hiển thị khác
    captions, scenes = [], []
    voice_track = []                    # (t, samples)
    t = HOOK_LEAD

    def push_move(san, at, dur=0.42):
        mv = board.parse_san(san)       # ném lỗi nếu nước đi không hợp lệ
        moving = [(chess.square_name(mv.from_square), chess.square_name(mv.to_square))]
        if board.is_castling(mv):
            rank = "1" if board.turn == chess.WHITE else "8"
            moving.append(("h" + rank, "f" + rank) if board.is_kingside_castling(mv) else ("a" + rank, "d" + rank))
        capture = board.is_capture(mv)
        board.push(mv)
        positions.append(board_map(board))
        board_events.append({"t": round(at, 3), "dur": dur, "kind": "move", "san": san,
                             "moving": moving, "capture": capture, "pos": len(positions) - 1})

    def push_reset(at):
        board.reset()
        positions.append(board_map(board))
        board_events.append({"t": round(at, 3), "dur": 0.35, "kind": "reset", "pos": len(positions) - 1})

    pid = 0
    for scene in script["scenes"]:
        s_start = t
        if scene.get("board", {}).get("reset"):
            push_reset(t)
        for ph in scene["phrases"]:
            pid += 1
            say = ph.get("say", ph["text"])
            mp3 = build / "tts" / f"p{pid:02d}.mp3"
            words = tts(say, voice, rate, mp3)
            audio, lead = trim_silence(decode(mp3))
            words = [(max(0.0, w - lead), txt) for w, txt in words]
            dur = len(audio) / SR
            voice_track.append((t, audio))
            captions.append({"t0": round(t, 3), "t1": round(t + dur, 3), "text": ph["text"],
                             "words": [round(t + w, 3) for w, _ in words]})

            def at_word(ev):
                k = ev.get("word", 0)
                return t + (words[min(k, len(words) - 1)][0] if words else 0)

            for ev in ph.get("events", []):
                et = at_word(ev)
                if ev["type"] == "move":
                    push_move(ev["san"], et)
                elif ev["type"] == "line":
                    if ev.get("reset"):
                        push_reset(et)
                        et += 0.4
                    for i, san in enumerate(ev["san"]):
                        push_move(san, et + i * ev.get("step", 0.3), dur=min(0.42, ev.get("step", 0.3) * 0.85))
                else:
                    o = {k: v for k, v in ev.items() if k != "word"}
                    if o["type"] == "dots":
                        sq = chess.parse_square(o["from"])
                        o["squares"] = [chess.square_name(s) for s in board.attacks(sq)]
                    o["t"] = round(et, 3)
                    overlays.append(o)
            t += dur + gap
        scenes.append({"id": scene["id"], "t0": round(s_start, 3), "t1": round(t, 3),
                       "header": scene.get("header", {}), "layout": scene.get("layout", "board")})

    total = t + TAIL
    scenes[-1]["t1"] = round(total, 3)

    # --- âm thanh ---
    n = int(total * SR)
    vtrack = np.zeros(n, dtype=np.float32)
    for st, a in voice_track:
        i = int(st * SR)
        vtrack[i:i + len(a)] += a[: max(0, n - i)]
    sfx = np.zeros(n, dtype=np.float32)
    clk = click_sound()
    for ev in board_events:
        if ev["kind"] == "move":
            i = int((ev["t"] + ev["dur"]) * SR)
            sfx[i:i + len(clk)] += clk[: max(0, n - i)] * (1.25 if ev["capture"] else 1.0)
    mix = vtrack * 0.95 + sfx + music_bed(total)
    mix = np.clip(mix, -0.98, 0.98)
    wav = build / "audio.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-c:a", "pcm_s16le", str(wav)], input=mix.tobytes(), check=True)

    # --- độ mở miệng theo âm lượng giọng đọc (mỗi khung hình) ---
    hop = SR // FPS
    frames = int(total * FPS)
    rms = np.array([np.sqrt(np.mean(vtrack[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(frames)])
    ref = np.percentile(rms[rms > 0.01], 90) if np.any(rms > 0.01) else 1.0
    mouth = np.clip(rms / ref, 0, 1)
    mouth = np.where(rms < 0.008, 0, mouth)
    mouth = np.convolve(mouth, [0.25, 0.5, 0.25], mode="same")

    timeline = {
        "title": script["title"], "fps": FPS, "duration": round(total, 3),
        "scenes": scenes, "captions": captions, "positions": positions,
        "boardEvents": board_events, "overlays": overlays, "recap": script.get("recap", []),
        "mouth": [round(float(m), 2) for m in mouth],
    }
    (build / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1))
    print(f"OK: {len(captions)} câu, {sum(e['kind'] == 'move' for e in board_events)} nước đi, {total:.1f}s → {build}")


if __name__ == "__main__":
    main(sys.argv[1])
