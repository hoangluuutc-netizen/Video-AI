# Hệ thống Sản xuất Video AI Thương mại Điện tử (Zero-Distortion Pipeline)

Dự án phục vụ đội ngũ kinh doanh và marketing đa kênh (**TikTok, Shopee, Facebook Fanpage, Website**), giúp tạo video quảng cáo, giới thiệu và trải nghiệm sản phẩm **đẹp, chân thực, rõ chi tiết** mà **không làm sai lệch sản phẩm gốc và nhân vật**.

## 1. Nguyên lý cốt lõi: Không để AI "tự bịa" chi tiết sản phẩm
Các mô hình Video AI thuần túy thường làm biến dạng logo, chữ trên bao bì, màu sắc hoặc hình dáng sản phẩm khi chuyển động. Dự án này giải quyết bằng quy trình **4 bước Hybrid (AI Keyframe + Controlled Video + Remotion Assembly)**:

1. **Chuẩn hóa Asset gốc (`assets/`)**: Lưu ảnh sản phẩm thật đa góc, ảnh tách nền PNG, bảng thông số, và hồ sơ nhân vật cố định (KOL/Người mẫu thương hiệu).
2. **Tạo Keyframe Neo (Image-First Anchor)**: Ghép sản phẩm thật & nhân vật cố định vào bối cảnh bằng model chính xác cao (FLUX Kontext / Gemini Image). Kiểm duyệt (QC) ảnh 100% đạt chuẩn trước khi làm video.
3. **Tạo Video Chuyển Động Có Kiểm Soát**: Đưa Keyframe đã duyệt vào Image-to-Video (Kling Elements / Veo Ingredients-to-Video / Wan 2.1) với prompt khóa chuyển động nhẹ, giữ nguyên hình khối và khuôn mặt.
4. **Lắp ráp & Đóng gói bằng Remotion (`studio/`)**: Ghép video AI trải nghiệm với **ảnh sản phẩm gốc sắc nét**, giá bán, ưu đãi, phụ đề tiếng Việt, logo thương hiệu và xuất hàng loạt cho **9:16 (TikTok/Shopee)**, **1:1 (Facebook)**, **16:9 (Web)**.

## 2. Cấu trúc thư mục
- `assets/brand-kit/`: Bộ nhận diện thương hiệu (`brand.json`, logo, màu sắc).
- `assets/products/`: Dữ liệu & ảnh gốc từng sản phẩm (`product.json`).
- `assets/characters/`: Hồ sơ & ảnh tham chiếu nhân vật đại diện cố định (`character.json`).
- `campaigns/`: Kịch bản, prompt và cấu hình render cho từng chiến dịch quảng cáo.
- `dashboard/`: Giao diện điều khiển trực quan **Đội Làm Video A.I. (7 Trợ Lý, 1 Cỗ Máy Ra Reel)** hỗ trợ cả luồng Quay thật (Zero-AI-Pixel) và Hybrid AI.
- `studio/`: Ứng dụng **Remotion (React + TypeScript)** để xem trước và render video đa tỷ lệ.
- `scripts/`: Bộ công cụ CLI kiểm tra dữ liệu, tạo chiến dịch mới và sinh prompt khóa chi tiết.
- `docs/`: Tài liệu tổng hợp công cụ/repo AI video, quy trình chống sai lệch và nhật ký dự án.
- `.agents/skills/`: Bộ kỹ năng (Agent Skills) để trợ lý AI tự động viết kịch bản và kiểm duyệt prompt.

## 3. Khởi chạy nhanh
```powershell
# 0. Mở Giao diện Trực quan "Đội Làm Video A.I. — 7 Trợ Lý" (http://localhost:4173)
node scripts/dashboard-server.mjs

# 1. Kiểm tra dữ liệu mẫu
node scripts/validate-assets.mjs

# 2. Sinh bộ prompt chuẩn khóa sản phẩm & nhân vật cho chiến dịch mẫu
node scripts/generate-prompts.mjs campaigns/sample-campaign/campaign.json

# 3. Tạo chiến dịch mới
node scripts/new-campaign.mjs ten-chien-dich

# 4. Mở Remotion Studio để xem trước & xuất video
cd studio
npm.cmd install
npm.cmd run dev
```

Xem chi tiết các công cụ, repo GitHub và quy trình tại [docs/CONG_CU_VA_REPO.md](docs/CONG_CU_VA_REPO.md) và [docs/QUY_TRINH_CHONG_SAI_LECH.md](docs/QUY_TRINH_CHONG_SAI_LECH.md).
