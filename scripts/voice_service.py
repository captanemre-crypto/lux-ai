r"""
Lux AI - Multi-Engine Neural Voice & Speech Recognition Service (Options A / B / C / D)
Supports:
- STT: Faster-Whisper (small, large-v3-turbo, base), Moonshine Base ONNX, Google Speech (Online)
- TTS: Piper TR ONNX (DFKI, Fahrettin, Fettah), Kokoro-82M ONNX, Coqui XTTS-v2 (isolated D:\ venv), Edge-TTS
Stores all models/caches on D:\LuxAI_Models when present to keep C: clean.
Zero robotic Windows system voices.
"""

import atexit
import asyncio
import base64
import codecs
import gc
import importlib.util
import io
import json
import mimetypes
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
import wave

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODELS_ROOT = r"D:\LuxAI_Models"
MODELS_ROOT = (
    os.environ.get("LUX_MODELS_DIR")
    or (DEFAULT_MODELS_ROOT if os.path.isdir(DEFAULT_MODELS_ROOT) else BASE_DIR)
)

os.environ.setdefault("HF_HOME", os.path.join(MODELS_ROOT, "huggingface"))
os.environ.setdefault("TTS_HOME", os.path.join(MODELS_ROOT, "coqui"))
os.environ.setdefault("TORCH_HOME", os.path.join(MODELS_ROOT, "torch"))
os.environ.setdefault("COQUI_TOS_AGREED", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

PY_LIBS_DIR = os.path.join(MODELS_ROOT, "py_libs")
if os.path.isdir(PY_LIBS_DIR) and PY_LIBS_DIR not in sys.path:
    sys.path.insert(0, PY_LIBS_DIR)

# Lazy-loaded heavy dependencies to keep service startup < 0.2s
np = None
sf = None
sr = None
edge_tts = None
WhisperModel = None
fw_utils = None
PiperVoice = None
SynthesisConfig = None
Kokoro = None
moonshine_onnx = None
MoonshineOnnxModel = None
recognizer = None

_whisper_lock = threading.RLock()
_piper_lock = threading.RLock()
_kokoro_lock = threading.RLock()
_moonshine_lock = threading.RLock()
_import_lock = threading.RLock()
_stdout_lock = threading.Lock()


_MODULE_SPEC_CACHE = {}


def _has_module(mod_name):
    if mod_name in _MODULE_SPEC_CACHE:
        return _MODULE_SPEC_CACHE[mod_name]
    try:
        ok = importlib.util.find_spec(mod_name) is not None
    except Exception:
        ok = False
    _MODULE_SPEC_CACHE[mod_name] = ok
    return ok


def _prime_module_cache():
    for m in ("faster_whisper", "piper", "kokoro_onnx", "moonshine_onnx", "edge_tts", "speech_recognition"):
        _has_module(m)


def _ensure_numpy():
    global np
    if np is not None:
        return np
    with _import_lock:
        if np is not None:
            return np
        try:
            import numpy as _np
            np = _np
        except ImportError:
            np = None
    return np


def _ensure_soundfile():
    global sf
    if sf is not None:
        return sf
    with _import_lock:
        if sf is not None:
            return sf
        _ensure_numpy()
        try:
            import soundfile as _sf
            sf = _sf
        except ImportError:
            sf = None
    return sf


def _ensure_recognizer():
    global sr, recognizer
    if sr is not None and recognizer is not None:
        return sr, recognizer
    with _import_lock:
        if sr is not None and recognizer is not None:
            return sr, recognizer
        try:
            import speech_recognition as _sr
            sr = _sr
            if recognizer is None:
                recognizer = _sr.Recognizer()
        except ImportError:
            sr = None
            recognizer = None
    return sr, recognizer


def _ensure_edge_tts():
    global edge_tts
    if edge_tts is not None:
        return edge_tts
    with _import_lock:
        if edge_tts is not None:
            return edge_tts
        try:
            import edge_tts as _edge_tts
            edge_tts = _edge_tts
        except ImportError:
            edge_tts = None
    return edge_tts


def _emit_json(payload):
    line = json.dumps(payload, ensure_ascii=False) + "\n"
    with _stdout_lock:
        sys.stdout.write(line)
        sys.stdout.flush()


LEGACY_VOICES_DIR = os.path.join(BASE_DIR, "voices")
PIPER_DIR = os.path.join(MODELS_ROOT, "piper")
KOKORO_DIR = os.path.join(MODELS_ROOT, "kokoro")
KOKORO_MODEL_PATH = os.path.join(KOKORO_DIR, "kokoro-v1.0.onnx")
KOKORO_VOICES_PATH = os.path.join(KOKORO_DIR, "voices-v1.0.bin")
XTTS_VENV_PYTHON = os.path.join(MODELS_ROOT, "xtts_venv", "Scripts", "python.exe")
XTTS_WORKER_SCRIPT = os.path.join(BASE_DIR, "xtts_worker.py")
DEFAULT_CLONE_WAV = os.path.join(MODELS_ROOT, "coqui", "voices", "tr_default_clone.wav")

PIPER_VOICE_MAP = {
    "Piper-DFKI": ("tr_TR-dfki-medium.onnx", "Piper DFKI Türkçe"),
    "Piper-Fahrettin": ("tr_TR-fahrettin-medium.onnx", "Piper Fahrettin Türkçe"),
    "Piper-Fettah": ("tr_TR-fettah-medium.onnx", "Piper Fettah Türkçe"),
}

KOKORO_VOICE_MAP = {
    "Kokoro-af_heart": ("af_heart", "Kokoro-82M Heart"),
    "Kokoro-af_bella": ("af_bella", "Kokoro-82M Bella"),
    "Kokoro-am_adam": ("am_adam", "Kokoro-82M Adam"),
    "Kokoro-am_michael": ("am_michael", "Kokoro-82M Michael"),
}

OPENROUTER_TTS_ENDPOINT = "https://openrouter.ai/api/v1/audio/speech"
OPENROUTER_HEYGEN_VOICES = (
    "nadine", "tabitha", "bram", "gareth", "noelle",
    "meredith", "sabrina", "lucian", "weston", "vincent",
)
OPENROUTER_SPEECH_VOICES = {
    "OpenRouter-Fish-S2.1": {
        "model": "fish-audio/s2.1-pro-free:free",
        "voice": None,
        "response_format": "mp3",
        "clone": False,
        "label": "Fish Audio S2.1 Pro (OpenRouter :free)",
        "engine": "openrouter-fish",
    },
    "OpenRouter-Fish-S2.1-Clone": {
        "model": "fish-audio/s2.1-pro-free:free",
        "voice": None,
        "response_format": "mp3",
        "clone": True,
        "label": "Fish Audio S2.1 Pro Klon (OpenRouter :free)",
        "engine": "openrouter-fish",
    },
}
for _hg_voice in OPENROUTER_HEYGEN_VOICES:
    OPENROUTER_SPEECH_VOICES[f"OpenRouter-HeyGen-{_hg_voice.capitalize()}"] = {
        "model": "heygen/heygen-voice-1-turbo:free",
        "voice": _hg_voice,
        "response_format": "pcm",
        "max_chars": 4800,
        "label": f"HeyGen Voice Turbo · {_hg_voice.capitalize()} (OpenRouter :free)",
        "engine": "openrouter-heygen",
    }

_whisper_model = None
_whisper_model_name = None
_piper_voices = {}
_kokoro_engine = None
_moonshine_model = None
_moonshine_tokenizer = None
_xtts_proc = None
_xtts_req_seq = 0
_xtts_lock = threading.Lock()


# Distinct Acoustic Voice Profiles for Cloud Edge-TTS Personas
PERSONA_PROFILES = {
    "Fola": {
        "voice": "tr-TR-EmelNeural",
        "pitch": "+0Hz",
        "rate_offset": 0,
        "desc": "Doğal & Sıcak Kadın",
    },
    "Arlo": {
        "voice": "tr-TR-AhmetNeural",
        "pitch": "-8Hz",
        "rate_offset": -2,
        "desc": "Sakin & Düşünceli Erkek",
    },
    "Puck": {
        "voice": "tr-TR-AhmetNeural",
        "pitch": "+45Hz",
        "rate_offset": +14,
        "desc": "Genç, Canlı & Enerjik Erkek",
    },
    "Kore": {
        "voice": "tr-TR-EmelNeural",
        "pitch": "-25Hz",
        "rate_offset": -8,
        "desc": "Yumuşak & Rahatlatıcı Kadın",
    },
    "Charon": {
        "voice": "tr-TR-AhmetNeural",
        "pitch": "-48Hz",
        "rate_offset": -6,
        "desc": "Derin, Tok Bariton Erkek",
    },
    "Aoede": {
        "voice": "tr-TR-EmelNeural",
        "pitch": "+50Hz",
        "rate_offset": +10,
        "desc": "Melodik, Parlak & Neşeli Kadın",
    },
    "Zephyr": {
        "voice": "tr-TR-AhmetNeural",
        "pitch": "+22Hz",
        "rate_offset": +20,
        "desc": "Hızlı, Keskin & Dinamik Erkek",
    },
    "Fenrir": {
        "voice": "tr-TR-AhmetNeural",
        "pitch": "-30Hz",
        "rate_offset": +4,
        "desc": "Güçlü & Kararlı Erkek",
    },
    "Villainess": {
        "voice": "tr-TR-EmelNeural",
        "pitch": "-22Hz",
        "rate_offset": -6,
        "desc": "Kötü Kadın (Villainess) - Karanlık, Soğuk & Entrikacı Kadın",
    },
    "ElevenLabs-Rachel": {
        "voice": "tr-TR-EmelNeural",
        "pitch": "+8Hz",
        "rate_offset": +2,
        "desc": "ElevenLabs Stili (Edge-TTS Profili) Akıcı Türkçe Kadın",
    },
    "ElevenLabs-Adam": {
        "voice": "tr-TR-AhmetNeural",
        "pitch": "-20Hz",
        "rate_offset": -4,
        "desc": "ElevenLabs Stili (Edge-TTS Profili) Derin Türkçe Erkek",
    },
    "ElevenLabs-Bella": {
        "voice": "tr-TR-EmelNeural",
        "pitch": "+15Hz",
        "rate_offset": +5,
        "desc": "ElevenLabs Stili (Edge-TTS Profili) Canlı Kadın",
    },
    "Cartesia-Sonic-TR": {
        "voice": "tr-TR-AhmetNeural",
        "pitch": "+10Hz",
        "rate_offset": +15,
        "desc": "Cartesia Stili (Edge-TTS Profili) Hızlı Canlı Asistan",
    },
    "Deepgram-Aura-TR": {
        "voice": "tr-TR-EmelNeural",
        "pitch": "-10Hz",
        "rate_offset": 0,
        "desc": "Deepgram Stili (Edge-TTS Profili) Türkçe Ses Ajanı",
    },
    "Qwen3-TTS-Bridge": {
        "voice": "tr-TR-AhmetNeural",
        "pitch": "-15Hz",
        "rate_offset": +5,
        "desc": "Qwen3-TTS Stili (Edge-TTS Profili)",
    },
}


def is_mostly_turkish(text):
    tr_chars = "çğıöşüÇĞİÖŞÜ"
    return any(c in tr_chars for c in (text or ""))


def _detect_xtts_lang(text):
    s = (text or "").strip()
    if is_mostly_turkish(s):
        return "tr"
    if re.search(r"\b(ve|bir|bu|şu|ben|sen|nasıl|nasilsin|nedir|için|ile|mı|mi|mu|mü|merhaba|selam|tamam|evet|hayır|dostum|teşekkür|tesekkur)\b", s, re.IGNORECASE):
        return "tr"
    if re.search(r"\b(hello|hi|hey|how|you|what|the|is|are|was|were|please|thank|with|from|this|that|good|morning|voice|english|test|testing)\b", s, re.IGNORECASE):
        return "en"
    return "tr"


def _hf_hub_dir():
    return os.path.join(
        os.environ.get("HF_HOME", os.path.join(MODELS_ROOT, "huggingface")),
        "hub",
    )


def _is_hf_repo_cached(repo_id):
    if not repo_id:
        return False
    repo_dir = os.path.join(_hf_hub_dir(), f"models--{repo_id.replace('/', '--')}")
    snapshots_dir = os.path.join(repo_dir, "snapshots")
    if not os.path.isdir(snapshots_dir):
        return False
    try:
        return any(os.path.isdir(os.path.join(snapshots_dir, entry)) for entry in os.listdir(snapshots_dir))
    except OSError:
        return False


def _is_whisper_cached(model_name="small"):
    candidates = []
    if fw_utils is not None:
        repo_id = getattr(fw_utils, "_MODELS", {}).get(model_name)
        if repo_id:
            candidates.append(repo_id)
    candidates.append(f"Systran/faster-whisper-{model_name}")
    if "turbo" in model_name:
        candidates.append("mobiuslabsgmbh/faster-whisper-large-v3-turbo")
    return any(_is_hf_repo_cached(repo) for repo in candidates)


def _is_moonshine_cached():
    return _is_hf_repo_cached("UsefulSensors/moonshine")


def _normalize_whisper_size(stt_model=""):
    s = str(stt_model or "").strip().lower()
    if s in ("whisper-large-v3-turbo", "large-v3-turbo", "turbo"):
        return "large-v3-turbo"
    if s in ("whisper-small", "small"):
        return "small"
    if s in ("whisper-base", "base"):
        return "base"
    return ""


def _ensure_whisper_cls():
    global WhisperModel, fw_utils
    if WhisperModel is not None:
        return WhisperModel
    with _import_lock:
        if WhisperModel is not None:
            return WhisperModel
        _ensure_numpy()
        try:
            from faster_whisper import WhisperModel as _WM
            from faster_whisper import utils as _fwu
            WhisperModel = _WM
            fw_utils = _fwu
        except ImportError:
            WhisperModel = None
            fw_utils = None
    return WhisperModel


def _ensure_piper_cls():
    global PiperVoice, SynthesisConfig
    if PiperVoice is not None and SynthesisConfig is not None:
        return PiperVoice, SynthesisConfig
    with _import_lock:
        if PiperVoice is not None and SynthesisConfig is not None:
            return PiperVoice, SynthesisConfig
        _ensure_numpy()
        try:
            from piper import PiperVoice as _PV, SynthesisConfig as _SC
            PiperVoice = _PV
            SynthesisConfig = _SC
        except ImportError:
            PiperVoice = None
            SynthesisConfig = None
    return PiperVoice, SynthesisConfig


def _ensure_kokoro_cls():
    global Kokoro
    if Kokoro is not None:
        return Kokoro
    with _import_lock:
        if Kokoro is not None:
            return Kokoro
        _ensure_numpy()
        try:
            from kokoro_onnx import Kokoro as _Kokoro
            Kokoro = _Kokoro
        except ImportError:
            Kokoro = None
    return Kokoro


def _ensure_moonshine_cls():
    global moonshine_onnx, MoonshineOnnxModel
    if MoonshineOnnxModel is not None and moonshine_onnx is not None:
        return MoonshineOnnxModel, moonshine_onnx
    with _import_lock:
        if MoonshineOnnxModel is not None and moonshine_onnx is not None:
            return MoonshineOnnxModel, moonshine_onnx
        _ensure_numpy()
        try:
            import moonshine_onnx as _mo
            from moonshine_onnx import MoonshineOnnxModel as _MOM
            moonshine_onnx = _mo
            MoonshineOnnxModel = _MOM
        except ImportError:
            moonshine_onnx = None
            MoonshineOnnxModel = None
    return MoonshineOnnxModel, moonshine_onnx


def get_whisper_model(requested_size=""):
    global _whisper_model, _whisper_model_name
    wm_cls = _ensure_whisper_cls()
    if wm_cls is None:
        return None

    desired = _normalize_whisper_size(requested_size)
    with _whisper_lock:
        if _whisper_model is not None:
            if not desired or _whisper_model_name == desired:
                return _whisper_model
            # Evict previous model before loading a different size to keep RAM footprint bounded
            _whisper_model = None
            _whisper_model_name = None
            gc.collect()

        candidates = []
        if desired:
            candidates.append((desired, True))
            candidates.append((desired, False))
        for fb in ("small", "base", "large-v3-turbo"):
            if fb != desired:
                candidates.append((fb, True))
        if not desired:
            candidates.append(("small", False))
            candidates.append(("base", False))

        for size, local_only in candidates:
            try:
                _whisper_model = wm_cls(size, device="cpu", compute_type="int8", local_files_only=local_only)
                _whisper_model_name = size
                return _whisper_model
            except Exception:
                continue
        return None


def _resolve_piper_paths():
    found = {}
    for persona_id, (filename, _label) in PIPER_VOICE_MAP.items():
        for folder in (PIPER_DIR, LEGACY_VOICES_DIR):
            p = os.path.join(folder, filename)
            if os.path.isfile(p) and os.path.getsize(p) > 100000:
                found[persona_id] = p
                break
    return found


def get_piper_voice(persona="Piper-DFKI"):
    pv_cls, _sc = _ensure_piper_cls()
    if pv_cls is None:
        return None, persona
    key = persona if persona in PIPER_VOICE_MAP else "Piper-DFKI"
    if key in _piper_voices:
        return _piper_voices[key], key

    paths = _resolve_piper_paths()
    model_path = paths.get(key) or paths.get("Piper-DFKI")
    if not model_path:
        return None, key

    actual_key = key if key in paths else "Piper-DFKI"
    with _piper_lock:
        if actual_key in _piper_voices:
            return _piper_voices[actual_key], actual_key
        pv = pv_cls.load(model_path)
        _piper_voices[actual_key] = pv
        return pv, actual_key


def get_kokoro_engine():
    global _kokoro_engine
    if _kokoro_engine is not None:
        return _kokoro_engine
    k_cls = _ensure_kokoro_cls()
    if k_cls is None or not os.path.isfile(KOKORO_MODEL_PATH) or not os.path.isfile(KOKORO_VOICES_PATH):
        return None
    with _kokoro_lock:
        if _kokoro_engine is None:
            _kokoro_engine = k_cls(KOKORO_MODEL_PATH, KOKORO_VOICES_PATH)
        return _kokoro_engine


def get_moonshine_model():
    global _moonshine_model, _moonshine_tokenizer
    if _moonshine_model is not None and _moonshine_tokenizer is not None:
        return _moonshine_model, _moonshine_tokenizer
    mom_cls, mo_mod = _ensure_moonshine_cls()
    if mom_cls is None or mo_mod is None:
        return None, None
    with _moonshine_lock:
        if _moonshine_model is None or _moonshine_tokenizer is None:
            _moonshine_model = mom_cls(model_name="base")
            _moonshine_tokenizer = mo_mod.load_tokenizer()
        return _moonshine_model, _moonshine_tokenizer


def _stop_xtts_worker():
    global _xtts_proc
    with _xtts_lock:
        proc = _xtts_proc
        _xtts_proc = None
        if proc is None:
            return
        try:
            if proc.poll() is None and proc.stdin:
                proc.stdin.write(json.dumps({"action": "shutdown", "id": 0}) + "\n")
                proc.stdin.flush()
                proc.wait(timeout=2.0)
        except Exception:
            pass
        if proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=1.5)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass


