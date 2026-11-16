# Gói 7 — Giọng KOL người thật qua VoiceStudio, Phụ đề theo từng từ, X-Ray lời thoại & Hạ chi phí < $0.50/video

> **Trạng thái (bản 3, 2026-11-16):**
> - **Mốc 7.1 XONG** (commit `300e4da`, Claude kiểm định + vá giao diện ở `e0e2ed2`).
> - Người dùng **duyệt cả hai**: (1) Task 0 được phép cài VoiceStudio (app desktop qua script chính thức, đọc script trước khi chạy) + `uv`/Python 3.11; (2) làm ngay **Mốc 7.2a** gồm các việc không cần cài đặt.
> - Thứ tự mới xem mục **"Thứ tự & mốc bàn giao"**.
>
> **Bản 2 chỉnh theo yêu cầu người dùng:**
> - **(1)** Mỗi công cụ VoiceStudio (VoxCPM2, WhisperX) trở thành **một lựa chọn trong danh sách công cụ của từng hạng mục** trên Dashboard, theo chuẩn Gói 6. VoiceStudio là đường tích hợp chính.
> - **(2)** **KOL là người thật**: thêm văn bản đồng ý, giới hạn phạm vi, KOL duyệt từng kịch bản, thu hồi giọng, và không commit dữ liệu giọng.
>
> **Phần A** là phân tích (đóng vai trò spec). **Phần B** là kế hoạch triển khai từng task.

---

## PHẦN A — PHÂN TÍCH

### A0. Sự thật đã xác minh (khác với giả định ban đầu)

| Hạng mục | Giả định ban đầu | Thực tế đã kiểm (16-11-2026) | Hệ quả thiết kế |
|---|---|---|---|
| Phần cứng | "GPU văn phòng không lớn" | **Không có GPU rời.** Intel Core Ultra 7 165H + iGPU Intel Arc (dùng chung RAM), **RAM 31,4 GB**. Chưa cài Python, Docker. Ollama 0.40.16 đã có. | Bài toán là **RAM/CPU**, không phải VRAM. Mọi model AI local chạy CPU. |
| VoiceStudio | v0.5.6, 55,3k⭐ | `pyproject.toml`: `0.5.9-beta.4`, ~111k⭐, không thấy release tag | Khi cài phải **ghim commit hash**, ghi vào `docs/SPEECH_API_NOTES.md`. |
| Giấy phép mã nguồn | AGPL-3.0 | `AGPL-3.0-only` | Đúng — xem A1. |
| Trọng số **OmniVoice** (engine mặc định của VoiceStudio, cả bản GGUF) | Dùng được | `model-inventory`: **CC-BY-NC** (+ Higgs Audio 2, Meta Llama 3), `commercial_use: false` | **CẤM dùng cho video quảng cáo bán hàng.** Phải chuyển VoiceStudio sang engine VoxCPM2. |
| Trọng số **VoxCPM2** | 48 kHz, có tiếng Việt | Model card **Apache-2.0**; 48 kHz; tiếng Việt nằm trong 30 ngôn ngữ; clone cần câu thoại mẫu ≤ 30s | Engine duy nhất được phép. Kiểm lại model card khi cài. |
| VoxCPM2 trên máy này | Chạy được | CUDA khuyến nghị. Fallback CPU "vài phút mỗi câu", "cần nhiều RAM". VoxCPM2 tự cài PyTorch riêng → **không dùng được Intel XPU**. | Chỉ hợp **chạy lô ban đêm + cache**. Bắt buộc đo RTF ở Task 0. |
| API VoiceStudio | OpenAI-compatible | Docs xác nhận `POST /v1/audio/speech` (ví dụ `{model, voice, input, response_format}`), `GET /v1/audio/voices`, `POST /v1/audio/transcriptions`, `GET /.well-known/voicestudio-speech`. Field chọn engine, tham chiếu giọng clone, `words[]`: **chưa công bố**. Loopback không cần key. | Task 0 phải **dò API thật** trước khi code client. |
| Giải phóng RAM / Demucs qua API | Có | **Không có** endpoint unload, **không có** endpoint Demucs. Headless backend trên Windows **chưa có tài liệu**. | Muốn giải phóng RAM → quản tiến trình (nếu chạy headless được) hoặc tắt app sau lô. Demucs chạy riêng ngoài VoiceStudio. |
| Chi phí TTS hiện tại | Khâu tốn tiền | Vbee/FPT ≈ **$0.005–0.01/video** | VoiceStudio **không hạ chi phí đáng kể**. Giá trị thật là **giọng KOL người thật, xử lý hoàn toàn trên máy**. Tiền nằm ở khâu video AI (A4). |

### A1. Tích hợp VoiceStudio an toàn AGPL (đường chính)

**Ranh giới nghĩa vụ AGPL-3.0:** §13 chỉ phát sinh nghĩa vụ công bố mã khi **sửa** VoiceStudio **và** cho người khác tương tác với bản sửa qua mạng. Dùng nội bộ, không sửa, gọi qua HTTP từ một chương trình riêng thì mã của repo này **không** thành tác phẩm phái sinh. Giữ đúng khoảng cách bằng 6 luật:

1. Không sao chép, vendor, submodule mã VoiceStudio. Không `import` module Python của VoiceStudio.
2. Không phát hành bộ cài hay binary VoiceStudio kèm sản phẩm. Người dùng tự cài **ngoài repo**, ví dụ `D:\AI\_external\VoiceStudio`.
3. Không sửa VoiceStudio. Nếu buộc phải sửa → fork công khai.
4. Client viết theo **chuẩn OpenAI Audio API công khai**, không dựa trên mã nguồn VoiceStudio. Client dùng được với bất kỳ server OpenAI-compatible nào; đây là bằng chứng độc lập.
5. Chỉ gọi tới **loopback** (`127.0.0.1` / `localhost` / `::1`). **Tắt tính năng chia sẻ LAN (PIN 6 số)** của VoiceStudio, vì dữ liệu giọng KOL thật không được rời máy.
6. Ghi rõ trong `docs/GIAY_PHEP_BEN_THU_BA.md`: tên, giấy phép, cách dùng (tiến trình riêng, không sửa), commit hash.

**Rủi ro pháp lý lớn nhất nằm ở trọng số model:** client kiểm engine đang chạy và **từ chối mọi engine tên chứa `omnivoice`**, chỉ cho `voxcpm2`.

**Kiến trúc:**

```
Dashboard: chọn công cụ từng hạng mục (A5)
        │
generate-voiceover.mjs / word-aligner.mjs / video-analyzer.mjs
        │
local-tts-client.mjs  ──HTTP loopback, chuẩn OpenAI──┬─► VoiceStudio 127.0.0.1:3900 (ĐƯỜNG CHÍNH, cài ngoài repo, engine = VoxCPM2)
   (+ chặn engine NC)                                 │      /v1/audio/speech        → giọng KOL
                                                      │      /v1/audio/transcriptions → WhisperX bóc băng / căn từ
                                                      └─► Sidecar VoxCPM2 127.0.0.1:3911 (DỰ PHÒNG — chỉ làm nếu T0 thấy VoiceStudio
                                                             thiếu field clone, không chạy headless, hoặc quá nặng RAM)
```

Sidecar chỉ là phương án dự phòng: VoxCPM2 Apache-2.0, ~100 dòng Python, có `/admin/unload`. Nó nói cùng giao thức nên chỉ cần đổi lựa chọn trên Dashboard là chuyển được.

### A2. Điều phối RAM (máy không GPU rời)

**Ngân sách bộ nhớ ước tính** (số của VoiceStudio/VoxCPM2 chưa được công bố → Task 0 đo thật):

| Thành phần | RAM ước tính |
|---|---|
| Windows + Dashboard + trình duyệt | 6–8 GB |
| Ollama `qwen3.5:9b` Q4 + ngữ cảnh 8k | ~7–8 GB |
| VoiceStudio + VoxCPM2 trên CPU (fp32) | "nhiều GB" — tạm dự trù **8–10 GB** (cộng thêm nếu WhisperX cũng nạp) |
| faster-whisper `small` int8 | ~1 GB |
| Demucs `htdemucs` (CPU) | 2–4 GB |
| FFmpeg dựng 1080×1920 × 2 luồng | 1–2 GB |
| Remotion (Chrome, concurrency mặc định) | 3–6 GB |

Cộng dồn > 31 GB → **bắt buộc chạy tuần tự theo pha**. CPU 16 nhân cũng bị tranh chấp nếu chạy TTS song song với dựng hình.

**Phát hiện:** `run-optimal-pipeline.mjs` **không gọi Ollama**. Ollama được gọi ở `/api/ai-remake` và KOL Studio, giữ model 5 phút. Bấm "AI Remake" rồi chạy Auto-Pilot ngay thì TTS chạy khi Ollama vẫn giữ ~7 GB. Điểm giải phóng đúng là **đầu Bước 4 của pipeline**.

**Cơ chế:**

1. **Ollama:**
   - Gửi `keep_alive` (mặc định `"2m"`) và `options.num_ctx` (8192).
   - `unloadOllamaModels()`: `GET /api/ps` → với mỗi model gửi `POST /api/generate {model, keep_alive: 0}` → chờ `/api/ps` rỗng.
   - Khuyên đặt `OLLAMA_MAX_LOADED_MODELS=1`, `OLLAMA_NUM_PARALLEL=1`.
2. **Cổng tài nguyên** `resource-gate.mjs`: trước pha nặng → unload Ollama → kiểm RAM trống ≥ ngưỡng, chờ tối đa 20s → không đủ thì **dừng với thông báo tiếng Việt**.
3. **VoiceStudio:**
   - Nếu T0 xác nhận chạy headless được → **chế độ managed**: script khởi động (`LOCAL_TTS_START_CMD`), xong pha TTS thì tắt đúng tiến trình đó.
   - Nếu chỉ có app desktop → health-check + cảnh báo RAM + nhắc tắt app sau lô.
   - Luôn gửi `referenceText` để VoiceStudio không phải nạp thêm ASR tự bóc băng câu mẫu.
