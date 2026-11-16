---
name: kol-visual-consistency
description: Khóa nhất quán khuôn mặt, kiểu tóc, tỷ lệ cơ thể và trang phục của KOL AI qua Character Sheet 4 góc, Gemini Image, Fal.ai FLUX Kontext và ComfyUI (PuLID/InstantID/IC-Light).
---

# KOL Visual Consistency — Khóa Nhất Quán Hình Ảnh KOL AI

## Mục tiêu
Đảm bảo KOL AI giữ **cùng một khuôn mặt, màu da, kiểu tóc và trang phục** trong mọi khung hình, góc máy (chính diện, góc nghiêng 45°, góc nghiêng 90°, toàn thân/bán thân) và mọi bối cảnh (Studio, Quán cafe, Tại nhà, Ngoài trời).

## Quy tắc Vàng (Golden Rules)
1. **Single Source of Truth (Ảnh Gốc Chuẩn)**: Luôn bắt đầu từ 1 ảnh chân dung rõ nét (`portrait`) hoặc ảnh bán thân (`halfBody`) độ phân giải >= 1024px, ánh sáng đều, không che mặt.
2. **Character Sheet 4 Góc (`character-sheet-4angles.png`)**: Trước khi sản xuất hàng loạt video/lookbook, luôn tạo bảng 4 góc (`Front`, `3/4 Left`, `3/4 Right`, `Half-body Lifestyle`) để làm ảnh tham chiếu (reference image) cho các bước sau.
3. **Không bao giờ bỏ quên `immutableTraits`**: Mọi prompt tạo ảnh/video đều phải chèn nguyên văn mảng `immutableTraits` từ `character.json` vào đầu prompt.

## Pipeline Tạo & Khóa Hình Ảnh theo Ngân sách

### Tầng 1 — Tiết kiệm $0 (FFmpeg Real Composite)
- Dùng trực tiếp ảnh thật/ảnh gốc của KOL kết hợp chuyển động Ken Burns (`zoompan`) và tách nền sản phẩm để giữ **100% pixel khuôn mặt gốc**, không bao giờ bị biến dạng.
- Chạy qua `scripts/generate-character-sheet.mjs <characterId>` (tự động fallback FFmpeg 4-panel nếu không có API Key).

### Tầng 2 — Gemini Image / Nano Banana (`gemini-2.5-flash-image`)
- Truyền ảnh `portrait` làm reference input kèm prompt:
  `"Create a clean 4-panel character reference sheet of the EXACT same person from the reference image: [Front view], [3/4 angle smiling], [Side profile], [Half-body holding product]. Preserve exact facial features, skin tone, hair, and outfit: <immutableTraits>. Studio softbox lighting, neutral background."`

### Tầng 3 — Fal.ai FLUX Kontext / ComfyUI (PuLID + IP-Adapter + IC-Light)
- Khi cần thay đổi bối cảnh (cafe, phòng khách, du lịch) nhưng vẫn giữ nguyên mặt KOL:
  - Dùng `fal-flux-kontext` với `image_url` là ảnh `portrait` của KOL.
  - Hoặc dùng workflow ComfyUI (`templates/comfyui/comfyui_ic_light_product_workflow.json`) kết hợp **PuLID / InstantID** (khóa mặt) + **IC-Light** (đồng bộ ánh sáng môi trường).

## Negative Prompt Bắt Buộc (Chống biến dạng)
`different person, changed face, altered facial structure, plastic skin, extra fingers, distorted hands, blurry eyes, inconsistent hair color, warped product logo, watermark, text artifacts`
