# Hướng dẫn Test Thử Hệ thống (Checklist 5 Phút)

## Bước 0: Kiểm tra nhanh toàn hệ thống (tùy chọn)
Mở PowerShell tại `d:\AI\tạo video AI` và chạy:
```powershell
node scripts/smoke-test.mjs
```

---

## Bước 1: Mở Dashboard
Nhấp đúp vào file **[start-dashboard.bat](../../start-dashboard.bat)** ở thư mục gốc dự án (hoặc chạy `node scripts/dashboard-server.mjs`).  
Trình duyệt sẽ tự động mở tại **`http://localhost:4173`**.

*(Nếu muốn test các tính năng gọi Cloud như **Giải phẫu sâu Gemini** hoặc **Veo 3.1 / Character Sheet AI**, hãy bấm nút **⚙️ Cài đặt Bộ não & Công cụ** ở góc trên và nhập `GEMINI_API_KEY`).*

---

## Bước 2: Test Giải phẫu Video Mẫu & Khóa Nhân Vật (Mục `02 / 08`)
1. Chọn Video mẫu (`video-m-u`) hoặc dán link TikTok/Shorts vào ô **Link URL** rồi bấm **⬇️ Tải từ Link**.
2. Kiểm tra biểu đồ **Sóng âm & Vạch cắt cảnh thật (X-Ray)** cùng các thẻ `BPM`, `Cắt cảnh thật`, `Hook 3s đầu`.
3. Chọn **Ngành hàng** & **Phong cách**, rồi bấm **🎭 Tạo Bộ Ảnh Nhân Vật 4 Góc** để xem tạo ảnh tham chiếu 4 góc cho nhân vật.
4. Bấm **✨ Áp Công Thức Sang Hook & 6 Khối** để đổ công thức sang Mục 03 & 04.

---

## Bước 3: Test Kiểm soát Nhịp Thoại & Prompt Studio (Mục `03`, `04`, `05`)
1. Ở **Mục `04 / 08`**, gõ thử thêm chữ vào một khối kịch bản để thấy bộ đếm **`X/Y từ`** tự động đổi màu đỏ cảnh báo khi vượt `2.8 từ/giây`.
2. Ở **Mục `05 / 08`**, kéo thả ảnh sản phẩm thật (PNG tách nền) hoặc ảnh nhân vật thật của bạn, bấm **🎨 Tạo Cặp Ảnh Đầu/Cuối & Prompt 3-Slot**, sau đó thử nút **📥 Tải `.md`**.

---

## Bước 4: Test Dựng Video 3 Tỷ Lệ & Phụ Đề (Mục `06 / 08` & `07 / 08`)
1. *(Tùy chọn)* Chép 1 file nhạc nền `.mp3` vào `assets/music/` để bật tự động trộn nhạc nền **Auto-Ducking**.
2. Bấm **🎙️ 2. Sinh Giọng Đọc & Lồng Tiếng**, nghe thử trên trình phát và thử tải **📥 `.srt`** / **📥 `.ass` (TikTok)**.
3. Bấm **📐 Xuất 3 Tỷ Lệ (9:16 + 1:1 + 16:9)** để dựng đồng bộ cả 3 file trong `campaigns/sample-campaign/out/`:
   - `ffmpeg-9x16.mp4` (TikTok / Reels / Shopee Video)
   - `ffmpeg-1x1.mp4` (Facebook Feed / Shopee)
   - `ffmpeg-16x9.mp4` (Website / YouTube)
4. Xuống **Mục `07 / 08`** bấm kiểm duyệt `PASS/FAIL` để xác nhận không có khung hình đen và hình/tiếng khớp nhau.

---

## Bước 5: Test Nhập Hàng Loạt Từ CSV (Dành cho nhiều SKU)
Chỉnh sửa danh sách sản phẩm trong `assets/products/batch-template.csv` và chạy:
```powershell
node scripts/batch-from-csv.mjs assets/products/batch-template.csv
```
*(Thêm `--run` ở cuối nếu muốn tự động chạy Auto-Pilot dựng video cho toàn bộ danh sách).*
