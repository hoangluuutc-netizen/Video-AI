# Bộ Prompt Khóa Sản Phẩm & Nhân Vật — Chiến dịch Bình Giữ Nhiệt 24h — TikTok & Shopee

- **Sản phẩm:** Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml (`BGN-304-750-BLK`)
- **Nhân vật cố định:** Minh Anh (Đại sứ thương hiệu)
- **Ảnh tham chiếu sản phẩm:** assets/products/sample-product/front.png, assets/products/sample-product/detail.png, assets/products/sample-product/cutout.png
- **Ảnh tham chiếu nhân vật:** assets/characters/sample-kol/portrait.png, assets/characters/sample-kol/half-body.png

> **Quy tắc bắt buộc:** Luôn tạo & kiểm duyệt (QC) **Keyframe** trước. Chỉ khi logo, màu sắc, kiểu dáng sản phẩm và khuôn mặt khớp 100% mới đưa vào **Image-to-Video**.

---
## Cảnh `scene-1-hook` (ai-lifestyle, 4s)
**Phụ đề tiếng Việt:** "Đi làm cả ngày mà nước đá vẫn lạnh buốt như mới pha?"

### 1. Prompt Tạo Ảnh Keyframe (FLUX Kontext / Gemini Image / ComfyUI)
```text
Commercial e-commerce photography, ultra-sharp, realistic natural lighting.
Subject: Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt.
Product (LOCKED TO REFERENCE IMAGE): Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml (Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1).
Action & Composition: Character holds the exact product casually on an office desk, looking at camera with a confident smile, subtle slow camera push-in.
Setting: Bright modern sunlit minimalist office desk with laptop and notebook in soft bokeh background.
Strict constraints: Preserve exact product geometry, logo, label typography, and color finish from the product reference image. Do not change matte black finish to glossy; Do not alter or warp the silver logo; Do not add extra buttons or handles not present in reference.
Negative: warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays
```

### 2. Prompt Tạo Video Image-to-Video (Kling / Veo / Wan 2.1)
```text
Image-to-Video from approved Keyframe. Motion level: low.
Action: Character holds the exact product casually on an office desk, looking at camera with a confident smile, subtle slow camera push-in.
Lock rule: Keep product shape, logo, surface texture, and character facial identity 100% consistent with the first frame. No rapid rotation, no text generation.
Negative: warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays
```

---
## Cảnh `scene-2-experience` (ai-experience, 5s)
**Phụ đề tiếng Việt:** "Cầm cực chắc tay với lớp sơn nhám chống bám vân tay siêu mịn."

### 1. Prompt Tạo Ảnh Keyframe (FLUX Kontext / Gemini Image / ComfyUI)
```text
Commercial e-commerce photography, ultra-sharp, realistic natural lighting.
Subject: Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt.
Product (LOCKED TO REFERENCE IMAGE): Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml (Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1).
Action & Composition: Close-up of character's hand gently lifting the matte black bottle, natural studio daylight shimmer, no rapid rotation.
Setting: Clean warm indoor lifestyle counter, natural window light.
Strict constraints: Preserve exact product geometry, logo, label typography, and color finish from the product reference image. Do not change matte black finish to glossy; Do not alter or warp the silver logo; Do not add extra buttons or handles not present in reference.
Negative: warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays
```

### 2. Prompt Tạo Video Image-to-Video (Kling / Veo / Wan 2.1)
```text
Image-to-Video from approved Keyframe. Motion level: low.
Action: Close-up of character's hand gently lifting the matte black bottle, natural studio daylight shimmer, no rapid rotation.
Lock rule: Keep product shape, logo, surface texture, and character facial identity 100% consistent with the first frame. No rapid rotation, no text generation.
Negative: warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays
```

---
## Cảnh `scene-3-product-truth` (real-product-closeup, 4s)
**Phụ đề tiếng Việt:** "Lõi Inox 304 chuẩn y tế — Giữ nóng & lạnh suốt 24 giờ!"

*Cảnh này được render trực tiếp bằng **Remotion (`studio/`)** sử dụng ảnh sản phẩm gốc và chữ tiếng Việt chuẩn — KHÔNG dùng AI tạo video để tránh sai lệch chi tiết.*

---
## Cảnh `scene-4-cta` (offer-cta, 3s)
**Phụ đề tiếng Việt:** "Chỉ 249.000đ hôm nay — Đặt ngay kẻo hết Flash Sale!"

*Cảnh này được render trực tiếp bằng **Remotion (`studio/`)** sử dụng ảnh sản phẩm gốc và chữ tiếng Việt chuẩn — KHÔNG dùng AI tạo video để tránh sai lệch chi tiết.*
