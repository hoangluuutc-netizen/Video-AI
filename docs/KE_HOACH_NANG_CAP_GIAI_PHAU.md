# Kế hoạch Nâng cấp Hệ thống Giải Phẫu & Nhân Bản Video (`D:\AI\tạo video AI`)

> Tài liệu này tổng hợp các module đã chuyển từ công cụ `giai-phau-video` vào `scripts/lib/` và 5 gói tinh chỉnh để hoàn thiện hệ thống **Đội Làm Video A.I.**.

## 1. Dữ liệu & Module đã chuyển sẵn vào repo
- `scripts/lib/video-analyzer.mjs`: đo cắt cảnh thật (`detectVideoCuts`), giải mã sóng âm & BPM (`analyzeAudioSync`), chấm điểm hook 3s đầu (`pacingMetrics`) — **đã tích hợp vào `scripts/analyze-sample-video.mjs`**.
- `scripts/lib/gemini-client.mjs`: client gọi Gemini Files API + Interactions API (`gemini-4-hydrogen` mặc định, không cần cài thêm package).
- `scripts/lib/video-forensics.mjs`: schema & prompt giải phẫu video từng cảnh (`aiBreakdown`).
- `scripts/lib/video-remake.mjs`: 7 ngành hàng (`CATEGORY_PRESETS`), 5 phong cách (`STYLE_PRESETS`), giới hạn lời thoại `~2.8 từ/giây` (`wordsFor`), `templateRemake`, `aiRemake`, `toCampaign`.

## 2. 5 gói điều chỉnh tiếp theo (theo thứ tự ưu tiên)

### Gói 1 — Hiển thị X-Ray thật lên Mục `02 / 08` (`dashboard/`)
- Vẽ biểu đồ sóng âm (`waveform`) + vạch đỏ/vàng đánh dấu `cuts` từ `sampleAnalysis.xray`.
- Hiển thị thẻ thông số: `Số cảnh thật`, `Nhịp dựng (s/cảnh)`, `BPM`, `Độ mạnh Hook 3s đầu`.

### Gói 2 — Thêm "Giải phẫu sâu Gemini" & "Nạp link URL" (`dashboard-server.mjs` + `dashboard/`)
- Thêm `POST /api/xray-ai` gọi `uploadVideo()` + `aiBreakdown()` từ `gemini-client.mjs` & `video-forensics.mjs`.
- Thêm `POST /api/fetch-sample-url` (dùng `yt-dlp` nếu máy đã cài, fallback hướng dẫn kéo thả `.mp4`).
- Thêm nút **"Áp công thức sang Hook & 6 khối"** gọi `aiRemake()` đổ thẳng vào Bảng Hook (`03/08`) và Kịch bản (`04/08`).

### Gói 3 — Kiểm soát số từ lời thoại & xuất `.srt` tổng (`dashboard/app.js` + `scripts/generate-voiceover.mjs`)
- Cảnh báo ngay trên giao diện khi lời thoại vượt ngưỡng `~2.8 từ/giây` theo `durationSec` của từng cảnh.
- Xuất kèm 1 file `subtitles.srt` tổng hợp toàn video để người dùng nạp lại vào CapCut/TikTok nếu muốn.

### Gói 4 — Bổ sung 7 ngành hàng & 5 phong cách vào `prompt-builder.mjs`
- Đồng bộ `CATEGORY_PRESETS` và `STYLE_PRESETS` từ `video-remake.mjs` vào `prompt-builder.mjs` và form sản phẩm trên Dashboard.

### Gói 5 — Tinh chỉnh an toàn khi dựng & QC (`scripts/export-cutlist.mjs` + `scripts/verify-integrity.mjs`)
- Trong `export-cutlist.mjs`: ưu tiên dùng ảnh PNG đã tách nền sẵn (`referenceImages.transparent`); chỉ áp dụng `colorkey=0xFFFFFF:0.06:0.03` khi ảnh đầu vào có nền trắng đặc (JPG) để tránh làm lủng chi tiết sản phẩm màu trắng.
- Trong `verify-integrity.mjs`: khi `hasOwnReplacedAssets === true`, bổ sung kiểm tra khung hình đen (`blackdetect`) và độ lệch thời lượng audio/video thay vì chỉ trả `OK`.

### Gói 6 — Chuẩn hóa danh sách lựa chọn Model AI trên Dashboard (`dashboard/index.html` + `scripts/dashboard-server.mjs`)
- Mỗi phần việc (Kịch bản LLM, Tạo/Ghép ảnh, Tạo chuyển động Video, Giọng đọc TTS) có danh sách đầy đủ các công cụ AI phù hợp.
- **Lựa chọn mặc định đầu tiên** luôn là model **không tốn token (`$0`)**.
- **Thứ tự sắp xếp:** Từ thấp đến cao theo hướng tối ưu dần (miễn phí `0đ` → giá rẻ → cân bằng → cao cấp nhất).
- **Hiển thị chi phí:** Sau mỗi lựa chọn đều ghi rõ **giá ước tính** để người dùng chủ động kiểm soát ngân sách trước khi chạy.

### Gói 7 — Giọng KOL local $0, Phụ đề từng từ, X-Ray lời thoại & < $0.50/video (ĐÃ CHỐT bản 2 — Mốc 7.1 đã giao Antigravity)
- Chi tiết phân tích + kế hoạch 13 task (bản 2): [`docs/KE_HOACH_GOI_7_GIONG_KOL_LOCAL.md`](KE_HOACH_GOI_7_GIONG_KOL_LOCAL.md).
- **7.0 Spike:** cài VoiceStudio ngoài repo, chuyển engine sang VoxCPM2, dò API thật, đo tốc độ CPU (máy không có GPU rời), kiểm FFmpeg `h264_qsv`/`libass`.
- **7.1 Nền tảng (không cài thêm):** unload Ollama trước TTS, cổng RAM, cache giọng + bỏ TTS chạy 2 lần, batch không ghi đè `product.json`, chặn ngân sách `$0.50` + 1 cảnh AI, dựng QSV nhanh hơn.
- **7.2 Giọng KOL người thật:** VoiceStudio (AGPL, gọi qua HTTP loopback chuẩn OpenAI) là đường chính, **cấm OmniVoice (CC-BY-NC)**; văn bản đồng ý + phạm vi ngành hàng + KOL duyệt từng kịch bản (dấu "BẢN NHÁP" khi chưa duyệt) + thu hồi giọng; dữ liệu giọng chỉ ở `assets/private/`. Sidecar VoxCPM2 chỉ làm khi T0 yêu cầu.
- **7.3 Phụ đề & X-Ray:** mỗi hạng mục thành danh sách lựa chọn trên Dashboard theo chuẩn Gói 6 — Căn phụ đề (Heuristic / faster-whisper / VoiceStudio·WhisperX), Kiểu phụ đề (Khung / Highlight từng từ), Tách nhạc & bóc băng (Không / VoiceStudio·WhisperX / Demucs + faster-whisper).

## 3. Quy tắc kiểm tra sau mỗi gói
1. `node scripts/validate-assets.mjs`
2. `cd studio && npm.cmd run typecheck`
3. Cập nhật `docs/NHAT_KY.md`
