# Giấy phép phần mềm & model bên thứ ba (Gói 7)

> Ghi nhận cách dự án dùng từng thành phần, để giữ ranh giới giấy phép. Đây không phải tư vấn pháp lý.

| Thành phần | Giấy phép | Cách dùng trong dự án | Thương mại |
|---|---|---|---|
| **VoiceStudio** (`debpalash/VoiceStudio`) | AGPL-3.0-only | Cài **ngoài repo** (`D:\AI\_external\VoiceStudio`), chạy như tiến trình riêng, **không sửa**, chỉ gọi qua HTTP loopback theo chuẩn OpenAI Audio API (`scripts/lib/local-tts-client.mjs`). Không vendor, không import mã, không phát hành kèm. Commit hash: _(Task 0 điền)_ | Được, khi giữ đúng các điều trên |
| **VoxCPM2** (`openbmb/VoxCPM2`) | Apache-2.0 (model card) | Engine TTS duy nhất được phép (allowlist cứng trong client và `validate-assets`). Revision: _(Task 0 điền)_ | Được |
| **OmniVoice / OmniVoice-GGUF** | CC-BY-NC (+ Higgs Audio 2, Meta Llama 3) | **CẤM** — client từ chối mọi engine tên chứa `omnivoice` | **Không** |
| **faster-whisper** + trọng số Whisper | MIT | `tools/speech/align_words.py`, `xray_speech.py` (venv riêng, gitignored) | Được |
| **Demucs** (`htdemucs`) | MIT | `tools/speech/xray_speech.py` | Được |
| **WhisperX** (qua VoiceStudio) | BSD-2-Clause (mã); model căn chỉnh wav2vec2 tiếng Việt: _(Task 0 kiểm — nhiều checkpoint là CC-BY-NC-4.0)_ | Lựa chọn `voicestudio-whisperx` / `voicestudio-asr`; chỉ dùng cho thương mại khi model căn chỉnh được phép | Tùy model |
| **Remotion** (`studio/`) | Remotion License | Chỉ xem trước/chỉnh tay, không nằm trong luồng batch | Công ty > 3 người cần Company License |
| **FFmpeg** (bản gyan.dev full) | GPL-3.0 (bản full) | Gọi như chương trình ngoài qua dòng lệnh | Được (không phân phối kèm) |

## 6 luật ranh giới AGPL (tóm tắt từ kế hoạch Gói 7, mục A1)

1. Không sao chép, vendor, submodule hay `import` mã VoiceStudio.
2. Không phát hành bộ cài/binary VoiceStudio kèm sản phẩm.
3. Không sửa VoiceStudio. Buộc phải sửa → fork công khai.
4. Client viết theo chuẩn OpenAI Audio API công khai, dùng được với mọi server tương thích.
5. Chỉ gọi tới loopback. Tắt chia sẻ LAN (PIN 6 số) của VoiceStudio.
6. Ghi commit hash VoiceStudio và revision model vào bảng trên.
