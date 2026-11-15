# 🎨🎬 HỒ SƠ KỊCH BẢN PHÂN CẢNH MUSE AI × WHISK 3-SLOT × VEO 3.1 — Chiến dịch Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml (real-footage)

> **Phương pháp kết hợp tối ưu (Muse AI × Google Whisk 3-Slot × ToolKichBan × Veo 3.1):**
> 1. **Whisk 3-Slot Remix (Chủ thể + Bối cảnh + Phong cách):** Khóa cứng Chủ thể (`assets/characters/sample-kol/mama.jpg` + `assets/products/sample-product/binh-thuy-tinh-giu-nhiet.png`), Bối cảnh trích từ Video Mẫu, và Phong cách ánh sáng `💎 TVC Studio Sang Trọng (Bokeh Vàng Ấm)`.
> 2. **Frames-to-Video (Khung Đầu → Khung Cuối):** Tự động sinh cặp ảnh `-start.png` và `-end.png` cho mỗi cảnh để khóa quỹ đạo chuyển động không bị biến dạng sản phẩm.
> 3. **Học Chuyển Động Từ Video Mẫu (Video-to-Video Reference):** Trích đoạn 3s từ Video Mẫu để dẫn hướng góc máy.
> 4. **Âm Thanh Gốc Veo 3 (Native Audio + Lip-Sync + SFX):** Đồng bộ khẩu hình miệng tiếng Việt kết hợp hiệu ứng âm thanh thực tế.

- **Sản phẩm:** Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml (`BGN-304-750-BLK`) — Giá ưu đãi: **249.000đ**
- **Nhân vật cố định:** Minh Anh (Đại sứ thương hiệu)
- **Phong cách Muse / Whisk Style:** 💎 TVC Studio Sang Trọng (Bokeh Vàng Ấm)
- **Ảnh gốc Nhân vật (Slot 1A):** `assets/characters/sample-kol/mama.jpg`
- **Ảnh gốc Sản phẩm (Slot 1B):** `assets/products/sample-product/binh-thuy-tinh-giu-nhiet.png`

---
## Phân cảnh 1: `scene-1-hook` (real-footage • 4s • 9:16 1080p)
- **Lời thoại Tiếng Việt (Lip-Sync / Voiceover):** "Đừng mua Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml nếu bạn chưa kiểm tra 3 chi tiết sống còn này!"
- **Phong cách Muse Style:** 💎 TVC Studio Sang Trọng (Bokeh Vàng Ấm)
- **Khung hình Đầu (Start Frame):** `media/keyframes/scene-1-hook-start.png`
- **Khung hình Cuối (End Frame):** `media/keyframes/scene-1-hook-end.png`
- **Góc máy & Ống kính (Camera):** Eye-level medium close-up shot, 50mm prime lens, f/1.8 shallow depth of field, subtle slow dolly-in to capture attention in the first 3 seconds
- **Hiệu ứng âm thanh (SFX):** Crisp subtle studio whoosh transition, natural room tone, clear warm spoken voice
- **Clip mẫu tham chiếu nhịp máy (3s):** `media/ref-clips/scene-1-hook-ref3s.mp4`

### A. Prompt Chuẩn Muse AI / Google Whisk 3-Slot (Subject + Scene + Style)
```text
[MUSE AI / GOOGLE WHISK 3-SLOT REMIX — 9:16 VERTICAL]
• [SLOT 1 - SUBJECT (Chủ thể khóa cứng 100%)]: Minh Anh (Đại sứ thương hiệu) (Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt) holding/presenting Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml (Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1). Preserve exact face and product geometry/logo.
• [SLOT 2 - SCENE (Bối cảnh & Hành động)]: Standard clean studio/lifestyle setting. Action: Quay thật điện thoại: cầm sản phẩm trên tay, nói câu hook trực diện.
• [SLOT 3 - STYLE (Ánh sáng & Màu phim)]: High-end commercial TVC lighting, warm golden rim light, ARRI Alexa / Sony Venice cinema color science, 85mm f/1.4 creamy bokeh, ultra-sharp product texture. Camera: Eye-level medium close-up shot, 50mm prime lens, f/1.8 shallow depth of field, subtle slow dolly-in to capture attention in the first 3 seconds.
• [STRICT NEGATIVE]: warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays. Do not change matte black finish to glossy; Do not alter or warp the silver logo; Do not add extra buttons or handles not present in reference.
```