4. **Batch theo pha** — mỗi model chỉ nạp một lần cho cả lô:

```
[Pha 1] Phân tích video mẫu 1 lần ─► [Pha 2] Kịch bản mọi SKU (Ollama nạp 1 lần) ─► unload Ollama
   ─► [Pha 3] TTS mọi SKU (VoiceStudio nạp 1 lần) ─► tắt/giải phóng TTS
   ─► [Pha 4] Căn từ/phụ đề ─► [Pha 5] Dựng FFmpeg (2 luồng) ─► [Pha 6] Kiểm định + trạng thái duyệt KOL
```

### A3. Phụ đề theo từng từ & X-Ray lời thoại

**Giới hạn hiện tại (đã đọc mã):**

- `ass-subtitles.mjs:47-57`: mỗi cảnh 1 dòng Dialogue phủ cả cảnh, không có thời gian từng từ.
- File `.ass` **chỉ để tải về**. Video thành phẩm vẽ phụ đề bằng `drawtext` (`export-cutlist.mjs:191-196`).
- `generate-voiceover.mjs:215-228` `normalizeAndFitAudio`:
  - (a) `apad` + `atrim` → giọng dài hơn cảnh bị **cắt cụt giữa từ**.
  - (b) `amix` mặc định `normalize=1` → giọng **giảm ~6 dB**, rồi `applyBgmAutoDucking` (`export-cutlist.mjs:288`) giảm thêm lần nữa.

**Căn thời gian từng từ:** ta **đã biết chính xác lời thoại**, nên mọi công cụ đều đi theo cùng mô hình:

> nhận dạng ra từ + thời gian → **ánh xạ DP** (Levenshtein theo âm tiết) về từ kịch bản → **giữ đúng chữ gốc có dấu**, chỉ lấy thời gian.

Có 3 lựa chọn công cụ (bảng A5):
- **Heuristic** (Node thuần, `silencedetect` + chia theo âm tiết): $0, luôn chạy được.
- **faster-whisper local**: MIT, `word_timestamps=True`, cần Python.
- **VoiceStudio · WhisperX** qua `/v1/audio/transcriptions`: chỉ bật khi T0 xác nhận API trả `words[]` **và** license model căn chỉnh tiếng Việt cho phép thương mại. Nhiều checkpoint wav2vec2 tiếng Việt phổ biến dùng CC-BY-NC-4.0.

**Số, giá, ký hiệu:** `199.000đ`, `50%`, `24h` được chuẩn hóa thành chữ trước khi TTS. Bộ chuẩn hóa trả **bản đồ token** `{display: "199.000đ", spoken: [7 từ]}` → phụ đề hiện `199.000đ`, thời gian = khoảng phủ của 7 từ đọc.

**Kiểu TikTok "từ đang đọc":**
- Gom 2–3 từ/cụm (≤ 1,4s).
- Mỗi từ sinh 1 Dialogue hiển thị cả cụm; từ đang đọc tô vàng + phóng 115%.
- Burn-in **theo từng cảnh** ngay trong lần encode cảnh → không thêm lượt encode. Cần FFmpeg có `libass` (T0 kiểm).

**X-Ray lời thoại video mẫu:**
- `analyzeAudioSync` (`video-analyzer.mjs:56-96`) đang đo BPM trên âm thanh trộn giọng + nhạc → BPM nhiễu.
- Lựa chọn `demucs-faster-whisper-local`: Demucs (MIT) tách `vocals` / `no_vocals` → BPM nhạc sạch + bóc băng lời.
- Lựa chọn `voicestudio-asr`: bóc băng qua VoiceStudio, không tách nhạc.
- Kết quả thêm vào `analysis.json → xray.speech`: `transcript`, `words[]`, `wordsPerSec`, `hookText3s`, `perShot[]`. Trong đó `perShot[]` đổ vào `ollamaRemake`.
- Không đổi `analyzeSampleVideo` sang async; X-Ray lời thoại là bước tùy chọn riêng.

### A4. Điểm nghẽn chi phí & tốc độ (mục tiêu < $0.50/video 30s)

Đơn giá lấy từ nhãn ước tính trên Dashboard; Antigravity đối chiếu bảng giá Fal hiện hành ở Task 5.

| Hạng mục | Hiện tại (`--selective`, 2 cảnh AI) | Sau Gói 7 |
|---|---|---|
| Kịch bản | Ollama $0 | $0 |
| Keyframe FLUX Kontext | 2 × ~$0.04 = $0.08 | 1 × $0.04 (cache trúng: $0) |
| Video AI 5s/cảnh | 2 × Wan ~$0.25 = **$0.50** (Kling Turbo $0.40–0.70) | 1 × Wan = **$0.25** |
| TTS | ~$0.01 × **2 lần** (chạy trùng) | $0 (VoiceStudio VoxCPM2) hoặc ~$0.01 × 1 (cache) |
| Dựng FFmpeg | $0 | $0 |
| **Tổng** | **≈ $0.59–0.80** | **≈ $0.29–0.30**; biến thể cùng SKU dùng lại clip AI → **≈ $0–0.04** |

**Điểm nghẽn đã xác định trong mã:**

| # | Vị trí | Vấn đề | Đề xuất |
|---|---|---|---|
| 1 | `run-optimal-pipeline.mjs:62` + `export-cutlist.mjs:381` | **TTS chạy 2 lần** mỗi lần Auto-Pilot | Chỉ sinh giọng khi thiếu wav hoặc `--regen-voice`; cache theo hash |
| 2 | `generate-media.mjs:271-273` | Cố định 2 cảnh AI | `selectiveAiCount` (mặc định 1) + chặn `maxCostUsdPerVideo` 0.50 |
| 3 | `generate-media.mjs` / `fal-client.mjs` | Không cache kết quả Fal → chạy lại thì trả tiền lại | Cache theo hash trong `assets/ai-cache/` |
| 4 | `batch-from-csv.mjs:81` | **Ghi đè `product.json` vô điều kiện** | Đã tồn tại thì giữ nguyên, chỉ log |
| 5 | `batch-from-csv.mjs:95-98` | `generate-prompts` chạy 2 lần; 1 SKU lỗi dừng cả lô; không resume | try/catch từng dòng + tổng kết + `--resume` + `--phased` |
| 6 | `run-optimal-pipeline.mjs:35-36` | Mỗi SKU phân tích lại cùng 1 video mẫu | `skipSampleAnalysis` trong batch |
| 7 | `export-cutlist.mjs:169` | `boxblur=42:6` ở 1080×1920 mọi frame | `scale=270:480,boxblur=10:3,scale=1080:1920` (SSIM ≥ 0,95) |
| 8 | `export-cutlist.mjs:118,143,262,305` | `libx264 -crf 16 -preset medium` rất chậm | Tự dò `h264_qsv` → fallback `libx264 -crf 18 -preset veryfast` |
| 9 | `export-cutlist.mjs:400` | Dựng 4 cảnh tuần tự | Pool 2 luồng |
| 10 | `studio/` (Remotion) | **Không nằm trong luồng tự động** → không phải nghẽn hiện tại | Giữ FFmpeg cho batch. Lưu ý: công ty > 3 người phải mua Remotion Company License. |

### A5. Bảng lựa chọn công cụ theo hạng mục (chuẩn Gói 6)

Áp dụng chuẩn Gói 6 cho mọi danh sách:
- Lựa chọn `$0` đứng đầu, sắp xếp thấp → cao, ghi giá ước tính.
- **Giữ nguyên mặc định hiện có**; danh sách mới mặc định là lựa chọn đầu tiên (= hành vi hiện tại).
- Lựa chọn cần công cụ local hiển thị trạng thái sẵn sàng qua `GET /api/local-tools/status`; chưa sẵn sàng thì xám kèm lý do.
- Thời gian "~X phút" điền theo số đo ở T0.

**1) Giọng đọc TTS — `#cfg-tts-model` (đã có, thêm lựa chọn)**

| # | value | Nhãn hiển thị |
|---|---|---|
| 1 | `windows-sapi-vi` | (có sẵn) |
| 2 | `google-vi-natural` | (có sẵn) |
| 3 | **`voicestudio-voxcpm2`** (mới) | VoiceStudio · VoxCPM2 — Giọng KOL riêng (clone có văn bản đồng ý), xử lý trên máy — $0 / video, CPU ~X phút/video |
| 4 | **`sidecar-voxcpm2`** (mới, chỉ khi làm T7B) | VoxCPM2 Sidecar nhẹ RAM — $0 / video, CPU ~X phút/video |
| 5–8 | `fpt-vi`, `vbee-vi`, `gemini-3.8-flash-tts`, `elevenlabs-v3` | (có sẵn) — **không dùng được** cho nhân vật `mode: "clone"` (A6) |

**2) Căn thời gian phụ đề — `#cfg-subtitle-align` (mới) → `aiCfg.subtitleAlignModel`**

| # | value | Nhãn hiển thị |
|---|---|---|
| 1 | `heuristic-silence` (mặc định) | Chia theo âm tiết + khoảng lặng (Node thuần) — $0, sai số ~±0,3s |
| 2 | `faster-whisper-local` | faster-whisper local + ghép đúng chữ gốc — $0, ±0,1–0,2s, cần Python |
| 3 | `voicestudio-whisperx` | VoiceStudio · WhisperX + ghép chữ gốc — $0, cần VoiceStudio chạy (chỉ hiện khi T0 xác nhận `words[]` + license) |

**3) Kiểu phụ đề — `#cfg-subtitle-style` (mới) → `aiCfg.subtitleStyle`; campaign được ghi đè bằng `subtitleStyle`**

| # | value | Nhãn hiển thị |
|---|---|---|
| 1 | `box` (mặc định) | Khung phụ đề cả câu (như hiện tại) — $0 |
| 2 | `word-highlight` | Highlight từng từ kiểu TikTok (cần libass) — $0 |

**4) Tách nhạc & bóc băng video mẫu — `#cfg-xray-audio` (mới) → `aiCfg.xrayAudioModel`**

