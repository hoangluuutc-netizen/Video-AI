# CẨM NANG HỆ THỐNG & TỐI ƯU HÓA: DỰ ÁN TẠO VIDEO AI
### (Hướng Dẫn Dành Riêng Cho Antigravity & AI Coding Agents)

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG ĐÃ XÂY DỰNG

Hệ thống của bạn hiện nay gồm **4 tầng kiến trúc (4-Tier Architecture)** được tối ưu khép kín:

```
[TẦNG 1: DỊCH NGƯỢC VIDEO ĐỐI THỦ (REVERSE-ENGINEERING)]
└── Skill rea-video & reverse_and_remake.js
    ├── Bóc tách 5 Shot bằng FFmpeg (Keyframes, thời lượng)
    └── Thực hiện Element-Swap (Giữ nhịp viral, đổi sang sản phẩm của bạn)

[TẦNG 2: THIẾT KẾ KỊCH BẢN 30S (STORYBOARD ENGINE)]
└── storyboard.json / storyboard_remake.json
    ├── Chuẩn hóa theo AIDA: Hook (5s) -> Discovery (5s) -> Hero (7s) -> Experience (7s) -> CTA (6s)
    └── Quy định luật bảo vệ cho từng phân cảnh

[TẦNG 3: BẢO VỆ CHI TIẾT SẢN PHẨM 100% (PRODUCT FIDELITY)]
└── comfyui_ic_light_workflow.json
    ├── Tách nền sạch bằng RMBG-2.0 / BiRefNet
    ├── Tính toán ánh sáng tự nhiên bằng IC-Light (iclight_sd15_fbc)
    └── Đè lại lớp tem nhãn gốc bằng ImageCompositeMasked (Không mất dù chỉ 1 pixel)

[TẦNG 4: KẾT XUẤT PHIM & LỒNG TIẾNG VIỆT (RENDER & TTS)]
└── tts_vietnamese.js & generate_ad.js (hoặc AI Video Ad Studio Web App)
    ├── Giọng đọc tiếng Việt tự nhiên: vi-VN-HoaiMyNeural (Edge-TTS)
    └── FFmpeg render video dọc 9:16 (720x1280) kèm phụ đề nảy chữ
```

---

## 2. NGUYÊN TẮC VÀNG ĐỂ TỐI ƯU HỆ THỐNG TRÊN ANTIGRAVITY

Khi vận hành hệ thống này với Antigravity Agent, hãy tuân thủ 4 nguyên tắc tối ưu sau để tiết kiệm tối đa token, tăng tốc độ xử lý và đạt độ chính xác cao nhất:

### Nguyên tắc 1: Tối ưu Ngữ cảnh & Token (Token Efficiency)
* **Tuyệt đối không để Agent đọc toàn bộ file nhị phân video hoặc JSON dung lượng lớn.**
* Luôn sử dụng cơ chế trích xuất:
  * Khi phân tích video, script chỉ xuất ra danh sách tóm tắt 5 dòng trong `storyboard.json` và lưu các ảnh keyframe vào thư mục `xray_analysis/`.
  * Agent chỉ cần đọc file `storyboard.json` (~200 tokens) thay vì đọc dữ liệu thô hàng trăm nghìn tokens.

### Nguyên tắc 2: Tách biệt "Khâu Tĩnh" và "Khâu Động" (Composition vs Motion)
* **Sai lầm phổ biến:** Đưa cả nhân vật và sản phẩm vào một prompt sinh video từ đầu $\rightarrow$ 100% logo bị méo, ngón tay biến dạng.
* **Cách tối ưu chuẩn:**
  1. *Khâu tĩnh:* Ghép ảnh sản phẩm và nhân vật thật chuẩn xác trên ảnh Keyframe tĩnh trước (dùng IC-Light và Photoshop/ComfyUI).
  2. *Khâu động:* Khi đưa vào model sinh video (Wan 2.1, Kling, Runway), chỉ cho phép camera **chuyển động không quá 10%** (Slow push-in hoặc Pan nhẹ). Không cho AI tự ý "sáng tạo" lại bao bì.

### Nguyên tắc 3: Tối ưu Âm thanh & Đồng bộ Phụ đề (Audio-Visual Sync)
* Kịch bản 30 giây được chia cố định theo các mốc: `5s - 5s - 7s - 7s - 6s`.
* Khi viết lời thoại tiếng Việt:
  * Mỗi giây trong quảng cáo tương đương khoảng **2.5 đến 3 từ**.
  * Cảnh 5s: Viết khoảng 12 - 15 từ.
  * Cảnh 7s: Viết khoảng 18 - 22 từ.
* Điều này giúp giọng đọc tiếng Việt phát âm tròn vành rõ chữ, không bị vội hoặc bị ngắt tiếng đột ngột.

### Nguyên tắc 4: Tự Động Hóa 1-Click (Zero Setup Overhead)
* Ứng dụng **Dashboard Đội Làm Video A.I.** được viết hoàn toàn bằng Node.js tích hợp sẵn (không cần cài thêm hàng chục package npm nặng nề).
* Chỉ cần nhấp đúp vào file `start-dashboard.bat` ở thư mục gốc là cả hệ thống Backend, FFmpeg Engine và Giao diện Web tự động kích hoạt tại `http://localhost:4173`.

---

## 3. CHECKLIST KIỂM TRA CHẤT LƯỢNG (QA CHECKLIST) TRƯỚC KHI XUẤT BẢN

Trước khi chạy quảng cáo hoặc đăng video lên TikTok/Reels:
- [ ] **Hook 3 giây đầu:** Đã có câu hỏi đánh trúng nỗi đau khách hàng chưa?
- [ ] **Hero Shot (Shot 3):** Tên thương hiệu và tem nhãn có bị mờ hoặc méo không? (Nếu có méo, kiểm tra lại node `ImageCompositeMasked`).
- [ ] **Âm thanh:** Giọng đọc tiếng Việt có bị nhạc nền lấn át không? (Volume voiceover nên ở mức `0.8 - 0.9`, nhạc nền ở mức `0.15 - 0.2`).
- [ ] **Định dạng hiển thị:** Tỷ lệ video đã chuẩn `9:16` (720x1280 hoặc 1080x1920) để hiển thị tràn màn hình điện thoại chưa?
- [ ] **Lời kêu gọi (CTA 5s cuối):** Đã có logo thương hiệu sắc nét và mã ưu đãi chưa?
