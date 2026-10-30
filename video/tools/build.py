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


def tts(text, voice, rate, pitch, out_mp3):
    """Gọi edge-tts, trả về danh sách (thời điểm bắt đầu, từ)."""
    async def run():
        words = []
        comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
        with open(out_mp3, "wb") as f:
            async for ch in comm.stream():
                if ch["type"] == "audio":
                    f.write(ch["data"])
                elif ch["type"] == "WordBoundary":
                    words.append((ch["offset"] / 1e7, ch["text"]))
        return words
    return asyncio.run(run())


def decode(path, formant=1.0):
    """Giải mã về PCM. formant > 1 nâng cả cao độ lẫn formant (giọng trẻ con) mà giữ nguyên tốc độ."""
    af = ["-af", f"aresample={SR},asetrate={int(SR * formant)},aresample={SR},atempo={1 / formant:.5f}"] if formant != 1.0 else []
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), *af, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
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


def sfx_bank():
    """Hiệu ứng âm thanh tự tổng hợp cho phong cách phép thuật."""
    rng = np.random.default_rng(11)

    def env(n, a, d):
        t = np.arange(n) / SR
        return np.minimum(1, t / a) * np.exp(-t * d), t

    n = int(0.55 * SR); e, t = env(n, 0.12, 6)                        # whoosh: nhiễu quét dải
    noise = rng.standard_normal(n)
    sweep = np.sin(2 * np.pi * (300 + 2400 * t) * t)
    whoosh = np.convolve(noise, np.ones(12) / 12, "same") * e * (0.6 + 0.4 * sweep)
    n = int(1.1 * SR); e, t = env(n, 0.005, 3.5)                       # chime: chuông lấp lánh
    chime = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * (3 + i)) for i, f in enumerate([1318.5, 1760, 2093, 2637])) * e
    n = int(1.2 * SR); e, t = env(n, 0.003, 4.5)                       # boom: tiếng nổ trầm
    boom = (np.sin(2 * np.pi * (90 * np.exp(-t * 3) + 40) * t) * 1.2
            + np.convolve(rng.standard_normal(n), np.ones(30) / 30, "same") * np.exp(-t * 9) * 2.5) * e
    n = int(0.12 * SR); e, t = env(n, 0.002, 40)                       # tick đồng hồ
    tick = np.sin(2 * np.pi * 1800 * t) * e
    norm = lambda x, g: (x / (np.abs(x).max() + 1e-9) * g).astype(np.float32)
    return {"whoosh": norm(whoosh, 0.32), "chime": norm(chime, 0.22), "boom": norm(boom, 0.6), "tick": norm(tick, 0.3)}