| # | value | Nhãn hiển thị |
|---|---|---|
| 1 | `none` (mặc định) | Không tách — đo BPM trên âm thanh trộn (như hiện tại) — $0 |
| 2 | `voicestudio-asr` | VoiceStudio · WhisperX bóc băng (không tách nhạc) — $0, cần VoiceStudio chạy |
| 3 | `demucs-faster-whisper-local` | Demucs tách nhạc/lời + faster-whisper bóc băng — $0, CPU ~X phút/video mẫu, cần Python |

Kịch bản LLM / Ảnh / Video: VoiceStudio không có công cụ cho các hạng mục này → không đổi.

### A6. KOL người thật — đồng ý, phạm vi, duyệt kịch bản, thu hồi

> Đây là khuyến nghị kỹ thuật, **không phải tư vấn pháp lý**. Nên nhờ luật sư rà mẫu văn bản đồng ý trước khi ký.

**Cơ sở:**
- Giọng nói và hình ảnh của người thật là dữ liệu cá nhân. Dữ liệu sinh trắc học thuộc nhóm nhạy cảm (Nghị định 13/2023/NĐ-CP; Luật Bảo vệ dữ liệu cá nhân 2025, hiệu lực 01/01/2026). Việc xử lý cần **đồng ý rõ ràng, đúng mục đích, có thời hạn, rút lại được**.
- Quy định quảng cáo về người có ảnh hưởng (KOL) cũng đặt nghĩa vụ lên nội dung KOL "nói".
- AI tạo **lời mới** bằng giọng thật → KOL phải được duyệt từng kịch bản.

**6 cơ chế kỹ thuật:**

1. **Hồ sơ giọng** trong `character.json` chỉ chứa tham chiếu, không chứa dữ liệu:

```json
"voiceProfile": {
  "engine": "voxcpm2",
  "provider": "voicestudio",
  "mode": "clone",
  "voiceId": "<id VoiceStudio cấp — T0 xác minh cách tạo>",
  "referenceAudio": "assets/private/voices/<characterId>/voice-ref.wav",
  "referenceText": "Câu thoại đúng y lời trong voice-ref.wav",
  "consentRef": "KOL-2026-001"
}
```

   `mode: "design"` vẫn dùng cho KOL AI (như Linh Đan), không cần đồng ý; file mẫu được commit qua `!assets/characters/*/voice-ref.wav`. `mode: "clone"` thì `referenceAudio` **bắt buộc nằm trong `assets/private/`**.

2. **Văn bản đồng ý** `assets/private/consents/<consentRef>.json` (gitignored, kèm bản scan PDF):

```json
{ "consentRef": "KOL-2026-001", "characterId": "...", "signedAt": "2026-11-20", "validUntil": "2027-11-20",
  "scope": { "categories": ["fashion", "beauty"], "platforms": ["TikTok", "Shopee", "Facebook"] },
  "aiDisclosureLabel": true, "allowCloudProcessing": false, "documentFile": "KOL-2026-001.pdf", "revokedAt": null }
```

   Trước **mọi** lần sinh giọng clone, kiểm tra: tồn tại, chưa hết hạn, chưa thu hồi, `product.category` nằm trong `scope.categories`. Sai một điều → **dừng hẳn**.

3. **Chỉ xử lý trên máy:** nhân vật `mode: "clone"` chỉ được dùng engine local (`voicestudio-voxcpm2`, `sidecar-voxcpm2`).
   - TTS local lỗi → **dừng**, không lặng lẽ thay giọng khác.
   - Có cờ `--allow-generic-voice` thì cho dùng giọng thường và gắn nhãn "GIỌNG TẠM".
   - Lý do: thay giọng khác vào mặt KOL thật là sai lệch nhân vật.

4. **KOL duyệt từng kịch bản:** `campaign.kolApproval = { status, scriptHash, approvedBy, approvedAt }`, với `scriptHash` = sha256 toàn bộ lời thoại.
   - Chưa duyệt, hoặc **lời đổi sau khi duyệt** (hash lệch): video vẫn dựng được để xem nhưng **đóng dấu "BẢN NHÁP – CHỜ KOL DUYỆT"**, và Sổ Vận Hành ghi `CHỜ KOL DUYỆT`.
   - Duyệt bằng `scripts/kol-approve.mjs` hoặc nút trên KOL Studio.
   - Trước khi gửi KOL duyệt, nên chạy kiểm duyệt nội dung quảng cáo (skill `kiem-duyet-quang-cao-vn`).

5. **Thu hồi:** `scripts/revoke-voice.mjs <characterId>` mặc định chạy thử (dry-run), thêm `--yes` mới xóa thật. Nó sẽ:
   - đánh dấu `revokedAt`
   - xóa `assets/private/voices/<id>/` và các mục `assets/voice-cache/` của nhân vật
   - xóa `media/audio/` của các chiến dịch dùng nhân vật
   - xóa giọng đã lưu trong VoiceStudio (qua API nếu T0 tìm thấy endpoint xóa, ngược lại in hướng dẫn xóa thủ công)

6. **Tối thiểu dữ liệu:** câu mẫu 3–30s. Không commit, không gửi lên dịch vụ ngoài. Thư mục dữ liệu VoiceStudio đặt ngoài repo và được liệt kê trong hướng dẫn thu hồi.

**Mẫu điều khoản** (checklist cho luật sư, `docs/MAU_DONG_Y_SU_DUNG_GIONG_KOL.md`):
- mục đích
- ngành hàng / nền tảng
- thời hạn
- AI tạo lời mới và quyền duyệt từng video
- nhãn "nội dung do AI tạo"
- xử lý tại máy local, không chuyển ra nước ngoài
- quyền rút lại và thời hạn xóa
- thù lao, xử lý video đã đăng khi rút lại

---

## PHẦN B — KẾ HOẠCH TRIỂN KHAI (giao Antigravity)

> **For agentic workers:** REQUIRED SUB-SKILL: dùng superpowers:executing-plans (hoặc subagent-driven-development) để làm từng task. Các bước dùng checkbox (`- [ ]`).

**Goal:** Giọng KOL người thật qua VoiceStudio (VoxCPM2) chạy local $0 có đồng ý và duyệt; công cụ VoiceStudio thành lựa chọn trên Dashboard cho từng hạng mục; phụ đề highlight từng từ; X-Ray lời thoại; chi phí < $0.50/video; batch nhanh hơn ≥ 2 lần.

**Architecture:**
- Node.js thuần điều phối.
- VoiceStudio là dịch vụ ngoài (AGPL, cài ngoài repo), gọi qua HTTP loopback theo chuẩn OpenAI.
- Công cụ Python riêng (faster-whisper, Demucs; sidecar dự phòng) nằm trong `tools/speech/`, venv gitignored.
- Mỗi công cụ là một lựa chọn trên Dashboard. Thiếu công cụ → lựa chọn xám, luồng cũ vẫn chạy.

**Tech Stack:** Node ≥ 20 (`node:test`, `node:http`), FFmpeg, Ollama, VoiceStudio (VoxCPM2 + WhisperX), Python 3.11 qua `uv` (chỉ `tools/speech/`), `faster-whisper`, `demucs`.

**Spec:** Phần A của tài liệu này.

### Global Constraints

- Không sửa `assets/products/*/product.json`. Không đổi `immutableTraits`.
- Không sao chép, vendor hay `import` mã VoiceStudio. Chỉ gọi HTTP tới `127.0.0.1` / `localhost` / `::1`. Tắt chia sẻ LAN của VoiceStudio.
- Engine TTS local chỉ cho phép `voxcpm2`. Chặn mọi engine tên chứa `omnivoice`.
- **KOL người thật (`mode: "clone"`):**
  - phải có văn bản đồng ý hợp lệ (tồn tại, còn hạn, chưa thu hồi, đúng ngành hàng)
  - chỉ engine local
  - dữ liệu giọng và văn bản đồng ý chỉ nằm trong `assets/private/` (gitignored), **không bao giờ commit**
  - video chưa duyệt hoặc lời đã đổi sau khi duyệt → đóng dấu "BẢN NHÁP – CHỜ KOL DUYỆT"
- Mọi danh sách công cụ trên Dashboard: `$0` đứng đầu, thấp → cao, ghi giá ước tính, **giữ nguyên mặc định hiện có**.
- Không thêm npm dependency vào gốc repo. Test dùng `node:test`.
- `maxCostUsdPerVideo` mặc định `0.50`. `selectiveAiCount` mặc định `1`.
- Cổng VoiceStudio `3900`, sidecar `3911` (đổi từ 3901 vì 3901 là giao diện web của VoiceStudio). Timeout TTS local mặc định `600000` ms.
- Ghi file theo kiểu tạm rồi `rename`. Thông báo lỗi bằng tiếng Việt.
- **Khóa mốc** (theo `CLAUDE.md`): `node --check` các file sửa → `node --test` → `node scripts/validate-assets.mjs` 100% → `cd studio && npm.cmd run typecheck` nếu đụng `studio/` → cập nhật `docs/NHAT_KY.md` → đề xuất 1 dòng commit. **Chỉ commit khi xong trọn 1 mốc.**

### Review Focus

1. **Văn bản đồng ý hết hạn, đã thu hồi hoặc sai ngành hàng** (ví dụ KOL đồng ý `fashion`, chiến dịch là `home`) → không sinh giọng clone, báo rõ lý do. *(Task 8)*
2. **VoiceStudio tắt, timeout hoặc đang chạy engine OmniVoice:**
   - nhân vật thường/design → rơi về engine cũ
   - nhân vật clone → dừng (trừ khi có `--allow-generic-voice`)
   - không hỏng `campaign.json`, không để wav nửa vời

   *(Task 7, Task 9)*
3. **Văn bản có số/giá/ký hiệu** (`199.000đ`, `50%`, `24h`) → đọc thành chữ, phụ đề hiện nguyên chữ gốc, token số không có thời gian thì nội suy. *(Task 3, Task 10)*
4. **Lời thoại bị sửa sau khi KOL duyệt** → hash lệch → video quay lại trạng thái nháp có dấu. *(Task 8)*
5. **CSV có id trùng sản phẩm đã có, hoặc 1 dòng lỗi** → không ghi đè `product.json`, các dòng khác vẫn chạy. *(Task 4)*

