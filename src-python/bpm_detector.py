import sys
import librosa
import warnings
import argparse

# Suppress warnings to keep stdout clean for Tauri to parse
warnings.filterwarnings('ignore')

def main():
    parser = argparse.ArgumentParser(description="Detect BPM of an audio file")
    parser.add_argument("audio_path", help="Path to the audio file")
    parser.add_argument("--min", type=float, default=0.0, help="Minimum BPM constraint")
    parser.add_argument("--max", type=float, default=0.0, help="Maximum BPM constraint")
    
    args = parser.parse_args()
    
    try:
        # Load the audio file (sr=None preserves original sampling rate, which is faster than resampling)
        y, sr = librosa.load(args.audio_path, sr=None)
        
        # Run the beat tracker
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        
        # librosa tempo can be an array in newer versions, handle that
        if isinstance(tempo, (list, tuple)):
            tempo = tempo[0]
        elif hasattr(tempo, 'item'): # numpy scalar
            tempo = tempo.item()
            
        tempo = float(tempo)
        
        # Apply constraint logic (DJ style double/halve)
        if args.min > 0 and args.max > 0 and args.min < args.max:
            # Double until it's >= min
            while tempo > 0 and tempo < args.min:
                tempo *= 2
            # Halve until it's <= max
            while tempo > 0 and tempo > args.max:
                tempo /= 2

        # Print the rounded float directly to stdout so Node.js can parse it easily
        print(round(tempo, 2))
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
