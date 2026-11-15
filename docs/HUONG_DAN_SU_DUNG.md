# Hướng Dẫn Sử Dụng Chi Tiết: Đội Làm Video A.I. (7 Trợ Lý, 1 Cỗ Máy Ra Reel)

> **Mục tiêu xuyên suốt và bất di bất dịch của công cụ:**
> **Người thật + Hình ảnh/Video sản phẩm thật 100% — Tuyệt đối không làm biến dạng hay thay đổi bất kỳ chi tiết nào của người và sản phẩm.**
>
> Trong hệ thống này, AI đóng vai trò **Đạo diễn kịch bản, Chọn Hook, Chia mốc cắt ghép, Lên phụ đề và Kiểm duyệt chất lượng**, còn việc hiển thị hình ảnh sản phẩm/người thật được xử lý bằng công cụ dựng xác định (`ffmpeg`, `Remotion`, `CapCut`) và kiểm chứng bằng chỉ số toán học **SSIM**.

---

## 1. Khởi động nhanh giao diện điều khiển trực quan

Mở PowerShell tại thư mục gốc dự án (`d:\AI\tạo video AI`) và chạy:

```powershell
node scripts/dashboard-server.mjs
```

Sau đó mở trình duyệt tại địa chỉ:
👉 **http://localhost:4173**

*(Khi kết nối thành công, góc phải trên cùng của giao diện sẽ hiện trạng thái màu xanh: `🟢 Đã kết nối Local Server (Chạy lệnh thật)`).*

### ✨ Các tiện ích điều khiển nhanh trên mọi mục giao diện:
1. **Nút ẩn/hiện hướng dẫn chi tiết (`❓ Hướng dẫn mục này`):** Ở góc phải của **tất cả các mục cần lựa chọn hoặc điều chỉnh** (`01` đến `07` và mục `Cài đặt Bộ não`), bấm vào biểu tượng `❓ Hướng dẫn mục này` sẽ mở ngay hộp hướng dẫn chi tiết cách thao tác riêng cho mục đó; bấm lần nữa để thu gọn.
2. **Nút mở & trích xuất file trực tiếp (`📂 Mở file ...`):** Ở mỗi mục đọc hoặc xuất dữ liệu (`product.json`, `character.json`, `brand.json`, `ai-config.json`, `catalog.json`, `campaign.json`, `cutlist.md`, `voiceover-full.mp3`, `ffmpeg-9x16.mp4`, `reel-sheet.json`), bấm vào biểu tượng `📂` sẽ:
   - Tự động mở **Windows File Explorer** trỏ thẳng tới file đó trên ổ đĩa của bạn.
   - Đồng thời mở **cửa sổ xem nhanh & trích xuất nội dung file** (`📋 Copy nội dung`) ngay trên trình duyệt.
3. **Thanh Trạng Thái Tiến Độ Thời Gian Thực (Sticky Progress Telemetry Bar):** Luôn bám ở đầu màn hình, hiển thị:
   - **Trạng thái công việc đang chạy** và **thanh phần trăm (`%`) tiến độ hoàn thành**.
   - **Thời gian đã xử lý (`Đã chạy: 00:00s`)** và **Thời gian dự kiến còn lại (`Còn lại (ETA)`)**.
   - Các chip hiển thị nhanh **Bộ não AI & Công cụ đang bật** (`LLM`, `Video Engine`, `Giọng đọc TTS`, `Render`).
4. **Bảng `⚙️ Cài đặt Bộ não & Công cụ`:** Bấm nút `⚙️ Cài đặt Bộ não` trên thanh trên cùng để tùy chỉnh:
   - **Bộ não Kịch bản & Hook (LLM):** `Gemini 2.5 Pro`, `Gemini 2.5 Flash`, `Claude 3.7 Sonnet` hoặc Local Engine.
   - **Công cụ Sinh Cảnh Từ Ảnh Người & SP Thật:** `FFmpeg Real-Photo Studio Composite (Giữ 100% ảnh gốc)`, `Veo 2.0 Image-to-Video (Khóa Keyframe gốc)` hoặc `Imagen 3 + Remotion Composite`.
   - **Bộ não Giọng đọc & Âm thanh (Voiceover TTS):** `Gemini 3.8 Flash TTS`, `Google Vietnamese Neural TTS` hoặc `Giọng thu thật từ clip gốc`.
   - **Công cụ Dựng & Kiểm định:** `FFmpeg 9:16 + Remotion Studio + SSIM ≥ 0.90`.