### B. Prompt Chuẩn Google Veo 3.1 (Start→End Frame + Native Audio Lip-Sync)
```text
[VEO 3.1 + MUSE AI FRAMES-TO-VIDEO — 9:16 VERTICAL 1080p]
• Character Reference (Image 1): Minh Anh (Đại sứ thương hiệu) (Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt). Keep facial identity, hairstyle, and outfit 100% consistent across all scenes.
• Product Ingredient Reference (Image 2): Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml (Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1). Preserve exact shape, proportions, surface finish, and logo without any distortion.
• Frame Continuity (Start Frame -> End Frame): Smoothly transition from Start Keyframe (medium hero shot) to End Keyframe (focused product emphasis) over 4s.
• Camera & Lens: Eye-level medium close-up shot, 50mm prime lens, f/1.8 shallow depth of field, subtle slow dolly-in to capture attention in the first 3 seconds.
• Style & Color Grade: High-end commercial TVC lighting, warm golden rim light, ARRI Alexa / Sony Venice cinema color science, 85mm f/1.4 creamy bokeh, ultra-sharp product texture.
• Scene Action (4s): Quay thật điện thoại: cầm sản phẩm trên tay, nói câu hook trực diện.
• Native Audio & Lip-Sync Dialogue (Vietnamese): Character speaks naturally in Vietnamese with warm, clear delivery: "Đừng mua Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml nếu bạn chưa kiểm tra 3 chi tiết sống còn này!"
• Sound Effects (SFX) & Ambience: Crisp subtle studio whoosh transition, natural room tone, clear warm spoken voice.
• Strict Negative Constraints: warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays. Do not change matte black finish to glossy; Do not alter or warp the silver logo; Do not add extra buttons or handles not present in reference.
```

### C. Prompt Chuẩn Gemini Omni 1.2 Flash (Reference-to-Video R2V)
```text
In a single continuous commercial shot (4s, 9:16 portrait, 1080p, High-end commercial TVC lighting, warm golden rim light, ARRI Alexa / Sony Venice cinema color science, 85mm f/1.4 creamy bokeh, ultra-sharp product texture): The person from the first reference image (Minh Anh (Đại sứ thương hiệu), Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt) holds and demonstrates the exact product from the second reference image (Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml, Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1), following the camera framing and pacing of the 3-second reference video. Transition smoothly from the starting keyframe pose to a close, clear showcase of the product at the ending frame. Action: Quay thật điện thoại: cầm sản phẩm trên tay, nói câu hook trực diện. Camera: Eye-level medium close-up shot, 50mm prime lens, f/1.8 shallow depth of field, subtle slow dolly-in to capture attention in the first 3 seconds. Audio & Dialogue: The character speaks clearly in Vietnamese: "Đừng mua Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml nếu bạn chưa kiểm tra 3 chi tiết sống còn này!". Sound design: Crisp subtle studio whoosh transition, natural room tone, clear warm spoken voice. Use the given images as strict character and product references so the face, logo, and product geometry remain 100% unchanged. No warped text, no extra fingers.
```

---
## Phân cảnh 2: `scene-2-problem-flip` (real-footage • 5s • 9:16 1080p)
- **Lời thoại Tiếng Việt (Lip-Sync / Voiceover):** "Mang nước đi làm mà chỉ 2 tiếng đã hết lạnh, vỏ bình lại đọng nước ướt hết giấy tờ trong balo. Khác biệt nằm ở kết cấu: Inox 304 chuẩn y tế, giữ nhiệt 24h kết hợp lớp sơn nhám tĩnh điện chống bám vân tay."
- **Phong cách Muse Style:** 💎 TVC Studio Sang Trọng (Bokeh Vàng Ấm)
- **Khung hình Đầu (Start Frame):** `media/keyframes/scene-2-problem-flip-start.png`
- **Khung hình Cuối (End Frame):** `media/keyframes/scene-2-problem-flip-end.png`
- **Góc máy & Ống kính (Camera):** Natural handheld UGC lifestyle shot, 35mm lens, gentle organic camera movement, warm sunlit indoor ambiance
- **Hiệu ứng âm thanh (SFX):** Subtle tactile sound of hands holding the matte bottle, gentle click of the flip-top lid, warm acoustic background hum
- **Clip mẫu tham chiếu nhịp máy (3s):** `media/ref-clips/scene-2-problem-flip-ref3s.mp4`

