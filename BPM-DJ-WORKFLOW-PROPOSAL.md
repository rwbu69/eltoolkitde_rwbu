# BPM Feature: Accuracy-Focused Proposal

## Recommendation

Do not turn ElToolkitDeRWBU into full DJ software. Keep the existing batch media-utility workflow and borrow only the BPM-analysis ideas that improve accuracy.

The goal should be **at least 90% BPM accuracy on a defined test set**, rather than a broad claim of DJ-grade functionality.

## Proposed workflow

1. Select one or more audio files.
2. Analyze tempo and beat timing.
3. Show BPM, confidence, duration, and analysis status.
4. Allow manual BPM correction for uncertain results.
5. Let the user choose a target BPM.
6. Show the tempo ratio and expected duration.
7. Choose WAV or MP3 output and export a pitch-preserving result without overwriting the source.

For low-confidence tracks, optionally show a compact beat-marker timeline. A full waveform editor, cue-point system, deck layout, or playback mixer is not required.

## Accuracy improvements

- Calculate multiple independent tempo candidates instead of trusting one estimate.
- Explicitly test half-time and double-time interpretations.
- Score candidates using onset consistency, beat-interval stability, and agreement between algorithms.
- Analyze a stable section of the track rather than relying only on the intro.
- Skip silence where possible.
- Expose confidence and clearly flag ambiguous results.
- Preserve the selected/manual BPM in the processing step.
- Store candidates, selected BPM, confidence, duration, and analysis details per track.

## Validation standard

Create a labeled test set containing:

- Clean click tracks
- Normal drum tracks
- Sparse or melodic tracks
- Half-time and double-time examples
- Tracks with silence or long intros
- Tracks with tempo changes

Define “correct” before implementation, for example:

- Within ±1 BPM, or
- Within ±1% of the reference BPM

Report the percentage of correct results. Do not claim 90% accuracy until the result is measured against this test set.

## Processing direction

- Preserve pitch by default.
- Use the corrected original BPM when calculating the target tempo ratio.
- Write to a temporary file first.
- Use an explicit output extension and format.
- Offer WAV for lossless output and MP3 for smaller files.
- Do not overwrite source files by default.
- Report failure if the output is incomplete or unchanged.
- Keep single-pass time stretching as the initial processing method; do not quantize every beat independently by default because that can create audible artifacts.

## Benefits

- Keeps the product focused as a media utility.
- Uses DJ-style analysis concepts only where they improve detection.
- Makes half-time, double-time, and intro-detection mistakes visible.
- Gives users control over uncertain results.
- Makes the 90% target measurable.
- Avoids the cost and complexity of building a complete DJ interface.

## Trade-offs

| Benefit | Cost or risk |
|---|---|
| More accurate BPM results | Requires representative audio fixtures |
| Better handling of half-time and double-time tracks | More analysis states and user choices |
| Manual correction for uncertain tracks | Slightly longer review workflow |
| Focused utility experience | Less visual feedback than DJ software |
| More reliable exports | Higher analysis time and CPU usage |
| Measurable quality target | Accuracy varies by genre and recording quality |

## Do not implement yet

- Do not claim 90% accuracy without a defined test set and tolerance.
- Do not claim the result is accurate for every genre or variable-tempo recording.
- Do not add key detection, stems, cue points, or a full waveform editor.
- Do not hide low-confidence results behind one unquestioned BPM number.
- Do not overwrite source files automatically.

## Recommended first implementation slice

1. Define a per-track analysis model with candidate BPMs, selected BPM, confidence, and duration.
2. Build a labeled test set and measure the current detector.
3. Improve detection with independent candidates and half/double-time scoring.
4. Add clear low-confidence states and manual BPM correction.
5. Add WAV/MP3 output selection with safe temporary-file handling.
6. Add a lightweight beat-marker preview only if it helps users verify results.
7. Keep export conservative: temporary output, explicit format, no source overwrite.
8. Re-measure accuracy after each algorithm change.

## Open decisions

1. What tolerance defines “correct”: ±1 BPM, ±2 BPM, or a percentage?
2. Which genres and track types should make up the accuracy test set?
3. Should variable-tempo tracks be marked unsupported or only receive a confidence warning?
4. Is a compact beat-marker preview useful, or should the first version remain numeric-only?
5. WAV and MP3 are the initial supported output formats; should another format be added later?