### Thứ tự & mốc bàn giao

**Bản 3 — sắp lại để không phải chờ Task 0:**

| Mốc | Task | Cần cài thêm? | Trạng thái / Lợi ích |
|---|---|---|---|
| **7.1 Nền tảng** | T1 → T6 | Không | ✅ **XONG** (`300e4da` + vá UI `e0e2ed2`) |
| **7.0 Spike** | T0 | VoiceStudio + Python/uv — **người dùng ĐÃ DUYỆT** | Cổng quyết định; dò API thật. Cần giọng mẫu của chính người dùng |
| **7.2a Không cần cài** | T0-Bước 1 → T5b → T8* → T10* → T11 | Không | ✅ **XONG** (Claude) — kiểm thật: burn-in ASS + dấu nháp trên video |
| **7.2b Sau T0** | T7 (+T7B nếu cần) → T9 → T10 (tầng 2–3) → T12 → phần còn lại của T8 | Cần T0 PASS | 🟡 **MÃ XONG** (Claude, test bằng máy chủ giả) — **chờ Task 0 xác minh với VoiceStudio + Python thật**. Chưa làm: T7B (chỉ khi cổng T0 yêu cầu), xóa giọng qua API VoiceStudio |

**Phạm vi Mốc 7.2a** (đánh dấu * = làm một phần):

- **T0-Bước 1:** chỉ kiểm FFmpeg (`-version`, `h264_qsv`, `libass`). T11 cần kết quả `libass`.
- **T5b (mới, nhỏ) — Fal tính tròn 5s/10s:**
  - Thêm `falBilledSeconds(durationSec) → 5 | 10` vào `scripts/lib/cost-ledger.mjs`, cùng quy tắc với `fal-client.mjs:109` (`durationSec >= 8 ? 10 : 5`).
  - `generate-media.mjs` dùng hàm này khi dựng `aiScenes` để ước tính.
  - Test: `falBilledSeconds(4) === 5`, `(7.9) === 5`, `(8) === 10`, `(12) === 10`; 1 cảnh 4s Wan ước tính `$0.25` chứ không phải `$0.20`.
- **T8\*:** làm toàn bộ, **trừ** việc xóa giọng đã lưu **bên trong VoiceStudio**. Trong 7.2a, `revoke-voice.mjs` in hướng dẫn xóa thủ công; xóa qua API làm ở 7.2b nếu T0 tìm thấy endpoint.
- **T10\* — chỉ tầng 1:**
  - Làm `heuristicWordTimes`, `mapAsrToScript` (hàm thuần, test bằng dữ liệu ASR giả), `detectSpeechBounds`, `alignCampaignWords` với `heuristic-silence`.
  - Danh sách `#cfg-subtitle-align` hiện đủ 3 lựa chọn theo bảng A5-2, nhưng `faster-whisper-local` và `voicestudio-whisperx` **xám kèm chú thích "(cần Task 0)"**. Chưa có `getLocalToolsStatus` (T9) thì để xám cứng.
  - **Đo vùng tiếng nói:** đo trên **file TTS thô trước khi trộn** ngay trong `generate-voiceover.mjs`, quy đổi theo `tempo` (`speechStart = rawStart / tempo`, `speechEnd = min(dur, rawEnd / tempo)`), ghi `speechStart` / `speechEnd` vào `voice-manifest.json` (và vào meta của cache giọng). `detectSpeechBounds` chỉ là fallback khi manifest thiếu 2 trường này.
  - *Đính chính (đã đo thật):* bản 3 từng ghi âm nền sine ≈ −32 dBFS sẽ che ngưỡng −35 dB. **Sai** — bộ lọc `sine` mặc định biên độ 1/8 nên âm nền chỉ ≈ −50 dBFS, `silencedetect` vẫn đo đúng trên file đã trộn. Đo trên file thô vẫn được giữ vì chính xác hơn (trước atempo / fade).
- **T11:** làm toàn bộ (dùng `words.json` từ heuristic). Thiếu `libass` → lựa chọn `word-highlight` xám + giữ `drawtext`.
- **Khóa Mốc 7.2a** (theo Global Constraints), commit gợi ý: `git commit -m "Gói 7.2a: đồng ý/duyệt/thu hồi giọng KOL, căn từ heuristic + phụ đề highlight từng từ, ước tính Fal bậc 5s/10s"`.

**Mốc 7.2b** bắt đầu khi T0 có kết quả ở Bước 7 (cổng quyết định). Thứ tự: T7 (+T7B) → T9 → T10 tầng 2–3 (bỏ xám 2 lựa chọn ASR theo `getLocalToolsStatus`) → T12 → xóa giọng qua API của T8.

---

### Task 0: Spike — cài VoiceStudio, dò API, đo hiệu năng (cổng quyết định)

**Files:**
- Create: `scripts/speech-probe.mjs`, `docs/SPEECH_API_NOTES.md`, `tools/speech/requirements.txt` (`faster-whisper`, `demucs>=4.0.1`, `soundfile`), `tools/speech/README.md`

- [ ] **Bước 1:** Kiểm FFmpeg, ghi vào notes:
  - `ffmpeg -version` — cần ≥ 5 cho `amix normalize`
  - `ffmpeg -hide_banner -encoders | findstr qsv`
  - `ffmpeg -hide_banner -filters | findstr " ass "`
- [ ] **Bước 2 (người dùng duyệt cài VoiceStudio ngoài repo):**
  - Chọn 1 trong 2 cách:
    - app desktop qua script cài chính thức — người dùng đọc script trước khi chạy
    - build từ mã nguồn (Git, Bun, uv, Node ≥ 22.12, Rust, VS 2022 Build Tools)
  - Ghi **commit hash**.
  - Chuyển TTS backend sang **VoxCPM2**, ghi lại cách chọn: biến `OMNIVOICE_TTS_BACKEND` hoặc Model Catalogue.
  - **Tắt chia sẻ LAN**, ghi vị trí thư mục dữ liệu.
  - Mở model card `openbmb/VoxCPM2`, ghi license + revision.
- [ ] **Bước 3:** Xác định VoiceStudio có chạy **headless** trên Windows không (lệnh, thư mục làm việc) → quyết định có dùng chế độ managed.
- [ ] **Bước 4:** `node scripts/speech-probe.mjs --voicestudio` lưu nguyên văn response của:
  - `GET /.well-known/voicestudio-speech` — **engine đang chạy nằm ở field nào?**
  - `GET /v1/audio/voices`
  - cách **tạo voice clone** từ `voice-ref.wav` + `referenceText` (endpoint, field) và cách tham chiếu `voiceId` trong `POST /v1/audio/speech`
  - có endpoint **xóa voice** không
  - `POST /v1/audio/transcriptions` có nhận `timestamp_granularities[]=word` / `response_format=verbose_json` và trả `words[]` không
  - WhisperX dùng model căn chỉnh nào cho `vi`, license gì

  Lưu 1 response mẫu làm **fixture** `scripts/tests/fixtures/voicestudio-*.json`.
- [ ] **Bước 5:** Sinh câu `"Chỉ 199.000 đồng hôm nay, giảm 50 phần trăm, giao trong 24 giờ"` bằng giọng clone (dùng giọng của chính người dùng để thử, không dùng giọng KOL). Ghi:
  - thời gian, độ dài audio, **RTF**
  - RAM đỉnh của tiến trình VoiceStudio (`Get-Process | Sort PeakWorkingSet64`)
  - sample rate
- [ ] **Bước 6:** Cài `tools/speech/.venv` (uv, Python 3.11) → chạy faster-whisper `small` int8 `word_timestamps=True` trên file vừa sinh, và Demucs `--two-stems=vocals -d cpu` trên 30s video mẫu. Ghi thời gian và RAM.
- [ ] **Bước 7 — Cổng quyết định** (ghi vào `docs/NHAT_KY.md`):

  | Kết quả | Quyết định |
  |---|---|
  | RTF ≤ 20 | VoiceStudio dùng cho batch đêm |
  | RTF > 20 | Chỉ dùng cho video KOL "hero" |
  | Thiếu field clone / không xác định được engine đang chạy / RAM > 12 GB | **Làm T7B** (sidecar) làm đường sản xuất; VoiceStudio chỉ để thử giọng |
  | Tiếng Việt nghe không đạt | **Dừng Mốc 7.2**, vẫn làm 7.1 và 7.3 |

---

### Task 1: Kiểm soát bộ nhớ Ollama

**Files:**
- Modify: `scripts/lib/ollama-client.mjs:17-58`
- Test: `scripts/tests/ollama-client.test.mjs`

**Interfaces — Produces:**
- `generateOllamaJson({ ..., keepAlive = process.env.OLLAMA_KEEP_ALIVE || '2m', numCtx = Number(process.env.OLLAMA_NUM_CTX) || 8192 })` — body thêm `keep_alive`, `options.num_ctx`
- `listLoadedOllamaModels({ baseUrl }) → Promise<Array<{ name: string, size: number, size_vram: number }>>`
- `unloadOllamaModels({ baseUrl, timeoutMs = 15000 }) → Promise<string[]>` — Ollama tắt thì trả `[]`, không ném lỗi

- [ ] **Bước 1: Test hỏng** (mock `node:http`, cổng 0):

```js
test('generateOllamaJson gửi keep_alive và num_ctx', async () => {
  assert.equal(body.keep_alive, '2m'); assert.equal(body.options.num_ctx, 8192);
});
test('unloadOllamaModels gửi keep_alive 0 cho từng model đang nạp', async () => {
  assert.deepEqual(unloaded, ['qwen3.5:9b', 'llava:7b']);
  assert.ok(generateCalls.every((b) => b.keep_alive === 0));
});
test('unloadOllamaModels trả [] khi Ollama không chạy', async () =>
  assert.deepEqual(await unloadOllamaModels({ baseUrl: 'http://127.0.0.1:1' }), []));
```

