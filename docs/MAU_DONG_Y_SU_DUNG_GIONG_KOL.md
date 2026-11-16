# Checklist văn bản đồng ý sử dụng giọng nói & hình ảnh KOL (bản nháp cho luật sư)

> **Đây không phải tư vấn pháp lý.** Đây là danh sách điều khoản kỹ thuật mà hệ thống cần để vận hành đúng. Hãy nhờ luật sư rà soát trước khi ký với KOL. Cơ sở tham chiếu: Nghị định 13/2023/NĐ-CP, Luật Bảo vệ dữ liệu cá nhân 2025 (hiệu lực 01/01/2026), quy định quảng cáo về người có ảnh hưởng.

## Điều khoản cần có

1. **Mục đích:** dùng giọng nói (và hình ảnh, nếu có) của KOL để AI tạo **lời thoại mới** cho video quảng cáo sản phẩm của shop.
2. **Phạm vi ngành hàng:** liệt kê rõ, ví dụ thời trang và làm đẹp. Hệ thống **tự chặn** sản phẩm ngoài danh sách này.
3. **Nền tảng đăng:** ví dụ TikTok, Shopee, Facebook.
4. **Thời hạn:** ngày bắt đầu và ngày hết hạn. Hết hạn thì hệ thống **tự chặn** việc sinh giọng mới.
5. **Quyền duyệt từng video:** KOL (hoặc người được ủy quyền) duyệt từng kịch bản trước khi đăng. Video chưa duyệt bị đóng dấu "BẢN NHÁP – CHỜ KOL DUYỆT". Sửa lời sau khi duyệt thì phải duyệt lại.
6. **Nhãn "nội dung do AI tạo":** cam kết gắn nhãn theo chính sách của từng nền tảng.
7. **Nơi xử lý dữ liệu:** giọng mẫu chỉ lưu và xử lý **trên máy của shop** (VoiceStudio/VoxCPM2 chạy cục bộ), không gửi lên dịch vụ đám mây, không chuyển ra nước ngoài, trừ khi có điều khoản riêng.
8. **Tối thiểu dữ liệu:** chỉ dùng 1 đoạn giọng mẫu 3–30 giây.
9. **Quyền rút lại:** cách thông báo, thời hạn xóa dữ liệu (hệ thống có lệnh `node scripts/revoke-voice.mjs <id> --yes`), và cách xử lý các video đã đăng.
10. **Thù lao và trách nhiệm** đối với nội dung quảng cáo mà KOL "nói".

## Lưu trên máy (không commit)

Lưu file `assets/private/consents/<consentRef>.json` (kèm bản scan PDF cùng tên):

```json
{
  "consentRef": "KOL-2026-001",
  "characterId": "<id nhân vật trong assets/characters>",
  "signedAt": "2026-11-20",
  "validUntil": "2027-11-20",
  "scope": { "categories": ["fashion", "beauty"], "platforms": ["TikTok", "Shopee", "Facebook"] },
  "aiDisclosureLabel": true,
  "allowCloudProcessing": false,
  "documentFile": "KOL-2026-001.pdf",
  "revokedAt": null
}
```

Trong `assets/characters/<id>/character.json` chỉ ghi phần tham chiếu:

```json
"voiceProfile": {
  "engine": "voxcpm2",
  "provider": "voicestudio",
  "mode": "clone",
  "voiceId": "<id do VoiceStudio cấp>",
  "referenceAudio": "assets/private/voices/<id>/voice-ref.wav",
  "referenceText": "Câu thoại đúng y lời trong voice-ref.wav",
  "consentRef": "KOL-2026-001"
}
```
