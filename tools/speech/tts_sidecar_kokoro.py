"""Sidecar TTS siêu nhẹ (127.0.0.1:3911) chuẩn OpenAI Audio API cho Kokoro-82M (Apache-2.0).

Mục tiêu: Thay thế VoxCPM2 (12-14 GB RAM) bằng engine ONNX nhẹ chạy CPU (< 300 MB RAM).
Cài thư viện tùy chọn khi muốn dùng:
  tools/speech/.venv/Scripts/pip.exe install fastapi uvicorn kokoro-onnx soundfile
Chạy:
  tools/speech/.venv/Scripts/python.exe tools/speech/tts_sidecar_kokoro.py
"""
import io
import os
from typing import Optional

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import Response
    from pydantic import BaseModel
    import uvicorn
except ImportError as exc:
    raise SystemExit(
        f"Thiếu thư viện sidecar ({exc}). Cài bằng: "
        "tools/speech/.venv/Scripts/pip.exe install fastapi uvicorn kokoro-onnx soundfile"
    )

app = FastAPI(title="Kokoro-82M Lightweight TTS Sidecar")
_MODEL = None


class SpeechReq(BaseModel):
    model: str = "kokoro-82m"
    input: str
    voice: Optional[str] = "af_heart"
    response_format: str = "wav"
    speed: float = 1.0


@app.get("/v1/models")
def list_models():
    return {
        "object": "list",
        "data": [
            {
                "id": "kokoro-82m",
                "object": "model",
                "owned_by": "sidecar",
                "voicestudio": {"kind": "tts", "alias_for_active_engine": False},
            }
        ],
    }


@app.post("/admin/unload")
def unload_model():
    global _MODEL
    _MODEL = None
    return {"unloaded": True}


@app.post("/v1/audio/speech")
def synthesize(req: SpeechReq):
    global _MODEL
    model_path = os.environ.get("KOKORO_ONNX_PATH", "kokoro-v1.0.int8.onnx")
    voices_path = os.environ.get("KOKORO_VOICES_PATH", "voices-v1.0.bin")
    if not os.path.exists(model_path) or not os.path.exists(voices_path):
        raise HTTPException(
            status_code=503,
            detail=f"Chưa có file model Kokoro ({model_path}, {voices_path}).",
        )
    try:
        import soundfile as sf
        from kokoro_onnx import Kokoro
    except ImportError as exc:
        raise HTTPException(status_code=500, detail=f"Thiếu kokoro-onnx/soundfile: {exc}")

    if _MODEL is None:
        _MODEL = Kokoro(model_path, voices_path)
    samples, sample_rate = _MODEL.create(req.input, voice=req.voice or "af_heart", speed=req.speed)
    buf = io.BytesIO()
    sf.write(buf, samples, sample_rate, format="WAV")
    return Response(content=buf.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3911)
