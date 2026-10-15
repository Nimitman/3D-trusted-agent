"""
Builds the film's sound set from public-domain (CC0) recordings:
  VSCO 2 Community Edition  https://github.com/sgossner/VSCO-2-CE
  VCSL                      https://github.com/sgossner/VCSL

Picks the notes the score uses, trims each to its onset, bakes a seamless loop
into sustained notes so they can hold for any length, normalises each
instrument as a group (so soft and loud layers keep their difference), and
encodes AAC into public/sound/. Writes the manifest to src/sound/samples.ts.

  python3 scripts/build-samples.py /path/to/raw   (raw/VSCO-2-CE/..., raw/VCSL/...)

Needs numpy and soundfile (pip install numpy soundfile) and macOS afconvert.
"""
import glob
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "sound")
MANIFEST = os.path.join(ROOT, "src", "sound", "samples.ts")
SR = 44100
PRE = 0.01  # seconds kept before each onset

PCS = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def midi_of(name):
    """Both libraries name notes one octave below scientific pitch (checked by pitch detection)."""
    m = re.search(r"_([A-G]#?)(\d)_", name)
    return 12 * (int(m.group(2)) + 2) + PCS[m.group(1)]


# group: (glob patterns, kind, max seconds, mono, encode kbps)
#   kind 'loop'  sustained, with a baked loop
#   kind 'shot'  plays once
GROUPS = {
    "cello": ([r"Cello Section/.*susvib_(G1|B1|D2|F2|A2|C3|E3|G3|B3|D4)_v(1|3)_1"], "loop", 0, False, 64),
    "bass": ([r"Solo Contrabass/.*SusNV_(D1|A1)_v3"], "loop", 0, False, 64),
    "bassPizz": ([r"Solo Contrabass/.*Pizz_(G0|A#0|C1|D1|E1|F#1|A1)_v1_rr1"], "shot", 2.6, True, 48),
    "pizz": ([r"Cello Section/.*pizzT_(D2|F2|A2|C3|E3|G3|B3|D4|F4)_v(1|2)_RR1"], "shot", 2.0, True, 48),
    "viola": ([r"Viola Section/.*susvib_(C2|D2|E2|G2|B2|D3|F3|A3|C4)_v1"], "loop", 0, False, 64),
    "violin": ([r"Violin Section/.*susVib_(D3|F#3|A3|C4|E4|G4|B4|D5)_v(1|2)"], "loop", 0, False, 64),
    "horn": ([r"F Horn/.*sus_(G1|A#1|D2|F2|A2|C3)_v(2|3)"], "loop", 0, False, 64),
    "vibes": ([r"Vibraphone/Soft Mallets/.*_v1_"], "shot", 4.5, False, 64),
    "timp": ([r"Timpani.*Timpani(2|3)_Hit_v(3|4)_rr1", r"Timpani.*Timpani(2|3)_Roll_v5"], "shot", 7.0, True, 48),
    "gong": ([r"gongHit_fff"], "shot", 11.0, False, 64),
    "cresc": ([r"susCymb1-cresc-(Short|Median)"], "shot", 0, False, 64),
    "cymbal": ([r"susCymb1-hit_f_rr1"], "shot", 6.0, False, 64),
    "kick": ([r"BDrumNewhit_v(5|7)_rr1"], "shot", 3.0, True, 48),
    "frame": ([r"Frame Drum/HDrum(L|S)_(Hit_v(2|3)_rr1|HitMuted_v3_rr1)"], "shot", 1.6, True, 48),
    "darbuka": ([r"Darbuka/Darbuka_\d_hit_vl(1|2)_rr1"], "shot", 0.9, True, 48),
    "hat": ([r"HiHat_(HitC_v(1|2)_rr1|Close_rr1)"], "shot", 0.8, True, 48),
    "shaker": ([r"Mid_Shaker(Double_(Down|Up)|_Slap)_rr1"], "shot", 0.6, True, 48),
}

# Pitched groups carry a MIDI note; for the timpani it is the measured pitch of each drum.
PITCHED = {"cello", "bass", "bassPizz", "pizz", "viola", "violin", "horn", "vibes"}
TIMPANI = {"Timpani2": 35, "Timpani3": 37}


def onset(x, threshold=0.004):
    env = np.abs(x).max(axis=1) if x.ndim > 1 else np.abs(x)
    peak = env.max()
    idx = np.argmax(env > max(threshold, peak * 0.02))
    return max(0, idx - int(PRE * SR))


