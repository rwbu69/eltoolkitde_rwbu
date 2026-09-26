import sys
import json
import warnings
import argparse
import numpy as np
import librosa
from scipy.stats import lognorm

# Suppress warnings to keep stdout clean for Tauri to parse
warnings.filterwarnings('ignore')

def detect_bpm(
    path: str,
    bpm_range: tuple[float, float] = (70.0, 180.0),
    skip_intro_frac: float = 0.15,
    max_duration: float = 60.0
) -> dict:
    # 1. Fast duration check for core-sampling
    try:
        total_duration = librosa.get_duration(path=path)
        offset = total_duration * skip_intro_frac
        # Ensure we don't exceed file bounds if it's very short
        if total_duration < 10.0:
            offset = 0.0
            duration = None
        else:
            duration = min(max_duration, total_duration - offset)
            
        y, sr = librosa.load(path, sr=None, offset=offset, duration=duration)
    except Exception as e:
        raise RuntimeError(f"Audio load failed: {str(e)}")

    # 2. Isolate percussive component -> cleaner onset envelope
    _, y_perc = librosa.effects.hpss(y)

    # 3. Windowed tempo estimation over the stable region only
    onset_env = librosa.onset.onset_strength(y=y_perc, sr=sr)
    tempo_curve = librosa.feature.tempo(
        onset_envelope=onset_env, sr=sr, aggregate=None, std_bpm=4
    )
    # Drop the first quarter of *this* curve too — smooths past any residual transitions
    tempo_curve = tempo_curve[len(tempo_curve) // 4:]
    if len(tempo_curve) == 0:
        # Fallback if too short
        tempo_curve = [120.0]

    # 4. BPM-range prior
    lo, hi = bpm_range
    if lo <= 0 or hi <= 0 or lo >= hi:
        # Default fallback bounds if 'any' or invalid range passed
        lo, hi = 70.0, 180.0

    mean_bpm = (lo + hi) / 2
    prior = lognorm(s=0.5, scale=mean_bpm)

    estimate_a = float(np.median(tempo_curve))
    estimate_b, _ = librosa.beat.beat_track(
        onset_envelope=onset_env, sr=sr, prior=prior
    )
    estimate_b = float(np.atleast_1d(estimate_b)[0])

    # 5. Octave-error correction
    def fold_to_range(bpm):
        # Prevent infinite loops
        if bpm <= 0: return mean_bpm
        while bpm < lo:
            bpm *= 2
        while bpm > hi:
            bpm /= 2
        return bpm

    estimate_a = fold_to_range(estimate_a)
    estimate_b = fold_to_range(estimate_b)

    # 6. Confidence check
    diff = abs(estimate_a - estimate_b)
    if diff <= 2.0:
        confidence = "high"
        final_bpm = (estimate_a + estimate_b) / 2
    elif diff <= 6.0:
        confidence = "medium"
        final_bpm = estimate_a  # tempogram tends to be more stable globally
    else:
        confidence = "low"
        final_bpm = estimate_a

    return {
        "bpm": round(final_bpm, 2),
        "estimate_tempogram": round(estimate_a, 2),
        "estimate_dp_tracker": round(estimate_b, 2),
        "confidence": confidence,
    }

def main():
    parser = argparse.ArgumentParser(description="Detect BPM of an audio file")
    parser.add_argument("audio_path", help="Path to the audio file")
    parser.add_argument("--min", type=float, default=0.0, help="Minimum BPM constraint")
    parser.add_argument("--max", type=float, default=0.0, help="Maximum BPM constraint")
    
    args = parser.parse_args()
    
    try:
        result = detect_bpm(
            path=args.audio_path,
            bpm_range=(args.min, args.max)
        )
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
