---
name: kol-persona-architect
description: Thiết kế hồ sơ KOL AI (nhân khẩu học, tính cách, tone giọng, câu cửa miệng, ma trận nội dung và immutableTraits chuẩn character.json) để đảm bảo nhân vật nhất quán xuyên suốt mọi chiến dịch.
---

# KOL Persona Architect — Kiến trúc sư Nhân vật KOL AI

## Mục tiêu
Xây dựng một **KOL AI (Virtual Influencer / Đại sứ thương hiệu ảo)** có bản sắc rõ ràng, tự nhiên, đáng tin cậy trên TikTok, Shopee Video, Facebook Fanpage và YouTube Shorts, đồng thời xuất ra cấu trúc JSON chuẩn `assets/characters/<id>/character.json`.

## Quy trình 4 bước thiết kế KOL AI

### Bước 1: Định vị Ngách & Đối tượng khán giả
- **Ngách chuyên môn (`role`)**: Chọn 1 ngách trọng tâm (VD: *Chuyên gia review mỹ phẩm & skincare*, *Reviewer đồ gia dụng thông minh*, *KOL thời trang GenZ*, *Chuyên gia công nghệ tối giản*).
- **Khán giả mục tiêu**: Độ tuổi, thu nhập, nỗi đau chính và ngôn ngữ giao tiếp quen thuộc.

### Bước 2: Khóa Đặc điểm Ngoại hình Bất biến (`immutableTraits`)
Luôn viết bằng **tiếng Anh mô tả trực quan** (để các model tạo ảnh/video như Gemini Image, Veo 3.1, FLUX Kontext đọc chính xác nhất), gồm tối thiểu 4 gạch đầu dòng:
1. **Nhân khẩu học & Khuôn mặt**: Quốc tịch/chủng tộc, độ tuổi, dáng mặt, ánh mắt, nụ cười (VD: `"Vietnamese woman, 25 years old, oval face, warm natural skin tone, bright expressive eyes"`).
2. **Kiểu tóc cố định**: Độ dài, màu sắc, kiểu rẽ ngôi (VD: `"Shoulder-length straight dark brown hair with soft side-swept bangs"`).
3. **Trang phục & Phụ kiện đặc trưng**: Màu sắc, chất liệu, phụ kiện nhận diện (VD: `"Wearing a clean cream-colored casual blazer over white cotton t-shirt, minimal gold hoop earrings"`).
4. **Ánh sáng & Phong thái**: `"Soft natural daylight look, friendly confident posture, authentic creator vibe"`.

### Bước 3: Định hình Giọng nói & Cá tính (`voiceStyle` & Catchphrases)
- **Tông giọng (`voiceStyle`)**: Vùng miền (Bắc/Nam), tốc độ (vừa phải/nhanh năng lượng), cảm xúc (ấm áp, chân thật, sắc sảo, hài hước).
- **Câu cửa miệng (Catchphrase)**: 1–2 câu mở đầu 3 giây đầu giúp khán giả nhận ra ngay KOL (VD: *"Mình đã test thật 7 ngày rồi, kết quả bất ngờ lắm luôn..."*).
- **Từ khóa nên dùng / Từ cấm**: Tránh từ ngữ phóng đại vi phạm chính sách TikTok/Shopee (*cam kết 100% khỏi bệnh*, *tốt nhất thế giới*).

### Bước 4: Xuất `character.json` chuẩn hệ thống
```json
{
  "id": "ten-kol-slug",
  "name": "Tên KOL (Vai trò ngắn)",
  "role": "Mô tả chuyên môn KOL",
  "niche": "beauty | tech | fashion | home | food | general",
  "immutableTraits": [
    "..."
  ],
  "voiceStyle": "Mô tả giọng nói & phong cách truyền đạt",
  "catchphrase": "Câu mở đầu đặc trưng 3s đầu",
  "platforms": ["TikTok", "Shopee", "Facebook"],
  "referenceImages": {
    "portrait": "assets/characters/<id>/portrait.png",
    "halfBody": "assets/characters/<id>/half-body.png",
    "sheet4Angles": "assets/characters/<id>/character-sheet-4angles.png"
  }
}
```

## Kiểm tra chất lượng (Checklist)
- [ ] `id` chỉ dùng chữ thường, số và dấu gạch ngang (`^[a-z0-9-]+$`).
- [ ] `immutableTraits` có ít nhất 3–4 đặc điểm hình ảnh rõ ràng, không mơ hồ.
- [ ] Lời thoại mẫu tuân thủ ngưỡng `<= 2.8 từ/giây` để khớp nhịp thở người Việt.
