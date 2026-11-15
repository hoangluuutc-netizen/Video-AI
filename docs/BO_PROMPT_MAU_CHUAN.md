# BỘ THƯ VIỆN PROMPT MẪU CHUẨN: TẠO VIDEO QUẢNG CÁO AI 30S
### (Dành riêng cho Antigravity Agent & Hệ Thống Tự Động Hóa)

---

## 1. MẪU PROMPT CHO ANTIGRAVITY AGENT (RA LỆNH TỰ ĐỘNG HÓA)

Khi bạn muốn Antigravity tự động thực hiện từ đầu đến cuối một dự án video mới, hãy sao chép và chỉnh sửa các mẫu lệnh này vào khung chat:

### Mẫu 1: Dịch ngược video đối thủ & Hoán đổi sản phẩm (Element-Swap)
```text
Dùng skill rea-video giải phẫu video mẫu tại đường dẫn [ĐƯỜNG_DẪN_VIDEO_MẪU.mp4].
Yêu cầu:
1. Bóc tách 5 phân cảnh (Hook, Problem, Hero Shot, Experience, CTA), thời lượng từng cảnh và nhịp cắt (BPM).
2. Hoán đổi sản phẩm trong video thành sản phẩm của tôi:
   - Tên sản phẩm: [TÊN_SẢN_PHẨM]
   - Công dụng chính: [CÔNG_DỤNG_CHÍNH]
   - Nhân vật: [MÔ_TẢ_NHÂN_VẬT, ví dụ: Nữ công sở 25 tuổi, da dầu mụn]
3. Áp dụng quy tắc "Product Fidelity Lock": Khóa 100% hình dạng bao bì và logo sản phẩm ở Shot 3 (Hero Shot).
4. Xuất kịch bản ra file storyboard.json và kích hoạt engine dựng video 30s.
```

### Mẫu 2: Tự động sáng tạo kịch bản AIDA 30s mới từ ảnh sản phẩm
```text
Tôi có ảnh sản phẩm đặt tại [ĐƯỜNG_DẪN_ẢNH_SẢN_PHẨM.png].
Hãy phân tích hình dáng sản phẩm và viết một kịch bản video quảng cáo TikTok 30 giây chuẩn AIDA:
- Đối tượng mục tiêu: [ĐỐI_TƯỢNG_MỤC_TIÊU]
- Nỗi đau cần đánh trúng: [NỖI_ĐAU_KHÁCH_HÀNG]
- Phân bổ 5 cảnh: Shot 1 (5s Hook), Shot 2 (5s Discovery), Shot 3 (7s Hero Shot khóa sản phẩm), Shot 4 (7s Trải nghiệm), Shot 5 (6s CTA).
- Lời thoại tiếng Việt tự nhiên, lôi cuốn, phù hợp với giọng đọc Hoài My (Edge-TTS).
- Tự động sinh file SSML và xuất video demo bằng FFmpeg.
```

---

## 2. MẪU PROMPT SINH KỊCH BẢN PHÂN CẢNH (LLM STORYBOARD PROMPT)

Sử dụng prompt này trong API Gemini hoặc ChatGPT để xuất ra cấu trúc JSON chuẩn cho hệ thống:

```text
Bạn là Giám đốc Sáng tạo (Creative Director) chuyên về video quảng cáo chuyển đổi cao (TikTok/Reels Ads).
Hãy tạo kịch bản chi tiết cho video dọc 30 giây (9:16) giới thiệu sản phẩm:
- Tên sản phẩm: {PRODUCT_NAME}
- Tính năng nổi bật: {KEY_BENEFITS}
- Nhân vật đại diện: {CHARACTER_DEMO}

Định dạng đầu ra BẮT BUỘC là JSON chuẩn sau:
{
  "shots": [
    {
      "shot_id": 1,
      "title": "Hook - Bắt giữ chú ý",
      "duration": 5.0,
      "camera_motion": "Push-in Face Cam",
      "focus": "character",
      "voiceover": "Câu thoại mở đầu đánh trúng nỗi đau...",
      "visual_prompt": "Prompt tiếng Anh chi tiết để tạo ảnh...",
      "product_layer": "none"
    },
    {
      "shot_id": 2,
      "title": "Discovery - Nhận ra giải pháp",
      "duration": 5.0,
      "camera_motion": "Pan Right",
      "focus": "character_and_product",
      "voiceover": "Câu thoại giới thiệu cơ duyên gặp sản phẩm...",
      "visual_prompt": "Prompt tiếng Anh...",
      "product_layer": "ambient_placement"
    },
    {
      "shot_id": 3,
      "title": "Hero Shot - Tôn vinh sản phẩm",
      "duration": 7.0,
      "camera_motion": "Slow Orbit with Sunbeams",
      "focus": "product_only",
      "voiceover": "Câu thoại nói về thành phần và công nghệ...",
      "visual_prompt": "Prompt tiếng Anh chụp sản phẩm sang trọng...",
      "product_layer": "exact_original_mask_lock"
    },
    {
      "shot_id": 4,
      "title": "Experience - Cảm nhận hiệu quả",
      "duration": 7.0,
      "camera_motion": "Medium Tracking Shot",
      "focus": "character",
      "voiceover": "Câu thoại nói về cảm giác hài lòng khi dùng...",
      "visual_prompt": "Prompt tiếng Anh nhân vật tươi cười...",
      "product_layer": "subtle_hand_interaction"
    },
    {
      "shot_id": 5,
      "title": "CTA - Kêu gọi mua ngay",
      "duration": 6.0,
      "camera_motion": "Static with Graphic Overlay",
      "focus": "call_to_action",
      "voiceover": "Câu thoại ưu đãi giảm giá và kêu gọi hành động...",
      "visual_prompt": "Prompt tiếng Anh poster khuyến mãi...",
      "product_layer": "crisp_vector_overlay"
    }
  ]
}
```

---

## 3. MẪU PROMPT TẠO ẢNH HERO SHOT VỚI COMFYUI & IC-LIGHT

Dùng cho **Node 7 (CLIPTextEncode Positive)** trong file `comfyui_ic_light_workflow.json` để ánh sáng hòa nhập vào sản phẩm mà không làm méo tem nhãn:

### Prompt Dương tính (Positive Prompt):
```text
commercial product photography, high-end luxury advertisement,
[TÊN_SẢN_PHẨM_VÍ_DỤ: amber glass dropper bottle] standing on wet polished white marble surface,
soft morning sunbeams streaming through window, natural caustics light reflection,
delicate water ripples, shallow depth of field, photorealistic, 8k resolution,
sharp focus, studio strobe lighting, elegant aesthetic, pristine brand packaging
```

### Prompt Âm tính (Negative Prompt):
```text
deformed bottle, crooked label, illegible typography, blurry brand name,
scrambled text, plastic reflection, washed out colors, low resolution,
noisy, bad reflections, distorted geometry, cartoon, oversaturated, CGI artifacts
```

---

## 4. MẪU PROMPT TẠO CHUYỂN ĐỘNG (IMAGE-TO-VIDEO: WAN 2.1 / KLING / RUNWAY)

Khi đưa ảnh Keyframe tĩnh vào các mô hình sinh video, hãy dùng các prompt điều khiển camera tinh tế để tránh việc AI "vẽ lại" sản phẩm:

### Cho Shot 3 (Hero Shot Sản phẩm):
```text
Slow cinematic push-in camera movement, 10% zoom in, subtle water ripple animation on the surface,
warm sunbeams gently sweeping across the background, product bottle remains strictly stable and centered,
crisp sharp focus, 4k 60fps commercial look, no distortion
```

### Cho Shot 1 & 4 (Nhân vật diễn xuất):
```text
Medium close-up shot, gentle natural breathing, realistic eye blinking,
warm soft smile developing gradually, slight head tilt, cinematic studio rim lighting,
smooth skin texture, professional cinema camera depth of field
```