MUSIC = {
    # Am – F – C – G: nhẹ nhàng
    "calm": ([[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [261.63, 329.63, 392.0], [196.0, 246.94, 293.66]], 2.4, 0.055),
    # Dm – B♭ – Gm – A: huyền bí, nhanh hơn
    "magic": ([[146.83, 174.61, 220.0], [116.54, 146.83, 174.61], [98.0, 116.54, 146.83], [110.0, 138.59, 164.81]], 1.6, 0.06),
}


def music_bed(duration, style="calm"):
    """Nền nhạc tự tổng hợp, không vướng bản quyền."""
    n = int(duration * SR)
    t = np.arange(n) / SR
    chords, bar, gain = MUSIC[style]
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
    return (out * fade * gain).astype(np.float32)


def mobility(sym, sq):
    """Số ô một quân đứng một mình đi được trên bàn cờ trống."""
    b = chess.Board(None)
    b.set_piece_at(sq, chess.Piece.from_symbol(sym))
    return len(b.attacks(sq))


def ring(sq):
    """0 = mép bàn cờ … 3 = 4 ô trung tâm."""
    f, r = chess.square_file(sq), chess.square_rank(sq)
    return min(f, 7 - f, r, 7 - r)


def board_map(board):
    return {chess.square_name(sq): p.symbol() for sq, p in board.piece_map().items()}


def main(ep_dir):
    ep = Path(ep_dir)
    script = json.loads((ep / "script.json").read_text())
    build = ep / "build"
    (build / "tts").mkdir(parents=True, exist_ok=True)

    voice, rate, gap = script["voice"], script.get("rate", "+0%"), script.get("gap", 0.2)
    pitch, formant = script.get("pitch", "+0Hz"), script.get("formant", 1.0)
    board = chess.Board()
    positions = [board_map(board)]      # positions[k] = thế cờ sau k sự kiện cờ
    board_events = []                   # {t, dur, kind, from/to..., pos}
    overlays = []                       # sự kiện hiển thị khác
    captions, scenes = [], []
    voice_track = []                    # (t, samples)
    t = HOOK_LEAD

    def rays(frm, dirs):
        """Các tia đi được từ ô frm: dừng trước quân mình, dừng ở quân địch (ăn được)."""
        sq = chess.parse_square(frm)
        me = board.piece_at(sq).color
        out = []
        for df, dr in dirs:
            f, r = chess.square_file(sq), chess.square_rank(sq)
            last, hit, block = None, None, None
            while True:
                f, r = f + df, r + dr
                if not (0 <= f < 8 and 0 <= r < 8):
                    break
                p = board.piece_at(chess.square(f, r))
                if p is None:
                    last = chess.square_name(chess.square(f, r))
                    continue
                if p.color == me:
                    block = chess.square_name(chess.square(f, r))
                else:
                    last = hit = chess.square_name(chess.square(f, r))
                break
            if last:
                out.append({"to": last, "hit": hit, "block": block})
            elif block:
                out.append({"to": None, "hit": None, "block": block})
        return out

    def push_setup(fen, at):
        board.set_fen(fen)
        positions.append(board_map(board))
        board_events.append({"t": round(at, 3), "dur": 0.4, "kind": "reset", "pos": len(positions) - 1})

    def push_move(san, at, dur=0.42, boom=False):
        mv = board.parse_san(san)       # ném lỗi nếu nước đi không hợp lệ
        moving = [(chess.square_name(mv.from_square), chess.square_name(mv.to_square))]
        if board.is_castling(mv):
            rank = "1" if board.turn == chess.WHITE else "8"
            moving.append(("h" + rank, "f" + rank) if board.is_kingside_castling(mv) else ("a" + rank, "d" + rank))
        capture = board.is_capture(mv)
        board.push(mv)
        positions.append(board_map(board))
        board_events.append({"t": round(at, 3), "dur": dur, "kind": "move", "san": san, "boom": boom,
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
        if scene.get("board", {}).get("fen"):
            push_setup(scene["board"]["fen"], t)
        for ph in scene["phrases"]:
            pid += 1
            say = ph.get("say", ph["text"])
            mp3 = build / "tts" / f"p{pid:02d}.mp3"
            words = tts(say, voice, rate, pitch, mp3)
            audio, lead = trim_silence(decode(mp3, formant))
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
                    push_move(ev["san"], et, dur=ev.get("dur", 0.42), boom=ev.get("boom", False))
                    if ev.get("boom"):
                        overlays.append({"type": "boom", "square": board_events[-1]["moving"][0][1],
                                         "t": round(et + ev.get("dur", 0.42), 3)})
                elif ev["type"] == "fen":
                    push_setup(ev["fen"], et)
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
                        me = board.piece_at(sq).color
                        # mode "attacks": mọi ô quân đó kiểm soát; "moves": chỉ ô đi được (bỏ ô có quân mình)
                        targets = [s for s in board.attacks(sq)
                                   if o.get("mode") != "moves" or not (board.piece_at(s) and board.piece_at(s).color == me)]
                        o["squares"] = [chess.square_name(s) for s in targets]
                        o["captures"] = [chess.square_name(s) for s in targets
                                         if board.piece_at(s) and board.piece_at(s).color != me]
                    if o["type"] == "heat":
                        # bản đồ số ô đi được; với Hậu lưu riêng phần Xe + phần Tượng
                        rings = o.get("rings", [0, 1, 2, 3])
                        o["cells"] = {chess.square_name(q): {"ring": ring(q), "n": mobility(o["piece"], q),
                                                             "r": mobility("R", q), "b": mobility("B", q)}
                                      for q in chess.SQUARES if ring(q) in rings}
                    if o["type"] == "beam":
                        o["rays"] = rays(o["from"], [(1, 0), (-1, 0), (0, 1), (0, -1)])
                    o["t"] = round(et, 3)
                    overlays.append(o)
            t += dur + gap
        scenes.append({"id": scene["id"], "t0": round(s_start, 3), "t1": round(t, 3),
                       "header": scene.get("header", {}), "layout": scene.get("layout", "board"),
                       "board": scene.get("board", {})})

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
    bank = sfx_bank()
    cue = {"beam": "whoosh", "sticker": "chime", "magic": "chime", "boom": "boom", "countdown": "tick", "flash": "boom"}

    def add(name, at):
        x = bank[name]
        i = int(at * SR)
        sfx[i:i + len(x)] += x[: max(0, n - i)]

    if script.get("theme") == "magic":
        for o in overlays:
            if o["type"] in cue and o.get("sound", True):
                add(cue[o["type"]], o["t"])
        for ev in board_events:
            if ev["kind"] == "move" and not ev["boom"]:
                add("whoosh", ev["t"])
            if ev["kind"] == "reset" and ev["t"] > 1:
                add("chime", ev["t"])
    mix = vtrack * 0.95 + sfx + music_bed(total, script.get("music", "calm"))
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
        "character": script.get("character", "coach"), "theme": script.get("theme", "gold"),
        "endcard": script.get("endcard", {}),
        "boardBox": script.get("boardBox", {"x": 60, "y": 400, "size": 900}),
        "boardStyle": script.get("boardStyle", {}),
        "scenes": scenes, "captions": captions, "positions": positions,
        "boardEvents": board_events, "overlays": overlays, "recap": script.get("recap", []),
        "mouth": [round(float(m), 2) for m in mouth],
    }
    (build / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1))
    print(f"OK: {len(captions)} câu, {sum(e['kind'] == 'move' for e in board_events)} nước đi, {total:.1f}s → {build}")


if __name__ == "__main__":
    main(sys.argv[1])
