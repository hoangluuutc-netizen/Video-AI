---
name: kol-voice-lipsync
description: Điều phối giọng nói tiếng Việt đặc trưng cho KOL AI (Gemini TTS, Vbee, FPT.AI, Google Natural) và đồng bộ khẩu hình, nhịp thở, phụ đề Highlight TikTok cho video KOL nói (Talking KOL).
---

# KOL Voice & Lip-Sync — Giọng Nói & Khẩu Hình KOL AI

## Mục tiêu
Biến kịch bản chữ thành giọng nói tiếng Việt tự nhiên, đúng tính cách KOL AI, có phụ đề `.srt` / `.ass` (Highlight từng cụm từ kiểu TikTok) và sẵn sàng ghép vào video Talking KOL (`Veo 3.1`, `Gemini Omni 1.2`, hoặc `FFmpeg Studio`).

## Quy chuẩn Lời Thoại Tiếng Việt cho KOL AI
1. **Tốc độ vàng**: Tối đa **2.5 – 2.8 từ / giây** (VD: video 15 giây chỉ nên viết ~38–42 từ; video 30 giây viết ~75–84 từ).
2. **Ngắt nhịp tự nhiên**: Dùng dấu phẩy `,` cho nghỉ ngắn 0.2s, dấu chấm `.` hoặc xuống dòng cho nghỉ 0.4s. Viết như văn nói, dùng từ đệm tự nhiên (*"thật sự luôn á"*, *"mọi người nhìn kỹ nè"*).
3. **Hook 3 giây đầu**: Phải là câu hỏi gây tò mò, nỗi đau trực diện, hoặc con số thực tế.

## Lựa chọn Engine Giọng Nói (`ttsModel`)
- `google-vi-natural` (**$0 — Mặc định**): Chạy ngay không cần API key, ổn định, xuất kèm `.wav` 48kHz stereo + `.srt` + `.ass`.
- `vbee-vi` (**Vbee AIVoice**): Giọng đọc tiếng Việt rất tự nhiên, nhiều vùng miền (Hà Nội, Sài Gòn), phù hợp KOL review.
- `fpt-vi` (**FPT.AI Speech v5**): Tốc độ nhanh, phát âm chuẩn tên thương hiệu.
- `gemini-tts` (**Gemini Flash TTS**): Hỗ trợ điều khiển cảm xúc qua prompt (vui vẻ, thì thầm, hào hứng).

## Prompt Khớp Khẩu Hình (Lip-Sync) cho Veo 3.1 / Omni 1.2
Khi tạo clip KOL nói trực diện trước camera:
- Đặt lời thoại tiếng Việt trong ngoặc kép `"..."` và giới hạn độ dài <= 8 giây mỗi shot.
- Mô tả rõ biểu cảm miệng và ánh mắt:
  `"Medium close-up of the Vietnamese KOL from reference image looking directly into the camera lens, speaking naturally in Vietnamese with accurate lip movement and friendly hand gestures: \"<LỜI THOẠI>\". Crisp studio voice audio, no background noise, natural room tone."`