### A. Prompt Chuẩn Muse AI / Google Whisk 3-Slot (Subject + Scene + Style)
```text
[MUSE AI / GOOGLE WHISK 3-SLOT REMIX — 9:16 VERTICAL]
• [SLOT 1 - SUBJECT (Chủ thể khóa cứng 100%)]: Minh Anh (Đại sứ thương hiệu) (Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt) holding/presenting Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml (Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1). Preserve exact face and product geometry/logo.
• [SLOT 2 - SCENE (Bối cảnh & Hành động)]: Standard clean studio/lifestyle setting. Action: Quay thật cận cảnh bề mặt sơn nhám & thao tác mở nắp.
• [SLOT 3 - STYLE (Ánh sáng & Màu phim)]: High-end commercial TVC lighting, warm golden rim light, ARRI Alexa / Sony Venice cinema color science, 85mm f/1.4 creamy bokeh, ultra-sharp product texture. Camera: Natural handheld UGC lifestyle shot, 35mm lens, gentle organic camera movement, warm sunlit indoor ambiance.
• [STRICT NEGATIVE]: warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays. Do not change matte black finish to glossy; Do not alter or warp the silver logo; Do not add extra buttons or handles not present in reference.
```

### B. Prompt Chuẩn Google Veo 3.1 (Start→End Frame + Native Audio Lip-Sync)
```text
[VEO 3.1 + MUSE AI FRAMES-TO-VIDEO — 9:16 VERTICAL 1080p]
• Character Reference (Image 1): Minh Anh (Đại sứ thương hiệu) (Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt). Keep facial identity, hairstyle, and outfit 100% consistent across all scenes.
• Product Ingredient Reference (Image 2): Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml (Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1). Preserve exact shape, proportions, surface finish, and logo without any distortion.
• Frame Continuity (Start Frame -> End Frame): Smoothly transition from Start Keyframe (medium hero shot) to End Keyframe (focused product emphasis) over 5s.
• Camera & Lens: Natural handheld UGC lifestyle shot, 35mm lens, gentle organic camera movement, warm sunlit indoor ambiance.
• Style & Color Grade: High-end commercial TVC lighting, warm golden rim light, ARRI Alexa / Sony Venice cinema color science, 85mm f/1.4 creamy bokeh, ultra-sharp product texture.
• Scene Action (5s): Quay thật cận cảnh bề mặt sơn nhám & thao tác mở nắp.
• Native Audio & Lip-Sync Dialogue (Vietnamese): Character speaks naturally in Vietnamese with warm, clear delivery: "Mang nước đi làm mà chỉ 2 tiếng đã hết lạnh, vỏ bình lại đọng nước ướt hết giấy tờ trong balo. Khác biệt nằm ở kết cấu: Inox 304 chuẩn y tế, giữ nhiệt 24h kết hợp lớp sơn nhám tĩnh điện chống bám vân tay."
• Sound Effects (SFX) & Ambience: Subtle tactile sound of hands holding the matte bottle, gentle click of the flip-top lid, warm acoustic background hum.
• Strict Negative Constraints: warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays. Do not change matte black finish to glossy; Do not alter or warp the silver logo; Do not add extra buttons or handles not present in reference.
```