- [ ] **Bước 2:** `node --test scripts/tests/ollama-client.test.mjs` → FAIL.
- [ ] **Bước 3:** Cài đặt. Poll `/api/ps` 500 ms/lần tới khi rỗng hoặc hết `timeoutMs`.
- [ ] **Bước 4:** PASS; `node --check`. Thêm `OLLAMA_KEEP_ALIVE`, `OLLAMA_NUM_CTX`, `OLLAMA_MAX_LOADED_MODELS=1`, `OLLAMA_NUM_PARALLEL=1` vào `.env.example`.

### Task 2: Cổng tài nguyên + móc vào pipeline

**Files:**
- Create: `scripts/lib/resource-gate.mjs`
- Modify: `scripts/run-optimal-pipeline.mjs:58-62`
- Test: `scripts/tests/resource-gate.test.mjs`

**Interfaces:**
- Consumes: `unloadOllamaModels` (T1).
- Produces:
  - `getFreeMemoryGb() → number`
  - `ensureFreeMemory({ minFreeGb, label, waitMs = 20000, pollMs = 2000, freeMemFn = getFreeMemoryGb }) → Promise<number>`
  - `prepareForHeavyPhase({ label, minFreeGb, ollamaBaseUrl }) → Promise<{ unloaded: string[], freeGb: number }>`

- [ ] **Bước 1: Test hỏng:**

```js
test('ensureFreeMemory chờ tới khi đủ RAM', async () => {
  const seq = [3, 3, 9];
  assert.equal(await ensureFreeMemory({ minFreeGb: 8, label: 'TTS', pollMs: 1, freeMemFn: () => seq.shift() }), 9);
});
test('ensureFreeMemory báo lỗi tiếng Việt khi hết thời gian', async () =>
  await assert.rejects(ensureFreeMemory({ minFreeGb: 8, label: 'TTS', waitMs: 5, pollMs: 1, freeMemFn: () => 2 }),
    /Không đủ RAM cho TTS: cần 8 GB, còn 2/));
```

- [ ] **Bước 2:** Chạy → FAIL.
- [ ] **Bước 3:** Cài đặt. Trước Bước 4 của pipeline gọi `prepareForHeavyPhase`:
  - `label: 'TTS'`
  - `minFreeGb`: `aiCfg.ttsMinFreeGb ?? 10` khi `ttsModel` là `voicestudio-*` hoặc `sidecar-*`, ngược lại `2`.
- [ ] **Bước 4:** PASS. Chạy `node scripts/run-optimal-pipeline.mjs` → log `[Tài nguyên] Đã giải phóng Ollama: ...`, pipeline vẫn PASS.

### Task 3: Chuẩn hóa số tiếng Việt, cache giọng, khớp thời lượng, bỏ TTS chạy trùng

**Files:**
- Create: `scripts/lib/vi-text-normalize.mjs`, `scripts/lib/voice-cache.mjs`
- Modify: `scripts/generate-voiceover.mjs:215-228`, `:256-331`
- Modify: `scripts/export-cutlist.mjs:380-382`
- Modify: `.gitignore` (thêm `assets/voice-cache/`, `assets/private/*` — dùng `/*` chứ không dùng `/`, để T8 thêm được ngoại lệ `!assets/private/README.md`)
- Test: `scripts/tests/vi-text-normalize.test.mjs`, `scripts/tests/voice-cache.test.mjs`, `scripts/tests/audio-fit.test.mjs`

**Interfaces — Produces:**
- `normalizeViForTts(text) → { spoken: string, tokens: Array<{ display: string, spoken: string[] }> }`
- `voiceCacheKey({ engine, model, voiceId, text, refAudioHash }) → string` (sha256 hex)
- `getCachedVoice(key, { cacheDir }) → string | null`
- `putCachedVoice(key, buffer, { cacheDir, characterId }) → string` — ghi thêm `{key, characterId}` vào `index.json`
- `purgeVoiceCache(characterId, { cacheDir }) → number` — số file đã xóa (T8 dùng)
- `computeFitTempo(rawSec, targetSec) → { tempo, overflowSec }` (export từ `generate-voiceover.mjs`)
  - `tempo = min(1.15, max(1, raw/target))`, làm tròn 3 chữ số
  - `overflowSec = max(0, raw/tempo − target)`
- File `media/audio/voice-manifest.json`: `[{ sceneId, wav, text, spoken, tokens, engine, cacheKey, speechSec }]`

- [ ] **Bước 1: Test hỏng:**

```js
test('đọc giá', () => {
  const r = normalizeViForTts('Chỉ 199.000đ');
  assert.equal(r.spoken, 'Chỉ một trăm chín mươi chín nghìn đồng');
  assert.deepEqual(r.tokens[1], { display: '199.000đ', spoken: ['một','trăm','chín','mươi','chín','nghìn','đồng'] });
});
test('quy tắc đọc số', () => {
  for (const [n, s] of [['21','hai mươi mốt'],['15','mười lăm'],['105','một trăm linh năm'],['1.000.000','một triệu'],['50%','năm mươi phần trăm'],['24h','hai mươi bốn giờ']])
    assert.equal(normalizeViForTts(n).spoken, s);
});
test('giữ nguyên chữ có dấu', () => assert.equal(normalizeViForTts('Chính hãng').tokens.length, 2));
test('cache key đổi khi text đổi', () => assert.notEqual(voiceCacheKey({ ...b, text: 'a' }), voiceCacheKey({ ...b, text: 'b' })));
test('purgeVoiceCache chỉ xóa file của đúng nhân vật', () => { /* put 2 file kol-a, 1 file kol-b → purge('kol-a') === 2, file kol-b còn */ });
test('computeFitTempo', () => {
  assert.deepEqual(computeFitTempo(3, 4), { tempo: 1, overflowSec: 0 });
  assert.deepEqual(computeFitTempo(4.2, 4), { tempo: 1.05, overflowSec: 0 });
  const r = computeFitTempo(5, 4); assert.equal(r.tempo, 1.15); assert.ok(Math.abs(r.overflowSec - 0.348) < 0.01);
});
```

- [ ] **Bước 2:** Chạy → FAIL.
- [ ] **Bước 3: Cài đặt.**
  - `normalizeAndFitAudio`:
    - đo độ dài thô bằng `ffprobe`, áp `atempo`
    - `overflowSec > 0` thì `afade=t=out:st=dur-0.12:d=0.12` + cảnh báo "nên rút gọn lời thoại"
    - `amix=...:normalize=0`
    - bỏ âm nền sine khi chiến dịch có nhạc nền
  - Mọi engine tra cache trước, khóa có tên engine. Log `[Cache]` khi trúng.
  - Văn bản gửi TTS = `spoken`. Phụ đề giữ text gốc.
  - `export-cutlist` chỉ gọi `generateCampaignVoiceover` khi có cảnh thiếu `audioSrc` hoặc có `--regen-voice`.
- [ ] **Bước 4:** PASS. Chạy voiceover sample 2 lần → lần 2 mọi cảnh có `[Cache]`. Chạy Auto-Pilot → log TTS chỉ xuất hiện **1 lần**.

### Task 4: Gia cố batch CSV

**Files:**
- Modify: `scripts/batch-from-csv.mjs` (tách hàm thuần, chặn gọi `main()` khi bị import)
- Modify: `scripts/run-optimal-pipeline.mjs:22` → `runOptimalPipeline(path, { skipSampleAnalysis = false, skipPrompts = false } = {})`
- Test: `scripts/tests/batch-from-csv.test.mjs`

**Interfaces — Produces:**
- `parseCsv(text) → object[]`
- `buildProductFromRow(row) → object | null`
- `writeProductIfMissing(prodDir, productObj) → 'created' | 'kept'`
- `runBatch(rows, { runner, resume, root }) → Promise<{ ok: string[], failed: Array<{ id, error }>, skipped: string[] }>`

- [ ] **Bước 1: Test hỏng:**

```js
test('không ghi đè product.json đã tồn tại', () => {
  assert.equal(writeProductIfMissing(dir, { name: 'MỚI' }), 'kept');
  assert.equal(JSON.parse(fs.readFileSync(f)).name, 'GỐC');
});
test('1 dòng lỗi không dừng cả lô', async () => {
  const runner = async (p) => { if (p.includes('p2')) throw new Error('x'); };
  const r = await runBatch(rows3, { runner, root: tmp });
  assert.equal(r.ok.length, 2); assert.equal(r.failed[0].id, 'p2');
});
test('--resume bỏ qua SKU đã có out/ffmpeg-9x16.mp4 mới hơn campaign.json', async () => { /* ... */ });
```

- [ ] **Bước 2:** Chạy → FAIL.
- [ ] **Bước 3:** Cài đặt.
  - Bỏ `generate-prompts` riêng khi có `--run`.
  - Phân tích video mẫu 1 lần, sau đó gọi pipeline với `skipSampleAnalysis: true`.
  - Bảng tổng kết. `process.exitCode = 1` nếu có lỗi.
- [ ] **Bước 4:** PASS. Chạy batch mẫu → `git status` **không** hiện `product.json` nào bị sửa.

### Task 5: Sổ chi phí, chặn ngân sách, cache kết quả AI

**Files:**
- Create: `scripts/lib/cost-ledger.mjs`, `scripts/lib/ai-cache.mjs`
- Modify: `scripts/generate-media.mjs:271-273` và đoạn submit Fal
- Modify: `.gitignore` (thêm `assets/ai-cache/`)
- Test: `scripts/tests/cost-ledger.test.mjs`

**Interfaces — Produces:**
- `PRICE_TABLE_USD` theo **đúng id model trên Dashboard**. Khoảng giá thì lấy cận trên; model $0 có giá `0`. Đối chiếu bảng giá Fal, ghi ngày đối chiếu vào chú thích.
- `estimateAiCost({ imageModel, videoModel, ttsModel, aiScenes: Array<{ durationSec }>, keyframes }) → { items: Array<{ step, model, units, usd }>, totalUsd }` (làm tròn 2 chữ số)
- `assertWithinBudget(estimate, maxUsd)` — ném `Error('Vượt ngân sách: ước tính $X > $Y / video')`
- `recordCost(campaignDir, item)` — ghi thêm vào `out/cost-ledger.jsonl`
- `aiCacheKey({ endpoint, payload, imageHashes }) → string`, `getCachedAi(key, ext) → string | null`, `putCachedAi(key, srcPath, ext) → string`

