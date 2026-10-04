import sys
import json
import argparse
import warnings
import numpy as np
import librosa
import soundfile as sf

# Suppress warnings to keep stdout clean for Tauri to parse
warnings.filterwarnings('ignore')

def warp_audio(y, sr, beat_times, target_bpm):
    # Determine the target duration per beat
    target_beat_duration = 60.0 / target_bpm
    
    # Calculate target beat times based on a rigid grid starting at beat_times[0]
    # We will preserve the initial offset
    if len(beat_times) < 2:
        return y # Not enough beats to warp

    warped_segments = []
    
    # Process audio before the first beat (leave as is)
    start_sample = 0
    first_beat_sample = int(beat_times[0] * sr)
    if first_beat_sample > 0:
        first_segment = y[start_sample:first_beat_sample]
        warped_segments.append(first_segment)
    
    # Process beat intervals
    for i in range(len(beat_times) - 1):
        segment_start = int(beat_times[i] * sr)
        segment_end = int(beat_times[i+1] * sr)
        
        segment = y[segment_start:segment_end]
        
        original_duration = beat_times[i+1] - beat_times[i]
        target_duration = target_beat_duration
        
        if original_duration <= 0 or len(segment) == 0:
            continue
            
        # For librosa.effects.time_stretch, rate > 1.0 speeds up (shortens duration)
        # If target_duration < original_duration, we need to speed up -> rate > 1.0
        # rate = original_duration / target_duration
        local_rate = original_duration / target_duration
        
        stretched = librosa.effects.time_stretch(y=segment, rate=local_rate)
        warped_segments.append(stretched)
        
    # Process the tail
    last_beat_sample = int(beat_times[-1] * sr)
    if last_beat_sample < len(y):
        tail_segment = y[last_beat_sample:]
        # Use the last known rate
        if len(beat_times) > 1:
            last_orig = beat_times[-1] - beat_times[-2]
            last_rate = last_orig / target_beat_duration
            stretched_tail = librosa.effects.time_stretch(y=tail_segment, rate=last_rate)
            warped_segments.append(stretched_tail)
        else:
            warped_segments.append(tail_segment)
            
    return np.concatenate(warped_segments)

def modify_bpm(input_path: str, output_path: str, target_bpm: float):
    # Load audio
    y, sr = librosa.load(input_path, sr=None)
    
    # 1. Detect drifting beats using Predominant Local Pulse (PLP)
    _, y_perc = librosa.effects.hpss(y)
    onset_env = librosa.onset.onset_strength(y=y_perc, sr=sr)
    
    pulse = librosa.beat.plp(onset_envelope=onset_env, sr=sr)
    beats_plp = np.flatnonzero(librosa.util.localmax(pulse))
    beat_times = librosa.frames_to_time(beats_plp, sr=sr)
    
    if len(beat_times) == 0:
        # Fallback to standard beat track if PLP fails
        _, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
        beat_times = librosa.frames_to_time(beats, sr=sr)
    
    # 2. Warp audio to rigid grid
    y_quantized = warp_audio(y, sr, beat_times, target_bpm)
    
    # 3. Save output
    sf.write(output_path, y_quantized, sr)

def main():
    parser = argparse.ArgumentParser(description="Accurately quantize audio BPM")
    parser.add_argument("--input", required=True, help="Input audio file path")
    parser.add_argument("--output", required=True, help="Output audio file path")
    parser.add_argument("--target-bpm", type=float, required=True, help="Target rigid BPM")
    
    args = parser.parse_args()
    
    try:
        modify_bpm(args.input, args.output, args.target_bpm)
        print(json.dumps({"status": "success", "file": args.output}))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
