# Tổng hợp Công cụ, Skills và GitHub Repos Tạo Video AI Sản phẩm TMĐT

Tài liệu này tổng hợp các công cụ, mã nguồn mở (GitHub repos) và kỹ năng (skills) phù hợp cho mục tiêu **tạo video quảng cáo, giới thiệu và trải nghiệm sản phẩm đẹp, chân thực, giữ nguyên chi tiết sản phẩm gốc và nhân vật**.

---

## 1. Nhóm GitHub Repos & Workflows Nổi bật

| Tên Repo / Dự án | Mục đích chính | Điểm mạnh cho TMĐT | Link / Cách dùng |
| :--- | :--- | :--- | :--- |
| **`google-marketing-solutions/scene-machine`** (~454 ⭐) | Workbench full-stack (Python Flask + Web UI + `google-genai`) biến ảnh sản phẩm tĩnh thành video quảng cáo theo storyboard | **Bám sát mục tiêu nhất:** Dùng Gemini + Brand Guidelines tạo storyboard, gọi Veo song song từng cảnh, thay reference theo từng slot và ghép overlay/logo | `https://github.com/google-marketing-solutions/scene-machine` |
| **`Anil-matcha/Open-AI-UGC`** (~431 ⭐) | Ứng dụng Next.js tự host tạo video UGC với AI Actor (thay thế Arcads/MakeUGC) | Hỗ trợ nhân vật AI + ảnh tham chiếu qua Veo 3.1, Seedance 2, Grok Video | `https://github.com/Anil-matcha/Open-AI-UGC` |
| **`gyoridavid/short-video-maker`** (~1.5k ⭐) | Tạo video dọc 9:16 tự động bằng **Remotion** + Kokoro TTS + Whisper phụ đề + MCP/REST API | Tham khảo tốt cho luồng TTS + phụ đề karaoke đồng bộ trên Remotion | `https://github.com/gyoridavid/short-video-maker` |
| **`charlesdove977/UGC-Factory`** (~98 ⭐) | Pipeline tạo video UGC cho coding agent (Claude Code) | Khóa nhân vật & sản phẩm qua Elements và ghép bằng `ffmpeg` | `https://github.com/charlesdove977/UGC-Factory` |
| **`HiAPIAI/awesome-ai-video-workflows`** | Tổng hợp workflow & AI agent skills biến ảnh sản phẩm tĩnh thành video quảng cáo (TikTok/Reels/UGC) | Quy trình rõ ràng: Audit trang SP -> Tạo hero visual -> Storyboard -> Image-to-Video -> Đa biến thể nền tảng | `npx -y github:HiAPIAI/awesome-ai-video-workflows` |
| **`MCKRUZ/ComfyUI-Expert`** | Bộ skill điều phối ComfyUI cho AI assistant (`comfyui-character-gen`) | Giữ nhất quán danh tính nhân vật (character consistency) qua ảnh, video và giọng nói mà không cần train lại liên tục | Tích hợp cùng ComfyUI local hoặc Cloud GPU |
| **`leosssvip-dot/remotion-ad-video-skill`** | Agent skill biến link sản phẩm TMĐT thành ad-brief và render video bằng Remotion | Không bị sai lệch chữ/giá/logo vì ghép bằng code React (Remotion) | Kết hợp tốt với `studio/` trong dự án này |
| **`Rakshath66/AdGen`** | Template Next.js + TypeScript + Remotion tự động tạo video quảng cáo 15–30s từ link sản phẩm | Tự động hóa quy mô lớn cho danh mục nhiều SKU | Tham khảo kiến trúc scraper + Remotion |
| **`InstantStudioAI/instantclips-mcp`** | MCP Server tạo video ngắn quảng cáo bằng Remotion | Cho phép AI agent gọi render clip dọc/ngang trực tiếp | Kết nối qua MCP |

---

## 2. Nhóm Công cụ Cloud AI Chuyên Giữ Nguyên Sản Phẩm & Nhân Vật (Khuyên dùng khi không có GPU mạnh)

> Lưu ý: Máy tính văn phòng không có GPU NVIDIA VRAM lớn (12GB–16GB+) nên ưu tiên dùng các công cụ Cloud hoặc API dưới đây để tạo cảnh quay trải nghiệm, sau đó đưa vào `studio/` (Remotion) để đóng gói.

### A. Giữ nguyên chi tiết sản phẩm (Product Consistency) & Ghép bối cảnh
- **Lamina (`uselamina.ai`)**: Thiết lập "Brand Kit" (bảng màu, font, quy tắc đúng/sai, ảnh/3D sản phẩm khóa cứng) và kiểm duyệt tự động mọi đầu ra.
- **Wireflow (`wireflow.ai`)**: Chuỗi pipeline chuyên biệt biến 1 bộ ảnh sản phẩm thành nhiều biến thể video mà vẫn bảo toàn hình dáng/nhãn mác.
- **FLUX.1 Kontext / Gemini Image**: Dùng để tạo **Keyframe Neo (Anchor Image)** — ghép chính xác sản phẩm thật vào tay người mẫu hoặc bối cảnh studio trước khi tạo chuyển động.

### B. Tạo video trải nghiệm & Người mẫu mặc/dùng thử (Virtual Try-On & I2V)
- **Wan 2.1 / Wan 2.2 (Image-to-Video & First-Last-Frame)**: Mô hình mã nguồn mở hàng đầu giữ độ cứng vật thể (object rigidity), kết cấu bề mặt và khuôn mặt ổn định khi chuyển động (có thể chạy qua Fal.ai, RunComfy hoặc ComfyUI Cloud).
- **KOOZEE (`koozee.ai`) & Vmake**: Chuyên cho ngành thời trang/phụ kiện, biến ảnh sản phẩm phẳng (flat-lay) thành video người mẫu mặc thử (fit check) mượt mà, giảm nhấp nháy khung hình.
- **Kling / Runway / Google Veo (via Gemini API)**: Hỗ trợ tham chiếu nhiều ảnh (Multi-Image / Ingredients-to-Video) để khóa đồng thời nhân vật và sản phẩm.

### C. Tạo video UGC / Review có người nói (Talking Avatar)
- **HeyGen / Arcads**: Tạo nhân vật nói kịch bản tự nhiên, biểu cảm tốt, hỗ trợ lồng tiếng nhiều ngôn ngữ (HeyGen).
- **Creatify / Topview AI / Nexscope**: Dán link sản phẩm để tạo nhanh nhiều biến thể video hook chạy quảng cáo TikTok/Meta.

---

## 3. Plugins Chính thức trên Antigravity Marketplace
- **`invideo` (`antigravity-plugins-partners/plugin/invideo`)**: Kết nối trực tiếp trình chỉnh sửa video AI InVideo trên timeline.
- **`Gemini API` (`antigravity-plugins-official/plugin/gemini-api`)**: Tích hợp trực tiếp API của Google Gemini để tạo ảnh, video (Veo), và giọng nói.