- [ ] **Bước 1: Test hỏng:**

```js
test('1 cảnh Wan 5s + 1 keyframe = $0.29', () =>
  assert.equal(estimateAiCost({ imageModel:'fal-flux-kontext', videoModel:'fal-wan-i2v', ttsModel:'google-vi-natural', aiScenes:[{durationSec:5}], keyframes:1 }).totalUsd, 0.29));
test('chặn 2 cảnh Kling 5s', () =>
  assert.throws(() => assertWithinBudget(estimateAiCost({ imageModel:'fal-flux-kontext', videoModel:'fal-kling-turbo', ttsModel:'google-vi-natural', aiScenes:[{durationSec:5},{durationSec:5}], keyframes:2 }), 0.5), /Vượt ngân sách/));
test('aiCacheKey đổi khi ảnh đổi', () => assert.notEqual(aiCacheKey({ ...p, imageHashes:['a'] }), aiCacheKey({ ...p, imageHashes:['b'] })));
```

- [ ] **Bước 2:** Chạy → FAIL.
- [ ] **Bước 3:** Cài đặt.
  - `selectiveAiCount = aiCfg.selectiveAiCount ?? 1` (chỉ 1 hoặc 2)
  - ước tính + chặn ngân sách **trước khi submit**
  - cache trúng → copy, ghi `$0`
  - `--dry-run` in bảng ước tính
- [ ] **Bước 4:** PASS. `node scripts/generate-media.mjs campaigns/sample-campaign/campaign.json --mode video --selective --dry-run` → tổng ≤ $0.50.

### Task 6: Tăng tốc dựng FFmpeg

**Files:**
- Create: `scripts/lib/ffmpeg-encoder.mjs`
- Modify: `scripts/export-cutlist.mjs:118,143,169,262,305,400`
- Test: `scripts/tests/ffmpeg-encoder.test.mjs`

**Interfaces — Produces:**
- `detectVideoEncoder({ ffmpeg = 'ffmpeg', prefer = process.env.VIDEO_ENCODER } = {}) → { name: 'h264_qsv' | 'libx264', args: string[] }`
  - QSV: `['-c:v','h264_qsv','-global_quality','22','-pix_fmt','nv12']`
  - x264: `['-c:v','libx264','-crf','18','-preset','veryfast','-pix_fmt','yuv420p']`
  - Dò bằng encode thử 1 frame; cache kết quả trong tiến trình.
- `hasFfmpegFilter(name, { ffmpeg }) → boolean`
- `renderSceneSegmentAsync(scene, idx, ctx, tmpDir) → Promise<string>`; pool `concurrency = 2`

- [ ] **Bước 1: Test hỏng:**

```js
test('ép libx264 qua prefer', () => assert.equal(detectVideoEncoder({ prefer: 'libx264' }).name, 'libx264'));
test('ffmpeg không tồn tại → fallback libx264', () => assert.equal(detectVideoEncoder({ ffmpeg: 'khong-co-ffmpeg' }).name, 'libx264'));
```

- [ ] **Bước 2:** Chạy → FAIL.
- [ ] **Bước 3:** **Đo baseline trước**: `Measure-Command { node scripts/export-cutlist.mjs campaigns/sample-campaign/campaign.json --render-ffmpeg --ratio=all }`, giữ `ffmpeg-9x16.mp4` cũ. Sau đó cài đặt:
  - bokeh rút gọn
  - 4 khối encode dùng `detectVideoEncoder().args`
  - pool 2 luồng, giữ đúng thứ tự trong `concat.txt`
- [ ] **Bước 4:** PASS. Chạy `ffmpeg -i old.mp4 -i new.mp4 -lavfi ssim -f null -` → **SSIM All ≥ 0,95**. `verify-integrity.mjs` PASS. Đo lại → mục tiêu **nhanh hơn ≥ 2 lần**, ghi cả 2 số.
- [ ] **Bước 5 — Khóa Mốc 7.1:**
  - Chạy: `node --check`, `node --test`, `validate-assets` 100%, `run-optimal-pipeline` PASS. Cập nhật nhật ký.
  - Đề xuất commit: `git commit -m "Gói 7.1: cache giọng + bỏ TTS trùng, chặn ngân sách <$0.50, batch an toàn, dựng QSV nhanh"`.

---

### Task 7: Client OpenAI-compatible cho VoiceStudio + chặn license

**Files:**
- Create: `scripts/lib/local-tts-client.mjs`, `docs/GIAY_PHEP_BEN_THU_BA.md`
- Modify: `.env.example` (`LOCAL_TTS_PROVIDER`, `LOCAL_TTS_URL`, `LOCAL_TTS_API_KEY`, `LOCAL_TTS_START_CMD`, `LOCAL_TTS_START_CWD`)
- Test: `scripts/tests/local-tts-client.test.mjs` (dùng fixture từ T0)

**Interfaces — Produces:**
- `resolveLocalTtsConfig(aiCfg, env) → { provider: 'voicestudio' | 'sidecar', baseUrl, apiKey, model, timeoutMs, allowedEngines: ['voxcpm2'], startCmd, startCwd }` — mặc định `provider: 'voicestudio'`, `baseUrl: 'http://127.0.0.1:3900'`. Ném lỗi khi host không phải loopback.
- `checkLocalTts(cfg) → Promise<{ ok: boolean, engine: string | null, detail: string }>` — VoiceStudio: `GET /v1/models` + `findEngineInModelList` (đính chính sau khi đọc backend v0.5.8: `/.well-known` không chứa engine); sidecar: `GET /health`.
- `assertCommercialSafeEngine(engine, allowedEngines)` — ném lỗi với tên chứa `omnivoice`, hoặc engine `null` / không trong allowlist.
- `synthesizeLocalTts(text, { cfg, voiceProfile }) → Promise<Buffer>` — gọi `checkLocalTts` + `assertCommercialSafeEngine` (cache trong tiến trình), rồi `POST {baseUrl}/v1/audio/speech` với `{ model, input, voice: voiceProfile.voiceId, response_format: 'wav' }` + field clone theo notes T0. Có `Authorization: Bearer` khi có key. Timeout bằng `AbortController`.
- `transcribeLocalAsr(wavPath, { cfg, language = 'vi' }) → Promise<{ text: string, words: Array<{ w, start, end }> | null }>` — `POST /v1/audio/transcriptions` (multipart, `FormData` + `Blob` có sẵn trong Node). Trả `words: null` nếu server không trả `words[]`.
- `unloadLocalTts(cfg) → Promise<boolean>` — VoiceStudio: `false` + log gợi ý managed; sidecar: `POST /admin/unload`.
- `withManagedLocalTts(cfg, fn) → Promise<T>` — health fail mà có `startCmd` → `spawn` (windowsHide), chờ health ≤ 120s, chạy `fn`, rồi tắt **chỉ tiến trình do nó mở** (`taskkill /PID <pid> /T /F`).

- [ ] **Bước 1: Test hỏng:**

```js
test('từ chối host không phải loopback', () =>
  assert.throws(() => resolveLocalTtsConfig({ localTts: { baseUrl: 'http://192.168.1.5:3900' } }, {}), /loopback/));
test('chặn OmniVoice và engine không xác định', () => {
  assert.throws(() => assertCommercialSafeEngine('omnivoice-gguf', ['voxcpm2']), /CC-BY-NC|thương mại/);
  assert.throws(() => assertCommercialSafeEngine(null, ['voxcpm2']), /không xác định/);
});
test('synthesize từ chối khi server báo engine omnivoice', async () => { /* mock well-known theo fixture, engine=omnivoice */ });
test('gửi body OpenAI-compatible, trả Buffer WAV', async () => {
  assert.equal(body.response_format, 'wav'); assert.equal(body.voice, 'vs-voice-123');
  assert.equal(buf.subarray(0, 4).toString(), 'RIFF');
});
test('transcribeLocalAsr trả words=null khi server không có words[]', async () => { /* ... */ });
test('timeout ném lỗi rõ ràng', async () =>
  await assert.rejects(synthesizeLocalTts('x', { cfg: { ...cfg, timeoutMs: 50 }, voiceProfile }), /quá thời gian/));
```

- [ ] **Bước 2:** Chạy → FAIL.
- [ ] **Bước 3:** Cài đặt. Viết `docs/GIAY_PHEP_BEN_THU_BA.md` theo 6 luật A1 + bảng license (VoiceStudio AGPL-3.0-only — tiến trình riêng, không sửa, commit hash; VoxCPM2 Apache-2.0; faster-whisper MIT; Demucs MIT; model căn chỉnh WhisperX — theo T0; OmniVoice CC-BY-NC — **cấm**).
- [ ] **Bước 4:** PASS. Chạy thật `node scripts/speech-probe.mjs --tts --provider voicestudio` → ra WAV 48 kHz.

### Task 7B (chỉ làm khi cổng T0 yêu cầu): Sidecar VoxCPM2 dự phòng

**Files:**
- Create: `tools/speech/tts_server.py`
- Modify: `tools/speech/requirements.txt` (thêm `voxcpm>=2.0.3`), `.gitignore` (thêm `tools/speech/.venv/`)

**Interfaces:** cùng giao thức với T7 — thư viện chuẩn `http.server` + `voxcpm`, bind **127.0.0.1:3911**, xử lý từng request một, nạp model lười:
- `GET /health → { ok, engine: 'voxcpm2', license: 'apache-2.0', loaded }`
- `POST /v1/audio/speech { model, input, voice, response_format: 'wav', ref_audio_path, ref_text, seed? }`
- `POST /admin/unload`

- [ ] **Bước 1:** Cài đặt.
- [ ] **Bước 2:** Kiểm thật:
  - `node scripts/speech-probe.mjs --tts --provider sidecar` → WAV 48 kHz.
  - Gọi `/admin/unload` → RAM tiến trình giảm rõ (ghi số).
  - Test của T7 với `provider: 'sidecar'` PASS.

