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

## 3. Nghiên cứu Phương pháp `toolkichban.com` & Tích hợp Google Veo 3.1 / Gemini Omni 1.2 Flash

### A. Học hỏi gì từ `https://toolkichban.com/`?
1. **Character Bible & Product Bible Lock (Hồ sơ khóa cứng Nhân vật & Sản phẩm):**
   - Trong video nhiều cảnh (4–8 cảnh), lý do AI hay bị biến dạng khuôn mặt hoặc đổi màu sản phẩm giữa các cảnh là do mỗi prompt viết rời rạc.
   - Phương pháp chuẩn của `toolkichban.com` là lập một **Character Bible** và **Product Bible** cố định và nhúng nguyên văn vào mở đầu của **mọi cảnh quay (Scene 1 -> Scene N)** kết hợp cùng ảnh tham chiếu gốc.
2. **Cấu trúc Prompt Điện ảnh 7 Thành phần cho Veo 3 / Veo 3.1:**
   - `[1. Character Lock]` -> `[2. Product Lock]` -> `[3. Camera & Lens Preset]` -> `[4. Scene Setting & Lighting]` -> `[5. Physical Action]` -> `[6. Native Audio: Lip-Sync Vietnamese Dialogue in quotes + SFX + Room Ambience]` -> `[7. Negative Constraints]`.
3. **1-Click Copy & JSON Batch Automation:**
   - Xuất đồng thời từng thẻ Prompt theo từng cảnh (4–8s/cảnh) có nút **Copy 1 chạm** để dán vào **Google Flow / Vids / Whisk / Auto Whisk**, và file `veo3-prompts.json` cho chạy hàng loạt.

### B. Phương án Tối ưu Đã Triển khai cho Dự án (Kiến trúc Lai 3 Tầng)
Chúng ta đã nâng cấp hệ thống lên **Kiến trúc Lai 3 Tầng (3-Tier Hybrid Architecture)** vượt trội hơn cách chỉ sinh prompt chữ thuần túy:
1. **Tầng 1 — Google Veo 3.1 (`veo-3.1-generate-001` — Ingredients-to-Video + Native Audio):**
   - Truyền trực tiếp tối đa **3 ảnh nguyên liệu gốc (`referenceImages`)** vào từng cảnh: **Image 1 (`mama.jpg`)** + **Image 2 (`binh-thuy-tinh-giu-nhiet.png`)** + **Keyframe Neo**.
   - Sinh đồng thời chuyển động điện ảnh và âm thanh gốc (tiếng nói khớp khẩu hình trong dấu ngoặc kép `"..."` + tiếng động vật lý SFX).
2. **Tầng 2 — Gemini Omni 1.2 Flash (`gemini-omni-1.2-flash` — Reference-to-Video + 3s Sample Motion):**
   - Tự động cắt **clip mẫu 3 giây (`media/ref-clips/<scene>-ref3s.mp4`)** từ Video Mẫu người dùng tải lên (`Video-m-u.mp4`).
   - Truyền đồng thời **Ảnh Nhân vật thật (`--image`) + Ảnh Sản phẩm thật (`--image`) + Clip mẫu 3 giây (`--video-reference`)** để học đúng nhịp máy quay của video mẫu nhưng thay hoàn toàn bằng người và sản phẩm của mình.
3. **Tầng 3 — FFmpeg Dynamic Bokeh Cinema Local (`export-cutlist.mjs` — Chạy 100% trên máy không cần API/GPU):**
   - Biến chuyển động ánh sáng của Video Mẫu thành **phông nền Bokeh chuyển động điện ảnh làm mờ sâu (`boxblur=38:6`)** để triệt tiêu 100% sản phẩm của hãng cũ trong video mẫu, sau đó khóa lớp **Ảnh Nhân vật thật + Sản phẩm thật 100% sắc nét** lên tiền cảnh kèm giọng thuyết minh tiếng Việt tự nhiên.

### C. Tối ưu theo **Tool Muse AI (Tạo hình ảnh và video — `toolkichban.com`)** & **Google Whisk 3-Slot**
Từ việc phân tích sâu **Tool Muse AI tạo hình ảnh và video** (`toolkichban.com/product/ban-dung-thu-tool-muse-ai-tao-hinh-anh-va-video-1893`), hệ thống đã bổ sung 3 cơ chế quan trọng vào `scripts/generate-muse-pack.mjs`:
1. **Cơ chế Whisk 3-Slot Remix (`Subject` + `Scene` + `Style`):**
   - **Slot 1 (`Subject` — Chủ thể khóa cứng 100%):** Kết hợp trực tiếp Ảnh Nhân vật thật (`mama.jpg`) + Ảnh Sản phẩm thật (`binh-thuy-tinh-giu-nhiet.png`).
   - **Slot 2 (`Scene` — Bối cảnh từ Video Mẫu):** Trích xuất bối cảnh từ 4 phân cảnh của Video Mẫu (`assets/footage/analysis/video-m-u/scene-1.jpg` → `scene-4.jpg`).
   - **Slot 3 (`Style` — Preset Ánh sáng & Màu phim Muse AI):** Hỗ trợ 4 preset màu điện ảnh (`💎 TVC Studio Sang Trọng`, `☀️ Lifestyle Đời Thường Tự Nhiên`, `🛍️ Shopee Mall Sắc Nét`, `🔥 TikTok High-Retention`) áp dụng đồng thời vào cả Prompt AI và bộ lọc màu `ffmpegEq` khi dựng video thật.
2. **Khóa Quỹ Đạo Chuyển Động bằng Cặp Ảnh Khung Đầu → Khung Cuối (`Start Frame` → `End Frame` / `Frames-to-Video`):**
   - Tự động tạo **8 ảnh Keyframe (`1080×1920`)** cho 4 cảnh: mỗi cảnh có 1 **Khung Đầu (`<scene>-start.png` — góc trung Nhân vật + Sản phẩm)** và 1 **Khung Cuối (`<scene>-end.png` — góc push-in cận cảnh Sản phẩm thật)**.
   - Khi đưa cặp ảnh Đầu/Cuối này vào **Veo 3.1 (`image` + `lastFrame`)** hoặc **Gemini Omni 1.2 Flash**, quỹ đạo chuyển động được ghim chặt ở cả điểm đầu và điểm cuối, chống hoàn toàn hiện tượng trôi nét hoặc biến dạng sản phẩm giữa chừng.
3. **Hiển thị Trực quan Cặp Ảnh Đầu/Cuối & Nút Copy `Whisk 3-Slot` / `Veo 3.1 (Start→End)` ngay trên Giao diện (`Mục 05 / 08`):**
   - Cho phép xem trực tiếp ảnh `KHUNG ĐẦU (START) ➔ KHUNG CUỐI (END)` của từng cảnh ngay trên thẻ Storyboard và xuất file `campaigns/<id>/muse-ai-pack.json`.

---

## 4. Plugins Chính thức trên Antigravity Marketplace
- **`invideo` (`antigravity-plugins-partners/plugin/invideo`)**: Kết nối trực tiếp trình chỉnh sửa video AI InVideo trên timeline.
- **`Gemini API` (`antigravity-plugins-official/plugin/gemini-api`)**: Tích hợp trực tiếp API của Google Gemini để tạo ảnh, video (Veo), và giọng nói.
