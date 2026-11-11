r"""
Lux AI - Persistent Warm Coqui XTTS-v2 CPU Worker (Seçenek D)
Runs inside D:\LuxAI_Models\xtts_venv so heavy PyTorch / Coqui dependencies stay
completely isolated from Python 3.12 voice_service.py and the C: drive.
Communicates over UTF-8 JSON lines on stdin/stdout.
"""

import os
import sys
import json
import wave
import tempfile
import shutil

DEFAULT_MODELS_ROOT = r"D:\LuxAI_Models"
MODELS_ROOT = os.environ.get("LUX_MODELS_DIR") or (DEFAULT_MODELS_ROOT if os.path.isdir(DEFAULT_MODELS_ROOT) else os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault("COQUI_TOS_AGREED", "1")
os.environ.setdefault("HF_HOME", os.path.join(MODELS_ROOT, "huggingface"))
os.environ.setdefault("TTS_HOME", os.path.join(MODELS_ROOT, "coqui"))
os.environ.setdefault("TORCH_HOME", os.path.join(MODELS_ROOT, "torch"))

_tts_instance = None
_torchaudio_patched = False
_JSON_OUT = sys.stdout
DEFAULT_CLONE_WAV = os.path.join(MODELS_ROOT, "coqui", "voices", "tr_default_clone.wav")


def _patch_torchaudio_io():
    """Bypass TorchAudio 2.9+ torchcodec/FFmpeg requirement on Windows by routing WAV/FLAC/OGG/MP3 I/O through soundfile."""
    global _torchaudio_patched
    if _torchaudio_patched:
        return
    try:
        import torchaudio
        import soundfile as sf
        import torch
        import numpy as np

        if getattr(torchaudio, "_lux_soundfile_patched", False):
            _torchaudio_patched = True
            return

        orig_load = getattr(torchaudio, "load", None)
        orig_save = getattr(torchaudio, "save", None)

        def _sf_load(uri, frame_offset=0, num_frames=-1, normalize=True, channels_first=True, format=None, buffer_size=4096, backend=None):
            try:
                start = int(frame_offset or 0)
                frames = int(num_frames) if num_frames is not None else -1
                stop = (start + frames) if frames >= 0 else None
                data, sr = sf.read(uri, start=start, stop=stop, dtype="float32", always_2d=True)
                arr = data.T if channels_first else data
                tensor = torch.from_numpy(np.ascontiguousarray(arr, dtype=np.float32))
                return tensor, int(sr)
            except Exception:
                if callable(orig_load):
                    return orig_load(
                        uri,
                        frame_offset=frame_offset,
                        num_frames=num_frames,
                        normalize=normalize,
                        channels_first=channels_first,
                        format=format,
                        buffer_size=buffer_size,
                        backend=backend,
                    )
                raise

        def _sf_save(uri, src, sample_rate, channels_first=True, format=None, encoding=None, bits_per_sample=None, buffer_size=4096, backend=None, compression=None):
            try:
                arr = src.detach().cpu().numpy() if hasattr(src, "detach") else np.asarray(src)
                if arr.ndim == 2 and channels_first:
                    arr = arr.T
                sf.write(uri, arr, int(sample_rate))
                return
            except Exception:
                if callable(orig_save):
                    return orig_save(
                        uri,
                        src,
                        sample_rate,
                        channels_first=channels_first,
                        format=format,
                        encoding=encoding,
                        bits_per_sample=bits_per_sample,
                        buffer_size=buffer_size,
                        backend=backend,
                        compression=compression,
                    )
                raise

        torchaudio.load = _sf_load
        torchaudio.save = _sf_save
        torchaudio._lux_soundfile_patched = True
        _torchaudio_patched = True
    except Exception:
        pass


def get_xtts():
    global _tts_instance
    _patch_torchaudio_io()
    if _tts_instance is not None:
        return _tts_instance
    from TTS.api import TTS
    _tts_instance = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")
    return _tts_instance


def _prepare_speaker_wav(speaker_wav_path):
    candidate = (speaker_wav_path or "").strip()
    if not candidate or not os.path.isfile(candidate):
        if os.path.isfile(DEFAULT_CLONE_WAV):
            candidate = DEFAULT_CLONE_WAV
        else:
            voices_dir = os.path.dirname(DEFAULT_CLONE_WAV)
            if os.path.isdir(voices_dir):
                for fn in os.listdir(voices_dir):
                    if fn.lower().endswith(".wav"):
                        candidate = os.path.join(voices_dir, fn)
                        break

    if not candidate or not os.path.isfile(candidate):
        return None, None, "Referans ses dosyası (speaker_wav) bulunamadı."

    # Normalize to clean mono 22050Hz PCM16 WAV when possible so torchaudio never chokes on container codecs
    ext = os.path.splitext(candidate)[1].lower()
    if ext == ".wav":
        return candidate, None, None

    tmp_wav = None
    try:
        import soundfile as sf
        import numpy as np
        data, sr = sf.read(candidate, dtype="float32", always_2d=True)
        mono = data.mean(axis=1)
        if sr != 22050 and len(mono) > 1:
            target_len = int(round(len(mono) * 22050.0 / float(sr)))
            x_old = np.linspace(0.0, 1.0, num=len(mono), endpoint=False)
            x_new = np.linspace(0.0, 1.0, num=target_len, endpoint=False)
            mono = np.interp(x_new, x_old, mono).astype(np.float32)
            sr = 22050
        fd, tmp_wav = tempfile.mkstemp(prefix="lux_xtts_ref_", suffix=".wav")
        os.close(fd)
        sf.write(tmp_wav, mono, sr, subtype="PCM_16")
        return tmp_wav, tmp_wav, None
    except Exception:
        if tmp_wav and os.path.exists(tmp_wav):
            try:
                os.remove(tmp_wav)
            except OSError:
                pass

    try:
        _patch_torchaudio_io()
        import torchaudio
        wav_tensor, sr = torchaudio.load(candidate)
        if wav_tensor.shape[0] > 1:
            wav_tensor = wav_tensor.mean(dim=0, keepdim=True)
        fd, tmp_wav = tempfile.mkstemp(prefix="lux_xtts_ref_", suffix=".wav")
        os.close(fd)
        torchaudio.save(tmp_wav, wav_tensor, sr)
        return tmp_wav, tmp_wav, None
    except Exception as conv_err:
        return candidate, None, None


def synthesize_xtts(text, speaker_wav=None, language="tr", speed=1.0, out_path=None):
    clean_text = (text or "").strip()
    if not clean_text:
        return {"success": False, "error": "Boş metin sentezlenemez."}

    ref_wav, cleanup_tmp, ref_err = _prepare_speaker_wav(speaker_wav)
    if ref_err or not ref_wav:
        return {"success": False, "error": ref_err or "Referans ses dosyası yok."}

    try:
        tts = get_xtts()
        lang_code = str(language or "tr").split("-")[0].lower()
        supported = {"en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl", "cs", "ar", "zh", "hu", "ko", "ja", "hi"}
        if lang_code not in supported:
            lang_code = "tr"

        if not out_path:
            fd, out_path = tempfile.mkstemp(prefix="lux_xtts_out_", suffix=".wav")
            os.close(fd)
        elif not out_path.lower().endswith(".wav"):
            out_path = os.path.splitext(out_path)[0] + ".wav"

        spd = max(0.75, min(1.5, float(speed or 1.0)))
        kwargs = {
            "text": clean_text,
            "speaker_wav": ref_wav,
            "language": lang_code,
            "file_path": out_path,
        }
        try:
            tts.tts_to_file(**kwargs, speed=spd)
        except TypeError:
            tts.tts_to_file(**kwargs)

        if not os.path.exists(out_path) or os.path.getsize(out_path) < 512:
            return {"success": False, "error": "XTTS-v2 çıktı dosyası oluşturulamadı."}

        return {
            "success": True,
            "file": out_path,
            "mimeType": "audio/wav",
            "voice": "XTTS-Clone (Coqui XTTS-v2)",
            "engine": "coqui-xtts-v2",
            "refWav": os.path.basename(speaker_wav or ref_wav),
        }
    finally:
        if cleanup_tmp and os.path.exists(cleanup_tmp):
            try:
                os.remove(cleanup_tmp)
            except OSError:
                pass


def _emit_json(payload):
    _JSON_OUT.write(json.dumps(payload, ensure_ascii=False) + "\n")
    _JSON_OUT.flush()


def main():
    global _JSON_OUT
    try:
        sys.stdin.reconfigure(encoding="utf-8", errors="replace")
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    _JSON_OUT = sys.stdout
    # Keep third-party library print() noise off stdout so JSON-RPC lines never corrupt
    sys.stdout = sys.stderr

    while True:
        line = sys.stdin.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            action = req.get("action")

            if action == "status":
                resp = {
                    "success": True,
                    "loaded": _tts_instance is not None,
                    "defaultCloneWav": DEFAULT_CLONE_WAV if os.path.isfile(DEFAULT_CLONE_WAV) else None,
                }
            elif action == "warmup":
                get_xtts()
                resp = {"success": True, "loaded": True}
            elif action == "synthesize":
                resp = synthesize_xtts(
                    text=req.get("text", ""),
                    speaker_wav=req.get("speakerWav"),
                    language=req.get("language", "tr"),
                    speed=req.get("speed", 1.0),
                    out_path=req.get("outPath"),
                )
            elif action == "ping":
                resp = {"success": True, "pong": True}
            elif action == "shutdown":
                _emit_json({"id": req_id, "success": True, "shutdown": True})
                break
            else:
                resp = {"success": False, "error": f"Unknown XTTS action: {action}"}

            if req_id is not None:
                resp["id"] = req_id
            _emit_json(resp)
        except Exception as exc:
            err = {"success": False, "error": str(exc)}
            if req_id is not None:
                err["id"] = req_id
            _emit_json(err)


if __name__ == "__main__":
    main()