atexit.register(_stop_xtts_worker)


def _send_xtts_request(payload, timeout=120.0):
    global _xtts_proc, _xtts_req_seq
    if not os.path.isfile(XTTS_VENV_PYTHON) or not os.path.isfile(XTTS_WORKER_SCRIPT):
        return {"success": False, "error": "XTTS-v2 sanal ortamı D:\\LuxAI_Models\\xtts_venv bulunamadı."}

    with _xtts_lock:
        for attempt in range(2):
            if _xtts_proc is None or _xtts_proc.poll() is not None:
                env = os.environ.copy()
                env["PYTHONUTF8"] = "1"
                env["PYTHONIOENCODING"] = "utf-8"
                env["COQUI_TOS_AGREED"] = "1"
                env["LUX_MODELS_DIR"] = MODELS_ROOT
                env.setdefault("HF_HOME", os.path.join(MODELS_ROOT, "huggingface"))
                env.setdefault("TTS_HOME", os.path.join(MODELS_ROOT, "coqui"))
                env.setdefault("TORCH_HOME", os.path.join(MODELS_ROOT, "torch"))

                creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
                _xtts_proc = subprocess.Popen(
                    [XTTS_VENV_PYTHON, XTTS_WORKER_SCRIPT],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    bufsize=1,
                    env=env,
                    creationflags=creationflags,
                )

            _xtts_req_seq += 1
            req_id = _xtts_req_seq
            msg = dict(payload)
            msg["id"] = req_id

            try:
                _xtts_proc.stdin.write(json.dumps(msg, ensure_ascii=False) + "\n")
                _xtts_proc.stdin.flush()

                result_box = {}

                def _read_line():
                    try:
                        line = _xtts_proc.stdout.readline()
                        result_box["line"] = line
                    except Exception as exc:
                        result_box["err"] = str(exc)

                t = threading.Thread(target=_read_line, daemon=True)
                t.start()
                t.join(timeout=timeout)
                if t.is_alive():
                    raise TimeoutError(f"XTTS-v2 worker zaman aşımına uğradı ({timeout:.0f}s)")
                if "err" in result_box:
                    raise RuntimeError(result_box["err"])
                raw_line = (result_box.get("line") or "").strip()
                if not raw_line:
                    raise EOFError("XTTS-v2 worker beklenmedik şekilde kapandı")
                return json.loads(raw_line)
            except Exception as exc:
                try:
                    if _xtts_proc and _xtts_proc.poll() is None:
                        _xtts_proc.kill()
                except Exception:
                    pass
                _xtts_proc = None
                if attempt == 0 and isinstance(exc, (BrokenPipeError, EOFError)):
                    continue
                return {"success": False, "error": f"XTTS-v2 hatası: {exc}"}

    return {"success": False, "error": "XTTS-v2 iletişim hatası."}


