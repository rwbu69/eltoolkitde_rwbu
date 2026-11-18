use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioMetadataDto {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<u32>,
    pub track: Option<u32>,
    pub genre: Option<String>,
    pub duration_seconds: Option<u64>,
}

#[tauri::command]
pub async fn read_audio_tags(path: String) -> Result<AudioMetadataDto, String> {
    tokio::task::spawn_blocking(move || {
        use lofty::file::{AudioFile, TaggedFileExt};
        use lofty::probe::Probe;
        use lofty::tag::Accessor;

        let tagged_file = Probe::open(&path)
            .map_err(|e| format!("Failed to open audio file: {e}"))?
            .read()
            .map_err(|e| format!("Failed to read metadata: {e}"))?;

        let properties = tagged_file.properties();
        let duration = properties.duration().as_secs();

        let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());

        if let Some(tag) = tag {
            Ok(AudioMetadataDto {
                title: tag.title().as_deref().map(str::to_string),
                artist: tag.artist().as_deref().map(str::to_string),
                album: tag.album().as_deref().map(str::to_string),
                year: tag.year(),
                track: tag.track(),
                genre: tag.genre().as_deref().map(str::to_string),
                duration_seconds: Some(duration),
            })
        } else {
            Ok(AudioMetadataDto {
                title: None,
                artist: None,
                album: None,
                year: None,
                track: None,
                genre: None,
                duration_seconds: Some(duration),
            })
        }
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub async fn write_audio_tags(path: String, tags: AudioMetadataDto) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        use lofty::config::WriteOptions;
        use lofty::file::TaggedFileExt;
        use lofty::probe::Probe;
        use lofty::tag::{Accessor, Tag, TagExt};

        let mut tagged_file = Probe::open(&path)
            .map_err(|e| format!("Failed to open audio file: {e}"))?
            .read()
            .map_err(|e| format!("Failed to read metadata: {e}"))?;

        let tag = match tagged_file.primary_tag_mut() {
            Some(primary_tag) => primary_tag,
            None => {
                let tag_type = tagged_file.primary_tag_type();
                tagged_file.insert_tag(Tag::new(tag_type));
                tagged_file
                    .primary_tag_mut()
                    .ok_or_else(|| "Could not allocate tag".to_string())?
            }
        };

        if let Some(title) = tags.title {
            tag.set_title(title);
        }
        if let Some(artist) = tags.artist {
            tag.set_artist(artist);
        }
        if let Some(album) = tags.album {
            tag.set_album(album);
        }
        if let Some(year) = tags.year {
            tag.set_year(year);
        }
        if let Some(track) = tags.track {
            tag.set_track(track);
        }
        if let Some(genre) = tags.genre {
            tag.set_genre(genre);
        }

        tag.save_to_path(&path, WriteOptions::default())
            .map_err(|e| format!("Failed to save audio tags: {e}"))?;

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BpmResultDto {
    pub bpm: f64,
    pub confidence: String,
    pub candidates: Vec<f64>,
}

fn calculate_tempo_autocorr(
    samples: &[f32],
    sample_rate: u32,
    min_bpm: f64,
    max_bpm: f64,
) -> (f64, String, Vec<f64>) {
    let window_size = 1024;
    let hop_size = 512;
    if samples.len() < window_size * 4 {
        return (120.0, "low".to_string(), vec![120.0]);
    }

    // 1. Compute RMS energy envelope
    let mut energy_env: Vec<f32> = Vec::new();
    let mut i = 0;
    while i + window_size <= samples.len() {
        let window = &samples[i..i + window_size];
        let sum_sq: f32 = window.iter().map(|&s| s * s).sum();
        let rms = (sum_sq / window_size as f32).sqrt();
        energy_env.push(rms);
        i += hop_size;
    }

    // 2. Onset strength: half-wave rectified difference
    let mut onsets: Vec<f32> = Vec::with_capacity(energy_env.len());
    onsets.push(0.0);
    for t in 1..energy_env.len() {
        let diff = energy_env[t] - energy_env[t - 1];
        onsets.push(if diff > 0.0 { diff } else { 0.0 });
    }

    let mean_onset: f32 = onsets.iter().sum::<f32>() / onsets.len() as f32;
    for val in onsets.iter_mut() {
        *val = (*val - mean_onset).max(0.0);
    }

    // 3. Autocorrelation for lags corresponding to BPM range
    let fps = sample_rate as f64 / hop_size as f64;
    let min_lag = ((60.0 * fps) / max_bpm).round().max(1.0) as usize;
    let max_lag = ((60.0 * fps) / min_bpm)
        .round()
        .min((onsets.len() / 2) as f64) as usize;

    if min_lag >= max_lag || max_lag >= onsets.len() {
        return (120.0, "low".to_string(), vec![120.0]);
    }

    let mut best_score = -1.0;
    let mut best_lag = min_lag;
    let mut scores: Vec<(f64, f64)> = Vec::new();

    for lag in min_lag..=max_lag {
        let mut corr = 0.0f64;
        let n = onsets.len() - lag;
        for t in 0..n {
            corr += (onsets[t] as f64) * (onsets[t + lag] as f64);
        }
        let norm_corr = corr / (n as f64);
        let bpm = (60.0 * fps) / (lag as f64);

        let ratio = (bpm / 120.0).ln();
        let prior = (-0.5 * ratio * ratio / (0.45 * 0.45)).exp();
        let score = norm_corr * prior;

        scores.push((bpm, score));
        if score > best_score {
            best_score = score;
            best_lag = lag;
        }
    }

    let detected_bpm = ((60.0 * fps) / (best_lag as f64) * 10.0).round() / 10.0;

    let half_bpm = (detected_bpm / 2.0 * 10.0).round() / 10.0;
    let double_bpm = (detected_bpm * 2.0 * 10.0).round() / 10.0;
    let mut candidates = vec![detected_bpm];
    if half_bpm >= min_bpm {
        candidates.push(half_bpm);
    }
    if double_bpm <= max_bpm {
        candidates.push(double_bpm);
    }

    let avg_score = if !scores.is_empty() {
        scores.iter().map(|(_, s)| *s).sum::<f64>() / scores.len() as f64
    } else {
        1.0
    };
    let ratio = if avg_score > 0.0 {
        best_score / avg_score
    } else {
        1.0
    };
    let confidence = if ratio > 2.8 {
        "high".to_string()
    } else if ratio > 1.8 {
        "medium".to_string()
    } else {
        "low".to_string()
    };

    (detected_bpm, confidence, candidates)
}

#[tauri::command]
pub async fn detect_audio_bpm(
    path: String,
    min_bpm: Option<f64>,
    max_bpm: Option<f64>,
) -> Result<BpmResultDto, String> {
    tokio::task::spawn_blocking(move || {
        use symphonia::core::audio::SampleBuffer;
        use symphonia::core::codecs::DecoderOptions;
        use symphonia::core::formats::FormatOptions;
        use symphonia::core::io::MediaSourceStream;
        use symphonia::core::meta::MetadataOptions;
        use symphonia::core::probe::Hint;

        let min_b = min_bpm.unwrap_or(60.0).clamp(30.0, 300.0);
        let max_b = max_bpm.unwrap_or(200.0).clamp(min_b + 10.0, 320.0);

        let file =
            std::fs::File::open(&path).map_err(|e| format!("Failed to open audio: {e}"))?;
        let mss = MediaSourceStream::new(Box::new(file), Default::default());

        let mut hint = Hint::new();
        if let Some(ext) = std::path::Path::new(&path).extension().and_then(|s| s.to_str()) {
            hint.with_extension(ext);
        }

        let probed = symphonia::default::get_probe()
            .format(
                &hint,
                mss,
                &FormatOptions::default(),
                &MetadataOptions::default(),
            )
            .map_err(|e| format!("Unsupported format: {e}"))?;

        let mut format = probed.format;
        let track = format.default_track().ok_or("No default audio track")?;
        let mut decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &DecoderOptions::default())
            .map_err(|e| format!("Codec unsupported: {e}"))?;

        let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
        let max_samples = (sample_rate as usize) * 45;
        let mut mono_samples: Vec<f32> = Vec::with_capacity(max_samples);

        while mono_samples.len() < max_samples {
            let packet = match format.next_packet() {
                Ok(packet) => packet,
                Err(symphonia::core::errors::Error::IoError(ref e))
                    if e.kind() == std::io::ErrorKind::UnexpectedEof =>
                {
                    break;
                }
                Err(_) => break,
            };

            let decoded = match decoder.decode(&packet) {
                Ok(decoded) => decoded,
                Err(_) => continue,
            };

            let spec = *decoded.spec();
            let mut sample_buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
            sample_buf.copy_interleaved_ref(decoded);
            let samples = sample_buf.samples();
            let channels = spec.channels.count();

            for frame in samples.chunks(channels) {
                let mono = frame.iter().sum::<f32>() / (channels as f32);
                mono_samples.push(mono);
                if mono_samples.len() >= max_samples {
                    break;
                }
            }
        }

        if mono_samples.is_empty() {
            return Err("No audio samples could be decoded".to_string());
        }

        let (bpm, confidence, candidates) =
            calculate_tempo_autocorr(&mono_samples, sample_rate, min_b, max_b);

        Ok(BpmResultDto {
            bpm,
            confidence,
            candidates,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}
