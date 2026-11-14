# Kiến trúc Hệ thống (Architecture)

## Tổng quan luồng dữ liệu
```text
[assets/products/*/product.json]  ---+
[assets/characters/*/character.json]-+--> [scripts/generate-prompts.mjs] --> [campaigns/*/prompts.md]
[assets/brand-kit/brand.json]     ---+                                              |
                                                                                    v
                                                                       (Cloud AI: Kling / Veo / Wan / FLUX)
                                                                                    |
                                                                                    v (Clip đã QC)
[campaigns/*/campaign.json] + [Ảnh SP gốc] + [Clip AI] ---> [studio/ (Remotion)] ---> [9:16 | 1:1 | 16:9 MP4]
```

## Các thành phần chính
1. **Data Layer (`assets/`, `campaigns/`)**: Dữ liệu JSON có cấu trúc rõ ràng, tách biệt giữa tài sản cố định (thương hiệu, sản phẩm, nhân vật) và cấu hình từng chiến dịch.
2. **Validation & Prompt Engine (`scripts/`)**: Chạy thuần Node.js (không phụ thuộc thư viện nặng), đảm bảo dữ liệu đủ trường bắt buộc và tự động chèn các ràng buộc chống biến dạng sản phẩm/nhân vật vào prompt.
3. **Programmatic Video Studio (`studio/`)**: Remotion + React + TypeScript. Chịu trách nhiệm hiển thị chính xác 100% ảnh sản phẩm gốc, chữ tiếng Việt, giá, khuyến mãi, logo và ghép nối với clip trải nghiệm AI.
4. **Agent Skills (`.agents/skills/`)**: Định nghĩa vai trò Đạo diễn Video TMĐT và Chuyên viên QC chống sai lệch để AI assistant hỗ trợ vận hành nhất quán.