def _load_wav_as_float32_16k(wav_source):
    np_mod = _ensure_numpy()
    if np_mod is None:
        return wav_source
    samples = None
    framerate = 16000
    is_bytes = isinstance(wav_source, (bytes, bytearray))
    try:
        src_obj = io.BytesIO(wav_source) if is_bytes else wav_source
        with wave.open(src_obj, "rb") as wf:
            channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            nframes = wf.getnframes()
            raw = wf.readframes(nframes)

        if not raw:
            return np_mod.zeros(0, dtype=np_mod.float32)

        if sampwidth == 1:
            samples = (np_mod.frombuffer(raw, dtype=np_mod.uint8).astype(np_mod.float32) - 128.0) / 128.0
        elif sampwidth == 2:
            samples = np_mod.frombuffer(raw, dtype=np_mod.int16).astype(np_mod.float32) / 32768.0
        elif sampwidth == 4:
            samples = np_mod.frombuffer(raw, dtype=np_mod.int32).astype(np_mod.float32) / 2147483648.0
        elif sampwidth == 3:
            raw_u8 = np_mod.frombuffer(raw, dtype=np_mod.uint8).reshape(-1, 3)
            raw_i32 = (
                raw_u8[:, 0].astype(np_mod.int32)
                | (raw_u8[:, 1].astype(np_mod.int32) << 8)
                | (raw_u8[:, 2].astype(np_mod.int32) << 16)
            )
            raw_i32 = np_mod.where(raw_i32 & 0x800000, raw_i32 - 0x1000000, raw_i32)
            samples = raw_i32.astype(np_mod.float32) / 8388608.0
        else:
            samples = None

        if samples is not None and channels > 1:
            samples = samples.reshape(-1, channels).mean(axis=1)
    except Exception:
        samples = None

    if samples is None:
        sf_mod = _ensure_soundfile()
        if sf_mod is not None:
            try:
                sf_src = io.BytesIO(wav_source) if is_bytes else wav_source
                sf_data, sf_sr = sf_mod.read(sf_src, dtype="float32", always_2d=False)
                if getattr(sf_data, "ndim", 1) > 1:
                    sf_data = sf_data.mean(axis=1)
                samples = np_mod.asarray(sf_data, dtype=np_mod.float32)
                framerate = int(sf_sr or 16000)
            except Exception:
                samples = None

    if samples is None:
        return wav_source

    if samples.size == 0:
        return np_mod.zeros(0, dtype=np_mod.float32)

    if framerate != 16000 and len(samples) > 1:
        target_len = int(round(len(samples) * 16000.0 / float(framerate)))
        if target_len > 0:
            x_old = np_mod.linspace(0.0, 1.0, num=len(samples), endpoint=False)
            x_new = np_mod.linspace(0.0, 1.0, num=target_len, endpoint=False)
            samples = np_mod.interp(x_new, x_old, samples).astype(np_mod.float32)

    return np_mod.ascontiguousarray(samples, dtype=np_mod.float32)


def _preprocess_samples_16k(samples):
    np_mod = _ensure_numpy()
    if np_mod is None or not isinstance(samples, np_mod.ndarray):
        return samples, {"has_signal": True, "rms": 0.05, "peak": 0.2}
    if samples.size == 0:
        return samples, {"has_signal": False, "rms": 0.0, "peak": 0.0}

    cleaned = samples.astype(np_mod.float32) - float(np_mod.mean(samples))
    peak = float(np_mod.max(np_mod.abs(cleaned)))
    rms = float(np_mod.sqrt(np_mod.mean(cleaned * cleaned)))

    if peak < 0.0020 or (rms < 0.00045 and peak < 0.0035):
        return np_mod.zeros(0, dtype=np_mod.float32), {"has_signal": False, "rms": rms, "peak": peak}

    if 0.0020 <= peak < 0.38:
        gain = min(45.0, 0.55 / peak)
        cleaned = np_mod.clip(cleaned * gain, -0.95, 0.95)

    pad_sec = 0.35 if len(cleaned) < 16000 else 0.24
    pad = np_mod.zeros(int(16000 * pad_sec), dtype=np_mod.float32)
    padded = np_mod.ascontiguousarray(np_mod.concatenate([pad, cleaned, pad]), dtype=np_mod.float32)
    return padded, {"has_signal": True, "rms": rms, "peak": peak}


def _write_pcm16_wav(samples_f32, out_path, sample_rate=16000):
    np_mod = _ensure_numpy()
    pcm = np_mod.clip(samples_f32 * 32767.0, -32768.0, 32767.0).astype(np_mod.int16)
    with wave.open(out_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())


_HALLUCINATION_FRAGMENTS = (
    "altyazı m.k",
    "altyazı mk",
    "altyazı:",
    "çeviri:",
    "abone olmayı",
    "abone ol",
    "kanala abone",
    "youtube kanalıma",
    "videoyu beğ",
    "yorum yapmayı",
    "bildirimleri aç",
    "izlediğiniz için teşekkür",
    "bir sonraki videoda",
    "paylaşmayı unutmayın",
    "beğenmeyi unutmayın",
    "thank you for watching",
    "thanks for watching",
    "subscribe to my channel",
    "subtitles by",
    "transcribed by",
    "amara.org",
)


def _tr_lower(text):
    return str(text or "").replace("I", "ı").replace("İ", "i").lower()


def _extract_whisper_text(segments, audio_stats, fallback_pass=False):
    parts = []
    for seg in segments:
        txt = (seg.text or "").strip()
        if not txt:
            continue
        no_speech = getattr(seg, "no_speech_prob", 0.0) or 0.0
        avg_lp = getattr(seg, "avg_logprob", 0.0) or 0.0
        comp_ratio = getattr(seg, "compression_ratio", 1.0) or 1.0
        if no_speech > 0.78 and avg_lp < -1.1:
            continue
        if fallback_pass and (no_speech > 0.30 or avg_lp < -0.78):
            continue
        if comp_ratio > 2.6:
            continue
        lower_txt = _tr_lower(txt)
        if any(h in lower_txt for h in _HALLUCINATION_FRAGMENTS):
            continue
        parts.append(txt)
    return " ".join(parts).strip()


_LUX_PHONETIC_RE = None


def _normalize_tr_transcript(text, lang="tr"):
    global _LUX_PHONETIC_RE
    cleaned = (text or "").strip()
    if not cleaned or not str(lang).lower().startswith("tr"):
        return cleaned
    if _LUX_PHONETIC_RE is None:
        _LUX_PHONETIC_RE = re.compile(
            r"\b(?:lax\s*al[ıiuü]|laxall[ıiuü]|laks\s*al[ıiuü]|laksall[ıiuü]|lux\s*al[ıiuü]|luxall[ıiuü]|lax\s*sağlığı|laks\s*sağlığı)\b",
            re.IGNORECASE,
        )
    return _LUX_PHONETIC_RE.sub("Lux AI", cleaned)