### Task 8: KOL người thật — đồng ý, phạm vi, duyệt kịch bản, thu hồi

**Files:**
- Create: `scripts/lib/kol-consent.mjs`, `scripts/kol-approve.mjs`, `scripts/revoke-voice.mjs`, `docs/MAU_DONG_Y_SU_DUNG_GIONG_KOL.md`, `assets/private/README.md`
- Modify: `.gitignore` (thêm `!assets/private/README.md` — chỉ file này trong `assets/private/` được commit; thêm `!assets/characters/*/voice-ref.wav` cho giọng KOL AI `mode: "design"`)
- Modify: `scripts/validate-assets.mjs:99-112`
- Modify: `scripts/export-cutlist.mjs` (dấu nháp ở **cả 3 nhánh** dựng: clip AI, clip thô, Studio Pro)
- Modify: `scripts/run-optimal-pipeline.mjs:90-100` (trạng thái Sổ Vận Hành)
- Modify: `scripts/dashboard-server.mjs` (`POST /api/kol/approve`), `dashboard/kol-studio.js` (nút "KOL đã duyệt kịch bản này" + ô tên người duyệt)
- Test: `scripts/tests/kol-consent.test.mjs`

**Interfaces:**
- Consumes: `purgeVoiceCache` (T3).
- Produces:
  - `loadConsent(consentRef, { privateDir = 'assets/private/consents' }) → object | null`
  - `assertVoiceConsent({ character, product, now = new Date(), privateDir }) → object` — ném lỗi tiếng Việt khi: thiếu, hết hạn (`validUntil < now`), đã thu hồi (`revokedAt`), hoặc `product.category ∉ scope.categories`. Nhân vật không có `voiceProfile` hoặc `mode: 'design'` → trả `null` (không cần).
  - `computeScriptHash(campaign) → string` — sha256 của `scenes.map(s => s.subtitle).join('\n')` + `hookText` + `ctaText`.
  - `getApprovalState(campaign, character) → 'not-required' | 'pending' | 'approved' | 'stale'`
  - `validateVoiceProfile(vp, label) → { errors: string[], warnings: string[] }` (export từ `validate-assets.mjs`):
    - `engine ≠ 'voxcpm2'` → error
    - `mode: 'clone'` mà thiếu `consentRef` → error
    - `mode: 'clone'` mà `referenceAudio` không nằm trong `assets/private/` → error
    - file văn bản đồng ý không có trên máy này → **warning** (để validate vẫn 100% trên máy không có dữ liệu riêng)
  - CLI: `node scripts/kol-approve.mjs <campaign.json> --by "<tên>"`; `node scripts/revoke-voice.mjs <characterId> [--yes]` (mặc định chỉ liệt kê, `--yes` mới xóa)

- [ ] **Bước 1: Test hỏng:**

```js
test('thiếu văn bản đồng ý → chặn', () => assert.throws(() => assertVoiceConsent({ character: clone('KOL-X'), product, privateDir: tmp }), /chưa có văn bản đồng ý/));
test('hết hạn → chặn', () => assert.throws(() => assertVoiceConsent({ ..., now: new Date('2028-01-01') }), /hết hạn/));
test('đã thu hồi → chặn', () => { /* revokedAt = '2026-12-01' */ });
test('sai ngành hàng → chặn', () => assert.throws(() => assertVoiceConsent({ ..., product: { category: 'home' } }), /ngoài phạm vi/));
test('design không cần đồng ý', () => assert.equal(assertVoiceConsent({ character: design(), product }), null));
test('lời đổi sau khi duyệt → stale', () => {
  const c = { ...camp, kolApproval: { status: 'approved', scriptHash: computeScriptHash(camp) } };
  c.scenes[0].subtitle += '!'; assert.equal(getApprovalState(c, cloneChar), 'stale');
});
test('validateVoiceProfile: clone có referenceAudio ngoài assets/private là lỗi', () =>
  assert.equal(validateVoiceProfile({ engine:'voxcpm2', mode:'clone', consentRef:'K', referenceAudio:'assets/characters/a/voice-ref.wav' }, 'c').errors.length, 1));
```

- [ ] **Bước 2:** Chạy → FAIL.
- [ ] **Bước 3:** Cài đặt.
  - Dấu nháp: `drawtext` "BẢN NHÁP – CHỜ KOL DUYỆT" bán trong suốt khi trạng thái `pending` / `stale`.
  - Sổ Vận Hành ghi `CHỜ KOL DUYỆT`.
  - Viết `docs/MAU_DONG_Y_SU_DUNG_GIONG_KOL.md` theo checklist A6, kèm dòng "cần luật sư rà soát".
- [ ] **Bước 4:** PASS. Kiểm thật:
  - Tạo nhân vật thử `mode: 'clone'` với văn bản đồng ý giả trong `assets/private/` → render → frame có dấu nháp.
  - `kol-approve` → render lại → hết dấu.
  - Sửa 1 chữ phụ đề → dấu xuất hiện lại.
  - `revoke-voice --yes` → cache và voice-ref bị xóa.
  - `git status` **không** hiện file nào trong `assets/private/` ngoài README.

### Task 9: Lựa chọn TTS trên Dashboard + nối engine VoiceStudio + batch theo pha

**Files:**
- Modify: `dashboard/index.html:111-118` (`#cfg-tts-model`: thêm option theo bảng A5-1)
- Modify: `dashboard/app.js` (hiển thị trạng thái sẵn sàng)
- Modify: `scripts/dashboard-server.mjs` (nhận giá trị mới; `GET /api/local-tools/status`; **không đổi mặc định**)
- Modify: `scripts/generate-voiceover.mjs` (nhánh `voicestudio-voxcpm2` / `sidecar-voxcpm2`, đặt trước nhánh Vbee ở dòng 271)
- Modify: `scripts/batch-from-csv.mjs` (cờ `--phased`)
- Test: `scripts/tests/voice-engine-routing.test.mjs`

**Interfaces:**
- Consumes: T2 `prepareForHeavyPhase`, T3 `normalizeViForTts` / cache, T7 `withManagedLocalTts` / `synthesizeLocalTts` / `unloadLocalTts`, T8 `assertVoiceConsent`.
- Produces:
  - `getLocalToolsStatus() → Promise<{ voicestudio: { ok, engine, detail }, sidecar: { ok }, speechPython: boolean, libass: boolean, qsv: boolean }>` — đây là body của `GET /api/local-tools/status`, dùng chung cho các danh sách ở T10–T12.
  - `pickVoiceRoute({ ttsModel, character, allowGenericVoice }) → { engines: string[], mustBeLocal: boolean }` (hàm thuần trong `generate-voiceover.mjs`):
    - clone → chỉ engine local `` `${voiceProfile.provider}-voxcpm2` ``, `mustBeLocal: true`, bỏ qua `ttsModel` đang chọn
    - thường/design → engine được chọn rồi chuỗi fallback cũ
    - clone + `allowGenericVoice` → thêm fallback, gắn nhãn "GIỌNG TẠM"

- [ ] **Bước 1: Test hỏng:**

```js
test('clone chỉ đi engine local, không fallback', () =>
  assert.deepEqual(pickVoiceRoute({ ttsModel: 'vbee-vi', character: cloneChar }), { engines: ['voicestudio-voxcpm2'], mustBeLocal: true }));
test('nhân vật thường giữ chuỗi fallback cũ', () =>
  assert.deepEqual(pickVoiceRoute({ ttsModel: 'voicestudio-voxcpm2', character: plain }).engines.slice(-2), ['google-vi-natural', 'windows-sapi-vi']));
test('clone + allowGenericVoice cho fallback', () =>
  assert.ok(pickVoiceRoute({ ttsModel: 'voicestudio-voxcpm2', character: cloneChar, allowGenericVoice: true }).engines.length > 1));
```

- [ ] **Bước 2:** Chạy → FAIL.
- [ ] **Bước 3:** Cài đặt.
  - Nhánh VoiceStudio: `assertVoiceConsent` → `prepareForHeavyPhase` → `withManagedLocalTts` bọc vòng cảnh → `unloadLocalTts`.
  - `--phased` chạy đúng 6 pha ở A2.
  - **Chỉ gắn `voiceProfile` cho nhân vật thật sau khi có văn bản đồng ý và KOL nghe duyệt giọng mẫu.**
- [ ] **Bước 4:** PASS. Kiểm thật:
  - Tắt VoiceStudio → nhân vật thường rơi về fallback; nhân vật clone dừng với lỗi rõ ràng.
  - Bật VoiceStudio → log `OK [VoiceStudio · VoxCPM2]`.
  - Dashboard: option nằm sau 2 lựa chọn $0 có sẵn, xám khi VoiceStudio chưa chạy.
  - `batch-from-csv --run --phased` → Ollama và TTS mỗi thứ chỉ nạp 1 lần.
- [ ] **Bước 5 — Khóa Mốc 7.2:**
  - Chạy kiểm tra như 7.1 + `git status` không có dữ liệu trong `assets/private/`. Cập nhật nhật ký.
  - Đề xuất commit: `git commit -m "Gói 7.2: giọng KOL thật qua VoiceStudio VoxCPM2 (đồng ý + duyệt + thu hồi), chặn license NC, batch theo pha"`.

---

### Task 10: Căn thời gian từng từ — 3 lựa chọn công cụ

**Files:**
- Create: `tools/speech/align_words.py`, `scripts/lib/word-aligner.mjs`
- Modify: `dashboard/index.html`, `dashboard/app.js`, `scripts/dashboard-server.mjs` (thêm `#cfg-subtitle-align` theo bảng A5-2, mặc định `heuristic-silence`)
- Test: `scripts/tests/word-aligner.test.mjs`

