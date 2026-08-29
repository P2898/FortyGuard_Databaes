"""Audio transcription endpoint — converts voice to text.
Uses ffmpeg directly (via imageio-ffmpeg bundle) + Whisper for transcription."""

import os
import io
import tempfile
import asyncio
import subprocess
import numpy as np
from fastapi import APIRouter, UploadFile, File
from app.services.monitoring import metrics

router = APIRouter(prefix="/api/transcribe", tags=["transcribe"])

# ─── Setup ffmpeg path ───────────────────────────────────────────────────────

_ffmpeg_path = None
_whisper_available = False
_model = None

try:
    import imageio_ffmpeg
    _ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    _ffmpeg_available = True
    print(f"[transcribe] ffmpeg: {_ffmpeg_path}")
except Exception as e:
    _ffmpeg_available = False
    print(f"[transcribe] ffmpeg not found: {e}")

try:
    import whisper
    _whisper_available = True

    # Patch whisper to use our ffmpeg
    import whisper.audio as _wa
    _orig_load = _wa.load_audio

    def _patched_load(file, sr=16000):
        cmd = [_ffmpeg_path, "-i", file, "-f", "f32le", "-ac", "1",
               "-ar", str(sr), "-loglevel", "error", "pipe:1"]
        out = subprocess.run(cmd, capture_output=True, check=True).stdout
        return np.frombuffer(out, np.float32).copy()

    _wa.load_audio = _patched_load
    print(f"[transcribe] Whisper ready (patched with our ffmpeg)")
except ImportError:
    print("[transcribe] Whisper not installed")


def _get_model():
    global _model
    if _model is None and _whisper_available:
        print("[transcribe] Loading Whisper tiny model...")
        _model = whisper.load_model("tiny")
        print("[transcribe] Model loaded")
    return _model


# ─── Convert any audio → WAV using ffmpeg directly ───────────────────────────

def _ffmpeg_convert(input_bytes: bytes, input_format: str) -> bytes | None:
    """Convert audio bytes to 16kHz mono WAV using ffmpeg subprocess."""
    cmd = [
        _ffmpeg_path,
        "-f", input_format,
        "-i", "pipe:0",          # read from stdin
        "-f", "wav",             # output format
        "-ac", "1",              # mono
        "-ar", "16000",          # 16kHz sample rate
        "-loglevel", "error",
        "pipe:1",                # write to stdout
    ]
    try:
        result = subprocess.run(cmd, input=input_bytes, capture_output=True, timeout=30)
        if result.returncode != 0:
            print(f"[transcribe] ffmpeg error: {result.stderr.decode()[:200]}")
            return None
        return result.stdout
    except Exception as e:
        print(f"[transcribe] ffmpeg exception: {e}")
        return None


# ─── Endpoint ────────────────────────────────────────────────────────────────

@router.post("/audio")
async def transcribe_audio(audio: UploadFile = File(...)):
    span = metrics.start_span("transcribe_audio")

    try:
        audio_bytes = await audio.read()
        content_type = (audio.content_type or "audio/webm").lower()
        print(f"[transcribe] Received {len(audio_bytes)} bytes ({content_type})")

        if len(audio_bytes) < 500:
            return {"text": "", "method": "error",
                    "message": "Audio too short. Speak for at least 1-2 seconds."}

        if not _whisper_available:
            return {"text": "", "method": "unavailable",
                    "message": "Voice transcription is not available on this server. Please type your message instead."}

        if not _ffmpeg_available:
            return {"text": "", "method": "unavailable",
                    "message": "Voice transcription requires audio processing support. Please type your message instead."}

        # Determine input format for ffmpeg
        fmt_map = {
            "webm": "webm", "mp4": "mp4", "m4a": "mp4",
            "mp3": "mp3", "mpeg": "mp3", "wav": "wav", "ogg": "ogg",
        }
        input_fmt = "webm"
        for key, fmt in fmt_map.items():
            if key in content_type:
                input_fmt = fmt
                break

        # Convert to WAV
        print(f"[transcribe] Converting {input_fmt} -> wav via ffmpeg...")
        wav_bytes = _ffmpeg_convert(audio_bytes, input_fmt)

        if not wav_bytes or len(wav_bytes) < 100:
            return {"text": "", "method": "error",
                    "message": "Audio conversion failed. Type your message instead."}

        print(f"[transcribe] WAV ready: {len(wav_bytes)} bytes")

        # Write WAV to temp file and transcribe
        result = await asyncio.get_event_loop().run_in_executor(
            None, _do_transcribe, wav_bytes
        )

        metrics.end_span(span, "ok")
        return {"text": result, "method": "whisper"}

    except Exception as e:
        print(f"[transcribe] Error: {e}")
        import traceback; traceback.print_exc()
        metrics.end_span(span, "error")
        return {"text": "", "method": "error",
                "message": f"Error: {e}. Type your message instead."}


def _do_transcribe(wav_bytes: bytes) -> str:
    """Write WAV to temp file and run Whisper."""
    model = _get_model()
    if model is None:
        return ""

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        tmp.write(wav_bytes)
        tmp.close()
        print(f"[transcribe] Whisper transcribing {tmp.name}...")
        result = model.transcribe(tmp.name, language="en", fp16=False)
        text = result.get("text", "").strip()
        print(f"[transcribe] Result: '{text[:100]}'")
        return text
    except Exception as e:
        print(f"[transcribe] Whisper error: {e}")
        import traceback; traceback.print_exc()
        return ""
    finally:
        try: os.unlink(tmp.name)
        except: pass