def bake_loop(x, a, b, xf):
    """Blend the end of [a, b) into the audio just before a, so jumping b → a is seamless."""
    y = x.copy()
    t = np.linspace(0, np.pi / 2, xf)[:, None]
    tail = y[b - xf : b]
    lead = x[a - xf : a]
    y[b - xf : b] = tail * np.cos(t) + lead * np.sin(t)
    return y[:b]


def crescendo_end(x):
    """Cymbal swells: keep up to the peak and a short ring after it."""
    env = np.abs(x).max(axis=1)
    k = 2048
    smooth = np.convolve(env, np.ones(k) / k, mode="same")
    return min(len(x), int(np.argmax(smooth)) + int(2.5 * SR))


def main(raw):
    files = [f for f in glob.glob(os.path.join(raw, "**", "*.wav"), recursive=True)]
    os.makedirs(OUT, exist_ok=True)
    for old in glob.glob(os.path.join(OUT, "*.m4a")):
        os.remove(old)
    entries = []
    total = 0
    for group, (patterns, kind, max_s, mono, kbps) in GROUPS.items():
        chosen = sorted(f for f in files if any(re.search(p, f) for p in patterns))
        if not chosen:
            sys.exit(f"no files for {group}")
        clips = []
        for f in chosen:
            x, sr = sf.read(f, always_2d=True)
            assert sr == SR, (f, sr)
            x = x[:, :2]
            x = x[onset(x) :]
            loop = None
            if kind == "loop":
                a, b, xf = int(1.4 * SR), int(3.9 * SR), int(0.6 * SR)
                x = bake_loop(x, a, b, xf)
                loop = (round(a / SR, 4), round(b / SR, 4))
            elif group == "cresc":
                x = x[: crescendo_end(x)]
            if max_s and len(x) > max_s * SR:
                x = x[: int(max_s * SR)]
            if kind == "shot":
                fade = min(len(x), int(0.25 * SR))
                x[-fade:] *= np.linspace(1, 0, fade)[:, None]
            if mono:
                x = x.mean(axis=1, keepdims=True)
            clips.append((f, x, loop))
        gain = 0.9 / max(np.abs(c[1]).max() for c in clips)
        for i, (f, x, loop) in enumerate(clips):
            name = os.path.basename(f)
            vel = re.search(r"_v[l]?(\d)", name)
            entry = {"id": f"{group}{i}", "group": group, "vel": int(vel.group(1)) if vel else 1}
            if group in PITCHED:
                entry["midi"] = midi_of(name)
            if group == "timp":
                drum = re.search(r"(Timpani\d)", name).group(1)
                entry["midi"] = TIMPANI[drum]
                entry["roll"] = "Roll" in name
            if group == "frame":
                entry["drum"] = "low" if "HDrumL" in name else "high"
                entry["muted"] = "Muted" in name
            if loop:
                entry["loop"] = loop
            with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
                sf.write(tmp.name, x * gain, SR, subtype="PCM_16")
                out = os.path.join(OUT, f"{entry['id']}.m4a")
                subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", str(kbps * 1000 * x.shape[1]), tmp.name, out], check=True)
            total += os.path.getsize(out)
            entries.append(entry)
        print(f"{group:9} {len(clips):3} files")
    write_manifest(entries)
    print(f"total {total / 1e6:.2f} MB in {len(entries)} files")


def write_manifest(entries):
    def ts(e):
        parts = []
        for k, v in e.items():
            if isinstance(v, bool):
                v = "true" if v else "false"
            elif isinstance(v, str):
                v = f"'{v}'"
            elif isinstance(v, tuple):
                v = f"[{v[0]}, {v[1]}]"
            parts.append(f"{k}: {v}")
        return "  { " + ", ".join(parts) + " },"

    lines = [
        "// Generated by scripts/build-samples.py. Do not edit by hand.",
        "// Recordings: VSCO 2 Community Edition and VCSL by Versilian Studios, CC0 (public domain).",
        "",
        "export type SampleGroup =",
        "  | " + "\n  | ".join(f"'{g}'" for g in GROUPS),
        "",
        "export type Sample = {",
        "  id: string",
        "  group: SampleGroup",
        "  /** Velocity layer: higher is louder. */",
        "  vel: number",
        "  midi?: number",
        "  /** Loop region in seconds from the onset, for sustained notes. */",
        "  loop?: [number, number]",
        "  roll?: boolean",
        "  drum?: 'low' | 'high'",
        "  muted?: boolean",
        "}",
        "",
        "export const SAMPLES: Sample[] = [",
        *[ts(e) for e in entries],
        "]",
        "",
    ]
    with open(MANIFEST, "w") as fh:
        fh.write("\n".join(lines))


if __name__ == "__main__":
    main(sys.argv[1])
