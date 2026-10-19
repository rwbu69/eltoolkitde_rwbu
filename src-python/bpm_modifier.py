import argparse
import json
import sys
import warnings

import librosa
import soundfile as sf

warnings.filterwarnings("ignore")


def modify_bpm(input_path: str, output_path: str, original_bpm: float, target_bpm: float) -> None:
    if original_bpm <= 0 or target_bpm <= 0:
        raise ValueError("Original and target BPM must be positive")
    if not 20 <= target_bpm <= 300:
        raise ValueError("Target BPM must be between 20 and 300")

    audio, sample_rate = librosa.load(input_path, sr=None, mono=False)
    if audio.size == 0:
        raise RuntimeError("Audio contains no readable samples")

    rate = target_bpm / original_bpm
    stretched = librosa.effects.time_stretch(audio, rate=rate)
    sf.write(output_path, stretched.T if stretched.ndim > 1 else stretched, sample_rate, format="WAV")


def main() -> None:
    parser = argparse.ArgumentParser(description="Pitch-preserving BPM modifier")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--original-bpm", type=float, required=True)
    parser.add_argument("--target-bpm", type=float, required=True)
    args = parser.parse_args()

    try:
        modify_bpm(args.input, args.output, args.original_bpm, args.target_bpm)
        print(json.dumps({"status": "success", "file": args.output}))
    except Exception as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
