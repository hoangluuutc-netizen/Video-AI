# Thư mục Nhạc nền (BGM) cho Video Quảng cáo

Hãy chép các file nhạc nền không bản quyền (`.mp3`, `.wav`, `.m4a`) vào thư mục này (ví dụ: `upbeat-tvc.mp3`).

Khi chạy dựng video (`scripts/export-cutlist.mjs --render-ffmpeg`), hệ thống sẽ tự động:
1. Lặp nhạc nền khớp với độ dài toàn bộ video.
2. Áp dụng **Auto-Ducking (`sidechaincompress`)**: tự động hạ nhỏ nhạc nền khi có giọng đọc tiếng Việt và nâng nhẹ ở các khoảng nghỉ.
