# Ghi chú API giọng nói & kết quả Task 0 (Gói 7)

> Claude điền phần đã đo được trên máy (16-11-2026). Các ô _(Task 0)_ do Antigravity điền sau khi cài VoiceStudio + `tools/speech/.venv`.

## 1. FFmpeg trên máy (Task 0 — Bước 1) ✅

| Kiểm tra | Kết quả |
|---|---|
| Phiên bản | `ffmpeg 9.0.2-full_build-www.gyan.dev` (≥ 5 → `amix normalize=0` dùng được) |
| `h264_qsv` | Có (kèm `hevc_qsv`, `av1_qsv`) |
| `libass` (`ass`, `subtitles`) | Có → lựa chọn "Highlight từng từ" dùng được |
| `silencedetect` | Có |

Ghi chú đã kiểm: âm nền sine trong `normalizeAndFitAudio` (`sine` mặc định biên độ 1/8 × `volume=0.025`) chỉ ≈ **−50 dBFS**, thấp hơn ngưỡng `silencedetect -35dB`, nên **không** che khoảng lặng. Thử bằng file 0,4 s lặng + 1 s tone + 0,6 s lặng: cả file thô lẫn file đã trộn đều đo được 0,4 → 1,4 s.

## 2. VoiceStudio (Task 0 — Bước 2–5) _(Task 0)_

| Mục | Giá trị |
|---|---|
| Cách cài (app desktop / mã nguồn) | _(Task 0)_ |
| Commit hash | _(Task 0)_ |
| Thư mục dữ liệu (để thu hồi giọng) | _(Task 0)_ |
| Đã tắt chia sẻ LAN? | _(Task 0)_ |
| Chạy headless được? Lệnh + thư mục (→ `LOCAL_TTS_START_CMD`, `LOCAL_TTS_START_CWD`) | _(Task 0)_ |
| Cách chuyển engine sang VoxCPM2 | _(Task 0)_ |

### Ánh xạ API — đối chiếu với `VOICESTUDIO_DEFAULT_FIELDS` trong `scripts/lib/local-tts-client.mjs`

| Việc | Mặc định trong client | Thực tế | Cần ghi đè `localTts.fields`? |
|---|---|---|---|
| Discovery | `GET /.well-known/voicestudio-speech` | _(Task 0)_ | |
| Khóa chứa engine đang chạy | thử `tts_backend`, `tts.backend`, `tts.engine`, `engine`, `backends.tts`, `capabilities.tts.backend` | _(Task 0)_ | `engineKeys` |
| Nếu discovery không lộ engine | dùng `localTts.engineConfirmed: "voxcpm2"` sau khi tự kiểm trong app | _(Task 0)_ | |
| Sinh giọng | `POST /v1/audio/speech {model, input, voice, response_format:"wav"}` | _(Task 0)_ | `speechPath`, `extraSpeechBody` |
| Tạo voice clone từ `voice-ref.wav` + `referenceText` | — chưa có trong client — | _(Task 0: endpoint + field)_ | Ghi id vào `voiceProfile.voiceId` |
| Danh sách giọng | `GET /v1/audio/voices` | _(Task 0)_ | |
| Xóa giọng (cho `revoke-voice.mjs`) | — chưa có, đang in hướng dẫn xóa thủ công — | _(Task 0)_ | |
| Bóc băng | `POST /v1/audio/transcriptions` multipart, `response_format=verbose_json`, `timestamp_granularities[]=word` | Có trả `words[]` không? _(Task 0)_ | `transcriptionsPath` |
| Model căn chỉnh WhisperX cho `vi` + giấy phép | — | _(Task 0)_ | Nếu CC-BY-NC → không dùng `voicestudio-whisperx` cho thương mại |

Lưu response thật làm fixture: `scripts/tests/fixtures/voicestudio-*.json`.

## 3. Hiệu năng trên máy (Task 0 — Bước 5–6) _(Task 0)_

Câu thử: `"Chỉ 199.000 đồng hôm nay, giảm 50 phần trăm, giao trong 24 giờ"` (giọng của chính người dùng, không dùng giọng KOL).

| Công cụ | Thời gian | Độ dài audio | RTF | RAM đỉnh | Ghi chú |
|---|---|---|---|---|---|
| VoiceStudio · VoxCPM2 (CPU) | | | | | sample rate: |
| faster-whisper `small` int8 (căn từ) | | | | | |
| Demucs `htdemucs` (30s video mẫu) | | | | | |

## 4. Cổng quyết định (Task 0 — Bước 7) _(Task 0)_

| Kết quả | Quyết định |
|---|---|
| RTF ≤ 20 | VoiceStudio dùng cho batch đêm |
| RTF > 20 | Chỉ dùng cho video KOL "hero" |
| Thiếu field clone / không xác định được engine / RAM > 12 GB | Làm T7B (sidecar `tools/speech/tts_server.py`, `provider: "sidecar"`) |
| Tiếng Việt nghe không đạt | Dừng dùng VoxCPM2; giữ Vbee/FPT |

**Quyết định:** _(Task 0)_
