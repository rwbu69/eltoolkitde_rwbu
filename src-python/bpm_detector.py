import argparse
import json
import sys
import warnings

import librosa
import numpy as np

warnings.filterwarnings("ignore")


def _in_range(value: float, bpm_range: tuple[float, float] | None) -> bool:
    if bpm_range is None:
        return 30.0 <= value <= 300.0
    return bpm_range[0] <= value <= bpm_range[1]


def _octave_candidates(value: float) -> list[float]:
    return [value * factor for factor in (0.5, 1.0, 2.0)]


def _candidate_score(candidate: float, estimates: list[float]) -> float:
    distances = [abs(candidate - estimate) for estimate in estimates]
    agreement = sum(distance <= 1.5 for distance in distances)
    close_estimates = [distance for distance in distances if distance <= 12.0]
    proximity = max(0.0, 1.0 - (min(close_estimates) / 12.0)) if close_estimates else 0.0
    return agreement * 2.0 + proximity


def detect_bpm(
    path: str,
    bpm_range: tuple[float, float] | None = None,
    skip_intro_frac: float = 0.15,
    max_duration: float = 60.0,
) -> dict:
    try:
        total_duration = librosa.get_duration(path=path)
        offset = total_duration * skip_intro_frac if total_duration >= 10.0 else 0.0
        duration = min(max_duration, total_duration - offset) if total_duration >= 10.0 else None
        y, sr = librosa.load(path, sr=None, mono=True, offset=offset, duration=duration)
    except Exception as error:
        raise RuntimeError(f"Audio load failed: {error}") from error

    if y.size == 0 or sr <= 0 or not np.any(np.isfinite(y)) or np.max(np.abs(y)) < 1e-5:
        raise RuntimeError("Audio contains no readable, audible samples")

    _, y_perc = librosa.effects.hpss(y)
    onset_env = librosa.onset.onset_strength(y=y_perc, sr=sr)
    if onset_env.size < 8 or float(np.std(onset_env)) < 1e-4:
        raise RuntimeError("Unable to find a stable rhythmic pattern")

    tempo_curve = np.atleast_1d(
        librosa.feature.tempo(onset_envelope=onset_env, sr=sr, aggregate=None, std_bpm=4)
    ).astype(float)
    curve_estimates = [
        float(value)
        for value in tempo_curve
        if np.isfinite(value) and value > 0
    ]

    tracker_estimates: list[float] = []
    for start_bpm in (70.0, 100.0, 130.0, 160.0):
        estimate, _ = librosa.beat.beat_track(
            onset_envelope=onset_env,
            sr=sr,
            start_bpm=start_bpm,
            tightness=100,
        )
        value = float(np.atleast_1d(estimate)[0])
        if np.isfinite(value) and value > 0:
            tracker_estimates.append(value)

    interval_estimate = None
    onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
    if onset_frames.size >= 4:
        onset_times = librosa.frames_to_time(onset_frames, sr=sr)
        intervals = np.diff(onset_times)
        intervals = intervals[(intervals > 0.2) & (intervals < 2.0)]
        if intervals.size >= 3:
            interval_estimate = 60.0 / float(np.median(intervals))

    summary_estimates = []
    if curve_estimates:
        summary_estimates.append(float(np.median(curve_estimates)))
    if interval_estimate is not None and np.isfinite(interval_estimate):
        summary_estimates.extend([interval_estimate, interval_estimate])
    if tracker_estimates:
        tracker_median = float(np.median(tracker_estimates))
        summary_estimates.extend([tracker_median, tracker_median])
    raw_estimates = summary_estimates
    if not raw_estimates:
        raise RuntimeError("Unable to estimate a stable tempo")

    candidates = sorted(
        {
            round(candidate, 2)
            for estimate in raw_estimates
            for candidate in _octave_candidates(estimate)
            if _in_range(candidate, bpm_range)
        }
    )
    if not candidates:
        if bpm_range is None:
            raise RuntimeError("No BPM estimate was within the supported 30-300 BPM range")
        raise RuntimeError(
            f"No reliable BPM estimate in requested range {bpm_range[0]:g}-{bpm_range[1]:g}"
        )

    scored = sorted(
        ((candidate, _candidate_score(candidate, raw_estimates)) for candidate in candidates),
        key=lambda item: (item[1], -abs(item[0] - float(np.median(raw_estimates)))),
        reverse=True,
    )
    final_bpm, best_score = scored[0]
    octave_resolved = False
    if curve_estimates and tracker_estimates:
        curve_median = float(np.median(curve_estimates))
        tracker_median = float(np.median(tracker_estimates))
        low_estimate, high_estimate = sorted((curve_median, tracker_median))
        if 1.7 <= high_estimate / low_estimate <= 2.3:
            octave_options = [
                candidate for candidate in candidates
                if abs(candidate - high_estimate) <= 6.0
                or abs(candidate - (low_estimate * 2.0)) <= 6.0
            ]
            if octave_options:
                preferred = max(octave_options)
                final_bpm = preferred
                best_score = _candidate_score(final_bpm, raw_estimates)
                octave_resolved = True
    second_score = scored[1][1] if len(scored) > 1 else 0.0
    margin = best_score - second_score
    supporting = sum(abs(final_bpm - estimate) <= 3.0 for estimate in raw_estimates)

    if octave_resolved and supporting >= 1:
        confidence = "medium"
    elif supporting >= 3 and margin >= 1.0:
        confidence = "high"
    elif supporting >= 2 and margin >= 0.25:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "bpm": round(final_bpm, 2),
        "candidates": [
            round(candidate, 2)
            for candidate in [final_bpm, *(candidate for candidate, _ in scored if candidate != final_bpm)]
        ][:5],
        "estimate_tempogram": round(float(np.median(curve_estimates)), 2)
        if curve_estimates
        else None,
        "estimate_dp_tracker": round(float(np.median(tracker_estimates)), 2)
        if tracker_estimates
        else None,
        "confidence": confidence,
        "confidence_score": round(best_score, 2),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Detect BPM of an audio file")
    parser.add_argument("audio_path", help="Path to an audio file")
    parser.add_argument("--min", type=float, default=0.0, help="Minimum BPM constraint")
    parser.add_argument("--max", type=float, default=0.0, help="Maximum BPM constraint")
    args = parser.parse_args()

    try:
        bpm_range = None
        if args.min > 0 or args.max > 0:
            if args.min <= 0 or args.max <= args.min:
                raise ValueError("BPM range must have positive minimum and maximum values")
            bpm_range = (args.min, args.max)
        print(json.dumps(detect_bpm(args.audio_path, bpm_range=bpm_range)))
    except Exception as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
