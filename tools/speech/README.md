# tools/speech — công cụ giọng nói chạy trên máy (Gói 7)

Thư mục này chứa script Python **tự viết** của dự án. Không chứa mã VoiceStudio: VoiceStudio là AGPL-3.0, cài **ngoài repo** và chỉ gọi qua HTTP loopback.

| Script | Lựa chọn trên Dashboard | Việc làm |
|---|---|---|
| `align_words.py` | Căn thời gian phụ đề → `faster-whisper-local` | Lấy timestamp từng từ của giọng TTS; Node ghép về chữ gốc có dấu |
| `xray_speech.py` | Tách nhạc & bóc băng → `demucs-faster-whisper-local` | Demucs tách giọng/nhạc + bóc băng video mẫu |
| `tts_server.py` (chưa có, Task 7B) | Giọng đọc → `sidecar-voxcpm2` | Chỉ viết khi Task 0 chọn phương án dự phòng |

## Cài đặt (Task 0, người dùng đã duyệt)

```bash
uv venv tools/speech/.venv --python 3.11
uv pip install --python tools/speech/.venv -r tools/speech/requirements.txt
```

Node tìm Python theo thứ tự: biến `SPEECH_PYTHON` → `tools/speech/.venv/Scripts/python.exe` (Windows) → `tools/speech/.venv/bin/python`. Thiếu Python thì các lựa chọn này hiện xám trên Dashboard, và pipeline tự dùng heuristic.

## Kiểm tra nhanh sau khi cài

```bash
tools/speech/.venv/Scripts/python.exe -I tools/speech/align_words.py --help
node scripts/analyze-sample-video.mjs --speech=demucs-faster-whisper-local
```

Trạng thái: **hai script chưa được chạy thật** (máy chưa có Python khi viết). Task 0 xác minh và ghi thời gian chạy, RAM vào `docs/SPEECH_API_NOTES.md`.
