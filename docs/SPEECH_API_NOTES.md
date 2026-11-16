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

## 2. VoiceStudio (Task 0 — Bước 2–5) — Claude cài 16-11-2026; người dùng hoàn tất trình thiết lập (gói Max) cùng ngày

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

### ⚠️ Lần thiết lập đầu thất bại — nguyên nhân & cách làm đúng

- `%APPDATA%\VoiceStudio\setup.log`: 2 lần `Runtime setup exited with code 2` với lỗi uv `Missing expected target directory for Python minor version link … cpython-3.11.16-windows-x86_64-none`; `backend.json` vẫn `"stage":"setup_required"`.
- **Nguyên nhân:** app Claude là gói MSIX (`Claude_pzs8sxrjxfjjc`). Chương trình được khởi chạy **từ phiên Claude** (bộ cài, `VoiceStudio.exe`, `voicestudio.exe` không có `--url`) chạy trong vùng chứa của gói → mọi chỗ ghi vào `%APPDATA%` bị chuyển sang `…\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\…`, trong khi junction của uv trỏ tới đường dẫn `%APPDATA%` thật → không tìm thấy thư mục đích. (Ổ D và `~/.config/omnivoice/env` không bị ảnh hưởng.)
- Trạng thái hỏng đã được đổi tên (không xóa) thành `…\LocalCache\Roaming\VoiceStudio.failed-setup-20261116`.
- **Cách làm đúng:** người dùng tự chạy bộ cài và mở VoiceStudio **từ Windows bình thường** (PowerShell mở từ Start menu / File Explorer), hoàn tất thiết lập tới màn hình chính. Phía Claude/Antigravity chỉ gọi **HTTP `127.0.0.1:3900`** và CLI luôn kèm `--url http://127.0.0.1:3900` — không tự khởi chạy VoiceStudio. Chế độ managed (`LOCAL_TTS_START_CMD`) vì vậy **không dùng được** khi pipeline chạy từ phiên Claude.

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
| Kiểm engine | `GET /v1/models` → cần `{id:"voxcpm2", voicestudio:{alias_for_active_engine:false}}` (`findEngineInModelList`) | ✅ **Chạy thật đúng**: trước khi cài → `engine:null` (từ chối); sau khi cài → `engine:"voxcpm2"`. Fixture thật: `scripts/tests/fixtures/voicestudio-v0.5.8-models-{before,with}-voxcpm2.json` | Không |
| Sinh giọng | `POST /v1/audio/speech {model:"voxcpm2", input, voice, response_format:"wav", language:"vi"}`; 403 giấy phép / 400 `model_not_available` được dịch sang lỗi tiếng Việt | ✅ Máy chủ nhận request và chạy đúng VoxCPM2 với `voice: "<id hồ sơ>"`, nhưng **engine sập giữa lúc sinh** (xem mục 3) → chưa có file âm thanh thật | Không |
| Giải phóng RAM | `POST /model/unload/sidecar:voxcpm2`, lỗi thì `POST /model/unload/sidecars` (router không tiền tố, quyền admin — loopback không cần key) | ✅ **Chạy thật đúng**: `unloadLocalTts → true`, `GET /model/loaded` về rỗng | Không |
| Tạo voice clone từ `voice-ref.wav` + `referenceText` | CLI `voicestudio --url … voices clone --name … --language vi --engine voxcpm2 --audio <wav> --ref-text "<lời>"` → `{id}` | ✅ Tạo được hồ sơ `eb076aff` (giọng của chính người dùng, đoạn 20,9 s) | Ghi id vào `voiceProfile.voiceId` |
| Ghi nhận đồng ý trong VoiceStudio | `voicestudio voices consent set <id> <file-âm-thanh-đồng-ý> --field consent_text=…` | Bắt buộc **file ghi âm** chủ giọng đọc lời đồng ý → nên dùng cho KOL thật (bổ sung cho `assets/private/consents/`) | |
| Danh sách giọng | `GET /v1/audio/voices` | _(chưa lưu fixture)_ | |
| Xóa giọng (cho `revoke-voice.mjs`) | — chưa có, đang in hướng dẫn xóa thủ công — | _(Task 0)_ | |
| Bóc băng | `POST /v1/audio/transcriptions` multipart, `response_format=verbose_json`, `timestamp_granularities[]=word` | Có trả `words[]` không? _(Task 0)_ | `transcriptionsPath` |
| Model căn chỉnh WhisperX cho `vi` + giấy phép | — | _(Task 0)_ | Nếu CC-BY-NC → không dùng `voicestudio-whisperx` cho thương mại |

