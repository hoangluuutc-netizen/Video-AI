---
name: ecommerce-video-director
description: Đạo diễn kịch bản và cấu hình video quảng cáo / trải nghiệm sản phẩm cho TikTok, Shopee, Facebook Fanpage và Website mà không làm sai lệch sản phẩm gốc và nhân vật.
---

# Đạo diễn Video TMĐT (E-Commerce Video Director)

Sử dụng kỹ năng này khi người dùng muốn lên kịch bản, tạo chiến dịch mới, hoặc xuất video giới thiệu/trải nghiệm sản phẩm.

## Quy trình thực hiện
1. Đọc thông tin từ:
   - `assets/brand-kit/brand.json`
   - `assets/products/<product-id>/product.json`
   - `assets/characters/<character-id>/character.json`
2. Thiết kế kịch bản theo cấu trúc chuyển đổi cao cho TMĐT (15–30 giây):
   - **0–3s (Hook)**: Đánh vào vấn đề/nhu cầu khách hàng hoặc khoảnh khắc trải nghiệm gây tò mò.
   - **3–12s (Trải nghiệm thực tế - AI Clip + Keyframe)**: Nhân vật cố định sử dụng sản phẩm thật trong bối cảnh tự nhiên.
   - **12–22s (Cận cảnh chi tiết nguyên bản - Remotion + Ảnh gốc)**: Hiển thị ảnh sản phẩm gốc độ phân giải cao, zoom chi tiết chất liệu/tem nhãn/thông số thật (tuyệt đối không để AI vẽ lại chữ).
   - **22–30s (Ưu đãi & CTA)**: Giá niêm yết, giá khuyến mãi, badge sàn (Shopee / TikTok Shop / Freeship) và nút kêu gọi hành động.
3. Chạy `node scripts/generate-prompts.mjs campaigns/<campaign-id>/campaign.json` để xuất file prompt khóa chi tiết sản phẩm và nhân vật.
4. Áp dụng skill `product-consistency-qc` để kiểm tra trước khi render trong `studio/`.
