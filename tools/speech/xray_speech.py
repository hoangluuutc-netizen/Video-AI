"""X-Ray lời thoại video mẫu: Demucs tách giọng / nhạc rồi faster-whisper bóc băng có timestamp từng từ
(Gói 7 — Task 12, lựa chọn "demucs-faster-whisper-local").

Đầu ra trong --out:
  speech.json    { "language": "vi", "words": [{ "w": ..., "start": s, "end": s }] }
  vocals.wav     giọng nói đã tách
  no_vocals.wav  nhạc nền đã tách (Node đo lại BPM trên file này)

Chạy: tools/speech/.venv/Scripts/python.exe -I tools/speech/xray_speech.py --video <mp4> --out <thư mục> --max-sec 90
Giấy phép: Demucs (MIT), faster-whisper (MIT), Whisper (MIT).
CHƯA CHẠY THỬ trên máy này (chưa có Python) — Antigravity xác minh ở Task 0.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys


def run(cmd: list) -> None:
    subprocess.run(cmd, check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-sec", type=float, default=90)
    ap.add_argument("--model", default="small")
    ap.add_argument("--language", default="vi")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    src_wav = os.path.join(args.out, "input.wav")
    ffmpeg = os.environ.get("FFMPEG_PATH", "ffmpeg")
    run([ffmpeg, "-y", "-v", "error", "-t", str(args.max_sec), "-i", args.video, "-vn", "-ac", "2", "-ar", "44100", src_wav])

    # Demucs: --two-stems=vocals → <out>/htdemucs/input/{vocals,no_vocals}.wav
    run([sys.executable, "-m", "demucs", "--two-stems=vocals", "-n", "htdemucs", "-d", "cpu", "-o", args.out, src_wav])
    stem_dir = os.path.join(args.out, "htdemucs", "input")
    for name in ("vocals.wav", "no_vocals.wav"):
        shutil.move(os.path.join(stem_dir, name), os.path.join(args.out, name))
    shutil.rmtree(os.path.join(args.out, "htdemucs"), ignore_errors=True)

    from faster_whisper import WhisperModel

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        os.path.join(args.out, "vocals.wav"),
        language=args.language,
        word_timestamps=True,
        vad_filter=True,
        beam_size=5,
    )
    words = []
    for seg in segments:
        for w in seg.words or []:
            text = (w.word or "").strip()
            if text:
                words.append({"w": text, "start": round(float(w.start), 3), "end": round(float(w.end), 3)})

    out_json = os.path.join(args.out, "speech.json")
    with open(out_json + ".tmp", "w", encoding="utf-8") as f:
        json.dump({"language": getattr(info, "language", args.language), "words": words}, f, ensure_ascii=False, indent=2)
    os.replace(out_json + ".tmp", out_json)


if __name__ == "__main__":
    main()