### C. Prompt Chuẩn Gemini Omni 1.2 Flash (Reference-to-Video R2V)
```text
In a single continuous commercial shot (5s, 9:16 portrait, 1080p, High-end commercial TVC lighting, warm golden rim light, ARRI Alexa / Sony Venice cinema color science, 85mm f/1.4 creamy bokeh, ultra-sharp product texture): The person from the first reference image (Minh Anh (Đại sứ thương hiệu), Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt) holds and demonstrates the exact product from the second reference image (Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml, Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1), following the camera framing and pacing of the 3-second reference video. Transition smoothly from the starting keyframe pose to a close, clear showcase of the product at the ending frame. Action: Quay thật cận cảnh bề mặt sơn nhám & thao tác mở nắp. Camera: Natural handheld UGC lifestyle shot, 35mm lens, gentle organic camera movement, warm sunlit indoor ambiance. Audio & Dialogue: The character speaks clearly in Vietnamese: "Mang nước đi làm mà chỉ 2 tiếng đã hết lạnh, vỏ bình lại đọng nước ướt hết giấy tờ trong balo. Khác biệt nằm ở kết cấu: Inox 304 chuẩn y tế, giữ nhiệt 24h kết hợp lớp sơn nhám tĩnh điện chống bám vân tay.". Sound design: Subtle tactile sound of hands holding the matte bottle, gentle click of the flip-top lid, warm acoustic background hum. Use the given images as strict character and product references so the face, logo, and product geometry remain 100% unchanged. No warped text, no extra fingers.
```

---
## Phân cảnh 3: `scene-3-proof` (real-product-closeup • 4s • 9:16 1080p)
- **Lời thoại Tiếng Việt (Lip-Sync / Voiceover):** "Nhìn cận cảnh: Inox 304 chuẩn y tế, giữ nhiệt 24h; Sơn nhám tĩnh điện chống bám vân tay; và Nắp khóa chống tràn 360 độ."
- **Phong cách Muse Style:** 💎 TVC Studio Sang Trọng (Bokeh Vàng Ấm)
- **Khung hình Đầu (Start Frame):** `media/keyframes/scene-3-proof-start.png`
- **Khung hình Cuối (End Frame):** `media/keyframes/scene-3-proof-end.png`
- **Góc máy & Ống kính (Camera):** Ultra-sharp macro close-up shot, 85mm f/2.8 lens, smooth slow pan across product surface texture and engraved logo, studio rim lighting
- **Hiệu ứng âm thanh (SFX):** Delicate metallic shimmer, crisp ice cubes clinking softly inside stainless steel, clean studio ambiance
- **Clip mẫu tham chiếu nhịp máy (3s):** `media/ref-clips/scene-3-proof-ref3s.mp4`

### A. Prompt Chuẩn Muse AI / Google Whisk 3-Slot (Subject + Scene + Style)
```text
[MUSE AI / GOOGLE WHISK 3-SLOT REMIX — 9:16 VERTICAL]
• [SLOT 1 - SUBJECT (Chủ thể khóa cứng 100%)]: Minh Anh (Đại sứ thương hiệu) (Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt) holding/presenting Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml (Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1). Preserve exact face and product geometry/logo.
• [SLOT 2 - SCENE (Bối cảnh & Hành động)]: Standard clean studio/lifestyle setting. Action: Remotion render 100% ảnh sản phẩm gốc + 3 thông số thật (Zero-AI-Pixel).
• [SLOT 3 - STYLE (Ánh sáng & Màu phim)]: High-end commercial TVC lighting, warm golden rim light, ARRI Alexa / Sony Venice cinema color science, 85mm f/1.4 creamy bokeh, ultra-sharp product texture. Camera: Ultra-sharp macro close-up shot, 85mm f/2.8 lens, smooth slow pan across product surface texture and engraved logo, studio rim lighting.
• [STRICT NEGATIVE]: warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays. Do not change matte black finish to glossy; Do not alter or warp the silver logo; Do not add extra buttons or handles not present in reference.
```