def transcribe_offline(wav_source, lang="tr-TR", stt_model=""):
    np_mod = _ensure_numpy()
    requested_size = _normalize_whisper_size(stt_model)
    with _whisper_lock:
        model = get_whisper_model(requested_size)
        if model is None:
            return {
                "success": False,
                "error": "Çevrimdışı Whisper motoru (faster-whisper) yüklü değil.",
                "text": "",
                "engine": "unavailable",
            }
        active_name = _whisper_model_name or "small"
        whisper_lang = "tr" if str(lang).lower().startswith("tr") else "en"
        raw_samples = _load_wav_as_float32_16k(wav_source)
        if np_mod is not None and isinstance(raw_samples, np_mod.ndarray) and raw_samples.size < 1600:
            return {"success": True, "text": "", "hasSignal": False, "engine": f"faster-whisper-{active_name}"}

        audio_input, stats = _preprocess_samples_16k(raw_samples)
        if not stats.get("has_signal", True):
            return {"success": True, "text": "", "hasSignal": False, "engine": f"faster-whisper-{active_name}"}

        tr_prompt = (
            "Dur, durdur, sus, kes, iptal et, bekle, masaüstüne klasör oluştur, dosya yaz, aç, kapat, hafızayı sıfırla, Lux AI, evet, hayır, tamam, nasılsın."
            if whisper_lang == "tr"
            else "Stop, cancel, pause, create folder on desktop, write file, open, close, wipe memory."
        )
        is_quiet_mic = stats.get("peak", 1.0) < 0.03

        segments, _info = model.transcribe(
            audio_input,
            language=whisper_lang,
            beam_size=1,
            best_of=1,
            temperature=0.0,
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters={
                "threshold": 0.22 if is_quiet_mic else 0.28,
                "min_speech_duration_ms": 100 if is_quiet_mic else 140,
                "min_silence_duration_ms": 420,
                "speech_pad_ms": 220,
            },
            initial_prompt=tr_prompt,
        )
        text = _extract_whisper_text(segments, stats)

        if not text and (stats.get("rms", 0.0) >= 0.004 or stats.get("peak", 0.0) >= 0.025):
            segments2, _info2 = model.transcribe(
                audio_input,
                language=whisper_lang,
                beam_size=1,
                best_of=1,
                temperature=0.0,
                condition_on_previous_text=False,
                vad_filter=False,
                initial_prompt=tr_prompt,
            )
            text = _extract_whisper_text(segments2, stats, fallback_pass=True)

        text = _normalize_tr_transcript(text, whisper_lang)
        return {"success": True, "text": text, "hasSignal": True, "engine": f"faster-whisper-{active_name}"}


def transcribe_moonshine(wav_source, lang="en-US"):
    np_mod = _ensure_numpy()
    with _moonshine_lock:
        m, tok = get_moonshine_model()
        if m is None or tok is None or np_mod is None:
            return {
                "success": False,
                "error": "Moonshine Base ONNX motoru yüklü değil.",
                "text": "",
                "engine": "unavailable",
            }

        raw_samples = _load_wav_as_float32_16k(wav_source)
        if not isinstance(raw_samples, np_mod.ndarray) or raw_samples.size < 1600:
            return {"success": True, "text": "", "hasSignal": False, "engine": "moonshine-base-onnx"}

        audio_input, stats = _preprocess_samples_16k(raw_samples)
        if not stats.get("has_signal", True):
            return {"success": True, "text": "", "hasSignal": False, "engine": "moonshine-base-onnx"}

        # Moonshine ONNX enforces 0.1s < duration < 64s per generate() call
        min_samples = 2400
        if audio_input.size < min_samples:
            audio_input = np_mod.pad(audio_input, (0, min_samples - audio_input.size), mode="constant")

        chunk_size = 16000 * 58
        texts = []
        for start in range(0, audio_input.size, chunk_size):
            chunk = audio_input[start:start + chunk_size]
            if chunk.size < min_samples:
                chunk = np_mod.pad(chunk, (0, min_samples - chunk.size), mode="constant")
            tokens = m.generate(np_mod.ascontiguousarray(chunk[None, ...], dtype=np_mod.float32))
            decoded = tok.decode_batch(tokens)
            if decoded and decoded[0]:
                texts.append(decoded[0].strip())

        text = _normalize_tr_transcript(" ".join(texts).strip(), lang)
        return {"success": True, "text": text, "hasSignal": True, "engine": "moonshine-base-onnx"}


def transcribe_online(wav_source, lang="tr-TR"):
    sr_mod, rec = _ensure_recognizer()
    np_mod = _ensure_numpy()
    if sr_mod is None or rec is None:
        raise RuntimeError("speech_recognition modülü yüklü değil.")

    prepared_source = wav_source
    if np_mod is not None:
        raw_samples = _load_wav_as_float32_16k(wav_source)
        if isinstance(raw_samples, np_mod.ndarray):
            padded, stats = _preprocess_samples_16k(raw_samples)
            if not stats.get("has_signal", True):
                return {"success": True, "text": "", "hasSignal": False, "engine": "google-cloud"}
            buf = io.BytesIO()
            _write_pcm16_wav(padded, buf, 16000)
            buf.seek(0)
            prepared_source = buf
    elif isinstance(wav_source, (bytes, bytearray)):
        prepared_source = io.BytesIO(wav_source)

    with sr_mod.AudioFile(prepared_source) as source:
        rec.energy_threshold = 200
        audio = rec.record(source)
    try:
        text = rec.recognize_google(audio, language=lang)
        return {
            "success": True,
            "text": _normalize_tr_transcript(text, lang),
            "hasSignal": True,
            "engine": "google-cloud",
        }
    except sr_mod.UnknownValueError:
        return {"success": True, "text": "", "hasSignal": True, "engine": "google-cloud"}


def transcribe_audio(wav_path=None, lang="tr-TR", mode="auto", stt_model="", wav_base64=""):
    wav_source = None
    if wav_base64:
        try:
            clean_b64 = str(wav_base64).split(",", 1)[-1].strip()
            wav_source = base64.b64decode(clean_b64)
        except Exception as dec_err:
            return {"success": False, "error": f"Invalid wavBase64: {dec_err}", "text": ""}
    elif wav_path and os.path.exists(wav_path):
        wav_source = wav_path
    else:
        return {"success": False, "error": f"File not found: {wav_path}", "text": ""}

    req_mode = (mode or "auto").lower()
    req_stt = (stt_model or "").strip().lower()
    whisper_avail = _whisper_model is not None or _has_module("faster_whisper")
    online_avail = recognizer is not None or _has_module("speech_recognition")

    # 1. Explicit Moonshine Base ONNX selection (Seçenek C)
    if req_stt in ("moonshine-base", "moonshine"):
        if req_mode == "online":
            try:
                return transcribe_online(wav_source, lang)
            except Exception as e:
                return {"success": False, "error": f"Çevrimiçi STT hatası: {e}", "text": "", "engine": "google-cloud"}
        try:
            ms_res = transcribe_moonshine(wav_source, lang)
            if ms_res.get("success"):
                if (ms_res.get("text") or "").strip() or ms_res.get("hasSignal") is False or req_mode == "offline":
                    return ms_res
            # Empty despite signal in auto mode -> try local Whisper
            if whisper_avail:
                fb = transcribe_offline(wav_source, lang, "small")
                if fb.get("success") and (fb.get("text") or "").strip():
                    fb["fallbackFrom"] = "moonshine-empty"
                    return fb
            return ms_res
        except Exception as ms_err:
            if req_mode == "offline":
                return transcribe_offline(wav_source, lang, "small")
            try:
                fb = transcribe_offline(wav_source, lang, "small")
                fb["fallbackFrom"] = str(ms_err)
                return fb
            except Exception:
                return {"success": False, "error": f"Moonshine STT hatası: {ms_err}", "text": ""}

    # 2. Explicit Google Cloud selection
    if req_stt == "google-cloud":
        if req_mode == "offline":
            try:
                return transcribe_offline(wav_source, lang, "small")
            except Exception as e:
                return {"success": False, "error": f"Çevrimdışı STT hatası: {e}", "text": "", "engine": "faster-whisper-offline"}
        try:
            on_res = transcribe_online(wav_source, lang)
            if on_res.get("success") and ((on_res.get("text") or "").strip() or on_res.get("hasSignal") is False or req_mode == "online"):
                return on_res
            if whisper_avail:
                fb = transcribe_offline(wav_source, lang, "small")
                if fb.get("success") and (fb.get("text") or "").strip():
                    return fb
            return on_res
        except Exception as online_err:
            if req_mode == "online":
                return {"success": False, "error": f"Çevrimiçi STT hatası: {online_err}", "text": "", "engine": "google-cloud"}
            fb = transcribe_offline(wav_source, lang, "small")
            fb["fallbackFrom"] = str(online_err)
            return fb

    # 3. Whisper models (explicit small / base / large-v3-turbo OR auto)
    explicit_whisper = _normalize_whisper_size(req_stt)

    if req_mode == "offline":
        try:
            return transcribe_offline(wav_source, lang, explicit_whisper)
        except Exception as e:
            return {"success": False, "error": f"Çevrimdışı STT hatası: {e}", "text": "", "engine": "faster-whisper-offline"}

    if req_mode == "online":
        try:
            return transcribe_online(wav_source, lang)
        except Exception as e:
            return {"success": False, "error": f"Çevrimiçi STT hatası: {e}", "text": "", "engine": "google-cloud"}

    has_local_whisper = whisper_avail and (
        bool(explicit_whisper)
        or _whisper_model is not None
        or _is_whisper_cached("small")
        or _is_whisper_cached("large-v3-turbo")
        or _is_whisper_cached("base")
    )
    if has_local_whisper:
        try:
            off_res = transcribe_offline(wav_source, lang, explicit_whisper)
            if off_res.get("success"):
                if (off_res.get("text") or "").strip() or off_res.get("hasSignal") is False:
                    return off_res
            if online_avail and off_res.get("hasSignal", True):
                try:
                    on_res = transcribe_online(wav_source, lang)
                    if on_res.get("success") and (on_res.get("text") or "").strip():
                        return on_res
                except Exception:
                    pass
            return off_res
        except Exception as off_err:
            if online_avail:
                try:
                    on_res = transcribe_online(wav_source, lang)
                    on_res["fallbackFrom"] = str(off_err)
                    return on_res
                except Exception as on_err:
                    return {"success": False, "error": f"STT hatası (Yerel: {off_err}, Bulut: {on_err})", "text": ""}
            return {"success": False, "error": f"STT hatası: {off_err}", "text": ""}

    try:
        return transcribe_online(wav_source, lang)
    except Exception as online_err:
        try:
            res = transcribe_offline(wav_source, lang, explicit_whisper)
            res["fallbackFrom"] = str(online_err)
            return res
        except Exception as off_err:
            return {"success": False, "error": f"STT hatası (Çevrimiçi: {online_err}, Çevrimdışı: {off_err})", "text": ""}


