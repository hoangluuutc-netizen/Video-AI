"""Căn thời gian từng từ cho giọng TTS của chiến dịch bằng faster-whisper (Gói 7 — Task 10, tầng 2).

Đầu vào : media/audio/voice-manifest.json (do scripts/generate-voiceover.mjs ghi)
Đầu ra  : [{ "sceneId": ..., "words": [{ "w": ..., "start": s, "end": s }] }]
Node (scripts/lib/word-aligner.mjs) ghép các từ nhận dạng này về đúng CHỮ GỐC có dấu bằng quy hoạch động,
nên ở đây chỉ cần thời gian; lời kịch bản được đưa vào initial_prompt để nhận dạng bám sát.

Chạy: tools/speech/.venv/Scripts/python.exe -I tools/speech/align_words.py \
        --manifest campaigns/<id>/media/audio/voice-manifest.json --base campaigns/<id> --out <file.json>
Giấy phép: faster-whisper (MIT), trọng số Whisper (MIT) — dùng thương mại được.
CHƯA CHẠY THỬ trên máy này (chưa có Python) — Antigravity xác minh ở Task 0.
"""
import argparse
import json
import os


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--base", required=True, help="Thư mục chiến dịch (đường dẫn wav trong manifest là tương đối với nó)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="small")
    ap.add_argument("--language", default="vi")
    args = ap.parse_args()

    from faster_whisper import WhisperModel  # nạp lười để --help chạy được khi chưa cài

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    with open(args.manifest, encoding="utf-8") as f:
        manifest = json.load(f)

    rows = []
    for entry in manifest:
        wav = os.path.join(args.base, entry["wav"])
        segments, _info = model.transcribe(
            wav,
            language=args.language,
            word_timestamps=True,
            vad_filter=False,
            beam_size=5,
            initial_prompt=entry.get("spoken") or None,
        )
        words = []
        for seg in segments:
            for w in seg.words or []:
                text = (w.word or "").strip()
                if text:
                    words.append({"w": text, "start": round(float(w.start), 3), "end": round(float(w.end), 3)})
        rows.append({"sceneId": entry["sceneId"], "words": words})

    tmp = args.out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    os.replace(tmp, args.out)


if __name__ == "__main__":
    main()