---

## 2. Bước chuẩn bị: Kéo & Thả Ảnh Sản phẩm, Ảnh Người thật và Video vào giao diện

Tại mục **`05 / 08 — TIẾP THEO, ĐẠO DIỄN LÊN HÌNH`** trên `http://localhost:4173`, bạn có thể **kéo thả trực tiếp (Drag & Drop)** hoặc bấm chọn file vào **3 ô tải nhanh**:
1. **`📦 1. KÉO THẢ ẢNH SẢN PHẨM THẬT` (`.png`, `.jpg`, `.webp`):** Tự động lưu vào `assets/products/<id>/`, cập nhật `referenceImages` trong `product.json` và hiển thị xem trước ngay trên thẻ & khung điện thoại `9:16`.
2. **`🧑 2. KÉO THẢ ẢNH NHÂN VẬT THẬT` (`.png`, `.jpg`, `.webp`):** Tự động lưu vào `assets/characters/<id>/` và cập nhật `character.json`.
3. **`🎬 3. KÉO THẢ VIDEO QUAY THẬT / MẪU` (`.mp4`, `.mov`):** Tự động lưu vào `assets/footage/`, tự động chạy `ffprobe` (`ingest-footage.mjs`) để ghi thời lượng vào `catalog.json`, điền mã `footageId` vào các cảnh `real-footage` và phát thử ngay trong khung điện thoại `9:16`.
   - *Mẹo nhanh:* Bạn cũng có thể **kéo thả trực tiếp file `.mp4` vào bất kỳ dòng nào trong Bảng Phân Cảnh** để gán riêng video đó cho đúng cảnh vừa thả!

Ngoài ra, bạn vẫn có thể chép file thủ công vào thư mục như dưới đây:

### A. Khai báo sản phẩm thật (`assets/products/<ma-san-pham>/`)
1. Tạo thư mục sản phẩm, ví dụ: `assets/products/vali-keo-tre-em/`
2. Đặt ảnh chụp thật của sản phẩm (`front.png`, `detail.png`, `cutout.png`) vào thư mục đó.
3. Tạo file `product.json` (tham khảo mẫu tại [product.json](file:///d:/AI/t%E1%BA%A1o%20video%20AI/assets/products/sample-product/product.json)) với các trường quan trọng:
   - `price`, `salePrice`, `discountBadge`: Giá bán và ưu đãi thật (khóa cứng để AI không tự bịa giá).
   - `highlights`: Các tính năng thật của sản phẩm.
   - `immutableFeatures`: **Danh sách đặc điểm vật lý bất biến** (màu sắc, vị trí logo, tỷ lệ kích thước, chất liệu).
   - `forbiddenChanges`: **Những thay đổi bị nghiêm cấm** (ví dụ: không được đổi bề mặt nhám thành bóng, không được làm méo logo).

### B. Khai báo người thật lên hình (`assets/characters/<ma-nhan-vat>/`)
1. Đặt ảnh tham chiếu người thật vào `assets/characters/<ma-nhan-vat>/`.
2. Khai báo `immutableTraits` trong [character.json](file:///d:/AI/t%E1%BA%A1o%20video%20AI/assets/characters/sample-kol/character.json).
3. **Lưu ý pháp lý & an toàn:** Nếu người lên hình là trẻ em hoặc khách hàng, cần lưu xác nhận đồng ý của phụ huynh/người lên hình.

### C. Đưa video quay thật bằng điện thoại vào kho (`assets/footage/`)
1. Chép các file video quay thật bằng điện thoại (`.mp4`, `.mov` — có người thật cầm/trải nghiệm sản phẩm thật và thu giọng thật) vào thư mục `assets/footage/`.
2. Trên giao diện web (Mục `05 Đạo diễn hình`), bấm nút **`📥 Quét kho clip quay thật (ingest-footage.mjs)`** hoặc chạy lệnh:
   ```powershell
   node scripts/ingest-footage.mjs
   ```
3. Hệ thống sẽ dùng `ffprobe` tự động đọc thời lượng, độ phân giải (`width × height`), FPS, trạng thái âm thanh và ghi vào sổ [catalog.json](file:///d:/AI/t%E1%BA%A1o%20video%20AI/assets/footage/catalog.json).

---

## 3. Quy trình vận hành 7 Trợ lý trên giao diện (`http://localhost:4173`)

### Bước 1 — Phân tích Video Mẫu & Thay thế bằng Sản phẩm + Nhân vật của bạn (Slide `02 / 08`)
1. **Nguyên lý cốt lõi:** Bạn chỉ cần đưa lên **1 Video Mẫu** (video xu hướng/đối thủ có cấu trúc hay). Hệ thống sẽ dùng `analyze-sample-video.mjs` (`ffprobe` + `ffmpeg`) để phân tích thời lượng, chia 4 phân cảnh theo nhịp mẫu, trích xuất **4 khung hình mốc thời gian (`scene-1.jpg` → `scene-4.jpg`)**, rút ra **Ý tưởng gốc** và lập **Sơ đồ Thay thế**.
2. **Thay thế 100% bằng tài sản của bạn:** Hệ thống tuyệt đối không lấy hình sản phẩm/nhân vật của video mẫu đưa vào video xuất ra, mà tự động thay thế bằng **Ảnh Sản phẩm thật của bạn (`product.json`)** và **Ảnh Nhân vật thật của bạn (`character.json`)** theo đúng bố cục và nhịp dựng của video mẫu.
3. Bấm **`🔍 1. Phân Tích Video Mẫu & Lấy Ý Tưởng`** để xem sơ đồ 4 cảnh mẫu kèm phương án thay thế, sau đó bấm **`⚡ 2. Áp Dụng Ý Tưởng & Thay Thế SP + Nhân Vật Của Mình (01 → 05)`**.

---

### Bước 2 — Phễu lọc Hook & Bảng Thay Đổi Ý Tưởng Cho Từng Hook (Slide `03 / 08`)
- **Trợ lý 01 – 02 – 03:** Tự động sinh **15 câu Hook** theo 5 cơ chế (*Cảnh báo, Công nhận, Tò mò, Đối lập, Lời hứa cụ thể*), chấm điểm trên thang 100 và lọc ra các ứng viên ≥ 70 điểm.
- **🎛️ Bảng Thay Đổi Ý Tưởng Cho Từng Hook (Làm giống hoặc làm khác Video Mẫu):**
  - Mặc định các Hook bám sát nhịp mở đầu của Video Mẫu (`🎯 Giống Video Mẫu`).
  - Nếu bạn muốn **làm khác đi so với Video Mẫu** ở bất kỳ câu Hook nào, hãy chọn trong cột **"Hướng triển khai (So với Video Mẫu)"**:
    - `🔄 Đổi Nỗi Đau Mới (Làm khác video mẫu)`
    - `🔥 Đảo Ngược Tình Huống / Bóc Sự Thật (Làm khác mẫu)`
    - `🧪 Test Thực Tế Ngay 3s Đầu (Làm khác mẫu)`
    - `🎁 Đập Giá Sốc / Deal Hời Đầu Video (Làm khác mẫu)`
    - `✍️ Tự Nhập Ý Tưởng Mới Hoàn Toàn`
  - Bạn có thể sửa trực tiếp ô **"Ý tưởng / Tình huống riêng cho Hook này"**, bấm **`⚡ Tạo lại Hook`** và bấm **`Chọn & Áp Dụng`** — hệ thống sẽ tự động cập nhật cả **Kịch bản 6 khối (Mục 04)** và **Bảng Phân Cảnh Thay Thế (Mục 05)** theo đúng ý tưởng mới của Hook đó!

---

### Bước 3 — Biên tập lời đọc 6 khối với Trợ lý 04 (Slide `04 / 08`)
- Kịch bản được chia sẵn thành **6 khối có mốc thời gian**:
  1. **`1. HOOK`**: Khóa cứng đúng câu Hook thắng (nếu bạn cố sửa ô số 1, hệ thống sẽ nhắc quy tắc không tự đổi Hook).
  2. **`2. VẤN ĐỀ`**: Nỗi đau thực tế của khách hàng.
  3. **`3. LẬT Ý`**: Giải quyết lời hứa của Hook ngay trong **15 giây đầu**.
  4. **`4. BẰNG CHỨNG`**: Nêu 2–3 thông số chuẩn từ `product.json`.
  5. **`5. KẾT QUẢ`**: Trải nghiệm thực tế khi sử dụng.
  6. **`6. CTA`**: Báo đúng giá gốc, giá khuyến mãi và kêu gọi hành động.
- Sau khi chỉnh sửa lời đọc vừa ý, bấm **`↳ Đẩy 6 khối lời đọc xuống Bảng Phân Cảnh`**.

---

### Bước 4 — Đạo diễn hình ảnh & Chống lặp cảnh với Trợ lý 05 (Slide `05 / 08`)
- Trong bảng phân cảnh, mỗi cảnh kéo dài **3 – 6 giây**:
  - Các cảnh **`real-footage`**: Nhập mã `footageId` (tên clip trong `assets/footage/catalog.json`) và khoảng thời gian cắt **`In (giây bắt đầu) → Out (giây kết thúc)`**.
  - Cảnh **`real-product-closeup`**: Tự động dùng **ảnh sản phẩm gốc 100%** kèm danh sách thông số thật trên Remotion (không qua AI).
  - Cảnh **`offer-cta`**: Tự động hiển thị bảng giá khuyến mãi và nút mua hàng.
- Ngay bên dưới bảng phân cảnh là **3 phương án bìa (Cover chữ 2 tầng)** để bạn chọn bìa dễ đọc nhất trên lưới Reels/TikTok.

---

### Bước 4.5 — Sử dụng **Muse AI × Whisk 3-Slot × Veo 3.1 Studio** (Slide `05 / 08`)
Ngay bên dưới bảng phân cảnh của Trợ lý 05 là trung tâm **`🎨🎬 MUSE AI × WHISK 3-SLOT × VEO 3.1 STUDIO`**:
- **Cơ chế Whisk 3-Slot (`Chủ thể [Người + SP]` + `Bối cảnh [Scene]` + `Phong cách [Style]`):**
  - Chọn **`Style`** (`💎 TVC Studio Sang Trọng`, `☀️ Lifestyle Đời Thường Tự Nhiên`, `🛍️ Shopee Mall Sắc Nét`, `🔥 TikTok High-Retention`) ở góc phải trên để đổi màu phim điện ảnh cho cả ảnh Keyframe lẫn video MP4.
- **Khóa Quỹ Đạo Chuyển Động bằng Cặp Ảnh `KHUNG ĐẦU (START) ➔ KHUNG CUỐI (END)` (`generate-muse-pack.mjs`):**
  - Tự động tạo 8 ảnh Keyframe (`media/keyframes/<scene>-start.png` và `<scene>-end.png`) hiển thị trực quan ngay trên từng thẻ cảnh quay.
- **Copy 1 chạm cho Muse AI / Google Whisk / Flow / Veo 3.1:** Mỗi cảnh có sẵn 3 nút **`📋 Copy Whisk 3-Slot`**, **`📋 Copy Veo 3.1 (Start→End)`**, và **`📋 Copy Omni 1.2`**, cùng nút **`📋 Copy Toàn Bộ JSON Batch`** và **`📂 Mở muse-ai-pack.json`**.

---

### Bước 5 — Xem trước 9:16, Sinh Giọng Đọc & Xuất Video với Trợ lý 06 (Slide `06 / 08`)
- Bên trái là **khung điện thoại dọc `9:16` (`1080 × 1920`)**:
  - Bấm nút **`▶`** để xem thử nhịp chạy phụ đề đổi màu theo từng từ, đồng thời tự động phát cả hình lẫn **tiếng thuyết minh tiếng Việt**.
  - Bấm nút **`🔊 / 🔇`** ở góc phải dưới khung điện thoại để bật/tắt tiếng trực tiếp trên màn hình xem trước.
  - Trình phát **`🎙️ Trình phát Giọng đọc & Lời thoại`** nằm ngay dưới mục `06` cho phép nghe thử toàn bộ file `voiceover-full.mp3` hoặc bấm `📂 Mở file MP3`.
- Bên phải là **7 nút thực thi trực tiếp**:
  1. **`💾 1. Lưu campaign.json`**: Lưu toàn bộ kịch bản và phân cảnh vào `campaigns/<ma-chien-dich>/campaign.json`.
  2. **`🎙️ 2. Sinh Giọng Đọc & Lồng Tiếng` (`generate-voiceover.mjs`)**: Chuyển lời thoại tiếng Việt của từng cảnh thành file âm thanh giọng đọc tự nhiên (`campaigns/<ma-chien-dich>/media/audio/<scene-id>.wav` và `voiceover-full.mp3`, chuẩn `48kHz stereo`).
  3. **`🖼️ 3. Tạo/Ghép Cảnh Từ Ảnh Người Thật + SP Thật` (`build-keyframes`)**: Sử dụng trực tiếp ảnh người thật và ảnh sản phẩm thật đã tải lên để tạo cảnh neo chuẩn xác (`100%` không biến dạng logo, màu sắc hay khuôn mặt).
  4. **`🎬 4. Dựng MP4 Có Tiếng (ffmpeg)` (`export-cutlist.mjs --render-ffmpeg`)**: Tự động sinh giọng đọc tiếng Việt (nếu chưa có), ghép cảnh người thật + sản phẩm thật và lồng tiếng đầy đủ thành file `campaigns/<ma-chien-dich>/out/ffmpeg-9x16.mp4` (`1080×1920`, `30fps`, `AAC 48kHz stereo`).
  5. **`📋 5. Xuất Cutlist CapCut`**: Xuất file `cutlist.md` và `cutlist.csv` ghi rõ từng cảnh để kéo vào CapCut dựng tay nếu muốn.
  6. **`⚛️ 6. Đồng bộ Remotion (studio/)`**: Đẩy toàn bộ dữ liệu, ảnh gốc, clip và file âm thanh `audioSrc` sang `studio/src/activeCampaign.json` để mở Remotion Studio (`cd studio && npm.cmd run dev`).
  7. **`📝 7. Xuất prompts.md`**: Xuất hồ sơ prompt chi tiết khóa cứng đặc điểm bất biến của người thật và sản phẩm thật.

---

### Bước 6 — Kiểm duyệt độ nguyên vẹn SSIM & Ghi Sổ Vận Hành với Trợ lý 07 (Slide `07 / 08`)
1. Bấm **`✔️ Chạy validate-assets.mjs`**: Kiểm tra toàn bộ cấu trúc JSON, sản phẩm, nhân vật, thời lượng và quy tắc cấm cảnh AI trong luồng quay thật.
2. Bấm **`🔬 Đo SSIM Khung Hình (verify-integrity.mjs)`**:
   - Công cụ trích khung hình giữa của từng cảnh trong video thành phẩm (`ffmpeg-9x16.mp4`) và so sánh toán học với khung hình gốc trong `assets/footage/`.
   - Nếu **tất cả các cảnh đều đạt `SSIM ≥ 0.90`**, hệ thống xác nhận: **`OK: Hình sản phẩm và người không bị biến đổi`**.
3. Đánh dấu đủ **5 tiêu chí kiểm duyệt** để thẻ **`PASS — Bàn giao reel`** sáng màu cam.
4. Bấm **`📒 Ghi Reel Đạt Vào Sổ Vận Hành`** để lưu vào `campaigns/reel-sheet.json` (có thể bấm **`⬇️ Xuất CSV Sổ Vận Hành`** để mở bằng Excel / Google Sheets).

---

## 4. Bảng tóm tắt lệnh CLI (Dành cho khi muốn chạy nhanh bằng dòng lệnh)

| Tác vụ | Lệnh thực thi |
| :--- | :--- |
| Mở giao diện web 7 Trợ lý | `node scripts/dashboard-server.mjs` |
| **Chạy tự động toàn bộ dây chuyền tối ưu (6 bước Auto-Pilot)** | `node scripts/run-optimal-pipeline.mjs campaigns/sample-campaign/campaign.json` |
| Kiểm tra tính hợp lệ toàn dự án | `node scripts/validate-assets.mjs` |
| Quét clip quay thật bằng `ffprobe` | `node scripts/ingest-footage.mjs` |
| Phân tích Video Mẫu & lập sơ đồ thay thế | `node scripts/analyze-sample-video.mjs` |
| Tạo chiến dịch mới từ mẫu quay thật | `node scripts/new-campaign.mjs <ten-chien-dich> --template real-footage-reel` |
| Sinh giọng đọc & âm thanh tiếng Việt | `node scripts/generate-voiceover.mjs campaigns/<ten-chien-dich>/campaign.json` |
| Xuất bảng cắt CapCut + Dựng `ffmpeg` có tiếng | `node scripts/export-cutlist.mjs campaigns/<ten-chien-dich>/campaign.json --render-ffmpeg` |
| Kiểm chứng không biến dạng (`SSIM`) & âm thanh | `node scripts/verify-integrity.mjs campaigns/<ten-chien-dich>/campaign.json` |
| Đồng bộ chiến dịch sang Remotion | `node scripts/sync-studio.mjs campaigns/<ten-chien-dich>/campaign.json` |
| Mở Remotion Studio xem trước 3 tỷ lệ | `cd studio && npm.cmd run dev` |