### B. Prompt Chuẩn Google Veo 3.1 (Start→End Frame + Native Audio Lip-Sync)
```text
[VEO 3.1 + MUSE AI FRAMES-TO-VIDEO — 9:16 VERTICAL 1080p]
• Character Reference (Image 1): Minh Anh (Đại sứ thương hiệu) (Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt). Keep facial identity, hairstyle, and outfit 100% consistent across all scenes.
• Product Ingredient Reference (Image 2): Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml (Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1). Preserve exact shape, proportions, surface finish, and logo without any distortion.
• Frame Continuity (Start Frame -> End Frame): Smoothly transition from Start Keyframe (medium hero shot) to End Keyframe (focused product emphasis) over 4s.
• Camera & Lens: Ultra-sharp macro close-up shot, 85mm f/2.8 lens, smooth slow pan across product surface texture and engraved logo, studio rim lighting.
• Style & Color Grade: High-end commercial TVC lighting, warm golden rim light, ARRI Alexa / Sony Venice cinema color science, 85mm f/1.4 creamy bokeh, ultra-sharp product texture.
• Scene Action (4s): Remotion render 100% ảnh sản phẩm gốc + 3 thông số thật (Zero-AI-Pixel).
• Native Audio & Lip-Sync Dialogue (Vietnamese): Character speaks naturally in Vietnamese with warm, clear delivery: "Nhìn cận cảnh: Inox 304 chuẩn y tế, giữ nhiệt 24h; Sơn nhám tĩnh điện chống bám vân tay; và Nắp khóa chống tràn 360 độ."
• Sound Effects (SFX) & Ambience: Delicate metallic shimmer, crisp ice cubes clinking softly inside stainless steel, clean studio ambiance.
• Strict Negative Constraints: warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays. Do not change matte black finish to glossy; Do not alter or warp the silver logo; Do not add extra buttons or handles not present in reference.
```

### C. Prompt Chuẩn Gemini Omni 1.2 Flash (Reference-to-Video R2V)
```text
In a single continuous commercial shot (4s, 9:16 portrait, 1080p, High-end commercial TVC lighting, warm golden rim light, ARRI Alexa / Sony Venice cinema color science, 85mm f/1.4 creamy bokeh, ultra-sharp product texture): The person from the first reference image (Minh Anh (Đại sứ thương hiệu), Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt) holds and demonstrates the exact product from the second reference image (Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml, Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1), following the camera framing and pacing of the 3-second reference video. Transition smoothly from the starting keyframe pose to a close, clear showcase of the product at the ending frame. Action: Remotion render 100% ảnh sản phẩm gốc + 3 thông số thật (Zero-AI-Pixel). Camera: Ultra-sharp macro close-up shot, 85mm f/2.8 lens, smooth slow pan across product surface texture and engraved logo, studio rim lighting. Audio & Dialogue: The character speaks clearly in Vietnamese: "Nhìn cận cảnh: Inox 304 chuẩn y tế, giữ nhiệt 24h; Sơn nhám tĩnh điện chống bám vân tay; và Nắp khóa chống tràn 360 độ.". Sound design: Delicate metallic shimmer, crisp ice cubes clinking softly inside stainless steel, clean studio ambiance. Use the given images as strict character and product references so the face, logo, and product geometry remain 100% unchanged. No warped text, no extra fingers.
```

---
## Phân cảnh 4: `scene-4-cta` (offer-cta • 3s • 9:16 1080p)
- **Lời thoại Tiếng Việt (Lip-Sync / Voiceover):** "Giá gốc 399.000đ giảm chỉ còn 249.000đ (-38% FLASH SALE) — bấm giỏ hàng đặt ngay!"
- **Phong cách Muse Style:** 💎 TVC Studio Sang Trọng (Bokeh Vàng Ấm)
- **Khung hình Đầu (Start Frame):** `media/keyframes/scene-4-cta-start.png`
- **Khung hình Cuối (End Frame):** `media/keyframes/scene-4-cta-end.png`
- **Góc máy & Ống kính (Camera):** Hero product showcase shot, dynamic slow push-in, warm golden studio backlight with clean negative space for price badge
- **Hiệu ứng âm thanh (SFX):** Upbeat modern commercial chime, confident spoken call-to-action, warm background music swell
- **Clip mẫu tham chiếu nhịp máy (3s):** `media/ref-clips/scene-4-cta-ref3s.mp4`