_TTS_EMOJI_RE = re.compile(
    r"(?:[0-9#*]\ufe0f?\u20e3|"
    r"[\U0001F1E6-\U0001F1FF]{2}|"
    r"[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U00002300-\U000023FF\U000025A0-\U000025FF\U00002B00-\U00002BFF\U00002190-\U000021FF]|"
    r"[\u200d\ufe0e\ufe0f\U0001F3FB-\U0001F3FF\u00a9\u00ae\u2122•●▪▫▸▹◆◇★☆✓✔✕✖✗✘])"
)
_TTS_EMOTICON_RE = re.compile(
    r"(^|[\s(\[{\"'“‘])(?:[:;=8]['’`]?[-o*^]?[)(DPpOo3\\/|*><]+|[xX][-o*']?[DPp)(]+|</?3|\^\^|>_<|\^_+\^|-_+-|[Tt]_[Tt]|[Oo]_[Oo])(?=$|[\s.,!?)\]}\"'”’])"
)


def _clean_tts_text(text):
    if not text:
        return ""
    cleaned = _TTS_EMOJI_RE.sub(" ", str(text))
    cleaned = _TTS_EMOTICON_RE.sub(r"\1", cleaned)
    cleaned = re.sub(r"\s*(?:<-+|-+>|=+>|<=+)\s*", " ", cleaned)
    cleaned = re.sub(r"\s+([.!?,;:])", r"\1", cleaned)
    cleaned = re.sub(r"([.!?])\1{2,}", r"\1", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    cleaned = re.sub(r"^[.!?,;:\s-]+", "", cleaned)
    return cleaned.strip()


def _ensure_wav_out(out_path, prefix="lux_tts_"):
    if not out_path:
        fd, p = tempfile.mkstemp(prefix=prefix, suffix=".wav")
        os.close(fd)
        return p
    if out_path.lower().endswith(".mp3"):
        return out_path[:-4] + ".wav"
    if not out_path.lower().endswith(".wav"):
        return out_path + ".wav"
    return out_path


def _ensure_ext_out(out_path, ext=".mp3", prefix="lux_tts_"):
    ext_norm = ext if ext.startswith(".") else f".{ext}"
    if not out_path:
        fd, p = tempfile.mkstemp(prefix=prefix, suffix=ext_norm)
        os.close(fd)
        return p
    root, cur_ext = os.path.splitext(out_path)
    if cur_ext.lower() in (".mp3", ".wav", ".ogg", ".flac", ".aac", ".pcm"):
        return root + ext_norm
    return out_path + ext_norm


def _resolve_openrouter_voice_spec(voice_key):
    key = str(voice_key or "").strip()
    if not key:
        return None
    if key in OPENROUTER_SPEECH_VOICES:
        return OPENROUTER_SPEECH_VOICES[key]
    lower = key.lower()
    for reg_key, spec in OPENROUTER_SPEECH_VOICES.items():
        if reg_key.lower() == lower or str(spec.get("model") or "").lower() == lower:
            return spec
    if lower.startswith("openrouter-heygen-"):
        hg_voice = lower.split("openrouter-heygen-", 1)[1].strip()
        if hg_voice:
            return {
                "model": "heygen/heygen-voice-1-turbo:free",
                "voice": hg_voice,
                "response_format": "pcm",
                "max_chars": 4800,
                "label": f"HeyGen Voice Turbo · {hg_voice.capitalize()} (OpenRouter :free)",
                "engine": "openrouter-heygen",
            }
    return None


def _is_openrouter_voice(voice_key):
    return _resolve_openrouter_voice_spec(voice_key) is not None


def _encode_clone_reference_data_uri(clone_ref_path=""):
    cand = (clone_ref_path or "").strip()
    if not cand or not os.path.isfile(cand):
        cand = DEFAULT_CLONE_WAV if os.path.isfile(DEFAULT_CLONE_WAV) else ""
    if not cand or not os.path.isfile(cand):
        return None
    try:
        if os.path.getsize(cand) > 4 * 1024 * 1024:
            return None
        with open(cand, "rb") as fh:
            raw = fh.read()
        if not raw:
            return None
        mime, _ = mimetypes.guess_type(cand)
        if not mime or not mime.startswith("audio/"):
            mime = "audio/wav" if cand.lower().endswith(".wav") else "audio/mpeg"
        b64 = base64.b64encode(raw).decode("ascii")
        return f"data:{mime};base64,{b64}"
    except Exception:
        return None


def _clip_tts_chars(text, max_chars=0):
    if not max_chars or len(text) <= max_chars:
        return text
    sub = text[:max_chars]
    last_punct = max(sub.rfind("."), sub.rfind("!"), sub.rfind("?"), sub.rfind(" "))
    if last_punct > max_chars // 2:
        sub = sub[:last_punct + 1]
    return sub.strip()


def _parse_openrouter_http_error(exc):
    code = getattr(exc, "code", 0)
    detail = ""
    try:
        raw_body = exc.read().decode("utf-8", errors="replace").strip()
        if raw_body:
            try:
                parsed = json.loads(raw_body)
                detail = str(parsed.get("error", {}).get("message") or parsed.get("message") or raw_body)
            except Exception:
                detail = raw_body
    except Exception:
        detail = str(exc)
    detail_short = (detail or str(exc))[:220]
    if code == 401:
        return f"OpenRouter API anahtarı geçersiz veya yetkisiz (401): {detail_short}"
    if code == 402:
        return f"OpenRouter hesap bakiyesi yetersiz (402): {detail_short}"
    if code == 429:
        return f"OpenRouter :free kullanım limiti doldu (429): {detail_short}"
    return f"OpenRouter HTTP {code}: {detail_short}"


def synthesize_offline_piper(text, persona="Piper-DFKI", rate=1.0, out_path=None, return_base64=False):
    text = _clean_tts_text(text)
    if not text:
        return {"success": False, "error": "Empty text after emoji cleanup"}

    with _piper_lock:
        pv, actual_key = get_piper_voice(persona)
        if pv is None or SynthesisConfig is None:
            return {"success": False, "error": f"Çevrimdışı Piper Türkçe ses modeli ({actual_key}) bulunamadı."}

        profile = PERSONA_PROFILES.get(persona, {"rate_offset": 0})
        base_rate_offset = profile.get("rate_offset", 0)
        effective_speed = max(0.65, min(1.8, float(rate) * (1.0 + base_rate_offset / 100.0)))
        length_scale = max(0.55, min(1.6, 1.0 / effective_speed))
        syn_cfg = SynthesisConfig(length_scale=length_scale, normalize_audio=True, volume=1.0)

        label = PIPER_VOICE_MAP.get(actual_key, ("", actual_key))[1]
        if return_base64 or not out_path:
            buf = io.BytesIO()
            with wave.open(buf, "wb") as wav_file:
                pv.synthesize_wav(text, wav_file, syn_config=syn_cfg)
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            return {
                "success": True,
                "audioBase64": f"data:audio/wav;base64,{b64}",
                "mimeType": "audio/wav",
                "voice": f"{label} (Yerel)",
                "engine": "piper-offline",
            }

        wav_out = _ensure_wav_out(out_path, "lux_piper_")
        with wave.open(wav_out, "wb") as wav_file:
            pv.synthesize_wav(text, wav_file, syn_config=syn_cfg)

    return {
        "success": True,
        "file": wav_out,
        "mimeType": "audio/wav",
        "voice": f"{label} (Yerel)",
        "engine": "piper-offline",
    }


def synthesize_kokoro(text, persona="Kokoro-af_heart", rate=1.0, out_path=None, return_base64=False):
    text = _clean_tts_text(text)
    if not text:
        return {"success": False, "error": "Empty text after emoji cleanup"}

    sf_mod = _ensure_soundfile()
    with _kokoro_lock:
        k = get_kokoro_engine()
        if k is None or sf_mod is None:
            return {"success": False, "error": "Kokoro-82M ONNX motoru veya ses dosyaları D:\\LuxAI_Models\\kokoro içinde hazır değil."}

        kokoro_voice, label = KOKORO_VOICE_MAP.get(persona, ("af_heart", "Kokoro-82M Heart"))
        spd = max(0.6, min(1.8, float(rate or 1.0)))

        kokoro_lang = "tr" if _detect_xtts_lang(text) == "tr" else "en-us"
        try:
            samples, sr_out = k.create(text, voice=kokoro_voice, speed=spd, lang=kokoro_lang)
        except Exception:
            if kokoro_lang != "en-us":
                samples, sr_out = k.create(text, voice=kokoro_voice, speed=spd, lang="en-us")
            else:
                raise

        if return_base64 or not out_path:
            buf = io.BytesIO()
            sf_mod.write(buf, samples, sr_out, format="WAV", subtype="PCM_16")
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            return {
                "success": True,
                "audioBase64": f"data:audio/wav;base64,{b64}",
                "mimeType": "audio/wav",
                "voice": f"{label} (D:\\ CPU)",
                "engine": "kokoro-onnx",
            }

        wav_out = _ensure_wav_out(out_path, "lux_kokoro_")
        sf_mod.write(wav_out, samples, sr_out, subtype="PCM_16")

    return {
        "success": True,
        "file": wav_out,
        "mimeType": "audio/wav",
        "voice": f"{label} (D:\\ CPU)",
        "engine": "kokoro-onnx",
    }


def synthesize_xtts_clone(text, rate=1.0, out_path=None, clone_ref_path=""):
    text = _clean_tts_text(text)
    if not text:
        return {"success": False, "error": "Empty text after emoji cleanup"}

    wav_out = _ensure_wav_out(out_path, "lux_xtts_")
    lang_code = _detect_xtts_lang(text)
    resp = _send_xtts_request(
        {
            "action": "synthesize",
            "text": text,
            "speakerWav": clone_ref_path or "",
            "language": lang_code,
            "speed": float(rate or 1.0),
            "outPath": wav_out,
        },
        timeout=170.0,
    )
    return resp


def synthesize_openrouter(text, voice_key="OpenRouter-Fish-S2.1", out_path=None, api_key="", clone_ref_path="", return_base64=False):
    text = _clean_tts_text(text)
    if not text:
        return {"success": False, "error": "Empty text after emoji cleanup"}

    spec = _resolve_openrouter_voice_spec(voice_key)
    if spec is None:
        return {"success": False, "error": f"Bilinmeyen OpenRouter ses kimliği: {voice_key}", "engine": "openrouter-tts"}

    resolved_key = str(api_key or "").strip() or os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not resolved_key:
        return {
            "success": False,
            "error": "OpenRouter API anahtarı tanımlı değil. Sesli Mod ayarlarından veya Modeller sekmesinden OpenRouter API anahtarını ekle.",
            "engine": spec["engine"],
            "missingApiKey": True,
        }

    max_chars = int(spec.get("max_chars") or 0)
    text_input = _clip_tts_chars(text, max_chars) if max_chars else text
    endpoint = (os.environ.get("LUX_OPENROUTER_TTS_URL") or "").strip() or OPENROUTER_TTS_ENDPOINT

    base_payload = {
        "model": spec["model"],
        "input": text_input,
        "response_format": spec.get("response_format") or "mp3",
    }
    if spec.get("voice"):
        base_payload["voice"] = spec["voice"]

    clone_used = False
    payload = dict(base_payload)
    if spec.get("clone"):
        ref_uri = _encode_clone_reference_data_uri(clone_ref_path)
        if ref_uri:
            payload["input_references"] = [{"audio": ref_uri}]
            clone_used = True

    def _post_openrouter(req_payload):
        body_bytes = json.dumps(req_payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            endpoint,
            data=body_bytes,
            method="POST",
            headers={
                "Authorization": f"Bearer {resolved_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://lux-ai.local",
                "X-Title": "Lux AI",
                "User-Agent": "LuxAI/1.0",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            ctype = str(resp.headers.get("Content-Type") or "")
            raw = resp.read()
            return ctype, raw

    try:
        ctype, raw_bytes = _post_openrouter(payload)
    except urllib.error.HTTPError as http_err:
        err_text = _parse_openrouter_http_error(http_err)
        if clone_used and http_err.code in (400, 413, 415, 422):
            clone_used = False
            try:
                ctype, raw_bytes = _post_openrouter(base_payload)
            except urllib.error.HTTPError as retry_err:
                retry_msg = _parse_openrouter_http_error(retry_err)
                if retry_err.code in (400, 422) and not base_payload.get("voice") and "voice" in retry_msg.lower():
                    try:
                        with_default = dict(base_payload, voice="default")
                        ctype, raw_bytes = _post_openrouter(with_default)
                    except urllib.error.HTTPError as retry2_err:
                        return {"success": False, "error": _parse_openrouter_http_error(retry2_err), "engine": spec["engine"]}
                    except Exception as retry2_exc:
                        return {"success": False, "error": f"OpenRouter bağlantı hatası: {retry2_exc}", "engine": spec["engine"]}
                else:
                    return {"success": False, "error": retry_msg, "engine": spec["engine"]}
            except Exception as retry_exc:
                return {"success": False, "error": f"OpenRouter bağlantı hatası: {retry_exc}", "engine": spec["engine"]}
        elif http_err.code in (400, 422) and not payload.get("voice") and "voice" in err_text.lower():
            try:
                with_default = dict(payload, voice="default")
                ctype, raw_bytes = _post_openrouter(with_default)
            except urllib.error.HTTPError as retry_err:
                return {"success": False, "error": _parse_openrouter_http_error(retry_err), "engine": spec["engine"]}
            except Exception as retry_exc:
                return {"success": False, "error": f"OpenRouter bağlantı hatası: {retry_exc}", "engine": spec["engine"]}
        else:
            return {"success": False, "error": err_text, "engine": spec["engine"]}
    except Exception as exc:
        return {"success": False, "error": f"OpenRouter bağlantı hatası: {exc}", "engine": spec["engine"]}

    if not raw_bytes:
        return {"success": False, "error": "OpenRouter boş ses verisi döndürdü.", "engine": spec["engine"]}

    ctype_l = ctype.lower()
    if "json" in ctype_l or "text/html" in ctype_l or raw_bytes.lstrip().startswith((b"{", b"[", b"<")):
        snippet = raw_bytes.decode("utf-8", errors="replace").strip()
        try:
            parsed = json.loads(snippet)
            err_msg = str(parsed.get("error", {}).get("message") or parsed.get("message") or snippet)[:220]
        except Exception:
            err_msg = snippet[:220]
        return {"success": False, "error": f"OpenRouter ses yerine hata yanıtı döndürdü: {err_msg}", "engine": spec["engine"]}

    if len(raw_bytes) < 64:
        return {"success": False, "error": "OpenRouter eksik veya bozuk ses verisi döndürdü.", "engine": spec["engine"]}
    is_riff_wav = raw_bytes[:4] == b"RIFF" and raw_bytes[8:12] == b"WAVE"
    is_mp3 = (
        "audio/mpeg" in ctype_l
        or "audio/mp3" in ctype_l
        or raw_bytes[:3] == b"ID3"
        or (len(raw_bytes) >= 2 and raw_bytes[0] == 0xFF and (raw_bytes[1] & 0xE0) == 0xE0)
    )
    is_pcm = ("pcm" in ctype_l) or (not is_riff_wav and not is_mp3 and spec.get("response_format") == "pcm")

    if is_mp3:
        if return_base64 or not out_path:
            b64 = base64.b64encode(raw_bytes).decode("ascii")
            return {
                "success": True,
                "audioBase64": f"data:audio/mp3;base64,{b64}",
                "mimeType": "audio/mp3",
                "voice": spec["label"],
                "engine": spec["engine"],
                "cloneApplied": clone_used,
            }
        mp3_out = _ensure_ext_out(out_path, ".mp3", "lux_or_")
        with open(mp3_out, "wb") as fh:
            fh.write(raw_bytes)
        return {
            "success": True,
            "file": mp3_out,
            "mimeType": "audio/mp3",
            "voice": spec["label"],
            "engine": spec["engine"],
            "cloneApplied": clone_used,
        }

    if is_riff_wav:
        if return_base64 or not out_path:
            b64 = base64.b64encode(raw_bytes).decode("ascii")
            return {
                "success": True,
                "audioBase64": f"data:audio/wav;base64,{b64}",
                "mimeType": "audio/wav",
                "voice": spec["label"],
                "engine": spec["engine"],
                "cloneApplied": clone_used,
            }
        wav_out = _ensure_ext_out(out_path, ".wav", "lux_or_")
        with open(wav_out, "wb") as fh:
            fh.write(raw_bytes)
        return {
            "success": True,
            "file": wav_out,
            "mimeType": "audio/wav",
            "voice": spec["label"],
            "engine": spec["engine"],
            "cloneApplied": clone_used,
        }

    if is_pcm:
        rate_match = re.search(r"rate=(\d+)", ctype_l)
        ch_match = re.search(r"channels=(\d+)", ctype_l)
        sample_rate = max(8000, min(96000, int(rate_match.group(1)) if rate_match else 44100))
        channels = max(1, min(2, int(ch_match.group(1)) if ch_match else 1))
        frame_bytes = 2 * channels
        usable_len = len(raw_bytes) - (len(raw_bytes) % frame_bytes)
        pcm_frames = raw_bytes[:usable_len]
        if not pcm_frames:
            return {"success": False, "error": "OpenRouter PCM ses çerçevesi boş.", "engine": spec["engine"]}

        if return_base64 or not out_path:
            buf = io.BytesIO()
            with wave.open(buf, "wb") as wav_file:
                wav_file.setnchannels(channels)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(pcm_frames)
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            return {
                "success": True,
                "audioBase64": f"data:audio/wav;base64,{b64}",
                "mimeType": "audio/wav",
                "voice": spec["label"],
                "engine": spec["engine"],
                "cloneApplied": clone_used,
            }

        wav_out = _ensure_ext_out(out_path, ".wav", "lux_or_")
        with wave.open(wav_out, "wb") as wav_file:
            wav_file.setnchannels(channels)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(pcm_frames)

        return {
            "success": True,
            "file": wav_out,
            "mimeType": "audio/wav",
            "voice": spec["label"],
            "engine": spec["engine"],
            "cloneApplied": clone_used,
        }

    if "ogg" in ctype_l or "opus" in ctype_l or raw_bytes[:4] == b"OggS":
        if return_base64 or not out_path:
            b64 = base64.b64encode(raw_bytes).decode("ascii")
            return {
                "success": True,
                "audioBase64": f"data:audio/ogg;base64,{b64}",
                "mimeType": "audio/ogg",
                "voice": spec["label"],
                "engine": spec["engine"],
                "cloneApplied": clone_used,
            }
        ogg_out = _ensure_ext_out(out_path, ".ogg", "lux_or_")
        with open(ogg_out, "wb") as fh:
            fh.write(raw_bytes)
        return {
            "success": True,
            "file": ogg_out,
            "mimeType": "audio/ogg",
            "voice": spec["label"],
            "engine": spec["engine"],
            "cloneApplied": clone_used,
        }

    # Default fallback to WAV if unrecognized
    resolved_mime = ctype.split(";")[0].strip() or "audio/wav"
    if return_base64 or not out_path:
        b64 = base64.b64encode(raw_bytes).decode("ascii")
        return {
            "success": True,
            "audioBase64": f"data:{resolved_mime};base64,{b64}",
            "mimeType": resolved_mime,
            "voice": spec["label"],
            "engine": spec["engine"],
            "cloneApplied": clone_used,
        }
    wav_out = _ensure_ext_out(out_path, ".wav", "lux_or_")
    with open(wav_out, "wb") as fh:
        fh.write(raw_bytes)
    return {
        "success": True,
        "file": wav_out,
        "mimeType": resolved_mime,
        "voice": spec["label"],
        "engine": spec["engine"],
        "cloneApplied": clone_used,
    }


async def synthesize_speech(text, persona="Arlo", rate=1.0, out_path=None, mode="auto", clone_ref_path="", api_key="", return_base64=False):
    text = _clean_tts_text(text)
    if not text:
        return {"success": False, "error": "Empty text"}

    req_mode = (mode or "auto").lower()
    voice_key = str(persona or "Arlo").strip()
    in_mem = bool(return_base64 or not out_path)

    # 1. Explicit Piper Local Turkish Voices (Option A / B)
    if voice_key in PIPER_VOICE_MAP:
        try:
            return await asyncio.to_thread(synthesize_offline_piper, text, voice_key, rate, out_path, in_mem)
        except Exception as e:
            return {"success": False, "error": f"Piper TTS hatası: {e}", "engine": "piper-offline"}

    # 2. Explicit Kokoro-82M ONNX Voices (Option C)
    if voice_key in KOKORO_VOICE_MAP:
        try:
            return await asyncio.to_thread(synthesize_kokoro, text, voice_key, rate, out_path, in_mem)
        except Exception as kokoro_err:
            if req_mode != "online":
                try:
                    fb = await asyncio.to_thread(synthesize_offline_piper, text, "Piper-DFKI", rate, out_path, in_mem)
                    fb["fallbackFrom"] = f"Kokoro hatası: {kokoro_err}"
                    return fb
                except Exception:
                    pass
            return {"success": False, "error": f"Kokoro TTS hatası: {kokoro_err}", "engine": "kokoro-onnx"}

    # 3. Coqui XTTS-v2 Zero-Shot Voice Cloning (Option D)
    if re.search(r"xtts", voice_key, re.IGNORECASE):
        try:
            xtts_res = await asyncio.to_thread(synthesize_xtts_clone, text, rate, out_path, clone_ref_path)
            if xtts_res.get("success"):
                return xtts_res
            xtts_err = xtts_res.get("error", "XTTS-v2 sentez başarısız")
            if req_mode != "online":
                try:
                    fb = await asyncio.to_thread(synthesize_offline_piper, text, "Piper-DFKI", rate, out_path, in_mem)
                    fb["fallbackFrom"] = xtts_err
                    return fb
                except Exception:
                    pass
            return xtts_res
        except Exception as xtts_err:
            return {"success": False, "error": str(xtts_err), "engine": "coqui-xtts-v2"}

    # 3.5 OpenRouter Free Cloud TTS (Fish Audio S2.1 Pro & HeyGen Voice Turbo)
    if _is_openrouter_voice(voice_key):
        spec = _resolve_openrouter_voice_spec(voice_key)
        if req_mode == "offline":
            try:
                fb = await asyncio.to_thread(synthesize_offline_piper, text, "Piper-DFKI", rate, out_path, in_mem)
                fb["fallbackFrom"] = "Çevrimdışı mod (OpenRouter bulut sesi yerine yerel Piper kullanıldı)"
                return fb
            except Exception as e:
                return {"success": False, "error": f"Çevrimdışı TTS hatası: {e}", "engine": "piper-offline"}
        try:
            or_res = await asyncio.to_thread(synthesize_openrouter, text, voice_key, out_path, api_key, clone_ref_path, in_mem)
            if or_res.get("success"):
                return or_res
            or_err = or_res.get("error", "OpenRouter TTS sentez başarısız")
            if req_mode != "online":
                try:
                    fb = await asyncio.to_thread(synthesize_offline_piper, text, "Piper-DFKI", rate, out_path, in_mem)
                    fb["fallbackFrom"] = or_err
                    return fb
                except Exception:
                    pass
            return or_res
        except Exception as or_exc:
            if req_mode != "online":
                try:
                    fb = await asyncio.to_thread(synthesize_offline_piper, text, "Piper-DFKI", rate, out_path, in_mem)
                    fb["fallbackFrom"] = str(or_exc)
                    return fb
                except Exception:
                    pass
            return {"success": False, "error": str(or_exc), "engine": spec["engine"]}

    # 4. Cloud Edge-TTS Personas (with Piper fallback in auto/offline)
    profile = PERSONA_PROFILES.get(voice_key, PERSONA_PROFILES.get("Arlo", {
        "voice": "tr-TR-AhmetNeural",
        "pitch": "+0Hz",
        "rate_offset": 0,
    }))

    if "Neural" in voice_key:
        edge_voice = voice_key
        pitch_str = "+0Hz"
        rate_pct = int(round((rate - 1.0) * 100))
    else:
        edge_voice = profile["voice"]
        pitch_str = profile.get("pitch", "+0Hz")
        base_rate = profile.get("rate_offset", 0)
        user_rate = int(round((rate - 1.0) * 100))
        rate_pct = base_rate + user_rate

    rate_str = f"+{rate_pct}%" if rate_pct >= 0 else f"{rate_pct}%"

    if req_mode == "offline":
        try:
            return await asyncio.to_thread(synthesize_offline_piper, text, "Piper-DFKI", rate, out_path, in_mem)
        except Exception as e:
            return {"success": False, "error": f"Çevrimdışı TTS hatası: {e}", "engine": "piper-offline"}

    et_mod = await asyncio.to_thread(_ensure_edge_tts)
    if et_mod is not None:
        try:
            comm = et_mod.Communicate(text, edge_voice, pitch=pitch_str, rate=rate_str)
            if in_mem:
                async def _collect_edge_audio():
                    chunks = []
                    async for ch in comm.stream():
                        if ch.get("type") == "audio":
                            chunks.append(ch["data"])
                    return b"".join(chunks)

                raw_mp3 = await asyncio.wait_for(_collect_edge_audio(), timeout=10.0)
                if not raw_mp3 or len(raw_mp3) < 32:
                    raise RuntimeError("Edge-TTS boş ses akışı döndürdü.")
                b64 = base64.b64encode(raw_mp3).decode("ascii")
                return {
                    "success": True,
                    "audioBase64": f"data:audio/mp3;base64,{b64}",
                    "mimeType": "audio/mp3",
                    "voice": f"{voice_key} ({pitch_str}, {rate_str})",
                    "engine": "edge-tts",
                }
            if not out_path:
                fd, out_path = tempfile.mkstemp(prefix="lux_edge_", suffix=".mp3")
                os.close(fd)
            await asyncio.wait_for(comm.save(out_path), timeout=10.0)
            return {
                "success": True,
                "file": out_path,
                "mimeType": "audio/mp3",
                "voice": f"{voice_key} ({pitch_str}, {rate_str})",
                "engine": "edge-tts",
            }
        except Exception as online_err:
            if req_mode == "online":
                return {"success": False, "error": str(online_err), "engine": "edge-tts"}
            try:
                res = await asyncio.to_thread(synthesize_offline_piper, text, "Piper-DFKI", rate, out_path, in_mem)
                res["fallbackFrom"] = str(online_err)
                return res
            except Exception as off_err:
                return {"success": False, "error": f"TTS hatası (Çevrimiçi: {online_err}, Çevrimdışı: {off_err})"}
    else:
        if req_mode == "online":
            return {"success": False, "error": "edge-tts modülü yüklü değil.", "engine": "edge-tts"}
        try:
            return await asyncio.to_thread(synthesize_offline_piper, text, "Piper-DFKI", rate, out_path, in_mem)
        except Exception as off_err:
            return {"success": False, "error": str(off_err)}


def get_service_status():
    piper_paths = _resolve_piper_paths()
    turbo_cached = _is_whisper_cached("large-v3-turbo")
    small_cached = _is_whisper_cached("small")
    moonshine_ready = (_moonshine_model is not None or _has_module("moonshine_onnx")) and (_moonshine_model is not None or _is_moonshine_cached())
    kokoro_ready = (_kokoro_engine is not None or _has_module("kokoro_onnx")) and os.path.isfile(KOKORO_MODEL_PATH) and os.path.isfile(KOKORO_VOICES_PATH)
    xtts_ready = os.path.isfile(XTTS_VENV_PYTHON) and os.path.isfile(XTTS_WORKER_SCRIPT)
    whisper_avail = _whisper_model is not None or _has_module("faster_whisper")
    sr_avail = recognizer is not None or _has_module("speech_recognition")
    edge_avail = edge_tts is not None or _has_module("edge_tts")
    piper_avail = (len(_piper_voices) > 0 or _has_module("piper")) and len(piper_paths) > 0

    if _whisper_model_name == "large-v3-turbo" or turbo_cached:
        model_label = "Faster-Whisper Small & Large-v3-Turbo (D:\\)" if small_cached else "Faster-Whisper Large-v3-Turbo (D:\\)"
    elif _whisper_model_name == "small" or small_cached:
        model_label = "Faster-Whisper Small (TR/EN)"
    else:
        model_label = "Faster-Whisper Base (TR/EN)"

    return {
        "success": True,
        "python": sys.version.split()[0],
        "modelsDir": MODELS_ROOT,
        "onlineSttAvailable": sr_avail,
        "offlineSttAvailable": whisper_avail,
        "offlineSttModel": model_label,
        "whisperLoaded": _whisper_model is not None,
        "whisperLoadedModel": _whisper_model_name,
        "whisperTurboCached": turbo_cached,
        "moonshineAvailable": moonshine_ready,
        "onlineTtsAvailable": edge_avail,
        "openrouterTtsAvailable": True,
        "openrouterConfigured": bool(os.environ.get("OPENROUTER_API_KEY", "").strip()),
        "openrouterFreeModels": ["fish-audio/s2.1-pro-free:free", "heygen/heygen-voice-1-turbo:free"],
        "offlineTtsAvailable": piper_avail,
        "piperVoicesCount": len(piper_paths),
        "offlineTtsVoice": ", ".join(sorted(piper_paths.keys())) if piper_paths else "Eksik",
        "kokoroAvailable": kokoro_ready,
        "xttsAvailable": xtts_ready,
        "xttsLoaded": _xtts_proc is not None and _xtts_proc.poll() is None,
    }


def warmup_models(stt_model="", voice="", mode="auto"):
    req_stt = str(stt_model or "").strip().lower()
    req_voice = str(voice or "").strip()
    req_mode = str(mode or "auto").strip().lower()

    ms_loaded = _moonshine_model is not None
    w_loaded = _whisper_model is not None
    if req_mode == "online" or req_stt == "google-cloud":
        _ensure_recognizer()
    elif req_stt in ("moonshine-base", "moonshine"):
        try:
            m, _tok = get_moonshine_model()
            ms_loaded = m is not None
        except Exception:
            pass
    else:
        w = get_whisper_model(_normalize_whisper_size(req_stt))
        w_loaded = w is not None

    piper_loaded = len(_piper_voices) > 0
    kokoro_loaded = _kokoro_engine is not None
    xtts_loaded = _xtts_proc is not None and _xtts_proc.poll() is None

    if req_voice in PIPER_VOICE_MAP:
        pv, _ = get_piper_voice(req_voice)
        piper_loaded = pv is not None
    elif req_voice in KOKORO_VOICE_MAP:
        k = get_kokoro_engine()
        kokoro_loaded = k is not None
    elif re.search(r"xtts", req_voice, re.IGNORECASE):
        res = _send_xtts_request({"action": "warmup"}, timeout=170.0)
        xtts_loaded = bool(res.get("success") and res.get("loaded"))
    elif _is_openrouter_voice(req_voice):
        pass  # OpenRouter :free cloud voice — skip local Piper model load
    elif req_mode == "offline" or not req_voice:
        pv, _ = get_piper_voice("Piper-DFKI")
        piper_loaded = pv is not None
    else:
        # Cloud Edge-TTS persona (Fola, Arlo, Kore, ...): warm lightweight Edge-TTS module only
        _ensure_edge_tts()

    return {
        "success": True,
        "whisperLoaded": w_loaded,
        "whisperModel": _whisper_model_name if _whisper_model is not None else None,
        "moonshineLoaded": ms_loaded,
        "piperLoaded": piper_loaded,
        "kokoroLoaded": kokoro_loaded,
        "xttsLoaded": xtts_loaded,
    }


async def _dispatch_request(req):
    action = req.get("action")
    req_id = req.get("id")
    try:
        if action == "transcribe":
            wav_path = req.get("wavPath")
            wav_base64 = req.get("wavBase64", "")
            lang = req.get("lang", "tr-TR")
            mode = req.get("mode", "auto")
            stt_model = req.get("sttModel", "")
            res = await asyncio.to_thread(transcribe_audio, wav_path, lang, mode, stt_model, wav_base64)
            if req_id is not None:
                res["id"] = req_id
            _emit_json(res)

        elif action == "synthesize":
            text = req.get("text", "")
            persona = req.get("voice", "Arlo")
            rate = float(req.get("rate", 1.0))
            out_path = req.get("outPath")
            mode = req.get("mode", "auto")
            clone_ref_path = req.get("cloneRefPath", "")
            api_key = req.get("apiKey") or req.get("openrouterApiKey") or ""
            return_base64 = bool(req.get("returnBase64", False))
            res = await synthesize_speech(text, persona, rate, out_path, mode, clone_ref_path, api_key, return_base64)
            if req_id is not None:
                res["id"] = req_id
            _emit_json(res)

        elif action == "status":
            res = get_service_status()
            if req_id is not None:
                res["id"] = req_id
            _emit_json(res)

        elif action == "warmup":
            stt_model = req.get("sttModel", "")
            voice = req.get("voice", "")
            mode = req.get("mode", "auto")
            res = await asyncio.to_thread(warmup_models, stt_model, voice, mode)
            if req_id is not None:
                res["id"] = req_id
            _emit_json(res)

        elif action == "ping":
            _emit_json({"id": req_id, "pong": True})

        else:
            _emit_json({"id": req_id, "success": False, "error": f"Unknown action: {action}"})

    except Exception as e:
        err_payload = {"success": False, "error": str(e)}
        if req_id is not None:
            err_payload["id"] = req_id
        _emit_json(err_payload)


async def main_loop():
    try:
        sys.stdin.reconfigure(encoding="utf-8", errors="replace")
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    _prime_module_cache()

    loop = asyncio.get_running_loop()
    cmd_queue = asyncio.Queue()
    pending_tasks = set()
    stop_reader = threading.Event()

    def _stdin_reader():
        # On Windows anonymous pipes, blocking in ReadFile(stdin) holds the synchronous pipe lock and
        # deadlocks any DLL (e.g. numpy's OpenBLAS/gfortran runtime) calling GetFileType(STD_INPUT_HANDLE).
        # Peeking with PeekNamedPipe avoids issuing ReadFile until bytes actually exist in the pipe.
        win_pipe = None
        if os.name == "nt":
            try:
                import ctypes
                import msvcrt
                stdin_fd = sys.stdin.fileno()
                handle = msvcrt.get_osfhandle(stdin_fd)
                kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
                kernel32.GetFileType.argtypes = [ctypes.c_void_p]
                kernel32.GetFileType.restype = ctypes.c_uint32
                kernel32.PeekNamedPipe.argtypes = [
                    ctypes.c_void_p,
                    ctypes.c_void_p,
                    ctypes.c_uint32,
                    ctypes.POINTER(ctypes.c_uint32),
                    ctypes.POINTER(ctypes.c_uint32),
                    ctypes.POINTER(ctypes.c_uint32),
                ]
                kernel32.PeekNamedPipe.restype = ctypes.c_int
                if kernel32.GetFileType(ctypes.c_void_p(handle)) == 3:  # FILE_TYPE_PIPE
                    win_pipe = (ctypes, kernel32, handle, stdin_fd)
            except Exception:
                win_pipe = None

        try:
            if win_pipe is not None:
                ctypes_mod, kernel32, handle, stdin_fd = win_pipe
                avail = ctypes_mod.c_uint32(0)
                decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
                buf = ""
                idle_ticks = 0
                h_ptr = ctypes_mod.c_void_p(handle)
                while not stop_reader.is_set():
                    ok = kernel32.PeekNamedPipe(h_ptr, None, 0, None, ctypes_mod.byref(avail), None)
                    if not ok:
                        break
                    n = avail.value
                    if n > 0:
                        idle_ticks = 0
                        chunk = os.read(stdin_fd, min(n, 65536))
                        if not chunk:
                            break
                        buf += decoder.decode(chunk, False)
                        while "\n" in buf:
                            line_out, buf = buf.split("\n", 1)
                            loop.call_soon_threadsafe(cmd_queue.put_nowait, line_out + "\n")
                    else:
                        idle_ticks = min(idle_ticks + 1, 20)
                        time.sleep(0.002 if idle_ticks < 8 else 0.012)
                tail = buf + decoder.decode(b"", True)
                if tail.strip():
                    loop.call_soon_threadsafe(cmd_queue.put_nowait, tail)
            else:
                while not stop_reader.is_set():
                    raw_line = sys.stdin.readline()
                    if not raw_line:
                        break
                    loop.call_soon_threadsafe(cmd_queue.put_nowait, raw_line)
        except Exception:
            pass
        finally:
            try:
                loop.call_soon_threadsafe(cmd_queue.put_nowait, None)
            except Exception:
                pass

    reader_thread = threading.Thread(target=_stdin_reader, daemon=True)
    reader_thread.start()

    try:
        while True:
            raw_line = await cmd_queue.get()
            if raw_line is None:
                if pending_tasks:
                    await asyncio.gather(*list(pending_tasks), return_exceptions=True)
                break

            line = raw_line.strip()
            if not line:
                continue

            req_id = None
            try:
                req = json.loads(line)
                req_id = req.get("id")
            except Exception as e:
                err_payload = {"success": False, "error": str(e)}
                if req_id is not None:
                    err_payload["id"] = req_id
                _emit_json(err_payload)
                continue

            if req.get("action") == "shutdown":
                stop_reader.set()
                await asyncio.to_thread(_stop_xtts_worker)
                _emit_json({"id": req_id, "success": True, "shutdown": True})
                break

            task = asyncio.create_task(_dispatch_request(req))
            pending_tasks.add(task)
            task.add_done_callback(pending_tasks.discard)
    finally:
        stop_reader.set()
        for t in list(pending_tasks):
            t.cancel()
        _stop_xtts_worker()


if __name__ == "__main__":
    try:
        sys.stdin.reconfigure(encoding="utf-8", errors="replace")
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "status":
            print(json.dumps(get_service_status(), ensure_ascii=False))
        elif cmd == "transcribe" and len(sys.argv) >= 3:
            wav = sys.argv[2]
            lang = sys.argv[3] if len(sys.argv) > 3 else "tr-TR"
            mode = sys.argv[4] if len(sys.argv) > 4 else "auto"
            stt_model = sys.argv[5] if len(sys.argv) > 5 else ""
            res = transcribe_audio(wav, lang, mode, stt_model)
            print(json.dumps(res, ensure_ascii=False))
        elif cmd == "synthesize" and len(sys.argv) >= 6:
            text = sys.argv[2]
            voice = sys.argv[3]
            rate = float(sys.argv[4])
            out = sys.argv[5]
            mode = sys.argv[6] if len(sys.argv) > 6 else "auto"
            clone_ref = sys.argv[7] if len(sys.argv) > 7 else ""
            res = asyncio.run(synthesize_speech(text, voice, rate, out, mode, clone_ref))
            print(json.dumps(res, ensure_ascii=False))
    else:
        asyncio.run(main_loop())
