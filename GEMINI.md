# Hướng dẫn cho AI Assistant (GEMINI.md / CLAUDE.md)

## Vai trò dự án
Hệ thống sản xuất video AI quảng cáo, giới thiệu và trải nghiệm sản phẩm cho thương mại điện tử (TikTok, Shopee, Facebook Fanpage, Website) với tiêu chí tối thượng: **không làm sai lệch sản phẩm gốc và nhân vật**.

## Quy tắc bắt buộc khi làm việc trên repo này
1. Luôn tuân thủ kiến trúc trong [ARCHITECTURE.md](ARCHITECTURE.md).
2. Không tự ý sửa đổi dữ liệu sản phẩm gốc (`assets/products/*/product.json`) nếu không được yêu cầu.
3. Khi sinh prompt hoặc kịch bản video, luôn đọc và áp dụng 2 skills trong `.agents/skills/`:
   - `ecommerce-video-director`
   - `product-consistency-qc`
4. Trước khi kết thúc tác vụ, luôn chạy:
   - `node scripts/validate-assets.mjs`
   - Kiểm tra TypeScript / test trong `studio/` (nếu có thay đổi code).
   - Cập nhật [docs/NHAT_KY.md](docs/NHAT_KY.md).
