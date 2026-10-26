"""
Builds the client's sounds from one recording: "Analog Bass, Sweeps, and FX-200" by CVLTIV8R (freesound.org/s/810685,
CC0). Every sound here is a piece of that sweep, pitched, shaped and layered, so they sound like one family.

    python scripts/make-sounds.py scripts/sounds-source/analog-bass-sweeps.wav src/assets/sounds

Needs numpy, scipy and ffmpeg (with libvorbis) on the path.
"""

import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
PEAK = 0.5  # nothing is louder than half of full scale; these play over voice


def load(path):
    w = wave.open(str(path))
    raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int32).reshape(-1, w.getnchannels())
    return raw.astype(np.float64).mean(axis=1) / 2**31


def piece(x, start, end):
    return x[int(start * SR) : int(end * SR)]


def pitch(x, ratio):
    """Faster and higher (ratio > 1) or slower and lower (< 1), like a tape."""
    n = int(len(x) / ratio)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)


def fade(x, attack=0.012, release=0.06):
    x = x.copy()
    a, r = int(attack * SR), min(int(release * SR), len(x))
    x[:a] *= np.linspace(0, 1, a)
    x[len(x) - r :] *= np.linspace(1, 0, r)
    return x


def lowpass(x, hz):
    return sosfilt(butter(4, hz, "low", fs=SR, output="sos"), x)


def highpass(x, hz):
    return sosfilt(butter(2, hz, "high", fs=SR, output="sos"), x)


def echo(x, delay, decay, times=3):
    out = np.zeros(len(x) + int(delay * SR * times))
    out[: len(x)] += x
    for i in range(1, times + 1):
        at = int(delay * SR * i)
        out[at : at + len(x)] += x * decay**i
    return out


def place(parts, length):
    """Parts is [(seconds, samples)]; lays them on one timeline."""
    out = np.zeros(int(length * SR))
    for at, x in parts:
        i = int(at * SR)
        out[i : i + len(x)] += x[: max(0, len(out) - i)]
    return out


def tone(hz, length, shape=lambda t: np.exp(-t * 6)):
    t = np.arange(int(length * SR)) / SR
    return np.sin(2 * np.pi * hz * t) * shape(t)


def finish(x):
    x = x - x.mean()
    return x / max(abs(x).max(), 1e-9) * PEAK


def build(source):
    falling = piece(source, 0.0, 0.30)  # 600 Hz down to 140 Hz
    rising = piece(source, 0.58, 0.88)  # 130 Hz up to 960 Hz
    whole = piece(source, 0.0, 0.90)

    sounds = {}

    # Incoming call: two rising sweeps, an octave and a fifth up so they carry, with a bell on top. Loops every 3 s.
    sweep = fade(lowpass(pitch(rising, 1.5), 4200), 0.01, 0.12)
    bell = tone(880, 0.5) * 0.35 + tone(1320, 0.5) * 0.15
    ring = place([(0.0, sweep), (0.0, bell), (0.34, sweep * 0.9), (0.34, bell * 0.9)], 3.0)
    sounds["ring"] = echo(ring, 0.18, 0.25, 2)[: int(3.0 * SR)]

    # Outgoing call: the whole sweep, slowed and lowered, once, with a soft echo: you hear it going out, not coming in.
    calling = fade(lowpass(pitch(whole, 0.8), 3000), 0.02, 0.2)
    sounds["calling"] = place([(0.0, echo(calling, 0.25, 0.3, 2))], 3.5)

    # Accepting: a quick rise, then the same rise a fifth higher.
    up = fade(lowpass(pitch(rising, 2.2), 5000), 0.006, 0.05)
    sounds["accept"] = place([(0.0, up * 0.8), (0.12, pitch(up, 1.5))], 0.5)

    # Ending a call: the falling part, lowered a little, with a short echo.
    down = fade(lowpass(pitch(falling, 1.1), 3200), 0.006, 0.12)
    sounds["end"] = echo(down, 0.1, 0.3, 2)

    # Leaving a voice channel: the same fall, shorter and softer.
    sounds["leave"] = fade(lowpass(pitch(falling, 1.6), 2600), 0.004, 0.08) * 0.8

    # Joining: a short rise.
    sounds["join"] = fade(lowpass(pitch(rising, 2.8), 4500), 0.004, 0.04) * 0.8

    # Getting pinged: a quick blip, the opening of the sweep pitched up, with a short bell.
    blip = fade(highpass(lowpass(pitch(piece(source, 0.0, 0.12), 2.4), 5500), 200), 0.003, 0.03)
    sounds["ping"] = place([(0.0, blip), (0.0, tone(1175, 0.18, lambda t: np.exp(-t * 18)) * 0.4)], 0.3)

    return {name: finish(x) for name, x in sounds.items()}


def encode(name, x, out):
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / f"{name}.wav"
        wavfile.write(wav, SR, (x * 32767).astype(np.int16))
        target = out / f"{name}.ogg"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libvorbis", "-q:a", "4", str(target)], check=True)
        print(f"{target.name}: {len(x) / SR:.2f}s, {target.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    source_path, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, samples in build(load(source_path)).items():
        encode(name, samples, out_dir)