### A. Prompt Chuẩn Muse AI / Google Whisk 3-Slot (Subject + Scene + Style)
```text
[MUSE AI / GOOGLE WHISK 3-SLOT REMIX — 9:16 VERTICAL]
• [SLOT 1 - SUBJECT (Chủ thể khóa cứng 100%)]: Minh Anh (Đại sứ thương hiệu) (Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt) holding/presenting Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml (Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1). Preserve exact face and product geometry/logo.
• [SLOT 2 - SCENE (Bối cảnh & Hành động)]: Standard clean studio/lifestyle setting. Action: Remotion render thẻ giá chính hãng + nút CTA.
• [SLOT 3 - STYLE (Ánh sáng & Màu phim)]: High-end commercial TVC lighting, warm golden rim light, ARRI Alexa / Sony Venice cinema color science, 85mm f/1.4 creamy bokeh, ultra-sharp product texture. Camera: Hero product showcase shot, dynamic slow push-in, warm golden studio backlight with clean negative space for price badge.
• [STRICT NEGATIVE]: warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays. Do not change matte black finish to glossy; Do not alter or warp the silver logo; Do not add extra buttons or handles not present in reference.
```

### B. Prompt Chuẩn Google Veo 3.1 (Start→End Frame + Native Audio Lip-Sync)
```text
[VEO 3.1 + MUSE AI FRAMES-TO-VIDEO — 9:16 VERTICAL 1080p]
• Character Reference (Image 1): Minh Anh (Đại sứ thương hiệu) (Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt). Keep facial identity, hairstyle, and outfit 100% consistent across all scenes.
• Product Ingredient Reference (Image 2): Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml (Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1). Preserve exact shape, proportions, surface finish, and logo without any distortion.
• Frame Continuity (Start Frame -> End Frame): Smoothly transition from Start Keyframe (medium hero shot) to End Keyframe (focused product emphasis) over 3s.
• Camera & Lens: Hero product showcase shot, dynamic slow push-in, warm golden studio backlight with clean negative space for price badge.
• Style & Color Grade: High-end commercial TVC lighting, warm golden rim light, ARRI Alexa / Sony Venice cinema color science, 85mm f/1.4 creamy bokeh, ultra-sharp product texture.
• Scene Action (3s): Remotion render thẻ giá chính hãng + nút CTA.
• Native Audio & Lip-Sync Dialogue (Vietnamese): Character speaks naturally in Vietnamese with warm, clear delivery: "Giá gốc 399.000đ giảm chỉ còn 249.000đ (-38% FLASH SALE) — bấm giỏ hàng đặt ngay!"
• Sound Effects (SFX) & Ambience: Upbeat modern commercial chime, confident spoken call-to-action, warm background music swell.
• Strict Negative Constraints: warped logo, distorted brand text, altered product colors, melted packaging, extra fingers, missing fingers, unnatural grip, face morphing, plastic skin, blurry product edges, random text overlays. Do not change matte black finish to glossy; Do not alter or warp the silver logo; Do not add extra buttons or handles not present in reference.
```

### C. Prompt Chuẩn Gemini Omni 1.2 Flash (Reference-to-Video R2V)
```text
In a single continuous commercial shot (3s, 9:16 portrait, 1080p, High-end commercial TVC lighting, warm golden rim light, ARRI Alexa / Sony Venice cinema color science, 85mm f/1.4 creamy bokeh, ultra-sharp product texture): The person from the first reference image (Minh Anh (Đại sứ thương hiệu), Vietnamese woman, 26 years old; Shoulder-length straight dark brown hair; Warm natural skin tone, friendly confident smile; Wearing a clean cream-colored casual blazer over white t-shirt) holds and demonstrates the exact product from the second reference image (Bình Giữ Nhiệt Inox 304 Cao Cấp 750ml, Matte black cylindrical body; Minimalist silver engraved logo centered on the upper third; Brushed stainless steel rim and leak-proof flip-top lid; Exact height-to-width ratio 3.2:1), following the camera framing and pacing of the 3-second reference video. Transition smoothly from the starting keyframe pose to a close, clear showcase of the product at the ending frame. Action: Remotion render thẻ giá chính hãng + nút CTA. Camera: Hero product showcase shot, dynamic slow push-in, warm golden studio backlight with clean negative space for price badge. Audio & Dialogue: The character speaks clearly in Vietnamese: "Giá gốc 399.000đ giảm chỉ còn 249.000đ (-38% FLASH SALE) — bấm giỏ hàng đặt ngay!". Sound design: Upbeat modern commercial chime, confident spoken call-to-action, warm background music swell. Use the given images as strict character and product references so the face, logo, and product geometry remain 100% unchanged. No warped text, no extra fingers.
```
