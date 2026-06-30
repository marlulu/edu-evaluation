"""语音转录"""

from openai import OpenAI


def transcribe_audio(client: OpenAI, model: str, audio_path: str) -> str | None:
    """语音转录（使用本地 Whisper）"""
    try:
        import warnings
        warnings.filterwarnings("ignore", message="FP16 is not supported")

        import whisper
        print("      Loading local Whisper model (tiny)...")
        whisper_model = whisper.load_model("tiny")
        result = whisper_model.transcribe(audio_path, language="zh")
        return result["text"]
    except Exception as e:
        print(f"      [SKIP] Transcription failed: {e}")
        return None
