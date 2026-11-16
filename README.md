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
- `dashboard/`: Giao diện điều khiển trực quan **Đội Làm Video A.I. (7 Trợ Lý, 1 Cỗ Máy Ra Reel)** hỗ trợ cả luồng Quay thật (Zero-AI-Pixel), Hybrid AI, Batch CSV & Sổ chi phí, Quản lý API Key `.env` 1-chạm, và **KOL AI Studio** (`dashboard/kol-studio.html`).
- `studio/`: Ứng dụng **Remotion (React + TypeScript)** hỗ trợ xem trước, phụ đề `word-highlight` từng từ kiểu TikTok, và render video đa tỷ lệ (`9:16 | 1:1 | 16:9`).
- `scripts/`: Bộ công cụ CLI & Server (`dashboard-server.mjs`, `run-optimal-pipeline.mjs`, `batch-from-csv.mjs`, `verify-integrity.mjs`).
- `docs/`: Tài liệu tổng hợp công cụ/repo AI video, quy trình chống sai lệch và nhật ký dự án (`docs/NHAT_KY.md`).
- `.agents/skills/`: Bộ **6 Agent Skills** chuyên biệt (`ecommerce-video-director`, `product-consistency-qc`, `rea-video`, `kol-persona-architect`, `kol-visual-consistency`, `kol-voice-lipsync`).

## 3. Khởi chạy nhanh
```powershell
# 0. Mở Giao diện Trực quan (Video Ad Studio: http://localhost:4173 | KOL AI Studio: http://localhost:4173/kol-studio.html)
start-dashboard.bat
# hoặc: node scripts/dashboard-server.mjs

# 1. Kiểm tra dữ liệu, unit tests & smoke test toàn hệ thống
node scripts/validate-assets.mjs
node --test scripts/tests/*.test.mjs
node scripts/smoke-test.mjs

# 2. Chạy dây chuyền tự động 6 bước (Hướng 1 — $0 mặc định hoặc Vbee/FPT)
node scripts/run-optimal-pipeline.mjs campaigns/sample-campaign/campaign.json

# 3. Mở Remotion Studio để xem trước & xuất video đa tỷ lệ
cd studio
npm.cmd install
npm.cmd run dev
```

Xem chi tiết tại:
- **Hướng dẫn sử dụng từng bước (A–Z):** [docs/HUONG_DAN_SU_DUNG.md](docs/HUONG_DAN_SU_DUNG.md)
- **Tổng hợp công cụ & GitHub repos:** [docs/CONG_CU_VA_REPO.md](docs/CONG_CU_VA_REPO.md)
- **Quy trình chống sai lệch sản phẩm & nhân vật:** [docs/QUY_TRINH_CHONG_SAI_LECH.md](docs/QUY_TRINH_CHONG_SAI_LECH.md)
