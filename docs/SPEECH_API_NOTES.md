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

## 2. VoiceStudio (Task 0 — Bước 2–5) — Claude cài 16-11-2026, **chờ người dùng hoàn tất trình thiết lập trong app**

| Mục | Giá trị |
|---|---|
| Cách cài | App desktop **v0.5.8** (bản ổn định mới nhất, phát hành 12-11-2026) tải từ GitHub Releases `debpalash/VoiceStudio`; checksum SHA-256 khớp `SHA256SUMS.txt` (`11238CB8…AD34`); bộ cài **không có chữ ký số**. Script `voicestudio.sh/install.ps1` đã đọc (149 dòng, chỉ tải + kiểm checksum + chạy bộ cài) nhưng không dùng vì không chọn được thư mục cài |
| Thư mục cài | `D:\AI\_external\VoiceStudio` (per-user, `/currentuser /S /D=`). Bộ cài tự thêm `D:\AI\_external\VoiceStudio\resources\cli` vào PATH người dùng |
| Commit hash | Bản phát hành v0.5.8 (backend đọc `OMNIVOICE_BUILD_COMMIT` lúc chạy — ghi sau khi backend chạy) |
| Thư mục dữ liệu (để thu hồi giọng) | Mặc định `%APPDATA%\OmniVoice` (đổi bằng `OMNIVOICE_DATA_DIR`); file cấu hình bền vững `%USERPROFILE%\.config\omnivoice\env` |
| Thu thập dữ liệu sử dụng | Mặc định **tắt** (opt-in). Đã đặt thêm công tắc tắt cứng `OMNIVOICE_ANALYTICS_DISABLED=1` trong file cấu hình bền vững |
| Cổng | Backend **3900**; giao diện web **3901** → sidecar dự phòng đã chuyển sang **3911** (`local-tts-client.mjs`, `local-tools-status.mjs`) |
| Chia sẻ LAN | Listener **riêng**, không phải cổng 3900. Kiểm/tắt bằng `voicestudio sharing status` / `voicestudio sharing disable` _(chạy sau khi thiết lập xong)_ |
| Chạy headless | Lệnh CLI tự khởi động backend ngầm (`Starting VoiceStudio in the background…`) **sau khi đã hoàn tất thiết lập**; `voicestudio stop` để tắt. Trước khi thiết lập: lỗi `VoiceStudio has not finished setup` |
| Chuyển engine sang VoxCPM2 | Mã engine **`voxcpm2`** (engine phụ có venv riêng, `pip install "voxcpm>=2.0.3"`, model `openbmb/VoxCPM2`). Cài: `voicestudio engines install`; chọn: `voicestudio engines select` hoặc `OMNIVOICE_TTS_BACKEND=voxcpm2`. Giấy phép model phải được **người dùng** chấp nhận (`voicestudio models license`) — nếu chưa, `/v1/audio/speech` trả 403 `ModelLicenceNotAccepted` |
| Giải phóng RAM | **Có**: `voicestudio models loaded` / `voicestudio models unload` (tìm endpoint REST tương ứng khi backend chạy); tự giải phóng khi rảnh sau `OMNIVOICE_IDLE_TIMEOUT` (mặc định 900 s) |

### Sự thật API đọc từ mã backend v0.5.8 (cần sửa client)

- `GET /.well-known/voicestudio-speech` là **tài liệu năng lực tĩnh** (endpoint, giao thức) — **không có engine đang chạy**. (Client cũ dò engine ở đây nên sẽ luôn từ chối — **đã sửa** sang `/v1/models`.)
- `POST /v1/audio/speech` chọn engine theo **`model`**: mã engine thật (`"voxcpm2"`) luôn chạy đúng engine đó; nếu chưa sẵn sàng → 400 `model_not_available` (**không** rơi về OmniVoice). Chỉ bí danh OpenAI (`tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`…) mới đi theo engine đang bật → client **không bao giờ** được gửi bí danh.
- → Kiểm tra đúng: `GET /v1/models` (danh sách `{id, voicestudio:{kind, alias_for_active_engine}}`), engine dùng được khi có `id === "voxcpm2"` và `alias_for_active_engine === false`.
- `voice`: id hồ sơ giọng, hoặc tên hồ sơ (không phân biệt hoa thường; trùng tên → 409). Tạo hồ sơ clone: `voicestudio voices` (xem `voicestudio help voices clone`). `GET /v1/audio/voices` → `{voices:[{voice_id, id, name, type, language}], engines}`.
- Trường mở rộng nhận được: `language`, `description` (voice design, chỉ VoxCPM2), `instruct`, `seed`, `speed`, `num_step`, `guidance_scale`. `response_format` mặc định `mp3` (client gửi `wav`).
- `POST /v1/audio/transcriptions` nhận `response_format=verbose_json` và `timestamp_granularities[]` — có trả `words[]` hay không cần thử khi backend chạy.

### Ánh xạ API — đối chiếu với `VOICESTUDIO_DEFAULT_FIELDS` trong `scripts/lib/local-tts-client.mjs`

| Việc | Mặc định trong client | Thực tế | Cần ghi đè `localTts.fields`? |
|---|---|---|---|
| Kiểm engine | `GET /v1/models` → cần `{id:"voxcpm2", voicestudio:{alias_for_active_engine:false}}` (`findEngineInModelList`) | Đúng theo mã v0.5.8; chờ chạy thật để lưu fixture | `modelsPath` |
| Sinh giọng | `POST /v1/audio/speech {model:"voxcpm2", input, voice, response_format:"wav", language:"vi"}`; 403 giấy phép / 400 `model_not_available` được dịch sang lỗi tiếng Việt | Đúng theo mã v0.5.8; chờ chạy thật | `speechPath`, `extraSpeechBody` |
| Giải phóng RAM | `POST /model/unload/sidecar:voxcpm2`, lỗi thì `POST /model/unload/sidecars` (router không tiền tố, cần quyền admin — loopback) | Đúng theo mã v0.5.8; chờ chạy thật | `unloadPath` |
| Tạo voice clone từ `voice-ref.wav` + `referenceText` | — chưa có trong client — | _(Task 0: endpoint + field)_ | Ghi id vào `voiceProfile.voiceId` |
| Danh sách giọng | `GET /v1/audio/voices` | _(Task 0)_ | |
| Xóa giọng (cho `revoke-voice.mjs`) | — chưa có, đang in hướng dẫn xóa thủ công — | _(Task 0)_ | |
| Bóc băng | `POST /v1/audio/transcriptions` multipart, `response_format=verbose_json`, `timestamp_granularities[]=word` | Có trả `words[]` không? _(Task 0)_ | `transcriptionsPath` |
| Model căn chỉnh WhisperX cho `vi` + giấy phép | — | _(Task 0)_ | Nếu CC-BY-NC → không dùng `voicestudio-whisperx` cho thương mại |

Lưu response thật làm fixture: `scripts/tests/fixtures/voicestudio-*.json`.

## 2b. `tools/speech/.venv` ✅ (Claude cài 16-11-2026)

- `uv` **0.13.8** tải từ GitHub Releases `astral-sh/uv` (checksum khớp), giải nén vào `D:\AI\_external\uv` — **không sửa PATH**. Python và cache của uv để ở `D:\AI\_external\uv\python`, `D:\AI\_external\uv\cache` (`UV_PYTHON_INSTALL_DIR`, `UV_CACHE_DIR`).
- `tools/speech/.venv`: **Python 3.11.18**, faster-whisper 1.2.1, PyTorch 2.15.0+cpu, Demucs (import đạt). Model faster-whisper / Demucs **chưa tải** (tải ở lần chạy đầu).

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