**Interfaces:**
- Consumes: `voice-manifest.json` (T3), `transcribeLocalAsr` (T7), `getLocalToolsStatus` (T9).
- `align_words.py --manifest <voice-manifest.json> --out <asr-words.json> [--model small]` → `[{ sceneId, words: [{ w, start, end }] }]`
- Produces:
  - `findSpeechPython() → string | null`
  - `detectSpeechBounds(wavPath) → { speechStart, speechEnd }` (`silencedetect=noise=-35dB:d=0.15`)
  - `heuristicWordTimes(tokens, { speechStart, speechEnd }) → Array<{ display, start, end, source: 'heuristic' }>`
  - `mapAsrToScript(tokens, asrWords) → Array<{ display, start, end, source: 'asr' | 'interp' }>` — DP Levenshtein trên âm tiết chuẩn hóa (chữ thường, bỏ dấu câu, **giữ dấu thanh**)
  - `alignCampaignWords(campaignDir, { model = aiCfg.subtitleAlignModel }) → Promise<Array<{ sceneId, words }>>`:
    - `faster-whisper-local` → Python CLI
    - `voicestudio-whisperx` → `transcribeLocalAsr`, mỗi cảnh một lần
    - lỗi hoặc `words: null` → **luôn rơi về heuristic**
    - ghi `media/audio/words.json`

- [ ] **Bước 1: Test hỏng:**

```js
test('giữ chữ 199.000đ, lấy thời gian từ 7 từ đọc', () => {
  const r = mapAsrToScript(normalizeViForTts('Chỉ 199.000đ').tokens, asrWordsMock);
  assert.equal(r[1].display, '199.000đ'); assert.equal(r[1].start, asrWordsMock[1].start); assert.equal(r[1].end, asrWordsMock[7].end);
});
test('ASR nghe sai 1 từ thì nội suy', () => assert.equal(r.find((x) => x.display === 'hãng').source, 'interp'));
test('heuristic phủ kín và tăng dần', () => {
  const r = heuristicWordTimes(tokens, { speechStart: 0.2, speechEnd: 3.0 });
  assert.equal(r[0].start, 0.2); assert.equal(r.at(-1).end, 3.0);
  assert.ok(r.every((w, i) => i === 0 || w.start >= r[i - 1].end - 1e-9));
});
test('voicestudio-whisperx trả words=null thì rơi về heuristic', async () => { /* inject transcribe mock */ });
```

- [ ] **Bước 2:** Chạy → FAIL.
- [ ] **Bước 3:** Cài đặt. Gọi `alignCampaignWords` cuối `generateCampaignVoiceover`.
- [ ] **Bước 4:** PASS. Chạy cả 3 lựa chọn trên sample → đều ra `words.json`; ghi sai số cảm nhận vào nhật ký.

### Task 11: Phụ đề ASS "từ đang đọc" + burn-in theo cảnh — lựa chọn kiểu phụ đề

**Files:**
- Modify: `scripts/lib/ass-subtitles.mjs`, `scripts/generate-voiceover.mjs:347-351`, `scripts/export-cutlist.mjs:191-196`
- Modify: `dashboard/index.html`, `dashboard/app.js`, `scripts/dashboard-server.mjs` (thêm `#cfg-subtitle-style` theo bảng A5-3, mặc định `box`)
- Test: `scripts/tests/ass-subtitles.test.mjs`

**Interfaces:**
- Consumes: `words.json` (T10), `hasFfmpegFilter` (T6).
- Produces:
  - `chunkWords(words, { maxWords = 3, maxSec = 1.4 }) → Array<{ start, end, words }>`
  - `generateAssSubtitles(scenes, outAssPath, { width, height, wordsByScene = null })` — không có `wordsByScene` thì **giữ hành vi cũ y nguyên**
  - `generateSceneAss(scene, words, outPath, { width, height }) → string` — thời gian tương đối theo cảnh
  - Kiểu phụ đề hiệu lực = `campaign.subtitleStyle ?? aiCfg.subtitleStyle ?? 'box'`

- [ ] **Bước 1: Test hỏng:**

```js
test('không có words thì 1 Dialogue mỗi cảnh (hành vi cũ)', () => assert.equal(countDialogue(legacyOut), 2));
test('word-highlight: số Dialogue = số từ, thời gian tăng dần', () => { /* 5 từ → 5 dòng */ });
test('từ active tô vàng + phóng 115%, giữ dấu', () => assert.match(out, /\{\\c&H00D4FF&\\fscx115\\fscy115\}hãng/));
test('ASS tổng cộng offset theo cảnh', () => assert.match(out, /Dialogue: 0,0:00:04\.\d\d/));
```

- [ ] **Bước 2:** Chạy → FAIL.
- [ ] **Bước 3:** Cài đặt.
  - Burn-in: thêm `,ass='<escape như subFileEsc>':fontsdir='C\:/Windows/Fonts'` vào chuỗi filter của cảnh.
  - Bỏ `drawbox` + `drawtext` phụ đề dưới; **giữ** thanh hook trên và dấu nháp (T8).
  - Thiếu `libass` → option xám trên Dashboard + log cảnh báo + giữ `drawtext`.
- [ ] **Bước 4:** PASS. Chọn `word-highlight`, render, trích frame `ffmpeg -ss 1.0 -i out/ffmpeg-9x16.mp4 -frames:v 1 check.png` → **người dùng xem**: dấu đúng, từ active nổi bật, không đè sản phẩm.

### Task 12: X-Ray lời thoại video mẫu — 3 lựa chọn công cụ

**Files:**
- Create: `tools/speech/xray_speech.py`
- Modify: `scripts/lib/video-analyzer.mjs` (thêm export, **không đổi** hàm cũ)
- Modify: `scripts/analyze-sample-video.mjs` (cờ `--speech`), `scripts/dashboard-server.mjs` (`POST /api/xray-speech`)
- Modify: `dashboard/index.html` + `app.js`:
  - thêm `#cfg-xray-audio` theo bảng A5-4, mặc định `none`
  - Mục 02/08 hiển thị lời thoại, thẻ "Tốc độ nói", hook 3s
- Modify: `scripts/lib/video-remake.mjs` (`ollamaRemake` nhận `perShot` tùy chọn)
- Test: `scripts/tests/video-analyzer-speech.test.mjs`

**Interfaces:**
- Consumes: `transcribeLocalAsr` (T7), `prepareForHeavyPhase` (T2), `getLocalToolsStatus` (T9).
- `xray_speech.py --video <path> --out <dir> --max-sec 90` → `speech.json { language, words: [{ w, start, end }] }` + `vocals.wav`, `no_vocals.wav`
- Produces:
  - `summarizeSpeech(words, shots, durationSec) → { transcript, wordsPerSec, hookText3s, speechCoverage, perShot: Array<{ index, text }> }` (hàm thuần)
  - `analyzeSpeechTrack(absPath, { durationSec, shots, model = aiCfg.xrayAudioModel }) → Promise<null | (summary & { musicBpm: object | null })>`:
    - `voicestudio-asr` → trích wav bằng ffmpeg → `transcribeLocalAsr`; `musicBpm = null`
    - `demucs-faster-whisper-local` → Python; `musicBpm = analyzeAudioSync(no_vocals.wav).bpm`
    - `none` hoặc công cụ thiếu → `null`
  - `analysis.json → xray.speech`

- [ ] **Bước 1: Test hỏng:**

```js
test('wordsPerSec và hookText3s', () => {
  const s = summarizeSpeech(words10in4s, shots, 4);
  assert.equal(s.wordsPerSec, 2.5); assert.equal(s.hookText3s, 'Đừng mua nồi này khi chưa xem');
});
test('perShot gán từ theo thời gian cảnh cắt', () => assert.deepEqual(s.perShot.map((p) => p.index), [1, 2]));
```

- [ ] **Bước 2:** Chạy → FAIL.
- [ ] **Bước 3:** Cài đặt. Gọi `prepareForHeavyPhase({ label: 'X-Ray lời thoại', minFreeGb: 6 })` trước khi chạy công cụ.
- [ ] **Bước 4:** PASS. Chạy `node scripts/analyze-sample-video.mjs --speech` với từng lựa chọn → `analysis.json` có `xray.speech`; Mục 02/08 hiển thị.
- [ ] **Bước 5 — Khóa Mốc 7.3:**
  - Chạy kiểm tra như 7.1 + `node scripts/smoke-test.mjs` (+ `typecheck` nếu đụng `studio/`).
  - Cập nhật `docs/NHAT_KY.md`, `docs/HUONG_DAN_HE_THONG_VA_TOI_UU.md`, mục Gói 7 trong `docs/KE_HOACH_NANG_CAP_GIAI_PHAU.md`.
  - Đề xuất commit: `git commit -m "Gói 7.3: 3 lựa chọn căn từ + highlight từng từ burn-in ASS, 3 lựa chọn X-Ray lời thoại"`.

---

### Rủi ro chính & cách giảm

| Rủi ro | Khả năng | Giảm thiểu |
|---|---|---|
| VoxCPM2 trên CPU quá chậm (vài phút/câu) | Cao | Cổng T0; cache theo hash; batch đêm theo pha; Vbee/FPT vẫn là đường nhanh cho nhân vật thường |
| API VoiceStudio khác docs / không lộ engine đang chạy | Trung bình | Client chỉ viết sau khi có fixture thật ở T0; engine không xác định → từ chối; có T7B dự phòng |
| VoiceStudio chạy nhầm OmniVoice (license NC) | Trung bình | Kiểm engine trước mỗi lần chạy; allowlist cứng `voxcpm2` |
| Dữ liệu giọng KOL thật lọt vào git / ra ngoài máy | Thấp nếu tuân thủ | `assets/private/` gitignored; validate báo lỗi khi `referenceAudio` ngoài `assets/private/`; chỉ engine local; tắt chia sẻ LAN |
| Video "KOL nói" lời chưa duyệt bị đăng | Trung bình | `scriptHash` + dấu nháp + trạng thái Sổ Vận Hành; sửa lời là mất duyệt |
| FFmpeg thiếu `h264_qsv` / `libass` / `amix normalize` | Trung bình | Tự dò + fallback + option xám trên Dashboard |
| Giọng clone lệch giữa các cảnh | Trung bình | Cố định `voice-ref.wav` + `referenceText` + `seed`; KOL nghe duyệt giọng mẫu trước khi gắn `voiceProfile` |