Lưu response thật làm fixture: `scripts/tests/fixtures/voicestudio-*.json`.

## 2b. `tools/speech/.venv` ✅ (Claude cài 16-11-2026)

- `uv` **0.13.8** tải từ GitHub Releases `astral-sh/uv` (checksum khớp), giải nén vào `D:\AI\_external\uv` — **không sửa PATH**. Python và cache của uv để ở `D:\AI\_external\uv\python`, `D:\AI\_external\uv\cache` (`UV_PYTHON_INSTALL_DIR`, `UV_CACHE_DIR`).
- `tools/speech/.venv`: **Python 3.11.18**, faster-whisper 1.2.1, PyTorch 2.15.0+cpu, Demucs (import đạt). Model faster-whisper / Demucs **chưa tải** (tải ở lần chạy đầu).

## 2c. Đã xác minh với máy chủ VoiceStudio v0.5.8 THẬT (16-11-2026)

- Cách mở đúng: `explorer.exe "D:\AI\_external\VoiceStudio\VoiceStudio.exe"` (Explorer chạy ngoài vùng chứa MSIX của Claude) → dữ liệu ghi vào `%APPDATA%\VoiceStudio` thật; thiết lập chạy xong (`Runtime installation completed`, `stage: ready`). Mirror PyPI tự chọn `mirrors.aliyun.com` (uv vẫn kiểm hash theo `uv.lock`).
- `checkLocalTts` → `GET /v1/models`: trước khi cài VoxCPM2 trả `engine: null` (client từ chối đúng); sau khi cài trả `engine: "voxcpm2"`. Fixture thật: `scripts/tests/fixtures/voicestudio-v0.5.8-models-before-voxcpm2.json`, `…-models-with-voxcpm2.json`.
- `unloadLocalTts` → `POST /model/unload/sidecar:voxcpm2` trả `true`, `/model/loaded` rỗng ngay sau đó.
- Chia sẻ LAN: `Enabled: no` (mặc định tắt). Engine đang bật đã chọn `voxcpm2` (`voicestudio engines select --type tts voxcpm2`); gói Max của trình thiết lập có thể đổi lại về OmniVoice → kiểm lại sau khi thiết lập xong.
- Engine VoxCPM2: `voicestudio engines install --type tts voxcpm2` (venv riêng, 150 gói, `import voxcpm OK`); trọng số `openbmb/VoxCPM2` revision thực tải **`7936080b41163874f38610f46f438e2c0757f9fd`**, 4,96 GB tại `%LOCALAPPDATA%\OmniVoice\hf_cache`. Giấy phép trong VoiceStudio: `apache-2.0`, `Required: no` (không cần chấp nhận); registry của VoiceStudio ghi `review_status: unreviewed`, `commercial_inference: unknown`.
- **Lỗi VoiceStudio 0.5.8 gặp phải:** mạng đứt giữa lúc tải `model.safetensors` → VoiceStudio vẫn báo `installed: true` với 0,35 GB (thiếu file chính). Cách sửa: `voicestudio models delete openbmb/VoxCPM2 --yes` rồi `models install`.
- Hồ sơ giọng thử `eb076aff` (giọng của chính người dùng, đoạn 20,9 s cắt ở ranh giới câu, lời thoại khớp) tạo bằng `voicestudio voices clone --engine voxcpm2 --language vi`. `voices consent set` **bắt buộc upload file âm thanh đồng ý** (không chỉ văn bản) → nên dùng cho KOL thật.

## 3. Hiệu năng trên máy (Task 0 — Bước 5–6) — đo 16-11-2026

