# Quy trình 4 Bước "Khóa Nguyên Bản" — Chống Sai Lệch Sản Phẩm & Nhân Vật

Mục tiêu: Đảm bảo sản phẩm trong video quảng cáo giống **100% hàng thật** (đúng logo, chữ trên nhãn, màu sắc, tỷ lệ kích thước) và nhân vật đại diện không bị biến dạng khuôn mặt giữa các cảnh.

---

## Bước 1: Chuẩn hóa Bộ Tài Sản Gốc (Asset Preparation)
Trước khi bấm tạo bất kỳ video nào, chuẩn bị đủ 3 nhóm file trong `assets/`:
1. **Ảnh sản phẩm thật (`assets/products/<ten-sp>/`)**:
   - Ảnh mặt chính diện sắc nét, đủ sáng, không bị bóng lóa che logo.
   - Ảnh mặt sau / mặt nghiêng / chi tiết tem nhãn (để dùng làm lớp overlay cận cảnh trong Remotion).
   - Ảnh tách nền (PNG trong suốt) để ghép vào video mà không bị AI vẽ lại.
2. **Hồ sơ nhân vật cố định (`assets/characters/<ten-nhan-vat>/`)**:
   - 1 ảnh chân dung chính diện rõ nét + 1 ảnh nửa người/toàn thân với trang phục cố định.
   - Mô tả đặc điểm nhận dạng bất biến (tuổi, kiểu tóc, màu da, phong cách trang phục) trong `character.json`.
3. **Brand Kit (`assets/brand-kit/brand.json`)**:
   - Logo PNG, mã màu thương hiệu, câu CTA chuẩn từng sàn (TikTok Shop, Shopee, Facebook, Web).

---

## Bước 2: Tạo Ảnh Keyframe Neo (Image-First, Video-Second)
**Tuyệt đối không** dùng Text-to-Video thuần túy để tạo cảnh người mẫu cầm sản phẩm. Hãy tạo ảnh tĩnh (Keyframe) trước:
- Đưa **Ảnh sản phẩm gốc** + **Ảnh nhân vật gốc** vào công cụ ghép ảnh tham chiếu (FLUX Kontext, Gemini Image, hoặc ComfyUI IP-Adapter + ControlNet).
- **Checklist QC Ảnh Keyframe (Bắt buộc đạt 5/5 mới được làm video):**
  - [ ] Logo và tên thương hiệu trên sản phẩm đọc được rõ ràng, không sai chính tả?
  - [ ] Tỷ lệ kích thước sản phẩm so với bàn tay/cơ thể người mẫu có thật không?
  - [ ] Màu sắc và chất liệu (nhám, bóng, trong suốt) có khớp 100% ảnh gốc?
  - [ ] Số lượng ngón tay cầm sản phẩm có tự nhiên (5 ngón, không xuyên qua vỏ hộp)?
  - [ ] Khuôn mặt nhân vật có khớp với ảnh hồ sơ gốc?

---

## Bước 3: Tạo Video Chuyển Động Có Kiểm Soát (Controlled Motion)
Khi đã có Keyframe đạt chuẩn 100%:
- Sử dụng chế độ **Image-to-Video (I2V)** hoặc **First-Last-Frame (FLF2V)** (trên Wan 2.1, Kling, Veo).
- **Nguyên tắc Prompt khóa chi tiết:**
  - Chỉ mô tả chuyển động nhẹ: *"subtle camera push-in"*, *"gentle natural breathing"*, *"soft studio lighting shimmer"*.
  - **Cấm** yêu cầu sản phẩm xoay 360 độ bằng AI nếu mặt sau chưa có trong tham chiếu (AI sẽ tự bịa mặt sau).
  - Thêm ràng buộc: *"Keep product shape, label text, logo, and character facial identity strictly unchanged throughout the shot."*

---

## Bước 4: Hậu kỳ & Đóng gói bằng Remotion (`studio/`)
Không dùng AI để vẽ chữ giá bán, thông số kỹ thuật hay badge khuyến mãi vì AI rất hay sai lỗi chính tả tiếng Việt.
- Đưa các clip trải nghiệm đã QC vào `studio/`.
- Chèn **ảnh sản phẩm gốc độ phân giải cao** ở các đoạn "Zoom chi tiết / Thông số / So sánh" để khách hàng nhìn rõ từng đường nét thật của sản phẩm.
- Remotion tự động render chính xác chữ tiếng Việt, giá niêm yết, giá Flash Sale, logo shop và xuất đồng bộ 3 tỷ lệ:
  - **9:16** (TikTok, TikTok Shop, Shopee Video, Facebook Reels)
  - **1:1** (Facebook Feed, Shopee Ảnh/Video vuông)
  - **16:9** (Website, Landing Page, YouTube)
