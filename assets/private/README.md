# assets/private — dữ liệu riêng, KHÔNG commit

Thư mục này đã được gitignore (trừ file README này). Chỉ chứa dữ liệu cá nhân của KOL người thật:

- `consents/<consentRef>.json` + bản scan PDF: văn bản đồng ý (mẫu ở `docs/MAU_DONG_Y_SU_DUNG_GIONG_KOL.md`).
- `voices/<characterId>/voice-ref.wav`: đoạn giọng mẫu 3–30 giây dùng để nhân bản giọng.

Sao lưu thư mục này riêng (ổ mã hóa / két an toàn), không đưa lên GitHub hay dịch vụ đám mây.
Thu hồi giọng: `node scripts/revoke-voice.mjs <characterId>` (xem trước) rồi thêm `--yes` để xóa thật.
