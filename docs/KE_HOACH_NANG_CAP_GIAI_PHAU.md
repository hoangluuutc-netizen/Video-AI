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

## 3. Quy tắc kiểm tra sau mỗi gói
1. `node scripts/validate-assets.mjs`
2. `cd studio && npm.cmd run typecheck`
3. Cập nhật `docs/NHAT_KY.md`
