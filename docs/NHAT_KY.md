# Nhật ký Dự án

## 2026-11-14 — Khởi tạo Hệ thống Sản xuất Video AI TMĐT
- Khởi tạo cấu trúc dự án tại `d:\AI\tạo video AI` và khởi tạo Git repository.
- Tổng hợp tài liệu công cụ, GitHub repos (`HiAPIAI/awesome-ai-video-workflows`, `MCKRUZ/ComfyUI-Expert`, `leosssvip-dot/remotion-ad-video-skill`, `Rakshath66/AdGen`, Wan 2.1/2.2, Lamina, KOOZEE, Kling, Veo) tại `docs/CONG_CU_VA_REPO.md`.
- Thiết lập quy trình 4 bước chống sai lệch sản phẩm & nhân vật tại `docs/QUY_TRINH_CHONG_SAI_LECH.md`.
- Xây dựng hệ thống dữ liệu mẫu (`assets/`, `campaigns/`), bộ Agent Skills (`.agents/skills/`), scripts tự động hóa (`scripts/`), và `studio/` (Remotion).
- Nghiên cứu và đối chiếu các repo GitHub nổi bật (`google-marketing-solutions/scene-machine`, `Anil-matcha/Open-AI-UGC`, `gyoridavid/short-video-maker`, `charlesdove977/UGC-Factory`); cập nhật `docs/CONG_CU_VA_REPO.md` với `scene-machine` làm repo tham chiếu kiến trúc chính.
- Triển khai nâng cấp pipeline theo kiến trúc `scene-machine`: thêm Creative Templates (`templates/storyboards/`), Scene Slots + QC Gate (`qcStatus`), CLI gọi Gemini/Veo song song (`scripts/generate-media.mjs`), `scripts/sync-studio.mjs` và Remotion Dynamic Root (`studio/src/Root.tsx`, `ProductAdVideo.tsx`).
- Tích hợp luồng Quay thật Zero-AI-Pixel (`mode: "real-footage"`) chạy song song: bổ sung kho cảnh `assets/footage/catalog.json`, template `real-footage-reel.json`, bộ công cụ `scripts/ingest-footage.mjs` (`ffprobe`), `scripts/export-cutlist.mjs` (xuất Cutlist CapCut + dựng tự động bằng `ffmpeg`), `scripts/verify-integrity.mjs` (kiểm chứng nguyên vẹn khung hình bằng SSIM), và cập nhật `.agents/skills/product-consistency-qc/SKILL.md`.