| Công cụ | Kết quả | RAM đỉnh | Ghi chú |
|---|---|---|---|
| faster-whisper `small` int8 (căn từ, 4 cảnh chiến dịch mẫu) | **Chạy được end-to-end**: 4/4 cảnh nguồn `asr`, giữ đúng chữ gốc | _chưa đo đúng_ (bộ đo bắt nhầm tiến trình trung gian của uv) | 164 s gồm lần đầu tải model ~0,5 GB |
| VoiceStudio · VoxCPM2, CPU, `bfloat16`, giọng clone `eb076aff` — **2 lần đo đủ trọng số** | **Không sinh được câu nào (~20 từ).** Mỗi lần: nạp model ~1 phút, sinh câu chạy **~2 phút 15 s không ra âm thanh rồi tiến trình chết** (`sidecar closed pipe mid-generate`, không có traceback Python); ngay sau đó **cả VoiceStudio đóng hẳn** (không có dòng tắt máy chủ trong log, không có sự kiện Windows hết bộ nhớ) | Lần 1: **14,2 GB** riêng tiến trình VoxCPM2 (~15,1 GB cả VoiceStudio); lần 2: **~12 GB** (~12,8 GB cả VoiceStudio) | Lần đo đầu tiên (trước đó) hỏng vì mạng đứt khi tải `model.safetensors` — không tính. RTF ước **≥ 22** (≥ 135 s mà chưa ra nổi ~6 s âm thanh) |
| Demucs `htdemucs` | _chưa đo_ | | |

Engine thay thế đã tra (sổ giấy phép `backend/config/model_licenses.json` + mã engine của VoiceStudio): **Supertonic-3** — ONNX chạy CPU, 31 ngôn ngữ **có tiếng Việt**, model ~400 MB, giấy phép **OpenRAIL-M** (cho thương mại kèm giới hạn mục đích — phải đọc điều khoản), **chỉ có giọng dựng sẵn, không nhân bản giọng**. KittenTTS / CosyVoice (Apache-2.0) chưa xác minh tiếng Việt. OmniVoice / OmniVoice-GGUF bị loại (CC-BY-NC).

## 4. Cổng quyết định (Task 0 — Bước 7) — 16-11-2026

| Kết quả | Quyết định |
|---|---|
| RTF ≤ 20 | VoiceStudio dùng cho batch đêm |
| RTF > 20 | Chỉ dùng cho video KOL "hero" |
| Thiếu field clone / không xác định được engine / RAM > 12 GB | Làm T7B (sidecar `tools/speech/tts_server.py`, `provider: "sidecar"`) |
| Tiếng Việt nghe không đạt | Dừng dùng VoxCPM2; giữ Vbee/FPT |

**Kết quả cổng:** RTF ≥ 22, RAM 12–14 GB, tiến trình chết trước khi ra âm thanh → **VoxCPM2 local KHÔNG dùng được cho sản xuất trên máy này** (Core Ultra 7 165H, không GPU rời, 31,4 GB RAM dùng chung với Ollama/FFmpeg). Sidecar tự viết (T7B) dùng cùng model nên **không** khắc phục được → không làm T7B.

**Hướng đi** _(chờ người dùng chọn)_ — đề xuất của Claude:
1. **Sản xuất ngay:** giữ Vbee / FPT.AI (≈ $0.005–0.01/video) cho giọng đọc. Mã 7.2b giữ nguyên: nhân vật thường tự rơi về engine cũ; nhân vật `mode: "clone"` chưa chạy được → chưa gắn `voiceProfile`, hoặc chạy với `--allow-generic-voice` (video gắn nhãn "GIỌNG TẠM").
2. **Thử tiếp, rẻ:** Supertonic-3 trong VoiceStudio làm lựa chọn giọng Việt `$0` chạy CPU (không clone) — người dùng nghe thử chất lượng và đọc điều khoản OpenRAIL-M trước.
3. **Khi bắt buộc cần giọng KOL clone:** VoxCPM2 trên GPU thuê theo giờ (VoiceStudio có tài liệu remote GPU) — giọng KOL rời máy → văn bản đồng ý phải có `allowCloudProcessing: true`; là một gói việc riêng.

**Quyết định:** _(chờ người dùng)_
