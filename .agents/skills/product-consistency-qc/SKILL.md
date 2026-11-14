---
name: product-consistency-qc
description: Kiểm duyệt và tối ưu prompt để khóa chặt hình dáng, logo, màu sắc sản phẩm gốc và danh tính nhân vật khi tạo ảnh/video AI; đồng thời kiểm duyệt luồng quay thật (Zero-AI-Pixel).
---

# Chuyên viên QC Chống Sai Lệch Sản Phẩm & Nhân Vật

Áp dụng kỹ năng này trước khi đưa bất kỳ prompt nào sang công cụ tạo ảnh/video AI (Kling, Veo, Wan 2.1, FLUX Kontext) và trước khi xuất bản mọi video quay thật.

## Quy tắc bắt buộc trong Prompt
1. **Khóa sản phẩm (Product Lock)**:
   - Luôn chèn danh sách `immutableFeatures` từ `product.json` (màu sắc chính xác, vị trí logo, chữ trên nhãn, chất liệu bề mặt).
   - Không yêu cầu chuyển động xoay 360 độ nếu thiếu ảnh tham chiếu các mặt.
   - Không yêu cầu AI tự viết chữ tiếng Việt hay giá bán lên video.
2. **Khóa nhân vật (Character Lock)**:
   - Luôn giữ nguyên `immutableTraits` từ `character.json` (độ tuổi, kiểu tóc, khuôn mặt, trang phục).
   - Chỉ mô tả chuyển động tự nhiên nhẹ nhàng (cầm, nâng nhẹ, mỉm cười, gật đầu, lia máy chậm).
3. **Negative Constraints (Những điều cấm)**:
   - `no warped logo, no distorted text, no altered product colors, no extra fingers, no face morphing, no melted packaging`.
4. **Quy tắc Keyframe-First**:
   - Bắt buộc tạo và kiểm duyệt ảnh Keyframe trước; chỉ chuyển sang Image-to-Video khi ảnh Keyframe khớp 100% sản phẩm thật.

## Checklist cho luồng Quay thật (`mode: "real-footage"` — Zero-AI-Pixel)
Nguyên tắc: **AI không bao giờ chạm vào điểm ảnh của sản phẩm và người.** AI chỉ quyết định cắt ở đâu, ghép cảnh nào, chữ gì.

1. **Cấm tuyệt đối**: AI sinh cảnh/mở rộng khung hình/xóa vật thể; làm đẹp da, đổi mặt, tăng nét bằng AI; giọng đọc AI; ảnh kho hoặc ảnh AI làm cảnh chính. (`validate-assets.mjs` báo lỗi nếu chiến dịch `real-footage` chứa cảnh `ai-*`; `generate-media.mjs` từ chối chạy.)
2. **Được phép**: cắt, ghép, crop dọc 9:16, chỉnh màu nhẹ đồng đều, phụ đề, chữ nổi, logo, nhạc, chuyển cảnh, phóng to/thu nhỏ.
3. **Khớp dữ liệu**: giá, size, thông số trong phụ đề/chữ nổi phải khớp `product.json`; phụ đề tiếng Việt đúng dấu; không dùng từ cấm của nền tảng (tuyệt đối hóa, cam kết y tế/chữa bệnh, so sánh nêu tên đối thủ).
4. **Kiểm nguyên vẹn bằng số**: sau khi dựng bằng ffmpeg chạy `node scripts/verify-integrity.mjs <campaign.json>`; cảnh nào SSIM dưới ngưỡng là hỏng, phải dựng lại.
5. **Giọng thật**: giữ nguyên âm thanh gốc từ clip quay; nếu sau này có cảnh/giọng do AI tạo thì phải đánh dấu để gắn nhãn theo quy định, không được xóa dấu nhận diện.
6. **Người lên hình**: trẻ em hoặc người khác lên hình cần sự đồng ý bằng văn bản/tin nhắn (phụ huynh nếu là trẻ em); ghi nhận vào `description` của clip trong `assets/footage/catalog.json`.
